use crate::items::balls::Ball;
use crate::core::event::{self, Event};
use crate::items::relics::RelicId;
use crate::core::rng::Rng;
use crate::core::state::GameState;
use crate::items::upgrades::Upgrade;

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum Alteration {
    Normal,
    Corrupted,
    Purified,
}

#[derive(Clone, Debug, PartialEq)]
pub enum ShopItem {
    Ball(Ball),
    Relic(RelicId),
    Upgrade(Upgrade),
}

#[derive(Clone, Debug)]
pub struct ShopSlot {
    pub item: ShopItem,
    pub price: u32,
    pub sold: bool,
    pub alteration: Alteration,
}

#[derive(Clone, Debug)]
pub struct Shop {
    pub balls: [ShopSlot; 3],
    pub relics: [ShopSlot; 3],
    pub upgrade: ShopSlot,
    pub reroll_cost: u32,
}

pub enum ShopAction {
    BuyBall(usize),
    BuyRelic(usize),
    BuyUpgrade,
    SellBall,
    SellUpgrade(usize),
    Reroll,
    Continue,
}

impl Shop {
    fn roll_alteration(rng: &mut Rng) -> Alteration {
        let r = rng.random();
        if r < 0.10 { Alteration::Corrupted }
        else if r < 0.20 { Alteration::Purified }
        else { Alteration::Normal }
    }

    fn apply_alteration(alteration: Alteration, state: &mut GameState) {
        use crate::core::balance;
        match alteration {
            Alteration::Normal => {}
            Alteration::Corrupted => {
                state.corruption = (state.corruption + balance::CORRUPTION_PER_CORRUPTED_BUY).min(1.0);
            }
            Alteration::Purified => {
                state.corruption = (state.corruption - balance::CORRUPTION_PER_PURIFIED_BUY).max(0.0);
            }
        }
    }

    pub fn generate(rng: &mut Rng) -> Self {
        let effect_pool = [crate::items::balls::BallEffect::ScoreOnce, crate::items::balls::BallEffect::ScoreDouble, crate::items::balls::BallEffect::ScoreAdjacent, crate::items::balls::BallEffect::ScoreTickets];
        let rarity_pool = [crate::items::balls::Rarity::Common, crate::items::balls::Rarity::Common, crate::items::balls::Rarity::Uncommon, crate::items::balls::Rarity::Rare];
        let balls = std::array::from_fn(|_| {
            let a = Self::roll_alteration(rng);
            ShopSlot {
                item: ShopItem::Ball(Ball::new(*rng.pick(&effect_pool), *rng.pick(&rarity_pool))),
                price: rng.int(5, 15) as u32,
                sold: false,
                alteration: a,
            }
        });

        let relic_pool = [RelicId::SetAllSegmentsTo20, RelicId::SetAllSegmentsTo19, RelicId::GoldenBonus, RelicId::CorruptionShield];
        let relics = std::array::from_fn(|_| {
            let id = *rng.pick(&relic_pool);
            let a = Self::roll_alteration(rng);
            ShopSlot {
                item: ShopItem::Relic(id),
                price: rng.int(10, 25) as u32,
                sold: false,
                alteration: a,
            }
        });

        let upgrade_pool = [Upgrade::TicketPerBall, Upgrade::BuyDiscount, Upgrade::RoundEndGold];
        let ua = Self::roll_alteration(rng);
        let upgrade = ShopSlot {
            item: ShopItem::Upgrade(*rng.pick(&upgrade_pool)),
            price: rng.int(8, 20) as u32,
            sold: false,
            alteration: ua,
        };

        Self {
            balls,
            relics,
            upgrade,
            reroll_cost: crate::core::balance::SHOP_REROLL_BASE,
        }
    }

    pub fn apply(mut self, action: ShopAction, mut state: GameState, rng: &mut Rng) -> (Shop, GameState) {
        match action {
            ShopAction::BuyBall(i) => {
                let slot = &mut self.balls[i];
                if !slot.sold && state.tickets >= slot.price {
                    slot.sold = true;
                    let cost = slot.price;
                    let alteration = slot.alteration;
                    state.tickets -= cost;
                    if let ShopItem::Ball(mut ball) = slot.item {
                        if state.balls.len() < crate::core::state::MAX_BALLS {
                            if !state.balls.is_full() {
                                ball.cost = cost;
                                state.balls.push(ball);
                            }
                        }
                    }
                    Self::apply_alteration(alteration, &mut state);
                    let _ = event::trigger(Event::OnBuy, &mut state);
                }
            }
            ShopAction::BuyRelic(i) => {
                let slot = &mut self.relics[i];
                if !slot.sold && state.tickets >= slot.price {
                    slot.sold = true;
                    let cost = slot.price;
                    let alteration = slot.alteration;
                    state.tickets -= cost;
                    if let ShopItem::Relic(id) = slot.item {
                        state.relics.push(id);
                    }
                    Self::apply_alteration(alteration, &mut state);
                    let _ = event::trigger(Event::OnBuy, &mut state);
                }
            }
            ShopAction::BuyUpgrade => {
                let slot = &mut self.upgrade;
                if !slot.sold && state.tickets >= slot.price {
                    slot.sold = true;
                    let cost = slot.price;
                    let alteration = slot.alteration;
                    state.tickets -= cost;
                    if let ShopItem::Upgrade(u) = slot.item {
                        if state.upgrades.len() < crate::core::state::MAX_UPGRADES {
                            if !state.upgrades.is_full() { state.upgrades.push((u, cost)); }
                        }
                    }
                    Self::apply_alteration(alteration, &mut state);
                    let _ = event::trigger(Event::OnBuy, &mut state);
                }
            }
            ShopAction::SellBall => {
                if state.balls.len() > 1 {
                    let ball = state.balls.remove(0);
                    state.tickets += ball.cost / 2;
                }
            }
            ShopAction::SellUpgrade(i) => {
                if i < state.upgrades.len() {
                    let (_, cost) = state.upgrades.remove(i);
                    state.tickets += cost / 2;
                }
            }
            ShopAction::Reroll => {
                if state.tickets >= self.reroll_cost {
                    let next_cost = self.reroll_cost * 2;
                    state.tickets -= self.reroll_cost;
                    self = Shop::generate(rng);
                    self.reroll_cost = next_cost;
                }
            }
            ShopAction::Continue => {}
        }
        (self, state)
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn generate_produces_valid_shop() {
        let mut rng = Rng::new(42);
        let shop = Shop::generate(&mut rng);
        assert!(!shop.balls[0].sold);
        assert!(!shop.relics[0].sold);
        assert!(!shop.upgrade.sold);
    }

    #[test]
    fn buy_ball_deducts_tickets() {
        let mut rng = Rng::new(42);
        let shop = Shop::generate(&mut rng);
        let mut state = GameState::new();
        state.tickets = 100;
        let price = shop.balls[0].price;
        let (shop, state) = shop.apply(ShopAction::BuyBall(0), state, &mut rng);
        assert!(shop.balls[0].sold);
        assert_eq!(state.tickets, 100 - price);
        assert_eq!(state.balls.len(), 6);
    }

    #[test]
    fn buy_relic_adds_to_state() {
        let mut rng = Rng::new(42);
        let shop = Shop::generate(&mut rng);
        let mut state = GameState::new();
        state.tickets = 100;
        let (_, state) = shop.apply(ShopAction::BuyRelic(0), state, &mut rng);
        assert_eq!(state.relics.len(), 1);
    }

    #[test]
    fn cannot_buy_without_tickets() {
        let mut rng = Rng::new(42);
        let shop = Shop::generate(&mut rng);
        let state = GameState::new();
        let (shop, state) = shop.apply(ShopAction::BuyBall(0), state, &mut rng);
        assert!(!shop.balls[0].sold);
        assert_eq!(state.balls.len(), 5);
    }

    #[test]
    fn cannot_buy_sold_slot() {
        let mut rng = Rng::new(42);
        let shop = Shop::generate(&mut rng);
        let mut state = GameState::new();
        state.tickets = 200;
        let (shop, state) = shop.apply(ShopAction::BuyBall(0), state, &mut rng);
        let tickets_after = state.tickets;
        let (_, state) = shop.apply(ShopAction::BuyBall(0), state, &mut rng);
        assert_eq!(state.tickets, tickets_after);
        assert_eq!(state.balls.len(), 6);
    }

    #[test]
    fn reroll_regenerates_shop() {
        let mut rng = Rng::new(42);
        let shop = Shop::generate(&mut rng);
        let mut state = GameState::new();
        state.tickets = 100;
        let old_price = shop.balls[0].price;
        let (shop, state) = shop.apply(ShopAction::Reroll, state, &mut rng);
        assert_eq!(state.tickets, 100 - crate::core::balance::SHOP_REROLL_BASE);
        assert!(!shop.balls[0].sold);
        let _ = old_price;
    }

    #[test]
    fn continue_does_nothing() {
        let mut rng = Rng::new(42);
        let shop = Shop::generate(&mut rng);
        let mut state = GameState::new();
        state.tickets = 50;
        let (_, state) = shop.apply(ShopAction::Continue, state, &mut rng);
        assert_eq!(state.tickets, 50);
    }
}
