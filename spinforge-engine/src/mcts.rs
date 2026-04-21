use rayon::prelude::*;
use std::sync::atomic::{AtomicU32, AtomicU64, Ordering};
use crate::core::balance;
use crate::core::rng::Rng;
use crate::core::state::GameState;
use crate::systems::shop::Shop;
use crate::sim;

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
            state = sim::simulate_round(state, &mut rng);

            if first_win_round.is_none() && state.gold_coins >= state.quota {
                first_win_round = Some(round);
            }

            state.tickets += balance::TICKETS_PER_ROUND;
            let shop = Shop::generate(&mut rng);
            let (_, st) = sim::mcts_shop_loop(shop, state, &mut rng);
            state = st;
            sim::check_deals(&mut state, &mut rng);
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
    use crate::core::event::{self, Event};

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
        state.upgrades.push((crate::items::upgrades::Upgrade::RoundEndGold, 0));
        state.upgrades.push((crate::items::upgrades::Upgrade::TicketPerBall, 0));

        for _ in 0..5 {
            state = sim::simulate_round(state, &mut rng);
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

        state = sim::simulate_round(state, &mut rng);
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
        state = sim::simulate_round(state, &mut rng);
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
            state = sim::simulate_round(state, &mut rng);

            state.tickets += balance::TICKETS_PER_ROUND;
            let shop = Shop::generate(&mut rng);
            let (_, s) = shop.apply(crate::systems::shop::ShopAction::BuyBall(0), state, &mut rng);
            state = s;
        }
        println!("Full game: gold={}, balls={}, round={}", state.gold_coins, state.balls.len(), state.round);
        assert!(state.balls.len() > 5);
    }
}
