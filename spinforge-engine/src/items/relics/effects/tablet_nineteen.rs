use crate::core::state::GameState;

pub fn process(mut state: GameState) -> GameState {
    for seg in &mut state.segments { seg.value = 19; }
    state
}
