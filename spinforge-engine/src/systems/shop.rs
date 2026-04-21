use crate::items::balls::Ball;
use crate::core::event::{self, Event};
use crate::items::relics::RelicId;
use crate::core::rng::Rng;
use crate::core::state::GameState;
use crate::items::upgrades::Upgrade;

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
    Reroll,
    Continue,
}

impl Shop {
    pub fn generate(rng: &mut Rng) -> Self {
        let balls = std::array::from_fn(|_| ShopSlot {
            item: ShopItem::Ball(Ball::new(crate::items::balls::BallEffect::ScoreOnce, crate::items::balls::Rarity::Common)),
            price: rng.int(5, 15) as u32,
            sold: false,
        });

        let relic_pool = [RelicId::SetAllSegmentsTo20, RelicId::SetAllSegmentsTo19];
        let relics = std::array::from_fn(|_| {
            let id = *rng.pick(&relic_pool);
            ShopSlot {
                item: ShopItem::Relic(id),
                price: rng.int(10, 25) as u32,
                sold: false,
            }
        });

        let upgrade = ShopSlot {
            item: ShopItem::Upgrade(Upgrade::TicketPerSegment),
            price: rng.int(8, 20) as u32,
            sold: false,
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
                    state.tickets -= cost;
                    if let ShopItem::Ball(ball) = slot.item {
                        state.balls.push(ball);
                    }
                    event::trigger(Event::OnBuy, &mut state);
                }
            }
            ShopAction::BuyRelic(i) => {
                let slot = &mut self.relics[i];
                if !slot.sold && state.tickets >= slot.price {
                    slot.sold = true;
                    let cost = slot.price;
                    state.tickets -= cost;
                    if let ShopItem::Relic(id) = slot.item {
                        state.relics.push_back(id);
                    }
                    event::trigger(Event::OnBuy, &mut state);
                }
            }
            ShopAction::BuyUpgrade => {
                let slot = &mut self.upgrade;
                if !slot.sold && state.tickets >= slot.price {
                    slot.sold = true;
                    let cost = slot.price;
                    state.tickets -= cost;
                    if let ShopItem::Upgrade(u) = slot.item {
                        state.upgrades.push(u);
                    }
                    event::trigger(Event::OnBuy, &mut state);
                }
            }
            ShopAction::Reroll => {
                if state.tickets >= self.reroll_cost {
                    state.tickets -= self.reroll_cost;
                    self = Shop::generate(rng);
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
