-- engine.lua — FFI bridge to spinforge-engine.dll
-- All game logic lives in Rust. This module exposes it to Lua.

local ffi = require('ffi')

ffi.cdef[[
typedef struct { uint8_t kind; int32_t a, b, c, d; } FrontEvent;
typedef struct { int32_t value; uint8_t kind; } SegmentFFI;
typedef struct { uint8_t effect; uint8_t rarity; } BallFFI;
typedef struct { uint8_t kind; uint8_t subtype; uint8_t rarity; uint8_t alteration; uint32_t price; uint8_t sold; } ShopSlot;

void* engine_new(uint32_t seed);
void  engine_free(void* ptr);
void  engine_restart(void* ptr);
void  engine_spin(void* ptr);
int32_t engine_resolve_ball(void* ptr, int32_t ball_idx, int32_t segment_idx);
void  engine_finish_round(void* ptr);
int32_t engine_respin(void* ptr);
void  engine_advance_round(void* ptr);
void  engine_shop_generate(void* ptr);
int32_t engine_shop_action(void* ptr, int32_t action_id);
int32_t engine_shop_get(void* ptr, ShopSlot* out, int32_t max_len);
uint32_t engine_shop_reroll_cost(void* ptr);
uint8_t engine_deal_check(void* ptr);
void  engine_deal_apply_auto(void* ptr);
uint8_t engine_get_round(void* ptr);
uint32_t engine_get_gold(void* ptr);
uint32_t engine_get_quota(void* ptr);
uint32_t engine_get_tickets(void* ptr);
double engine_get_corruption(void* ptr);
int32_t engine_get_ball_count(void* ptr);
int32_t engine_get_relic_count(void* ptr);
int32_t engine_get_upgrade_count(void* ptr);
uint32_t engine_rounds_per_run();
int32_t engine_get_segments(void* ptr, SegmentFFI* out, int32_t max);
int32_t engine_get_balls(void* ptr, BallFFI* out, int32_t max);
int32_t engine_poll_event(void* ptr, FrontEvent* out);
int32_t engine_event_count(void* ptr);
void  engine_clear_events(void* ptr);
int32_t engine_roll_segment(void* ptr);
void  engine_set_tickets(void* ptr, uint32_t v);
int32_t engine_won_round(void* ptr);
]]

local lib = ffi.load('spinforge_engine')
local _ev = ffi.new('FrontEvent[1]')
local _seg = ffi.new('SegmentFFI[40]')
local _ball = ffi.new('BallFFI[32]')
local _shop = ffi.new('ShopSlot[8]')

local E = {}
E.__index = E

function E.new(seed)
    local ptr = lib.engine_new(seed or math.floor(love.timer.getTime() * 1e6))
    return setmetatable({ _ptr = ptr }, E)
end

function E:free() if self._ptr then lib.engine_free(self._ptr); self._ptr = nil end end
function E:restart() lib.engine_restart(self._ptr) end
function E:spin() lib.engine_spin(self._ptr) end
function E:resolveBall(bi, si) return lib.engine_resolve_ball(self._ptr, bi, si) end
function E:finishRound() lib.engine_finish_round(self._ptr) end
function E:respin() return lib.engine_respin(self._ptr) end
function E:advanceRound() lib.engine_advance_round(self._ptr) end
function E:shopGenerate() lib.engine_shop_generate(self._ptr) end
function E:shopAction(id) return lib.engine_shop_action(self._ptr, id) end
function E:dealCheck() return lib.engine_deal_check(self._ptr) end
function E:dealApply() lib.engine_deal_apply_auto(self._ptr) end
function E:rollSegment() return lib.engine_roll_segment(self._ptr) end
function E:setTickets(v) lib.engine_set_tickets(self._ptr, v) end
function E:wonRound() return lib.engine_won_round(self._ptr) == 1 end

function E:round() return lib.engine_get_round(self._ptr) end
function E:gold() return tonumber(lib.engine_get_gold(self._ptr)) end
function E:quota() return tonumber(lib.engine_get_quota(self._ptr)) end
function E:tickets() return tonumber(lib.engine_get_tickets(self._ptr)) end
function E:corruption() return tonumber(lib.engine_get_corruption(self._ptr)) end
function E:ballCount() return lib.engine_get_ball_count(self._ptr) end
function E:relicCount() return lib.engine_get_relic_count(self._ptr) end
function E:upgradeCount() return lib.engine_get_upgrade_count(self._ptr) end
function E:roundsPerRun() return tonumber(lib.engine_rounds_per_run()) end

function E:segments()
    local n = lib.engine_get_segments(self._ptr, _seg, 40)
    local out = {}
    for i = 0, n - 1 do
        out[i + 1] = { value = tonumber(_seg[i].value), kind = _seg[i].kind }
    end
    return out
end

function E:balls()
    local n = lib.engine_get_balls(self._ptr, _ball, 32)
    local out = {}
    for i = 0, n - 1 do
        out[i + 1] = { effect = _ball[i].effect, rarity = _ball[i].rarity }
    end
    return out
end

function E:shopSlots()
    local n = lib.engine_shop_get(self._ptr, _shop, 8)
    local out = {}
    for i = 0, n - 1 do
        out[i + 1] = {
            kind = _shop[i].kind, subtype = _shop[i].subtype,
            rarity = _shop[i].rarity, alteration = _shop[i].alteration,
            price = tonumber(_shop[i].price),
            sold = _shop[i].sold ~= 0,
        }
    end
    return out
end

function E:shopRerollCost() return tonumber(lib.engine_shop_reroll_cost(self._ptr)) end

function E:pollEvents()
    local events = {}
    while lib.engine_poll_event(self._ptr, _ev) == 1 do
        events[#events + 1] = {
            kind = _ev[0].kind,
            a = tonumber(_ev[0].a), b = tonumber(_ev[0].b),
            c = tonumber(_ev[0].c), d = tonumber(_ev[0].d),
        }
    end
    return events
end

function E:clearEvents() lib.engine_clear_events(self._ptr) end

return E
