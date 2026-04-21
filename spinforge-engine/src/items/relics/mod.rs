use crate::items::balls::Rarity;
use crate::core::event::Event;
use crate::core::state::GameState;
pub mod effects;

#[derive(Clone, Copy, PartialEq, Eq, Debug)]
pub enum RelicId {
    TabletTwenty,
    TabletNineteen,
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
    pub fn on(self, _event: Event, _state: &mut GameState) {
        match self {
            RelicId::TabletTwenty => {}
            RelicId::TabletNineteen => {}
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn relic_id_is_copy() {
        let a = RelicId::TabletTwenty;
        let b = a;
        assert_eq!(a, b);
    }
}
