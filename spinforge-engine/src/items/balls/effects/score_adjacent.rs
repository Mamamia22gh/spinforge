use crate::core::state::GameState;
use super::score_once;

pub fn process(pos: usize, state: GameState) -> GameState {
    let len = state.segments.len();
    let left = if pos == 0 { len - 1 } else { pos - 1 };
    let right = if pos == len - 1 { 0 } else { pos + 1 };
    let state = score_once::process(left, state);
    score_once::process(right, state)
}
