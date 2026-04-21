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
    pub effect: Option<BallEffect>,
    pub rarity: Rarity,
}

impl Ball {
    pub fn normal() -> Self {
        Self { effect: None, rarity: Rarity::Common }
    }

    pub fn special(effect: BallEffect, rarity: Rarity) -> Self {
        Self { effect: Some(effect), rarity }
    }

    pub fn process(self, pos: usize, mut state: GameState) -> GameState {
        let value = state.segments[pos].value;
        state.gold_coins = (state.gold_coins as i32 + value).max(0) as u32;

        if let Some(effect) = self.effect {
            state = effect.process(pos, state);
        }
        state
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
        assert!(b.effect.is_none());
        assert_eq!(b.rarity, Rarity::Common);
    }

    #[test]
    fn special_ball_stores_effect() {
        let b = Ball::special(BallEffect::Double, Rarity::Rare);
        assert_eq!(b.effect, Some(BallEffect::Double));
        assert_eq!(b.rarity, Rarity::Rare);
    }

    #[test]
    fn ball_is_copy() {
        let a = Ball::special(BallEffect::Splash, Rarity::Legendary);
        let b = a;
        assert_eq!(a.effect, b.effect);
    }
}
