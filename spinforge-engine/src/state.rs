use std::collections::VecDeque;

use crate::balance;
use crate::balls::Ball;
use crate::relics::RelicId;
use crate::segment::{Segment, SegmentKind};
use crate::upgrades::Upgrade;

const STARTING_BALLS: usize = 5;

#[derive(Clone, Debug)]
pub struct GameState {
    pub round: u8,
    pub segments: Vec<Segment>,
    pub balls: Vec<Ball>,
    pub relics: VecDeque<RelicId>,
    pub upgrades: Vec<Upgrade>,
    pub gold_coins: u32,
    pub quota: u32,
    pub corruption: f64,
    pub tickets: u32,
}

impl GameState {
    pub fn new() -> Self {
        use SegmentKind::*;
        let pattern = [
            Neutral, Neutral, Neutral, Neutral, Golden,
            Neutral, Neutral, Neutral, Neutral, Corrupted,
            Neutral, Neutral, Neutral, Neutral, Golden,
            Neutral, Neutral, Neutral, Neutral, Corrupted,
            Neutral, Neutral, Neutral, Neutral, Golden,
            Neutral, Neutral, Neutral, Neutral, Corrupted,
            Neutral, Neutral, Neutral, Neutral, Golden,
            Neutral, Neutral, Neutral, Neutral, Corrupted,
        ];
        let segments = pattern.iter().map(|&k| Segment::new(k)).collect();

        let balls = (0..STARTING_BALLS)
            .map(|_| Ball::normal())
            .collect();

        Self {
            round: 1,
            segments,
            balls,
            relics: VecDeque::new(),
            upgrades: Vec::new(),
            gold_coins: 0,
            quota: balance::quota(1),
            corruption: balance::INITIAL_CORRUPTION,
            tickets: 0,
        }
    }
}


#[cfg(test)]
mod tests {
    use super::*;
    use crate::balls::BallEffect;
    use crate::balls::Rarity;

    #[test]
    fn new_run_has_40_segments() {
        let run = GameState::new();
        assert_eq!(run.segments.len(), 40);
    }

    #[test]
    fn new_run_has_5_normal_balls() {
        let run = GameState::new();
        assert_eq!(run.balls.len(), 5);
        assert!(run.balls.iter().all(|b| b.effects.iter().all(|e| e.is_none())));
    }

    #[test]
    fn gold_at_every_10th_from_4() {
        let run = GameState::new();
        for i in [4, 14, 24, 34] {
            assert_eq!(run.segments[i].kind, SegmentKind::Golden);
        }
    }

    #[test]
    fn corrupted_at_every_10th_from_9() {
        let run = GameState::new();
        for i in [9, 19, 29, 39] {
            assert_eq!(run.segments[i].kind, SegmentKind::Corrupted);
        }
    }

    #[test]
    fn initial_corruption() {
        let run = GameState::new();
        assert!((run.corruption - 0.5).abs() < f64::EPSILON);
    }

    #[test]
    fn clone_is_independent() {
        let mut run = GameState::new();
        let snap = run.clone();
        run.round = 5;
        run.segments[0].value = 99;
        assert_eq!(snap.round, 1);
        assert_eq!(snap.segments[0].value, 0);
    }

    #[test]
    fn size_small_enough_for_mcts() {
        let size = std::mem::size_of::<GameState>();
        println!("GameState stack size: {} bytes", size);
        assert!(size < 256);
    }

    #[test]
    fn adding_special_ball() {
        let mut run = GameState::new();
        run.balls.push(Ball::special(BallEffect::Double, Rarity::Rare));
        assert_eq!(run.balls.len(), 6);
        assert_eq!(run.balls[5].effects[0], Some(BallEffect::Double));
    }

    #[test]
    fn upgrades_stack() {
        let mut run = GameState::new();
        run.upgrades.push(Upgrade::TicketPerSegment);
        run.upgrades.push(Upgrade::TicketPerSegment);
        let count = run.upgrades.iter().filter(|u| **u == Upgrade::TicketPerSegment).count();
        assert_eq!(count, 2);
    }
}
