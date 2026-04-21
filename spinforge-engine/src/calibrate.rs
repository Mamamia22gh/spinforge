use rayon::prelude::*;
use crate::core::balance;
use crate::core::event::{self, Event};
use crate::core::rng::Rng;
use crate::core::state::GameState;
use crate::systems::shop::{Shop, ShopAction};

const ROUNDS: usize = 15;

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

fn random_shop_action(shop: &Shop, state: &GameState, rng: &mut Rng) -> ShopAction {
    let mut actions = vec![];
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
    if actions.is_empty() {
        ShopAction::Continue
    } else {
        let idx = rng.int(0, actions.len() as i32 - 1) as usize;
        actions.swap_remove(idx)
    }
}

/// Run N games, collect gold after each round. Returns [N][15] gold values.
fn collect_gold_distributions(seed: u32, n: u32) -> Vec<[u32; ROUNDS]> {
    (0..n).into_par_iter().map(|i| {
        let mut rng = Rng::new(seed.wrapping_add(i));
        let mut state = GameState::new();
        let mut golds = [0u32; ROUNDS];

        for round in 1..=ROUNDS as u8 {
            state.round = round;
            state.quota = 999_999; // irrelevant for collection
            state = simulate_round(state, &mut rng);
            golds[round as usize - 1] = state.gold_coins;

            // random shop spending
            state.tickets += balance::TICKETS_PER_ROUND;
            let mut shop = Shop::generate(&mut rng);
            loop {
                let action = random_shop_action(&shop, &state, &mut rng);
                let is_cont = matches!(action, ShopAction::Continue);
                let (s, st) = shop.apply(action, state, &mut rng);
                shop = s;
                state = st;
                if is_cont { break; }
            }
        }
        golds
    }).collect()
}

/// Given gold distributions and target win rates, compute quotas as percentiles.
fn compute_quotas(distributions: &[[u32; ROUNDS]], targets: &[f64; ROUNDS]) -> [u32; ROUNDS] {
    let n = distributions.len();
    let mut quotas = [0u32; ROUNDS];

    for r in 0..ROUNDS {
        let mut golds: Vec<u32> = distributions.iter().map(|g| g[r]).collect();
        golds.sort_unstable();

        // target win rate = fraction that should pass
        // So quota = percentile at (1 - win_rate) from bottom
        // e.g. 95% win rate → quota = 5th percentile
        let percentile_idx = ((1.0 - targets[r]) * n as f64).round() as usize;
        let idx = percentile_idx.min(n - 1);
        quotas[r] = golds[idx];
    }
    quotas
}

/// Iterative calibration: run sims, set quotas, repeat until stable.
pub fn calibrate(seed: u32, n: u32, iterations: u8) -> [u32; ROUNDS] {
    // Linear target from 95% (round 1) to 30% (round 15)
    let mut targets = [0.0f64; ROUNDS];
    for r in 0..ROUNDS {
        targets[r] = 0.95 - (0.95 - 0.30) * (r as f64 / (ROUNDS - 1) as f64);
    }

    println!("Target win rates:");
    for (r, t) in targets.iter().enumerate() {
        println!("  Round {:2}: {:.1}%", r + 1, t * 100.0);
    }

    let mut quotas = [0u32; ROUNDS];

    for iter in 0..iterations {
        println!("\n=== Iteration {} ===", iter + 1);
        let distributions = collect_gold_distributions(seed, n);
        quotas = compute_quotas(&distributions, &targets);

        println!("Quotas: {:?}", quotas);

        // Verify: measure actual win rates with these quotas
        let mut wins = [0u32; ROUNDS];
        for golds in &distributions {
            for r in 0..ROUNDS {
                if golds[r] >= quotas[r] {
                    wins[r] += 1;
                }
            }
        }
        println!("Actual win rates:");
        for r in 0..ROUNDS {
            let rate = wins[r] as f64 / distributions.len() as f64 * 100.0;
            println!("  Round {:2}: {:6.2}% (target {:.1}%, quota {})", r + 1, rate, targets[r] * 100.0, quotas[r]);
        }
    }
    quotas
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn calibrate_100k() {
        let quotas = calibrate(42, 100_000, 1);
        println!("\nFinal QUOTA array:");
        println!("pub const QUOTA: [u32; 15] = {:?};", quotas);
        for r in 0..ROUNDS {
            assert!(quotas[r] > 0, "round {} quota should be > 0", r + 1);
        }
        // quotas should be monotonically increasing
        for r in 1..ROUNDS {
            assert!(quotas[r] >= quotas[r - 1], "quotas should increase: round {} ({}) < round {} ({})", r, quotas[r - 1], r + 1, quotas[r]);
        }
    }
}
