use crate::core::state::GameState;

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum Event {
    OnBuy,
    OnScore(usize),
    AfterScore,
}

#[derive(Clone, Debug)]
pub struct Fired {
    pub relics: Vec<u8>,
    pub upgrades: Vec<u8>,
}

pub fn trigger(event: Event, state: &mut GameState) -> Fired {
    let mut fired = Fired { relics: Vec::new(), upgrades: Vec::new() };

    let relics: Vec<_> = state.relics.iter().copied().collect();
    for (i, relic) in relics.iter().enumerate() {
        let before_gold = state.gold_coins;
        let before_tickets = state.tickets;
        let before_corruption = state.corruption;
        let seg_snap: Vec<i32> = state.segments.iter().map(|s| s.value).collect();
        relic.on(event, state);
        let seg_changed = state.segments.iter().enumerate().any(|(j, s)| s.value != seg_snap[j]);
        if state.gold_coins != before_gold || state.tickets != before_tickets
            || (state.corruption - before_corruption).abs() > f64::EPSILON
            || seg_changed {
            fired.relics.push(i as u8);
        }
    }

    let upgrades: Vec<_> = state.upgrades.iter().map(|&(u, _)| u).collect();
    for (i, upgrade) in upgrades.iter().enumerate() {
        let before_gold = state.gold_coins;
        let before_tickets = state.tickets;
        upgrade.on(event, state);
        if state.gold_coins != before_gold || state.tickets != before_tickets {
            fired.upgrades.push(i as u8);
        }
    }

    fired
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
