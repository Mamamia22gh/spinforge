--[[
    ShopSystem — ISO with legacy JS ShopSystem.js.

    8-slot layout:
      0-1  → relics
      2-3  → relics
      4    → REROLL (nil in array)
      5    → symbol / generic ball
      6    → special ball
      7    → relic

    Currency: meta.tickets (NOT run.shopCurrency).
    Reroll cost: BASE × 2^rerollCount (exponential, paid with tickets).
]]

local BALANCE       = require('src.data.balance').BALANCE
local RELICS_MOD    = require('src.data.relics')
local SYMBOLS_MOD   = require('src.data.symbols')
local CHOICES       = require('src.data.choices').CHOICES

local Shop = {}
Shop.__index = Shop

function Shop.new(events)
    return setmetatable({ _events = events }, Shop)
end

--- Generate shop offerings (8 slots, slot 4 = reroll = nil).
function Shop:generateOfferings(run, rng)
    local round = run.round
    local weights = RELICS_MOD.getRarityWeights(round)
    local discount = run.shopDiscount or 0

    local function applyCost(baseCost)
        return math.max(1, math.ceil(baseCost * (1 - discount / 100)))
    end

    -- 8-slot array (1-indexed in Lua, but we use indices 1..8 mapping to JS 0..7)
    local offerings = {}
    for i = 1, 8 do offerings[i] = nil end
    -- Slot 5 (JS index 4) = reroll, stays nil

    -- Slot 6 (JS index 5) = symbol
    offerings[6] = self:_pickSymbol(run, rng, weights, applyCost)

    -- Slot 7 (JS index 6) = special ball
    offerings[7] = self:_pickSpecialBall(run, rng, weights, applyCost)

    -- Relic slots: 1,2,3,4,8 (JS indices 0,1,2,3,7)
    local relicSlots = { 1, 2, 3, 4, 8 }
    local relicPicks = self:_pickRelics(run, rng, weights, applyCost, #relicSlots)
    for i, slot in ipairs(relicSlots) do
        offerings[slot] = relicPicks[i] or nil
    end

    return offerings
end

function Shop:_pickSymbol(run, rng, weights, applyCost)
    local available = {}
    for _, s in ipairs(SYMBOLS_MOD.SYMBOLS) do
        if not s.requiresUnlock then
            available[#available+1] = s
        end
    end
    if #available == 0 then return self:_makeGenericBall(applyCost) end

    local w = {}
    for i, s in ipairs(available) do w[i] = weights[s.rarity] or 1 end
    local roll = rng:random()
    local specialChance = math.min(0.7, 0.3 + (run.round - 1) * 0.04)
    if roll > specialChance or #available == 0 then
        return self:_makeGenericBall(applyCost)
    end

    local pick = rng:pickWeighted(available, w)
    return {
        shopType = 'symbol',
        id = pick.id,
        name = pick.name,
        rarity = pick.rarity,
        description = 'Ajoute ' .. pick.name .. ' à la roue',
        finalCost = applyCost(pick.cost),
        symbolId = pick.id,
    }
end

function Shop:_makeGenericBall(applyCost)
    return {
        shopType = 'symbol',
        id = 'generic_ball',
        name = 'Segment',
        rarity = 'common',
        description = 'Ajoute un pocket générique',
        finalCost = applyCost(15),
        symbolId = nil,
    }
end

function Shop:_pickSpecialBall(run, rng, weights, applyCost)
    local balls = {}
    for _, c in ipairs(CHOICES) do
        if c.type == 'special_ball' then
            local ok = true
            if c.minRound and run.round < c.minRound then ok = false end
            if c.requiresUnlock then ok = false end
            if ok then balls[#balls+1] = c end
        end
    end
    if #balls == 0 then
        -- Fallback
        local fb = nil
        for _, c in ipairs(CHOICES) do
            if c.type == 'special_ball' then fb = c; break end
        end
        fb = fb or CHOICES[#CHOICES]
        return {
            shopType = 'special_ball',
            id = fb.id,
            name = fb.name,
            rarity = fb.rarity or 'common',
            description = fb.description,
            finalCost = applyCost(fb.cost or 20),
            effect = fb.effect,
        }
    end

    local w = {}
    for i, c in ipairs(balls) do w[i] = (weights[c.rarity] or 1) * c.weight end
    local pick = rng:pickWeighted(balls, w)
    return {
        shopType = 'special_ball',
        id = pick.id,
        name = pick.name,
        rarity = pick.rarity or 'common',
        description = pick.description,
        finalCost = applyCost(pick.cost or 20),
        effect = pick.effect,
    }
end

function Shop:_pickRelics(run, rng, weights, applyCost, count)
    local available = {}
    for _, r in ipairs(RELICS_MOD.RELICS) do
        if r.minRound <= run.round then
            local owned = false
            for _, owned_r in ipairs(run.relics) do
                if owned_r.id == r.id then owned = true; break end
            end
            if not owned then available[#available+1] = r end
        end
    end

    local picks = {}
    local usedIds = {}

    for _ = 1, count do
        local pool = {}
        for _, r in ipairs(available) do
            if not usedIds[r.id] then pool[#pool+1] = r end
        end
        if #pool == 0 then
            picks[#picks+1] = nil
        else
            local w = {}
            for i, r in ipairs(pool) do w[i] = weights[r.rarity] or 1 end
            local pick = rng:pickWeighted(pool, w)
            local offering = {
                shopType = 'relic',
                finalCost = applyCost(pick.cost),
            }
            -- Copy all relic fields
            for k, v in pairs(pick) do offering[k] = v end
            offering.finalCost = applyCost(pick.cost)
            picks[#picks+1] = offering
            usedIds[pick.id] = true
        end
    end

    return picks
end

--- Buy any item from shop offerings (paid with meta.tickets).
function Shop:buyItem(run, meta, slotIndex, wheelSystem)
    local offering = run.shopOfferings[slotIndex]
    if not offering then
        if self._events then self._events:emit('shop:invalid_offering', { slotIndex = slotIndex }) end
        return false
    end

    if meta.tickets < offering.finalCost then
        if self._events then self._events:emit('shop:insufficient_funds', { cost = offering.finalCost, available = meta.tickets }) end
        return false
    end

    meta.tickets = meta.tickets - offering.finalCost

    local st = offering.shopType
    if st == 'relic' then
        table.insert(run.relics, offering)

    elseif st == 'symbol' then
        if offering.id == 'generic_ball' then
            run.ballsLeft = run.ballsLeft + 1
            run.genericBallsBought = (run.genericBallsBought or 0) + 1
        else
            wheelSystem:addSegment(run, offering.symbolId)
        end

    elseif st == 'special_ball' then
        table.insert(run.specialBalls, {
            id = offering.id,
            name = offering.name,
            effect = offering.effect,
            rarity = offering.rarity,
        })
        run.ballsLeft = run.ballsLeft + 1
        if self._events then
            self._events:emit('special_ball:added', {
                ball = offering,
                totalSpecial = #run.specialBalls,
                ballsLeft = run.ballsLeft,
            })
        end

    else
        -- Treat as relic for backwards compat
        table.insert(run.relics, offering)
    end

    run.shopOfferings[slotIndex] = nil

    if self._events then
        self._events:emit('shop:item_bought', {
            item = offering,
            cost = offering.finalCost,
            remaining = meta.tickets,
        })
    end
    return true
end

--- Reroll shop offerings (paid with meta.tickets, exponential cost).
function Shop:reroll(run, meta, rng)
    local cost = BALANCE.SHOP_REROLL_BASE * math.pow(2, run.rerollCount)

    if meta.tickets < cost then
        if self._events then self._events:emit('shop:insufficient_funds', { cost = cost, available = meta.tickets }) end
        return false
    end

    meta.tickets = meta.tickets - cost
    run.rerollCount = run.rerollCount + 1
    run.shopOfferings = self:generateOfferings(run, rng)

    if self._events then self._events:emit('shop:rerolled', { cost = cost, offerings = run.shopOfferings }) end
    return true
end

function Shop:rerollCost(run)
    return BALANCE.SHOP_REROLL_BASE * math.pow(2, run.rerollCount or 0)
end

return Shop
