use crate::core::balance;
use crate::core::event::{self, Event};
use crate::core::rng::Rng;
use crate::core::state::GameState;
use crate::systems::shop::{Shop, ShopAction};

fn simulate_round_owned(mut state: GameState, rng: &mut Rng) -> GameState {
    let balls: arrayvec::ArrayVec<_, 16> = state.balls.iter().copied().collect();
    for ball in &balls {
        let pos = rng.int(0, state.segments.len() as i32 - 1) as usize;
        for effect_slot in &ball.effects {
            if let Some(effect) = effect_slot {
                state = effect.process(pos, state);
            }
        }
        event::trigger(Event::OnScore(pos), &mut state);
    }
    event::trigger(Event::AfterScore, &mut state);
    state
}

fn simulate_shop(state: GameState, rng: &mut Rng) -> GameState {
    let shop = Shop::generate(rng);
    let (_, state) = shop.apply(ShopAction::Continue, state, rng);
    state
}

#[derive(Debug)]
pub struct MctsResult {
    pub wins: u32,
    pub total: u32,
    pub win_rate: f64,
    pub avg_gold: f64,
    pub avg_rounds_survived: f64,
}

pub fn run_mcts(seed: u32, simulations: u32) -> MctsResult {
    let mut wins = 0u32;
    let mut total_gold = 0u64;
    let mut total_rounds = 0u64;

    for i in 0..simulations {
        let mut rng = Rng::new(seed.wrapping_add(i));
        let state = GameState::new();
        let mut state = state;

        let mut final_round = balance::ROUNDS_PER_RUN as u8;
        let mut won = false;

        for round in 1..=balance::ROUNDS_PER_RUN as u8 {
            state.round = round;
            state.quota = balance::quota(round as u32);
            state = simulate_round_owned(state, &mut rng);

            if state.gold_coins >= state.quota {
                won = true;
                final_round = round;
                break;
            }

            state.tickets += balance::TICKETS_PER_ROUND;
            state = simulate_shop(state, &mut rng);
        }

        if won { wins += 1; }
        total_gold += state.gold_coins as u64;
        total_rounds += final_round as u64;
    }

    MctsResult {
        wins,
        total: simulations,
        win_rate: wins as f64 / simulations as f64,
        avg_gold: total_gold as f64 / simulations as f64,
        avg_rounds_survived: total_rounds as f64 / simulations as f64,
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn mcts_runs_without_panic() {
        let result = run_mcts(42, 100);
        println!("{:#?}", result);
        assert_eq!(result.total, 100);
        assert!(result.win_rate >= 0.0 && result.win_rate <= 1.0);
    }

    #[test]
    fn mcts_deterministic() {
        let r1 = run_mcts(12345, 50);
        let r2 = run_mcts(12345, 50);
        assert_eq!(r1.wins, r2.wins);
        assert_eq!(r1.avg_gold, r2.avg_gold);
    }

    #[test]
    fn mcts_1000_sims() {
        let result = run_mcts(1, 1000);
        println!("1000 sims: {:#?}", result);
        assert!(result.avg_gold > 0.0);
    }

    #[test]
    fn mcts_with_upgrades() {
        let mut rng = Rng::new(99);
        let mut state = GameState::new();
        state.upgrades.push(crate::items::upgrades::Upgrade::RoundEndGold);
        state.upgrades.push(crate::items::upgrades::Upgrade::TicketPerBall);

        for _ in 0..5 {
            state = simulate_round_owned(state, &mut rng);
        }
        println!("After 5 rounds with upgrades: gold={}, tickets={}", state.gold_coins, state.tickets);
        assert!(state.gold_coins > 0 || state.tickets > 0);
    }

    #[test]
    fn mcts_with_relics() {
        let mut rng = Rng::new(77);
        let mut state = GameState::new();
        state.relics.push_back(crate::items::relics::RelicId::SetAllSegmentsTo20);
        event::trigger(Event::OnBuy, &mut state);

        assert!(state.segments.iter().all(|s| s.value == 20));

        state = simulate_round_owned(state, &mut rng);
        println!("After 1 round with SetAllTo20: gold={}", state.gold_coins);
        assert!(state.gold_coins > 0);
    }

    #[test]
    fn golden_bonus_relic_fires() {
        let mut rng = Rng::new(1);
        let mut state = GameState::new();
        for seg in &mut state.segments { seg.value = 1; }
        state.relics.push_back(crate::items::relics::RelicId::GoldenBonus);

        let gold_before = state.gold_coins;
        state = simulate_round_owned(state, &mut rng);
        println!("GoldenBonus test: gold={}", state.gold_coins);
        assert!(state.gold_coins > gold_before);
    }

    #[test]
    fn corruption_shield_reduces() {
        let mut state = GameState::new();
        state.relics.push_back(crate::items::relics::RelicId::CorruptionShield);
        let before = state.corruption;
        event::trigger(Event::AfterScore, &mut state);
        assert!(state.corruption < before);
    }

    #[test]
    fn mcts_10k_sims() {
        let result = run_mcts(42, 10_000);
        println!("10k sims: {:#?}", result);
        assert_eq!(result.total, 10_000);
        assert!(result.avg_gold > 0.0);
    }

    #[test]
    fn full_game_with_shop() {
        let mut rng = Rng::new(555);
        let mut state = GameState::new();

        for round in 1..=balance::ROUNDS_PER_RUN as u8 {
            state.round = round;
            state.quota = balance::quota(round as u32);
            state = simulate_round_owned(state, &mut rng);

            state.tickets += balance::TICKETS_PER_ROUND;
            let shop = Shop::generate(&mut rng);
            let (_, s) = shop.apply(ShopAction::BuyBall(0), state, &mut rng);
            state = s;
        }
        println!("Full game: gold={}, balls={}, round={}", state.gold_coins, state.balls.len(), state.round);
        assert!(state.balls.len() > 5);
    }
}
