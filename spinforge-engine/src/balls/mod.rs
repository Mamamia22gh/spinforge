use crate::state::GameState;
pub mod effects;

#[derive(Clone, Copy, PartialEq, Eq, Debug)]
pub enum BallEffect {
    Double,
    Splash,
    Ticket,
}

#[derive(Clone, Copy, PartialEq, Eq, Debug)]
pub enum Rarity {
    Common,
    Uncommon,
    Rare,
    Legendary,
}

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub struct Ball {
    pub effects: [Option<BallEffect>; 3],
    pub rarity: Rarity,
}

impl Ball {
    pub fn normal() -> Self {
        Self { effects: [None; 3], rarity: Rarity::Common }
    }

    pub fn special(effect: BallEffect, rarity: Rarity) -> Self {
        Self { effects: [Some(effect), None, None], rarity }
    }
}

impl BallEffect {
    pub fn process(self, pos: usize, state: GameState) -> GameState {
        match self {
            BallEffect::Double => effects::double::process(pos, state),
            BallEffect::Splash => effects::splash::process(pos, state),
            BallEffect::Ticket => effects::ticket::process(pos, state),
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn normal_ball_has_no_effect() {
        let b = Ball::normal();
        assert!(b.effects.iter().all(|e| e.is_none()));
        assert_eq!(b.rarity, Rarity::Common);
    }

    #[test]
    fn special_ball_stores_effect() {
        let b = Ball::special(BallEffect::Double, Rarity::Rare);
        assert_eq!(b.effects[0], Some(BallEffect::Double));
        assert_eq!(b.effects[1], None);
        assert_eq!(b.rarity, Rarity::Rare);
    }

    #[test]
    fn ball_is_copy() {
        let a = Ball::special(BallEffect::Splash, Rarity::Legendary);
        let b = a;
        assert_eq!(a.effects, b.effects);
    }
}
