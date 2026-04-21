use crate::core::balance;
use crate::core::event::{self, Event};
use crate::core::rng::Rng;
use crate::core::state::GameState;
use crate::systems::shop::{Shop, ShopAction};
use crate::deals;

pub const UCB_C: f64 = 1.414;
pub const MCTS_ITERATIONS: u32 = 50;
pub const ROLLOUT_ROUNDS: u8 = 3;

pub fn simulate_round(mut state: GameState, rng: &mut Rng) -> GameState {
    let balls: Vec<_> = state.balls.iter().copied().collect();
    for ball in &balls {
        let pos = rng.int(0, state.segments.len() as i32 - 1) as usize;
        for slot in &ball.effects {
            if let Some(effect) = slot {
                state = effect.process(pos, state);
            }
        }
        let _ = event::trigger(Event::OnScore(pos), &mut state);
    }
    let _ = event::trigger(Event::AfterScore, &mut state);
    state
}

pub fn maybe_respin(mut state: GameState, rng: &mut Rng) -> GameState {
    if state.gold_coins < state.quota && state.respin_available {
        state.respin_available = false;
        state = simulate_round(state, rng);
    }
    state
}

pub fn evaluate(state: &GameState) -> f64 {
    let gold = state.gold_coins as f64;
    let quota = state.quota as f64;
    if gold >= quota {
        let surplus = (gold - quota) / quota;
        1.0 + surplus.min(1.0)
    } else {
        gold / quota
    }
}

pub fn legal_actions(shop: &Shop, state: &GameState) -> Vec<ShopAction> {
    let mut actions = vec![ShopAction::Continue];
    for i in 0..3 {
        if !shop.balls[i].sold && state.tickets >= shop.balls[i].price && !state.balls.is_full() {
            actions.push(ShopAction::BuyBall(i));
        }
    }
    for i in 0..3 {
        if !shop.relics[i].sold && state.tickets >= shop.relics[i].price {
            actions.push(ShopAction::BuyRelic(i));
        }
    }
    if !shop.upgrade.sold && state.tickets >= shop.upgrade.price && !state.upgrades.is_full() {
        actions.push(ShopAction::BuyUpgrade);
    }
    if state.tickets >= shop.reroll_cost {
        actions.push(ShopAction::Reroll);
    }
    if !state.balls.is_empty() {
        actions.push(ShopAction::SellBall);
    }
    for i in 0..state.upgrades.len() {
        actions.push(ShopAction::SellUpgrade(i));
    }
    actions
}

pub fn action_index(a: &ShopAction) -> usize {
    match a {
        ShopAction::Continue => 0,
        ShopAction::BuyBall(i) => 1 + i,
        ShopAction::BuyRelic(i) => 4 + i,
        ShopAction::BuyUpgrade => 7,
        ShopAction::Reroll => 8,
        ShopAction::SellBall => 9,
        ShopAction::SellUpgrade(i) => 10 + i,
    }
}

pub fn idx_to_action(idx: usize) -> ShopAction {
    match idx {
        0 => ShopAction::Continue,
        1..=3 => ShopAction::BuyBall(idx - 1),
        4..=6 => ShopAction::BuyRelic(idx - 4),
        7 => ShopAction::BuyUpgrade,
        8 => ShopAction::Reroll,
        9 => ShopAction::SellBall,
        10..=17 => ShopAction::SellUpgrade(idx - 10),
        _ => ShopAction::Continue,
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
        state = maybe_respin(state, rng);
        state.tickets += balance::TICKETS_PER_ROUND;
        check_deals(&mut state, rng);
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
        if self.visits == 0 { return f64::INFINITY; }
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

fn tree_policy(node: &mut Node, shop: &Shop, state: GameState, rng: &mut Rng) -> f64 {
    if !node.expanded {
        expand(node, shop, &state);
    }
    if node.children.is_empty() {
        let rounds_left = (balance::ROUNDS_PER_RUN as u8).saturating_sub(state.round);
        return rollout(state, rng, rounds_left);
    }

    let ci = node.best_child_idx();
    let action = idx_to_action(node.children[ci].action_idx);
    let (new_shop, new_state) = shop.clone().apply(action, state, rng);
    let child = &mut node.children[ci];

    let val = if !child.expanded && !matches!(idx_to_action(child.action_idx), ShopAction::Reroll) {
        let rounds_left = (balance::ROUNDS_PER_RUN as u8).saturating_sub(new_state.round);
        expand(child, &new_shop, &new_state);
        rollout(new_state, rng, rounds_left)
    } else if matches!(idx_to_action(child.action_idx), ShopAction::Reroll) {
        tree_policy(child, &new_shop, new_state, rng)
    } else {
        let rounds_left = (balance::ROUNDS_PER_RUN as u8).saturating_sub(new_state.round);
        rollout(new_state, rng, rounds_left)
    };

    child.visits += 1;
    child.total_value += val;
    val
}

/// Check and apply deals after shop. Track zero-corruption rounds.
/// Generates 3 offerings and picks the best one via quick evaluation.
pub fn check_deals(state: &mut GameState, rng: &mut Rng) {
    if deals::check_devil_deal(state) {
        let offering = deals::generate_devil_offering(rng);
        if let deals::DealOffering::Devil(offers) = offering {
            let best = (0..3)
                .max_by(|&a, &b| {
                    let mut sa = state.clone();
                    let mut ra = rng.fork();
                    deals::apply_devil_choice(&mut sa, &offers[a], &mut ra);
                    let mut sb = state.clone();
                    let mut rb = rng.fork();
                    deals::apply_devil_choice(&mut sb, &offers[b], &mut rb);
                    evaluate(&sa).partial_cmp(&evaluate(&sb)).unwrap()
                })
                .unwrap();
            deals::apply_devil_choice(state, &offers[best], rng);
        }
        state.zero_corruption_rounds = 0;
    } else if state.corruption == 0.0 {
        state.zero_corruption_rounds += 1;
        if deals::check_angel_deal(state) {
            let offering = deals::generate_angel_offering(rng);
            if let deals::DealOffering::Angel(blessings) = offering {
                let best = (0..3)
                    .max_by(|&a, &b| {
                        let mut sa = state.clone();
                        deals::apply_angel_choice(&mut sa, blessings[a]);
                        let mut sb = state.clone();
                        deals::apply_angel_choice(&mut sb, blessings[b]);
                        evaluate(&sa).partial_cmp(&evaluate(&sb)).unwrap()
                    })
                    .unwrap();
                deals::apply_angel_choice(state, blessings[best]);
            }
        }
    } else {
        state.zero_corruption_rounds = 0;
    }
}

/// Run full MCTS shop decision loop: picks actions until Continue using UCB1 tree search.
pub fn mcts_shop_loop(mut shop: Shop, mut state: GameState, rng: &mut Rng) -> (Shop, GameState) {
    loop {
        let mut root = Node::new(0);
        expand(&mut root, &shop, &state);

        if root.children.len() <= 1 {
            break;
        }

        for _ in 0..MCTS_ITERATIONS {
            let mut sim_rng = rng.fork();
            let val = tree_policy(&mut root, &shop, state.clone(), &mut sim_rng);
            root.visits += 1;
            root.total_value += val;
        }

        let best = root.children.iter()
            .max_by(|a, b| a.avg_value().partial_cmp(&b.avg_value()).unwrap())
            .map(|n| n.action_idx)
            .unwrap_or(0);

        let action = idx_to_action(best);
        let is_continue = matches!(action, ShopAction::Continue);
        let (s, st) = shop.apply(action, state, rng);
        shop = s;
        state = st;
        if is_continue { break; }
    }
    (shop, state)
}

#[cfg(test)]
mod tests {
    use super::*;

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
        assert_eq!(actions.len(), 2); // Continue + SellBall (5 starting balls)
        assert_eq!(action_index(&actions[0]), 0); // Continue
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
    fn shop_loop_runs() {
        let mut rng = Rng::new(42);
        let mut state = GameState::new();
        state.tickets = 100;
        let shop = Shop::generate(&mut rng);
        let (_, new_state) = mcts_shop_loop(shop, state, &mut rng);
        assert!(new_state.tickets <= 100);
    }
}
