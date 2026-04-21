use crate::event::Event;
use crate::state::GameState;
pub mod effects;

#[derive(Clone, Copy, PartialEq, Eq, Debug)]
pub enum Upgrade {
    TicketPerSegment,
}

impl Upgrade {
    pub fn on(self, _event: Event, _state: &mut GameState) {
        match self {
            Upgrade::TicketPerSegment => {}
        }
    }
}
