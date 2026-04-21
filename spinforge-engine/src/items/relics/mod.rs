use crate::items::balls::Rarity;
use crate::core::event::Event;
use crate::core::state::GameState;
pub mod effects;

#[derive(Clone, Copy, PartialEq, Eq, Debug)]
pub enum RelicId {
    SetAllSegmentsTo20,
    SetAllSegmentsTo19,
    GoldenBonus,
    CorruptionShield,
}

#[derive(Clone, Copy, PartialEq, Eq, Debug)]
pub enum RelicEffectKind {
    SetBaseValue,
}

#[derive(Clone, Copy, Debug)]
pub struct RelicEffect {
    pub kind: RelicEffectKind,
    pub value: i32,
}

pub struct RelicDef {
    pub id: RelicId,
    pub rarity: Rarity,
    pub cost: u32,
    pub min_round: u8,
    pub effects: &'static [RelicEffect],
}

impl RelicId {
    pub fn on(self, event: Event, state: &mut GameState) {
        match self {
            RelicId::SetAllSegmentsTo20 => {
                if event == Event::OnBuy {
                    for seg in &mut state.segments { seg.value = 20; }
                }
            }
            RelicId::SetAllSegmentsTo19 => {
                if event == Event::OnBuy {
                    for seg in &mut state.segments { seg.value = 19; }
                }
            }
            RelicId::GoldenBonus => {
                if let Event::OnScore(pos) = event {
                    if state.segments[pos].kind == crate::items::segment::SegmentKind::Golden {
                        state.gold_coins += 5;
                    }
                }
            }
            RelicId::CorruptionShield => {
                if event == Event::AfterScore {
                    state.corruption = (state.corruption - 0.1).max(0.0);
                }
            }
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn relic_id_is_copy() {
        let a = RelicId::SetAllSegmentsTo20;
        let b = a;
        assert_eq!(a, b);
    }
}
