use rayon::prelude::*;
use std::sync::atomic::{AtomicU32, AtomicU64, Ordering};
use crate::core::balance;
use crate::core::event::{self, Event};
use crate::core::rng::Rng;
use crate::core::state::GameState;
use crate::systems::shop::{Shop, ShopAction};

const UCB_C: f64 = 1.414;
const MAX_DEPTH: u8 = 12;
const ROLLOUT_ROUNDS: u8 = 3;

fn legal_actions(shop: &Shop, state: &GameState) -> Vec<ShopAction> {
    let mut actions = vec![ShopAction::Continue];
    for i in 0..3 {
        if !shop.balls[i].sold && state.tickets >= shop.balls[i].price && state.balls.len() < crate::core::state::MAX_BALLS {
            actions.push(ShopAction::BuyBall(i));
        }
    }
    for i in 0..3 {
        if !shop.relics[i].sold && state.tickets >= shop.relics[i].price {
            actions.push(ShopAction::BuyRelic(i));
        }
    }
    if !shop.upgrade.sold && state.tickets >= shop.upgrade.price && state.upgrades.len() < crate::core::state::MAX_UPGRADES {
        actions.push(ShopAction::BuyUpgrade);
    }
    if state.tickets >= shop.reroll_cost {
        actions.push(ShopAction::Reroll);
    }
    actions
}

fn action_index(a: &ShopAction) -> usize {
    match a {
        ShopAction::Continue => 0,
        ShopAction::BuyBall(i) => 1 + i,
        ShopAction::BuyRelic(i) => 4 + i,
        ShopAction::BuyUpgrade => 7,
        ShopAction::Reroll => 8,
    }
}

fn simulate_round(mut state: GameState, rng: &mut Rng) -> GameState {
    let balls: arrayvec::ArrayVec<_, 24> = state.balls.iter().copied().collect();
    for ball in &balls {
        let pos = rng.int(0, state.segments.len() as i32 - 1) as usize;
        for slot in &ball.effects {
            if let Some(effect) = slot {
                state = effect.process(pos, state);
            }
        }
        event::trigger(Event::OnScore(pos), &mut state);
    }
    event::trigger(Event::AfterScore, &mut state);
    state
}

fn evaluate(state: &GameState) -> f64 {
    let gold = state.gold_coins as f64;
    let quota = state.quota as f64;
    if gold >= quota {
        let surplus = (gold - quota) / quota;
        1.0 + surplus.min(1.0)
    } else {
        gold / quota
    }
}

fn rollout(mut state: GameState, rng: &mut Rng, rounds_left: u8) -> f64 {
    let to_sim = rounds_left.min(ROLLOUT_ROUNDS);
    for r in 0..to_sim {
        let round = state.round + r + 1;
        if round as u32 > balance::ROUNDS_PER_RUN { break; }
        state.round = round;
        state.quota = balance::quota(round as u32);
        state = simulate_round(state, rng);

        state.tickets += balance::TICKETS_PER_ROUND;
        let shop = Shop::generate(rng);
        let (_, s) = shop.apply(ShopAction::Continue, state, rng);
        state = s;
    }
    evaluate(&state)
}

struct Node {
    visits: u32,
    total_value: f64,
    action_idx: usize,
    children: Vec<Node>,
    expanded: bool,
}

impl Node {
    fn new(action_idx: usize) -> Self {
        Self { visits: 0, total_value: 0.0, action_idx, children: Vec::new(), expanded: false }
    }

    fn avg_value(&self) -> f64 {
        if self.visits == 0 { 0.0 } else { self.total_value / self.visits as f64 }
    }

    fn ucb1(&self, parent_visits: u32) -> f64 {
        if self.visits == 0 {
            return f64::INFINITY;
        }
        self.avg_value() + UCB_C * ((parent_visits as f64).ln() / self.visits as f64).sqrt()
    }

    fn best_child_idx(&self) -> usize {
        let pv = self.visits;
        self.children.iter().enumerate()
            .max_by(|(_, a), (_, b)| a.ucb1(pv).partial_cmp(&b.ucb1(pv)).unwrap())
            .map(|(i, _)| i)
            .unwrap()
    }
}

fn expand(node: &mut Node, shop: &Shop, state: &GameState) {
    let actions = legal_actions(shop, state);
    node.children = actions.iter().map(|a| Node::new(action_index(a))).collect();
    node.expanded = true;
}

fn idx_to_action(idx: usize) -> ShopAction {
    match idx {
        0 => ShopAction::Continue,
        1..=3 => ShopAction::BuyBall(idx - 1),
        4..=6 => ShopAction::BuyRelic(idx - 4),
        7 => ShopAction::BuyUpgrade,
        8 => ShopAction::Reroll,
        _ => ShopAction::Continue,
    }
}

fn tree_policy(node: &mut Node, shop: &Shop, state: GameState, rng: &mut Rng) -> (GameState, f64) {
    if !node.expanded {
        expand(node, shop, &state);
    }

    if node.children.is_empty() {
        let rounds_left = MAX_DEPTH.saturating_sub(state.round);
        let val = rollout(state, rng, rounds_left);
        return (GameState::new(), val);
    }

    let ci = node.best_child_idx();
    let action = idx_to_action(node.children[ci].action_idx);

    let (new_shop, new_state) = shop.clone().apply(action, state, rng);
    let child = &mut node.children[ci];

    let val = if !child.expanded && !matches!(idx_to_action(child.action_idx), ShopAction::Reroll) {
        let rounds_left = MAX_DEPTH.saturating_sub(new_state.round);
        expand(child, &new_shop, &new_state);
        rollout(new_state, rng, rounds_left)
    } else if matches!(idx_to_action(child.action_idx), ShopAction::Reroll) {
        let (_, val) = tree_policy(child, &new_shop, new_state, rng);
        val
    } else {
        let rounds_left = MAX_DEPTH.saturating_sub(new_state.round);
        rollout(new_state, rng, rounds_left)
    };

    child.visits += 1;
    child.total_value += val;
    (GameState::new(), val)
}

#[derive(Debug)]
pub struct MctsResult {
    pub wins: u32,
    pub total: u32,
    pub win_rate: f64,
    pub avg_gold: f64,
    pub avg_winning_round: f64,
}

pub fn run_mcts(seed: u32, simulations: u32) -> MctsResult {
    let wins = AtomicU32::new(0);
    let total_gold = AtomicU64::new(0);
    let total_winning_round = AtomicU64::new(0);
    let total_winners = AtomicU32::new(0);

    (0..simulations).into_par_iter().for_each(|i| {
        let mut rng = Rng::new(seed.wrapping_add(i));
        let mut state = GameState::new();
        let mut first_win_round: Option<u8> = None;

        for round in 1..=balance::ROUNDS_PER_RUN as u8 {
            state.round = round;
            state.quota = balance::quota(round as u32);
            state = simulate_round(state, &mut rng);

            if first_win_round.is_none() && state.gold_coins >= state.quota {
                first_win_round = Some(round);
            }

            state.tickets += balance::TICKETS_PER_ROUND;
            let shop = Shop::generate(&mut rng);

            let mut root = Node::new(0);
            expand(&mut root, &shop, &state);

            for _ in 0..50 {
                let mut sim_rng = rng.fork();
                let (_, val) = tree_policy(&mut root, &shop, state.clone(), &mut sim_rng);
                root.visits += 1;
                root.total_value += val;
            }

            let best = root.children.iter()
                .max_by(|a, b| a.avg_value().partial_cmp(&b.avg_value()).unwrap())
                .map(|n| n.action_idx)
                .unwrap_or(0);

            let action = idx_to_action(best);
            let (_, s) = shop.apply(action, state, &mut rng);
            state = s;
        }

        if let Some(r) = first_win_round {
            wins.fetch_add(1, Ordering::Relaxed);
            total_winning_round.fetch_add(r as u64, Ordering::Relaxed);
            total_winners.fetch_add(1, Ordering::Relaxed);
        }
        total_gold.fetch_add(state.gold_coins as u64, Ordering::Relaxed);
    });

    let w = wins.load(Ordering::Relaxed);
    let tg = total_gold.load(Ordering::Relaxed);
    let tw = total_winners.load(Ordering::Relaxed);
    let twr = total_winning_round.load(Ordering::Relaxed);

    MctsResult {
        wins: w,
        total: simulations,
        win_rate: w as f64 / simulations as f64,
        avg_gold: tg as f64 / simulations as f64,
        avg_winning_round: if tw > 0 { twr as f64 / tw as f64 } else { 0.0 },
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn mcts_runs_without_panic() {
        let result = run_mcts(42, 10);
        println!("{:#?}", result);
        assert_eq!(result.total, 10);
        assert!(result.win_rate >= 0.0 && result.win_rate <= 1.0);
    }

    #[test]
    fn mcts_deterministic() {
        let r1 = run_mcts(12345, 20);
        let r2 = run_mcts(12345, 20);
        assert_eq!(r1.wins, r2.wins);
    }

    #[test]
    fn mcts_100_sims() {
        let result = run_mcts(1, 100);
        println!("100 sims: {:#?}", result);
        assert!(result.avg_gold > 0.0);
    }

    #[test]
    fn mcts_with_upgrades() {
        let mut rng = Rng::new(99);
        let mut state = GameState::new();
        state.upgrades.push(crate::items::upgrades::Upgrade::RoundEndGold);
        state.upgrades.push(crate::items::upgrades::Upgrade::TicketPerBall);

        for _ in 0..5 {
            state = simulate_round(state, &mut rng);
        }
        println!("After 5 rounds with upgrades: gold={}, tickets={}", state.gold_coins, state.tickets);
        assert!(state.gold_coins > 0 || state.tickets > 0);
    }

    #[test]
    fn mcts_with_relics() {
        let mut rng = Rng::new(77);
        let mut state = GameState::new();
        state.relics.push(crate::items::relics::RelicId::SetAllSegmentsTo20);
        event::trigger(Event::OnBuy, &mut state);

        assert!(state.segments.iter().all(|s| s.value == 20));

        state = simulate_round(state, &mut rng);
        println!("After 1 round with SetAllTo20: gold={}", state.gold_coins);
        assert!(state.gold_coins > 0);
    }

    #[test]
    fn golden_bonus_relic_fires() {
        let mut rng = Rng::new(1);
        let mut state = GameState::new();
        for seg in &mut state.segments { seg.value = 1; }
        state.relics.push(crate::items::relics::RelicId::GoldenBonus);

        let gold_before = state.gold_coins;
        state = simulate_round(state, &mut rng);
        println!("GoldenBonus test: gold={}", state.gold_coins);
        assert!(state.gold_coins > gold_before);
    }

    #[test]
    fn corruption_shield_reduces() {
        let mut state = GameState::new();
        state.relics.push(crate::items::relics::RelicId::CorruptionShield);
        let before = state.corruption;
        event::trigger(Event::AfterScore, &mut state);
        assert!(state.corruption < before);
    }

    #[test]
    fn evaluate_below_quota() {
        let mut state = GameState::new();
        state.gold_coins = 30;
        state.quota = 69;
        let v = evaluate(&state);
        assert!(v > 0.0 && v < 1.0);
        assert!((v - 30.0 / 69.0).abs() < 0.01);
    }

    #[test]
    fn evaluate_above_quota() {
        let mut state = GameState::new();
        state.gold_coins = 100;
        state.quota = 69;
        let v = evaluate(&state);
        assert!(v >= 1.0);
    }

    #[test]
    fn legal_actions_no_tickets() {
        let mut rng = Rng::new(1);
        let shop = Shop::generate(&mut rng);
        let state = GameState::new();
        let actions = legal_actions(&shop, &state);
        assert_eq!(actions.len(), 1);
        assert_eq!(action_index(&actions[0]), 0);
    }

    #[test]
    fn legal_actions_with_tickets() {
        let mut rng = Rng::new(1);
        let shop = Shop::generate(&mut rng);
        let mut state = GameState::new();
        state.tickets = 1000;
        let actions = legal_actions(&shop, &state);
        assert!(actions.len() > 1);
    }

    #[test]
    fn tree_node_ucb1_unexplored() {
        let n = Node::new(0);
        assert_eq!(n.ucb1(10), f64::INFINITY);
    }

    #[test]
    fn mcts_10k_sims() {
        let result = run_mcts(1, 10_000);
        println!("10k sims: {:#?}", result);
        assert!(result.avg_gold > 0.0);
    }

    #[test]
    fn mcts_100k_sims() {
        let result = run_mcts(1, 100_000);
        println!("100k sims: {:#?}", result);
        assert!(result.avg_gold > 0.0);
    }

    #[test]
    fn full_game_with_shop() {
        let mut rng = Rng::new(555);
        let mut state = GameState::new();

        for round in 1..=balance::ROUNDS_PER_RUN as u8 {
            state.round = round;
            state.quota = balance::quota(round as u32);
            state = simulate_round(state, &mut rng);

            state.tickets += balance::TICKETS_PER_ROUND;
            let shop = Shop::generate(&mut rng);
            let (_, s) = shop.apply(ShopAction::BuyBall(0), state, &mut rng);
            state = s;
        }
        println!("Full game: gold={}, balls={}, round={}", state.gold_coins, state.balls.len(), state.round);
        assert!(state.balls.len() > 5);
    }
}
