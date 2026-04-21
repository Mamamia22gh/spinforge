use crate::core::event::Event;
use crate::core::state::GameState;
pub mod effects;

#[derive(Clone, Copy, PartialEq, Eq, Debug)]
pub enum Upgrade {
    TicketPerSegment,
}

impl Upgrade {
    pub fn on(self, event: Event, state: &mut GameState) {
        match self {
            Upgrade::TicketPerSegment => {
                if event == Event::AfterScore {
                    state.tickets += state.segments.len() as u32;
                }
            }
        }
    }
}
