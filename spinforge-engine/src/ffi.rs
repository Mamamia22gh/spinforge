use std::slice;

use crate::core::balance;
use crate::core::event::{self, Event};
use crate::core::rng::Rng;
use crate::core::state::GameState;
use crate::items::balls::BallEffect;
use crate::items::segment::SegmentKind;
use crate::systems::shop::Shop;
use crate::deals;
use crate::sim;

#[repr(u8)]
#[derive(Clone, Copy, Debug)]
pub enum FrontEventKind {
    BallLanded = 1,
    SegmentScored = 2,
    GoldChanged = 3,
    TicketsChanged = 4,
    CorruptionChanged = 5,
    RelicTriggered = 6,
    UpgradeTriggered = 7,
    RoundEnded = 8,
    ItemBought = 9,
}

#[repr(C)]
#[derive(Clone, Copy, Debug)]
pub struct FrontEvent {
    pub kind: u8,
    pub a: i32,
    pub b: i32,
    pub c: i32,
    pub d: i32,
}

struct Engine {
    state: GameState,
    rng: Rng,
    shop: Option<Shop>,
    events: Vec<FrontEvent>,
}

fn push_ev(eng: &mut Engine, kind: FrontEventKind, a: i32, b: i32, c: i32, d: i32) {
    eng.events.push(FrontEvent { kind: kind as u8, a, b, c, d });
}

fn push_fired(eng: &mut Engine, fired: &event::Fired) {
    for &ri in &fired.relics {
        push_ev(eng, FrontEventKind::RelicTriggered, ri as i32, 0, 0, 0);
    }
    for &ui in &fired.upgrades {
        push_ev(eng, FrontEventKind::UpgradeTriggered, ui as i32, 0, 0, 0);
    }
}

#[no_mangle]
pub extern "C" fn engine_new(seed: u32) -> *mut Engine {
    let eng = Box::new(Engine {
        state: GameState::new(),
        rng: Rng::new(seed),
        shop: None,
        events: Vec::with_capacity(64),
    });
    Box::into_raw(eng)
}

#[no_mangle]
pub extern "C" fn engine_free(ptr: *mut Engine) {
    if !ptr.is_null() {
        unsafe { drop(Box::from_raw(ptr)); }
    }
}

#[no_mangle]
pub extern "C" fn engine_restart(ptr: *mut Engine) {
    let eng = unsafe { &mut *ptr };
    let new_seed = eng.rng.int(0, 0x7FFFFFFF) as u32;
    eng.state = GameState::new();
    eng.rng = Rng::new(new_seed);
    eng.shop = None;
    eng.events.clear();
}

#[no_mangle]
pub extern "C" fn engine_spin(ptr: *mut Engine) {
    let eng = unsafe { &mut *ptr };
    let old_gold = eng.state.gold_coins;
    let old_tickets = eng.state.tickets;

    let balls: Vec<_> = eng.state.balls.iter().copied().collect();
    for (bi, ball) in balls.iter().enumerate() {
        let pos = eng.rng.int(0, eng.state.segments.len() as i32 - 1) as usize;
        push_ev(eng, FrontEventKind::BallLanded, bi as i32, pos as i32, 0, 0);

        let gold_before = eng.state.gold_coins;
        for slot in &ball.effects {
            if let Some(effect) = slot {
                eng.state = effect.process(pos, eng.state.clone());
            }
        }
        let gold_after = eng.state.gold_coins;
        push_ev(eng, FrontEventKind::SegmentScored, pos as i32,
            eng.state.segments[pos].value, (gold_after - gold_before) as i32, 0);

        let f = event::trigger(Event::OnScore(pos), &mut eng.state);
        push_fired(eng, &f);
    }
    let f = event::trigger(Event::AfterScore, &mut eng.state);
    push_fired(eng, &f);

    if eng.state.gold_coins != old_gold {
        push_ev(eng, FrontEventKind::GoldChanged, old_gold as i32,
            eng.state.gold_coins as i32, 0, 0);
    }
    if eng.state.tickets != old_tickets {
        push_ev(eng, FrontEventKind::TicketsChanged, old_tickets as i32,
            eng.state.tickets as i32, 0, 0);
    }
}

#[no_mangle]
pub extern "C" fn engine_resolve_ball(ptr: *mut Engine, ball_idx: i32, segment_idx: i32) -> i32 {
    let eng = unsafe { &mut *ptr };
    let bi = ball_idx as usize;
    if bi >= eng.state.balls.len() { return 0; }
    let pos = segment_idx as usize;
    if pos >= eng.state.segments.len() { return 0; }

    let ball = eng.state.balls[bi];
    let gold_before = eng.state.gold_coins;
    for slot in &ball.effects {
        if let Some(effect) = slot {
            eng.state = effect.process(pos, eng.state.clone());
        }
    }
    let f = event::trigger(Event::OnScore(pos), &mut eng.state);
    push_fired(eng, &f);

    let gained = eng.state.gold_coins - gold_before;
    push_ev(eng, FrontEventKind::BallLanded, ball_idx, segment_idx, 0, 0);
    push_ev(eng, FrontEventKind::SegmentScored, segment_idx,
        eng.state.segments[pos].value, gained as i32, 0);
    gained as i32
}

#[no_mangle]
pub extern "C" fn engine_finish_round(ptr: *mut Engine) {
    let eng = unsafe { &mut *ptr };
    let f = event::trigger(Event::AfterScore, &mut eng.state);
    push_fired(eng, &f);
    let won = eng.state.gold_coins >= eng.state.quota;
    push_ev(eng, FrontEventKind::RoundEnded,
        eng.state.gold_coins as i32, eng.state.quota as i32, won as i32, 0);
}

#[no_mangle]
pub extern "C" fn engine_respin(ptr: *mut Engine) -> i32 {
    let eng = unsafe { &mut *ptr };
    if eng.state.gold_coins >= eng.state.quota || !eng.state.respin_available {
        return 0;
    }
    eng.state.respin_available = false;
    engine_spin(ptr);
    1
}

#[no_mangle]
pub extern "C" fn engine_advance_round(ptr: *mut Engine) {
    let eng = unsafe { &mut *ptr };
    eng.state.round += 1;
    eng.state.gold_coins = eng.state.gold_coins.saturating_sub(eng.state.quota);
    eng.state.quota = balance::quota(eng.state.round as u32);
    eng.state.respin_available = true;
    eng.state.tickets += balance::TICKETS_PER_ROUND;
}

#[no_mangle]
pub extern "C" fn engine_shop_generate(ptr: *mut Engine) {
    let eng = unsafe { &mut *ptr };
    eng.shop = Some(Shop::generate(&mut eng.rng));
}

#[no_mangle]
pub extern "C" fn engine_shop_action(ptr: *mut Engine, action_id: i32) -> i32 {
    let eng = unsafe { &mut *ptr };
    let shop = match eng.shop.take() {
        Some(s) => s,
        None => return -1,
    };
    let action = sim::idx_to_action(action_id as usize);
    let old_tickets = eng.state.tickets;
    let old_balls = eng.state.balls.len();
    let old_corruption = eng.state.corruption;
    let (new_shop, new_state) = shop.apply(action, eng.state.clone(), &mut eng.rng);
    if new_state.tickets != old_tickets || old_balls != new_state.balls.len() {
        push_ev(eng, FrontEventKind::ItemBought, action_id, 0, 0, 0);
    }
    if (new_state.corruption - old_corruption).abs() > f64::EPSILON {
        push_ev(eng, FrontEventKind::CorruptionChanged,
            (old_corruption * 1000.0) as i32, (new_state.corruption * 1000.0) as i32, 0, 0);
    }
    if new_state.tickets != old_tickets {
        push_ev(eng, FrontEventKind::TicketsChanged, old_tickets as i32, new_state.tickets as i32, 0, 0);
    }
    eng.state = new_state;
    eng.shop = Some(new_shop);
    0
}

#[repr(C)]
#[derive(Clone, Copy)]
pub struct ShopSlot {
    pub kind: u8,
    pub subtype: u8,
    pub rarity: u8,
    pub alteration: u8,
    pub price: u32,
    pub sold: u8,
}

#[no_mangle]
pub extern "C" fn engine_shop_get(ptr: *mut Engine, out: *mut ShopSlot, max_len: i32) -> i32 {
    let eng = unsafe { &*ptr };
    let shop = match &eng.shop {
        Some(s) => s,
        None => return 0,
    };
    let buf = unsafe { slice::from_raw_parts_mut(out, max_len as usize) };
    let mut n = 0;
    for i in 0..3 {
        if n >= buf.len() { break; }
        let slot = &shop.balls[i];
        let (subtype, rarity) = match &slot.item {
            crate::systems::shop::ShopItem::Ball(ball) => {
                let eff = ball.effects[0].unwrap_or(BallEffect::ScoreOnce);
                (eff as u8, ball.rarity as u8)
            },
            _ => (0, 0),
        };
        buf[n] = ShopSlot {
            kind: 0, subtype, rarity,
            alteration: slot.alteration as u8,
            price: slot.price,
            sold: slot.sold as u8,
        };
        n += 1;
    }
    for i in 0..3 {
        if n >= buf.len() { break; }
        let slot = &shop.relics[i];
        let subtype = match slot.item {
            crate::systems::shop::ShopItem::Relic(id) => id as u8,
            _ => 0,
        };
        buf[n] = ShopSlot {
            kind: 1, subtype, rarity: 0,
            alteration: slot.alteration as u8,
            price: slot.price,
            sold: slot.sold as u8,
        };
        n += 1;
    }
    if n < buf.len() {
        let slot = &shop.upgrade;
        let subtype = match slot.item {
            crate::systems::shop::ShopItem::Upgrade(u) => u as u8,
            _ => 0,
        };
        buf[n] = ShopSlot {
            kind: 2, subtype, rarity: 0,
            alteration: slot.alteration as u8,
            price: slot.price,
            sold: slot.sold as u8,
        };
        n += 1;
    }
    n as i32
}

#[no_mangle]
pub extern "C" fn engine_shop_reroll_cost(ptr: *mut Engine) -> u32 {
    let eng = unsafe { &*ptr };
    match &eng.shop { Some(s) => s.reroll_cost, None => 0 }
}

#[no_mangle]
pub extern "C" fn engine_deal_check(ptr: *mut Engine) -> u8 {
    let eng = unsafe { &*ptr };
    if deals::check_devil_deal(&eng.state) { 1 }
    else if deals::check_angel_deal(&eng.state) { 2 }
    else { 0 }
}

#[no_mangle]
pub extern "C" fn engine_deal_apply_auto(ptr: *mut Engine) {
    let eng = unsafe { &mut *ptr };
    sim::check_deals(&mut eng.state, &mut eng.rng);
}

#[no_mangle]
pub extern "C" fn engine_get_round(ptr: *const Engine) -> u8 {
    unsafe { (*ptr).state.round }
}
#[no_mangle]
pub extern "C" fn engine_get_gold(ptr: *const Engine) -> u32 {
    unsafe { (*ptr).state.gold_coins }
}
#[no_mangle]
pub extern "C" fn engine_get_quota(ptr: *const Engine) -> u32 {
    unsafe { (*ptr).state.quota }
}
#[no_mangle]
pub extern "C" fn engine_get_tickets(ptr: *const Engine) -> u32 {
    unsafe { (*ptr).state.tickets }
}
#[no_mangle]
pub extern "C" fn engine_get_corruption(ptr: *const Engine) -> f64 {
    unsafe { (*ptr).state.corruption }
}
#[no_mangle]
pub extern "C" fn engine_get_ball_count(ptr: *const Engine) -> i32 {
    unsafe { (*ptr).state.balls.len() as i32 }
}
#[no_mangle]
pub extern "C" fn engine_get_relic_count(ptr: *const Engine) -> i32 {
    unsafe { (*ptr).state.relics.len() as i32 }
}
#[no_mangle]
pub extern "C" fn engine_get_upgrade_count(ptr: *const Engine) -> i32 {
    unsafe { (*ptr).state.upgrades.len() as i32 }
}
#[no_mangle]
pub extern "C" fn engine_rounds_per_run() -> u32 {
    balance::ROUNDS_PER_RUN
}

#[repr(C)]
#[derive(Clone, Copy)]
pub struct SegmentFFI {
    pub value: i32,
    pub kind: u8,
}

#[no_mangle]
pub extern "C" fn engine_get_segments(ptr: *const Engine, out: *mut SegmentFFI, max: i32) -> i32 {
    let eng = unsafe { &*ptr };
    let n = eng.state.segments.len().min(max as usize);
    let buf = unsafe { slice::from_raw_parts_mut(out, n) };
    for (i, seg) in eng.state.segments[..n].iter().enumerate() {
        buf[i] = SegmentFFI { value: seg.value, kind: seg.kind as u8 };
    }
    n as i32
}

#[repr(C)]
#[derive(Clone, Copy)]
pub struct BallFFI {
    pub effect: u8,
    pub rarity: u8,
}

#[no_mangle]
pub extern "C" fn engine_get_balls(ptr: *const Engine, out: *mut BallFFI, max: i32) -> i32 {
    let eng = unsafe { &*ptr };
    let n = eng.state.balls.len().min(max as usize);
    let buf = unsafe { slice::from_raw_parts_mut(out, n) };
    for (i, ball) in eng.state.balls[..n].iter().enumerate() {
        let eff = ball.effects[0].unwrap_or(BallEffect::ScoreOnce);
        buf[i] = BallFFI { effect: eff as u8, rarity: ball.rarity as u8 };
    }
    n as i32
}

#[repr(C)]
#[derive(Clone, Copy)]
pub struct FrontEventC {
    pub kind: u8,
    pub a: i32,
    pub b: i32,
    pub c: i32,
    pub d: i32,
}

#[no_mangle]
pub extern "C" fn engine_poll_event(ptr: *mut Engine, out: *mut FrontEvent) -> i32 {
    let eng = unsafe { &mut *ptr };
    if eng.events.is_empty() { return 0; }
    let ev = eng.events.remove(0);
    unsafe { *out = ev; }
    1
}

#[no_mangle]
pub extern "C" fn engine_event_count(ptr: *const Engine) -> i32 {
    unsafe { (*ptr).events.len() as i32 }
}

#[no_mangle]
pub extern "C" fn engine_clear_events(ptr: *mut Engine) {
    unsafe { (*ptr).events.clear(); }
}

#[no_mangle]
pub extern "C" fn engine_roll_segment(ptr: *mut Engine) -> i32 {
    let eng = unsafe { &mut *ptr };
    eng.rng.int(0, eng.state.segments.len() as i32 - 1)
}

#[no_mangle]
pub extern "C" fn engine_set_tickets(ptr: *mut Engine, v: u32) {
    let eng = unsafe { &mut *ptr };
    eng.state.tickets = v;
}

#[no_mangle]
pub extern "C" fn engine_won_round(ptr: *const Engine) -> i32 {
    let eng = unsafe { &*ptr };
    if eng.state.gold_coins >= eng.state.quota { 1 } else { 0 }
}
