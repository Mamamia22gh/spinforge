use crate::state::GameState;
pub mod effects;

#[derive(Clone, Copy, PartialEq, Eq, Debug)]
pub enum BallEffect {
    ScoreOnce,
    ScoreDouble,
    ScoreAdjacent,
    ScoreTickets,
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
    pub fn new(effect: BallEffect, rarity: Rarity) -> Self {
        Self { effects: [Some(effect), None, None], rarity }
    }
}

impl BallEffect {
    pub fn process(self, pos: usize, state: GameState) -> GameState {
        match self {
            BallEffect::ScoreOnce => effects::score_once::process(pos, state),
            BallEffect::ScoreDouble => effects::score_double::process(pos, state),
            BallEffect::ScoreAdjacent => effects::score_adjacent::process(pos, state),
            BallEffect::ScoreTickets => effects::score_tickets::process(pos, state),
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn default_ball_has_score_once() {
        let b = Ball::new(BallEffect::ScoreOnce, Rarity::Common);
        assert_eq!(b.effects[0], Some(BallEffect::ScoreOnce));
        assert_eq!(b.effects[1], None);
    }

    #[test]
    fn ball_with_effect() {
        let b = Ball::new(BallEffect::ScoreDouble, Rarity::Rare);
        assert_eq!(b.effects[0], Some(BallEffect::ScoreDouble));
        assert_eq!(b.rarity, Rarity::Rare);
    }

    #[test]
    fn ball_is_copy() {
        let a = Ball::new(BallEffect::ScoreAdjacent, Rarity::Legendary);
        let b = a;
        assert_eq!(a.effects, b.effects);
    }
}
