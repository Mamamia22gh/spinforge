use rayon::prelude::*;
use crate::core::balance;
use crate::core::rng::Rng;
use crate::core::state::GameState;
use crate::systems::shop::Shop;
use crate::sim;

const ROUNDS: usize = 15;

fn collect_gold_distributions(seed: u32, n: u32) -> Vec<[u32; ROUNDS]> {
    (0..n).into_par_iter().map(|i| {
        let mut rng = Rng::new(seed.wrapping_add(i));
        let mut state = GameState::new();
        let mut golds = [0u32; ROUNDS];

        for round in 1..=ROUNDS as u8 {
            state.round = round;
            state.quota = 999_999;
            state = sim::simulate_round(state, &mut rng);
            golds[round as usize - 1] = state.gold_coins;

            state.tickets += balance::TICKETS_PER_ROUND;
            sim::check_deals(&mut state, &mut rng);
            let shop = Shop::generate(&mut rng);
            let (_, st) = sim::mcts_shop_loop(shop, state, &mut rng);
            state = st;
        }
        golds
    }).collect()
}

fn compute_quotas(distributions: &[[u32; ROUNDS]], targets: &[f64; ROUNDS]) -> [u32; ROUNDS] {
    let n = distributions.len();
    let mut quotas = [0u32; ROUNDS];

    for r in 0..ROUNDS {
        let mut golds: Vec<u32> = distributions.iter().map(|g| g[r]).collect();
        golds.sort_unstable();
        let percentile_idx = ((1.0 - targets[r]) * n as f64).round() as usize;
        let idx = percentile_idx.min(n - 1);
        quotas[r] = golds[idx];
    }
    quotas
}

pub fn calibrate(seed: u32, n: u32, iterations: u8) -> [u32; ROUNDS] {
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

        let mut wins = [0u32; ROUNDS];
        for golds in &distributions {
            for r in 0..ROUNDS {
                if golds[r] >= quotas[r] { wins[r] += 1; }
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


