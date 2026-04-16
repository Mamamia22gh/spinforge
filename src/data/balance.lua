--[[
    Master balance constants — port of legacy/src/data/balance.js
]]

local BALANCE = {
    ROUNDS_PER_RUN = 12,
    BALLS_PER_ROUND = 5,
    INITIAL_SEGMENTS = 40,

    QUOTA_BASE   = 69,
    QUOTA_GROWTH = 1.2,

    SURPLUS_CONVERSION_RATE = 20,

    MAX_SEGMENTS = 48,
    MIN_SEGMENTS = 20,
    MAX_WEIGHT_PER_SEGMENT = 5,

    -- 0-indexed segment indices (match legacy exactly)
    GOLD_POCKETS = { 14, 24, 34, 44 },

    SHOP_REROLL_BASE = 5,
    SHOP_PRICE_SCALING = 0.5,

    TICKETS_PER_ROUND    = 15,
    TICKETS_BONUS_WIN    = 10,
    TICKETS_BONUS_PERFECT = 5,

    CORRUPTION_START    = 0.5,
    CORRUPTION_PER_SPIN = 0.02,
    CORRUPTION_CRITICAL = 0.85,

    MAX_COIN_DROP    = 40,
    COINS_PER_SURPLUS = 5,
}

local function getQuota(round)
    return math.floor(BALANCE.QUOTA_BASE * (BALANCE.QUOTA_GROWTH ^ (round - 1)))
end

return { BALANCE = BALANCE, getQuota = getQuota }
