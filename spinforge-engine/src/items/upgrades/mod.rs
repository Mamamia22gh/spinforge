use crate::core::event::Event;
use crate::core::state::GameState;
pub mod effects;

#[derive(Clone, Copy, PartialEq, Eq, Debug)]
pub enum Upgrade {
    TicketPerBall,
    BuyDiscount,
    RoundEndGold,
}

impl Upgrade {
    pub fn on(self, event: Event, state: &mut GameState) {
        match self {
            Upgrade::TicketPerBall => {
                if matches!(event, Event::OnScore(_)) {
                    state.tickets += 1;
                }
            }
            Upgrade::BuyDiscount => {
                if event == Event::OnBuy {
                    state.tickets += 2;
                }
            }
            Upgrade::RoundEndGold => {
                if event == Event::AfterScore {
                    state.gold_coins += 10;
                }
            }
        }
    }
}
