use crate::items::balls::Rarity;
use crate::core::event::Event;
use crate::core::state::GameState;
pub mod effects;

#[derive(Clone, Copy, PartialEq, Eq, Debug)]
pub enum RelicId {
    SetAllSegmentsTo20,
    SetAllSegmentsTo19,
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
        if event != Event::OnBuy { return; }
        match self {
            RelicId::SetAllSegmentsTo20 => {
                for seg in &mut state.segments { seg.value = 20; }
            }
            RelicId::SetAllSegmentsTo19 => {
                for seg in &mut state.segments { seg.value = 19; }
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
