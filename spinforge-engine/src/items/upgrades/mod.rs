use crate::core::event::Event;
use crate::core::state::GameState;
pub mod effects;

#[derive(Clone, Copy, PartialEq, Eq, Debug)]
pub enum Upgrade {
    TicketPerBall,
}

impl Upgrade {
    pub fn on(self, event: Event, state: &mut GameState) {
        match self {
            Upgrade::TicketPerBall => {
                if matches!(event, Event::OnScore(_)) {
                    state.tickets += 1;
                }
            }
        }
    }
}
