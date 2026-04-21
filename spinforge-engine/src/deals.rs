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
pub struct DevilOffer {
    pub upgrade: DevilUpgrade,
    pub debuff: DevilDebuff,
}

#[derive(Clone, Debug)]
pub enum DealOffering {
    Devil([DevilOffer; 3]),
    Angel([AngelBlessing; 3]),
}

pub fn check_devil_deal(state: &GameState) -> bool {
    state.corruption >= 1.0
}

pub fn check_angel_deal(state: &GameState) -> bool {
    state.corruption == 0.0 && state.zero_corruption_rounds >= balance::ANGEL_DEAL_ZERO_ROUNDS
}

pub fn generate_devil_offering(rng: &mut Rng) -> DealOffering {
    let all_upgrades = [DevilUpgrade::DoubleBallDamage, DevilUpgrade::FreeRerolls, DevilUpgrade::ExtraTickets];
    let all_debuffs = [DevilDebuff::LoseOneBall, DevilDebuff::HigherQuota, DevilDebuff::CorruptedSegments];
    let mut offers = [
        DevilOffer { upgrade: all_upgrades[0], debuff: all_debuffs[0] },
        DevilOffer { upgrade: all_upgrades[1], debuff: all_debuffs[1] },
        DevilOffer { upgrade: all_upgrades[2], debuff: all_debuffs[2] },
    ];
    for i in 0..3 {
        let j = rng.int(0, 2) as usize;
        let tmp = offers[i].debuff;
        offers[i].debuff = offers[j].debuff;
        offers[j].debuff = tmp;
    }
    DealOffering::Devil(offers)
}

pub fn generate_angel_offering(_rng: &mut Rng) -> DealOffering {
    DealOffering::Angel([AngelBlessing::HealCorruption, AngelBlessing::BonusGold, AngelBlessing::ExtraBall])
}

pub fn apply_devil_choice(state: &mut GameState, offer: &DevilOffer, rng: &mut Rng) {
    apply_devil_upgrade(offer.upgrade, state);
    apply_devil_debuff(offer.debuff, state, rng);
    state.corruption = balance::CORRUPTION_RESET_AFTER_DEVIL;
}

pub fn apply_angel_choice(state: &mut GameState, blessing: AngelBlessing) {
    apply_angel_blessing(blessing, state);
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
    fn devil_offering_has_3_offers() {
        let mut rng = Rng::new(42);
        let offering = generate_devil_offering(&mut rng);
        match offering {
            DealOffering::Devil(offers) => assert_eq!(offers.len(), 3),
            _ => panic!("expected devil"),
        }
    }

    #[test]
    fn devil_choice_resets_corruption() {
        let mut state = GameState::new();
        let mut rng = Rng::new(42);
        state.corruption = 1.0;
        let offer = DevilOffer { upgrade: DevilUpgrade::FreeRerolls, debuff: DevilDebuff::HigherQuota };
        apply_devil_choice(&mut state, &offer, &mut rng);
        assert!((state.corruption - balance::CORRUPTION_RESET_AFTER_DEVIL).abs() < f64::EPSILON);
    }

    #[test]
    fn devil_choice_applies_one_upgrade_one_debuff() {
        let mut state = GameState::new();
        let mut rng = Rng::new(42);
        state.corruption = 1.0;
        let tickets_before = state.tickets;
        let offer = DevilOffer { upgrade: DevilUpgrade::FreeRerolls, debuff: DevilDebuff::HigherQuota };
        let quota_before = state.quota;
        apply_devil_choice(&mut state, &offer, &mut rng);
        assert_eq!(state.tickets, tickets_before + 30);
        assert_eq!(state.quota, (quota_before as f64 * 1.25) as u32);
    }

    #[test]
    fn angel_choice_applies_one_blessing() {
        let mut state = GameState::new();
        let gold_before = state.gold_coins;
        apply_angel_choice(&mut state, AngelBlessing::BonusGold);
        assert_eq!(state.gold_coins, gold_before + 50);
        assert_eq!(state.zero_corruption_rounds, 0);
    }

    #[test]
    fn angel_choice_does_not_apply_others() {
        let mut state = GameState::new();
        let balls_before = state.balls.len();
        apply_angel_choice(&mut state, AngelBlessing::BonusGold);
        assert_eq!(state.balls.len(), balls_before);
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
