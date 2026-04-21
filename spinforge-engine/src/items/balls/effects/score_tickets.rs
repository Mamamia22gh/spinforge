use crate::core::state::GameState;

pub fn process(pos: usize, mut state: GameState) -> GameState {
    let value = state.segments[pos].value;
    state.tickets = state.tickets.saturating_add(value.max(0) as u32);
    state
}
