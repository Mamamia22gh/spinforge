use rayon::prelude::*;
use std::collections::HashMap;

use crate::core::balance;
use crate::core::rng::Rng;
use crate::core::state::GameState;
use crate::items::balls::BallEffect;
use crate::items::relics::RelicId;
use crate::items::upgrades::Upgrade;
use crate::systems::shop::{Shop, ShopAction, ShopItem};
use crate::sim;

#[derive(Clone, Debug, Default)]
struct GameLog {
    purchases: Vec<ShopItem>,
    gold_per_round: Vec<u32>,
    tickets_per_round: Vec<u32>,
    final_gold: u32,
    won: bool,
    winning_round: Option<u8>,
    final_balls: Vec<BallEffect>,
    final_relics: Vec<RelicId>,
    final_upgrades: Vec<Upgrade>,
}

fn run_logged_game(seed: u32) -> GameLog {
    let mut rng = Rng::new(seed);
    let mut state = GameState::new();
    let mut log = GameLog::default();

    for round in 1..=balance::ROUNDS_PER_RUN as u8 {
        state.round = round;
        state.quota = balance::quota(round as u32);
        state = sim::simulate_round(state, &mut rng);

        log.gold_per_round.push(state.gold_coins);
        log.tickets_per_round.push(state.tickets);

        if log.winning_round.is_none() && state.gold_coins >= state.quota {
            log.winning_round = Some(round);
        }

        state.tickets += balance::TICKETS_PER_ROUND;
        sim::check_deals(&mut state, &mut rng);
        let shop = Shop::generate(&mut rng);

        // Snapshot shop offerings before MCTS consumes them
        let ball_items: Vec<_> = shop.balls.iter().map(|s| s.item.clone()).collect();
        let relic_items: Vec<_> = shop.relics.iter().map(|s| s.item.clone()).collect();
        let upgrade_item = shop.upgrade.item.clone();
        let balls_sold_before: Vec<_> = shop.balls.iter().map(|s| s.sold).collect();
        let relics_sold_before: Vec<_> = shop.relics.iter().map(|s| s.sold).collect();
        let upgrade_sold_before = shop.upgrade.sold;

        let (final_shop, mut new_state) = sim::mcts_shop_loop(shop, state, &mut rng);

        // Diff to find purchases
        for i in 0..3 {
            if !balls_sold_before[i] && final_shop.balls[i].sold {
                log.purchases.push(ball_items[i].clone());
            }
        }
        for i in 0..3 {
            if !relics_sold_before[i] && final_shop.relics[i].sold {
                log.purchases.push(relic_items[i].clone());
            }
        }
        if !upgrade_sold_before && final_shop.upgrade.sold {
            log.purchases.push(upgrade_item.clone());
        }

        state = new_state;
    }

    log.final_gold = state.gold_coins;
    log.won = log.winning_round.is_some();
    log.final_balls = state.balls.iter().map(|b| b.effects[0].unwrap_or(BallEffect::ScoreOnce)).collect();
    log.final_relics = state.relics.clone();
    log.final_upgrades = state.upgrades.iter().map(|&(u, _)| u).collect();
    log
}

#[derive(Debug)]
pub struct MetaReport {
    pub total_games: u32,
    pub win_rate: f64,
    pub avg_gold: f64,
    pub item_buy_rates: Vec<(String, u32, f64)>,
    pub relic_win_rates: Vec<(String, u32, f64)>,
    pub upgrade_win_rates: Vec<(String, u32, f64)>,
    pub ball_win_rates: Vec<(String, u32, f64)>,
    pub top_combos: Vec<(String, u32, f64)>,
    pub avg_purchases_per_game: f64,
}

pub fn analyze_metas(seed: u32, n: u32) -> MetaReport {
    let logs: Vec<GameLog> = (0..n).into_par_iter()
        .map(|i| run_logged_game(seed.wrapping_add(i)))
        .collect();

    let total = logs.len() as u32;
    let wins = logs.iter().filter(|l| l.won).count() as u32;
    let avg_gold = logs.iter().map(|l| l.final_gold as f64).sum::<f64>() / total as f64;
    let total_purchases: usize = logs.iter().map(|l| l.purchases.len()).sum();

    let mut item_stats: HashMap<String, (u32, f64)> = HashMap::new();
    for log in &logs {
        for p in &log.purchases {
            let name = format!("{:?}", p);
            let e = item_stats.entry(name).or_insert((0, 0.0));
            e.0 += 1;
            e.1 += log.final_gold as f64;
        }
    }
    let mut item_buy_rates: Vec<(String, u32, f64)> = item_stats.into_iter()
        .map(|(name, (count, gold))| (name, count, gold / count as f64))
        .collect();
    item_buy_rates.sort_by(|a, b| b.1.cmp(&a.1));

    let all_relics = [RelicId::SetAllSegmentsTo20, RelicId::SetAllSegmentsTo19, RelicId::GoldenBonus, RelicId::CorruptionShield];
    let relic_win_rates: Vec<(String, u32, f64)> = all_relics.iter().map(|r| {
        let with: Vec<_> = logs.iter().filter(|l| l.final_relics.contains(r)).collect();
        let count = with.len() as u32;
        let wr = if count > 0 { with.iter().filter(|l| l.won).count() as f64 / count as f64 } else { 0.0 };
        (format!("{:?}", r), count, wr)
    }).collect();

    let all_upgrades = [Upgrade::TicketPerBall, Upgrade::BuyDiscount, Upgrade::RoundEndGold];
    let upgrade_win_rates: Vec<(String, u32, f64)> = all_upgrades.iter().map(|u| {
        let with: Vec<_> = logs.iter().filter(|l| l.final_upgrades.contains(u)).collect();
        let count = with.len() as u32;
        let wr = if count > 0 { with.iter().filter(|l| l.won).count() as f64 / count as f64 } else { 0.0 };
        (format!("{:?}", u), count, wr)
    }).collect();

    let all_effects = [BallEffect::ScoreOnce, BallEffect::ScoreDouble, BallEffect::ScoreAdjacent, BallEffect::ScoreTickets];
    let ball_win_rates: Vec<(String, u32, f64)> = all_effects.iter().map(|e| {
        let with: Vec<_> = logs.iter().filter(|l| l.final_balls.contains(e)).collect();
        let count = with.len() as u32;
        let wr = if count > 0 { with.iter().filter(|l| l.won).count() as f64 / count as f64 } else { 0.0 };
        (format!("{:?}", e), count, wr)
    }).collect();

    let mut combo_stats: HashMap<String, (u32, u32)> = HashMap::new();
    for log in &logs {
        let mut items: Vec<String> = Vec::new();
        for r in &log.final_relics { items.push(format!("R:{:?}", r)); }
        for u in &log.final_upgrades { items.push(format!("U:{:?}", u)); }
        items.sort();
        items.dedup();
        for i in 0..items.len() {
            for j in (i+1)..items.len() {
                let combo = format!("{} + {}", items[i], items[j]);
                let e = combo_stats.entry(combo).or_insert((0, 0));
                e.0 += 1;
                if log.won { e.1 += 1; }
            }
        }
    }
    let mut top_combos: Vec<(String, u32, f64)> = combo_stats.into_iter()
        .filter(|(_, (count, _))| *count >= 10)
        .map(|(name, (count, wins))| (name, count, wins as f64 / count as f64))
        .collect();
    top_combos.sort_by(|a, b| b.2.partial_cmp(&a.2).unwrap());
    top_combos.truncate(15);

    MetaReport {
        total_games: total,
        win_rate: wins as f64 / total as f64,
        avg_gold,
        item_buy_rates,
        relic_win_rates,
        upgrade_win_rates,
        ball_win_rates,
        top_combos,
        avg_purchases_per_game: total_purchases as f64 / total as f64,
    }
}


