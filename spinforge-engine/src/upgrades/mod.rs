use crate::state::GameState;
pub mod effects;

#[derive(Clone, Copy, PartialEq, Eq, Debug)]
pub enum Upgrade {
    TicketPerSegment,
}

impl Upgrade {
    pub fn process(self, state: GameState) -> GameState {
        match self {
            Upgrade::TicketPerSegment => effects::ticket_per_segment::process(state),
        }
    }
}
