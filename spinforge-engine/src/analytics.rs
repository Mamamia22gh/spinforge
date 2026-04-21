use rayon::prelude::*;
use std::collections::HashMap;

use crate::core::balance;
use crate::core::event::{self, Event};
use crate::core::rng::Rng;
use crate::core::state::GameState;
use crate::items::balls::BallEffect;
use crate::items::relics::RelicId;
use crate::items::upgrades::Upgrade;
use crate::systems::shop::{Shop, ShopAction, ShopItem};

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

fn simulate_round(mut state: GameState, rng: &mut Rng) -> GameState {
    let balls: Vec<_> = state.balls.iter().copied().collect();
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

fn legal_actions(shop: &Shop, state: &GameState) -> Vec<ShopAction> {
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

fn run_logged_game(seed: u32) -> GameLog {
    let mut rng = Rng::new(seed);
    let mut state = GameState::new();
    let mut log = GameLog::default();

    for round in 1..=balance::ROUNDS_PER_RUN as u8 {
        state.round = round;
        state.quota = balance::quota(round as u32);
        state = simulate_round(state, &mut rng);

        log.gold_per_round.push(state.gold_coins);
        log.tickets_per_round.push(state.tickets);

        if log.winning_round.is_none() && state.gold_coins >= state.quota {
            log.winning_round = Some(round);
        }

        state.tickets += balance::TICKETS_PER_ROUND;
        let shop = Shop::generate(&mut rng);

        // MCTS-driven shop decisions (simplified: greedy best action via short tree search)
        let mut current_shop = shop;
        loop {
            let actions = legal_actions(&current_shop, &state);
            if actions.len() == 1 { break; } // only Continue

            // mini MCTS: 30 rollouts per action
            let mut best_action_idx = 0;
            let mut best_value = f64::NEG_INFINITY;

            for action in &actions {
                let ai = action_index(action);
                let mut total = 0.0;
                let n = 30;
                for _ in 0..n {
                    let mut sim_rng = rng.fork();
                    let (_, sim_state) = current_shop.clone().apply(idx_to_action(ai), state.clone(), &mut sim_rng);
                    // rollout 3 rounds
                    let mut s = sim_state;
                    for r in 0..3u8 {
                        let nr = state.round + r + 1;
                        if nr as u32 > balance::ROUNDS_PER_RUN { break; }
                        s.round = nr;
                        s.quota = balance::quota(nr as u32);
                        s = simulate_round(s, &mut sim_rng);
                        s.tickets += balance::TICKETS_PER_ROUND;
                        let sh = Shop::generate(&mut sim_rng);
                        let (_, ns) = sh.apply(ShopAction::Continue, s, &mut sim_rng);
                        s = ns;
                    }
                    let gold = s.gold_coins as f64;
                    let quota = s.quota as f64;
                    total += if gold >= quota { 1.0 + ((gold - quota) / quota).min(1.0) } else { gold / quota };
                }
                let avg = total / n as f64;
                if avg > best_value {
                    best_value = avg;
                    best_action_idx = ai;
                }
            }

            let action = idx_to_action(best_action_idx);
            let is_continue = matches!(action, ShopAction::Continue);

            // Log purchase
            match &action {
                ShopAction::BuyBall(i) => log.purchases.push(current_shop.balls[*i].item.clone()),
                ShopAction::BuyRelic(i) => log.purchases.push(current_shop.relics[*i].item.clone()),
                ShopAction::BuyUpgrade => log.purchases.push(current_shop.upgrade.item.clone()),
                _ => {}
            }

            let (s, st) = current_shop.apply(action, state, &mut rng);
            current_shop = s;
            state = st;

            if is_continue { break; }
        }
    }

    log.final_gold = state.gold_coins;
    log.won = log.winning_round.is_some();
    log.final_balls = state.balls.iter().map(|b| b.effects[0].unwrap_or(BallEffect::ScoreOnce)).collect();
    log.final_relics = state.relics.clone();
    log.final_upgrades = state.upgrades.iter().copied().collect();
    log
}

#[derive(Debug)]
pub struct MetaReport {
    pub total_games: u32,
    pub win_rate: f64,
    pub avg_gold: f64,
    pub item_buy_rates: Vec<(String, u32, f64)>,       // (item, count, avg_gold_when_bought)
    pub relic_win_rates: Vec<(String, u32, f64)>,       // (relic, games_with, win_rate)
    pub upgrade_win_rates: Vec<(String, u32, f64)>,     // (upgrade, games_with, win_rate)
    pub ball_win_rates: Vec<(String, u32, f64)>,        // (ball, games_with, win_rate)
    pub top_combos: Vec<(String, u32, f64)>,            // (combo, count, win_rate)
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

    // Item purchase frequency + avg gold
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

    // Per-relic win rates
    let all_relics = [RelicId::SetAllSegmentsTo20, RelicId::SetAllSegmentsTo19, RelicId::GoldenBonus, RelicId::CorruptionShield];
    let relic_win_rates: Vec<(String, u32, f64)> = all_relics.iter().map(|r| {
        let with: Vec<_> = logs.iter().filter(|l| l.final_relics.contains(r)).collect();
        let count = with.len() as u32;
        let wr = if count > 0 { with.iter().filter(|l| l.won).count() as f64 / count as f64 } else { 0.0 };
        (format!("{:?}", r), count, wr)
    }).collect();

    // Per-upgrade win rates
    let all_upgrades = [Upgrade::TicketPerBall, Upgrade::BuyDiscount, Upgrade::RoundEndGold];
    let upgrade_win_rates: Vec<(String, u32, f64)> = all_upgrades.iter().map(|u| {
        let with: Vec<_> = logs.iter().filter(|l| l.final_upgrades.contains(u)).collect();
        let count = with.len() as u32;
        let wr = if count > 0 { with.iter().filter(|l| l.won).count() as f64 / count as f64 } else { 0.0 };
        (format!("{:?}", u), count, wr)
    }).collect();

    // Per-ball-effect win rates
    let all_effects = [BallEffect::ScoreOnce, BallEffect::ScoreDouble, BallEffect::ScoreAdjacent, BallEffect::ScoreTickets];
    let ball_win_rates: Vec<(String, u32, f64)> = all_effects.iter().map(|e| {
        let with: Vec<_> = logs.iter().filter(|l| l.final_balls.contains(e)).collect();
        let count = with.len() as u32;
        let wr = if count > 0 { with.iter().filter(|l| l.won).count() as f64 / count as f64 } else { 0.0 };
        (format!("{:?}", e), count, wr)
    }).collect();

    // Top 2-item combos (relics+upgrades)
    let mut combo_stats: HashMap<String, (u32, u32)> = HashMap::new(); // (games, wins)
    for log in &logs {
        let mut items: Vec<String> = Vec::new();
        for r in &log.final_relics { items.push(format!("R:{:?}", r)); }
        for u in &log.final_upgrades { items.push(format!("U:{:?}", u)); }
        items.sort();
        items.dedup();
        // all pairs
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
        avg_gold: avg_gold,
        item_buy_rates,
        relic_win_rates,
        upgrade_win_rates,
        ball_win_rates,
        top_combos,
        avg_purchases_per_game: total_purchases as f64 / total as f64,
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn analyze_1k() {
        let report = analyze_metas(42, 1_000);
        println!("\n============================================================");
        println!("=== META ANALYSIS — {} games ===", report.total_games);
        println!("Win rate: {:.1}%", report.win_rate * 100.0);
        println!("Avg gold: {:.0}", report.avg_gold);
        println!("Avg purchases/game: {:.1}", report.avg_purchases_per_game);

        println!("\n--- Item Purchase Frequency (count | avg gold when bought) ---");
        for (name, count, avg_g) in &report.item_buy_rates {
            println!("  {:<40} {:>5}x  avg_gold={:.0}", name, count, avg_g);
        }

        println!("\n--- Relic Win Rates ---");
        for (name, count, wr) in &report.relic_win_rates {
            println!("  {:<30} {:>5} games  {:.1}% win", name, count, wr * 100.0);
        }

        println!("\n--- Upgrade Win Rates ---");
        for (name, count, wr) in &report.upgrade_win_rates {
            println!("  {:<30} {:>5} games  {:.1}% win", name, count, wr * 100.0);
        }

        println!("\n--- Ball Effect Win Rates ---");
        for (name, count, wr) in &report.ball_win_rates {
            println!("  {:<30} {:>5} games  {:.1}% win", name, count, wr * 100.0);
        }

        println!("\n--- Top Combos (min 10 games) ---");
        for (name, count, wr) in &report.top_combos {
            println!("  {:<55} {:>4} games  {:.1}% win", name, count, wr * 100.0);
        }
    }

    #[test]
    fn analyze_10k() {
        let report = analyze_metas(1, 10_000);
        println!("\n=== META ANALYSIS — {} games ===", report.total_games);
        println!("Win rate: {:.1}%", report.win_rate * 100.0);
        println!("Avg gold: {:.0}", report.avg_gold);
        println!("Avg purchases/game: {:.1}", report.avg_purchases_per_game);

        println!("\n--- Item Purchase Frequency ---");
        for (name, count, avg_g) in &report.item_buy_rates {
            println!("  {:<40} {:>6}x  avg_gold={:.0}", name, count, avg_g);
        }

        println!("\n--- Relic Win Rates ---");
        for (name, count, wr) in &report.relic_win_rates {
            println!("  {:<30} {:>6} games  {:.1}% win", name, count, wr * 100.0);
        }

        println!("\n--- Upgrade Win Rates ---");
        for (name, count, wr) in &report.upgrade_win_rates {
            println!("  {:<30} {:>6} games  {:.1}% win", name, count, wr * 100.0);
        }

        println!("\n--- Ball Effect Win Rates ---");
        for (name, count, wr) in &report.ball_win_rates {
            println!("  {:<30} {:>6} games  {:.1}% win", name, count, wr * 100.0);
        }

        println!("\n--- Top Combos ---");
        for (name, count, wr) in &report.top_combos {
            println!("  {:<55} {:>5} games  {:.1}% win", name, count, wr * 100.0);
        }
    }
}
