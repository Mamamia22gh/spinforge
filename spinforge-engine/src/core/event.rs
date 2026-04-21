use crate::core::state::GameState;

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum Event {
    OnBuy,
    OnScore(usize),
    AfterScore,
}

pub fn trigger(event: Event, state: &mut GameState) {
    let relics: Vec<_> = state.relics.iter().copied().collect();
    for relic in relics {
        relic.on(event, state);
    }

    let upgrades: Vec<_> = state.upgrades.iter().map(|&(u, _)| u).collect();
    for upgrade in upgrades {
        upgrade.on(event, state);
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn trigger_on_empty_state() {
        let mut state = GameState::new();
        let gold = state.gold_coins;
        trigger(Event::AfterScore, &mut state);
        assert_eq!(state.gold_coins, gold);
    }

    #[test]
    fn all_events_constructible() {
        let events = [Event::OnBuy, Event::OnScore(5), Event::AfterScore];
        assert_eq!(events.len(), 3);
    }
}
