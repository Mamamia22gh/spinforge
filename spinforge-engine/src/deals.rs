use crate::core::balance;
use crate::core::rng::Rng;
use crate::core::state::GameState;

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum DealKind {
    Devil,
    Angel,
}

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum DevilUpgrade {
    DoubleBallDamage,
    FreeRerolls,
    ExtraTickets,
}

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum DevilDebuff {
    LoseOneBall,
    HigherQuota,
    CorruptedSegments,
}

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum AngelBlessing {
    HealCorruption,
    BonusGold,
    ExtraBall,
}

#[derive(Clone, Debug)]
pub struct DealOffering {
    pub kind: DealKind,
    pub devil_upgrades: [(DevilUpgrade, DevilDebuff); 3],
    pub angel_blessings: [AngelBlessing; 3],
}

pub fn check_devil_deal(state: &GameState) -> bool {
    state.corruption >= 1.0
}

pub fn check_angel_deal(state: &GameState) -> bool {
    state.corruption == 0.0 && state.zero_corruption_rounds >= balance::ANGEL_DEAL_ZERO_ROUNDS
}

pub fn apply_devil_deal(state: &mut GameState, rng: &mut Rng) {
    let upgrades = [DevilUpgrade::DoubleBallDamage, DevilUpgrade::FreeRerolls, DevilUpgrade::ExtraTickets];
    let debuffs = [DevilDebuff::LoseOneBall, DevilDebuff::HigherQuota, DevilDebuff::CorruptedSegments];

    for i in 0..3 {
        apply_devil_upgrade(upgrades[i], state);
        apply_devil_debuff(debuffs[i], state, rng);
    }

    state.corruption = balance::CORRUPTION_RESET_AFTER_DEVIL;
}

pub fn apply_angel_deal(state: &mut GameState) {
    let blessings = [AngelBlessing::HealCorruption, AngelBlessing::BonusGold, AngelBlessing::ExtraBall];

    for blessing in blessings {
        apply_angel_blessing(blessing, state);
    }

    state.zero_corruption_rounds = 0;
}

fn apply_devil_upgrade(upgrade: DevilUpgrade, state: &mut GameState) {
    match upgrade {
        DevilUpgrade::DoubleBallDamage => {
            for seg in &mut state.segments {
                seg.value *= 2;
            }
        }
        DevilUpgrade::FreeRerolls => {
            state.tickets += 30;
        }
        DevilUpgrade::ExtraTickets => {
            state.tickets += 20;
        }
    }
}

fn apply_devil_debuff(debuff: DevilDebuff, state: &mut GameState, rng: &mut Rng) {
    match debuff {
        DevilDebuff::LoseOneBall => {
            if !state.balls.is_empty() {
                let idx = rng.int(0, state.balls.len() as i32 - 1) as usize;
                state.balls.remove(idx);
            }
        }
        DevilDebuff::HigherQuota => {
            state.quota = (state.quota as f64 * 1.25) as u32;
        }
        DevilDebuff::CorruptedSegments => {
            let count = 5.min(state.segments.len());
            for _ in 0..count {
                let idx = rng.int(0, state.segments.len() as i32 - 1) as usize;
                state.segments[idx].kind = crate::items::segment::SegmentKind::Corrupted;
                state.segments[idx].value = (state.segments[idx].value as f64 * 0.5) as i32;
            }
        }
    }
}

fn apply_angel_blessing(blessing: AngelBlessing, state: &mut GameState) {
    match blessing {
        AngelBlessing::HealCorruption => {
            for seg in &mut state.segments {
                if seg.kind == crate::items::segment::SegmentKind::Corrupted {
                    seg.kind = crate::items::segment::SegmentKind::Neutral;
                }
            }
        }
        AngelBlessing::BonusGold => {
            state.gold_coins += 50;
        }
        AngelBlessing::ExtraBall => {
            if !state.balls.is_full() {
                state.balls.push(crate::items::balls::Ball::new(
                    crate::items::balls::BallEffect::ScoreOnce,
                    crate::items::balls::Rarity::Uncommon,
                ));
            }
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn devil_deal_resets_corruption() {
        let mut state = GameState::new();
        let mut rng = Rng::new(42);
        state.corruption = 1.0;
        apply_devil_deal(&mut state, &mut rng);
        assert!((state.corruption - balance::CORRUPTION_RESET_AFTER_DEVIL).abs() < f64::EPSILON);
    }

    #[test]
    fn devil_deal_doubles_segments() {
        let mut state = GameState::new();
        let mut rng = Rng::new(42);
        let v0 = state.segments[0].value;
        state.corruption = 1.0;
        apply_devil_deal(&mut state, &mut rng);
        assert_eq!(state.segments[0].value, v0 * 2);
    }

    #[test]
    fn angel_deal_heals_corrupted() {
        let mut state = GameState::new();
        state.corruption = 0.0;
        state.zero_corruption_rounds = 4;
        assert!(check_angel_deal(&state));
        apply_angel_deal(&mut state);
        assert!(state.segments.iter().all(|s| s.kind != crate::items::segment::SegmentKind::Corrupted));
    }

    #[test]
    fn angel_deal_adds_gold_and_ball() {
        let mut state = GameState::new();
        let gold_before = state.gold_coins;
        let balls_before = state.balls.len();
        apply_angel_deal(&mut state);
        assert_eq!(state.gold_coins, gold_before + 50);
        assert_eq!(state.balls.len(), balls_before + 1);
    }

    #[test]
    fn check_devil_at_100() {
        let mut state = GameState::new();
        state.corruption = 1.0;
        assert!(check_devil_deal(&state));
        state.corruption = 0.99;
        assert!(!check_devil_deal(&state));
    }

    #[test]
    fn check_angel_needs_4_rounds() {
        let mut state = GameState::new();
        state.corruption = 0.0;
        state.zero_corruption_rounds = 3;
        assert!(!check_angel_deal(&state));
        state.zero_corruption_rounds = 4;
        assert!(check_angel_deal(&state));
    }

    #[test]
    fn corrupted_buy_increases_corruption() {
        let mut rng = Rng::new(42);
        let shop = crate::systems::shop::Shop::generate(&mut rng);
        let mut state = GameState::new();
        state.tickets = 1000;
        let corr_before = state.corruption;
        // Force a corrupted quality on first ball slot
        let mut shop2 = shop;
        shop2.balls[0].quality = crate::systems::shop::Quality::Corrupted;
        let (_, state) = shop2.apply(crate::systems::shop::ShopAction::BuyBall(0), state, &mut rng);
        assert!((state.corruption - (corr_before + balance::CORRUPTION_PER_CORRUPTED_BUY)).abs() < f64::EPSILON);
    }

    #[test]
    fn purified_buy_decreases_corruption() {
        let mut rng = Rng::new(42);
        let shop = crate::systems::shop::Shop::generate(&mut rng);
        let mut state = GameState::new();
        state.tickets = 1000;
        state.corruption = 0.5;
        let mut shop2 = shop;
        shop2.balls[0].quality = crate::systems::shop::Quality::Purified;
        let (_, state) = shop2.apply(crate::systems::shop::ShopAction::BuyBall(0), state, &mut rng);
        assert!((state.corruption - 0.3).abs() < f64::EPSILON);
    }
}
