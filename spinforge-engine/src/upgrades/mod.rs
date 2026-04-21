automod::dir!(pub "src/upgrades");

use crate::state::GameState;

#[derive(Clone, Copy, PartialEq, Eq, Debug)]
pub enum Upgrade {
    TicketPerSegment,
}

impl Upgrade {
    pub fn process(self, state: GameState) -> GameState {
        match self {
            Upgrade::TicketPerSegment => ticket_per_segment::process(state),
        }
    }
}
