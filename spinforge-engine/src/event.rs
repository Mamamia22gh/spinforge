use crate::shop::ShopItem;
use crate::state::GameState;

#[derive(Clone, Debug, PartialEq)]
pub enum Event {
    BallLanded { ball_idx: usize, pos: usize },
    SegmentScored { pos: usize, value: i32 },
    RoundStarted { round: u8 },
    RoundEnded { round: u8 },
    GoldChanged { old: u32, new: u32 },
    TicketChanged { old: u32, new: u32 },
    ItemBought { item: ShopItem, cost: u32 },
}

pub struct EventRouter;

impl EventRouter {
    pub fn dispatch(event: &Event, state: GameState) -> GameState {
        let state = Self::route_relics(event, state);
        let state = Self::route_upgrades(event, state);
        state
    }

    fn route_relics(event: &Event, state: GameState) -> GameState {
        for &relic in state.relics.iter() {
            match (relic, event) {
                (_, _) => {}
            }
        }
        state
    }

    fn route_upgrades(event: &Event, state: GameState) -> GameState {
        for &upgrade in state.upgrades.iter() {
            match (upgrade, event) {
                (_, _) => {}
            }
        }
        state
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn dispatch_identity_on_empty_state() {
        let state = GameState::new();
        let gold = state.gold_coins;
        let result = EventRouter::dispatch(&Event::RoundStarted { round: 1 }, state);
        assert_eq!(result.gold_coins, gold);
    }

    #[test]
    fn all_events_constructible() {
        let events = vec![
            Event::BallLanded { ball_idx: 0, pos: 5 },
            Event::SegmentScored { pos: 3, value: 10 },
            Event::RoundStarted { round: 1 },
            Event::RoundEnded { round: 1 },
            Event::GoldChanged { old: 0, new: 50 },
            Event::TicketChanged { old: 0, new: 15 },
            Event::ItemBought { item: ShopItem::Upgrade(crate::upgrades::Upgrade::TicketPerSegment), cost: 20 },
        ];
        assert_eq!(events.len(), 7);
    }
}
