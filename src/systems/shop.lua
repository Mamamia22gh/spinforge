--[[
    ShopSystem — generate & resolve shop offerings.
    Generates shop offerings, handles purchases and rerolls.
]]

local BALANCE       = require('src.data.balance').BALANCE
local RELICS_MOD    = require('src.data.relics')
local CHOICES       = require('src.data.choices').CHOICES
local Effect        = require('src.systems.effect')

local Shop = {}
Shop.__index = Shop

function Shop.new(events)
    return setmetatable({ _events = events }, Shop)
end

local function filterByRarity(pool, rarity)
    local out = {}
    for _, i in ipairs(pool) do
        if i.rarity == rarity then out[#out+1] = i end
    end
    return out
end

local function rollRelic(run, rng)
    local weights = RELICS_MOD.getRarityWeights()
    local total = 0
    for _, w in pairs(weights) do total = total + w end

    local roll = rng:random() * total
    local acc = 0
    local rarity = 'common'
    for _, r in ipairs({ 'common', 'uncommon', 'rare', 'legendary' }) do
        acc = acc + (weights[r] or 0)
        if roll < acc then rarity = r; break end
    end

    -- filter out already owned
    local pool = {}
    for _, r in ipairs(RELICS_MOD.RELICS) do
        if r.rarity == rarity then
            local owned = false
            for _, owned_id in ipairs(run.relics) do
                if owned_id == r.id then owned = true; break end
            end
            if not owned then pool[#pool+1] = r end
        end
    end
    if #pool == 0 then
        -- fallback any rarity
        for _, r in ipairs(RELICS_MOD.RELICS) do
            local owned = false
            for _, oid in ipairs(run.relics) do if oid == r.id then owned = true; break end end
            if not owned then pool[#pool+1] = r end
        end
    end
    if #pool == 0 then return nil end
    return pool[rng:int(1, #pool)]
end

function Shop:generateOfferings(run, rng)
    local discount = run.shopDiscount or 0
    local scale = 1 + BALANCE.SHOP_PRICE_SCALING * (run.round - 1)

    local offerings = {}

    -- 1 wheel upgrade slot
    local upgradePool = {}
    for _, c in ipairs(CHOICES) do
        if c.type == 'wheel_upgrade' then upgradePool[#upgradePool+1] = c end
    end
    if #upgradePool > 0 then
        local u = upgradePool[rng:int(1, #upgradePool)]
        offerings[#offerings+1] = {
            shopType = 'wheel_upgrade',
            id = u.id, name = u.name, desc = u.desc, rarity = u.rarity or 'common',
            upgradeId = u.upgradeId,
            cost = math.max(1, math.floor(u.cost * scale) - discount),
        }
    end

    -- 1 special ball slot
    local ballPool = {}
    for _, c in ipairs(CHOICES) do
        if c.type == 'special_ball' then ballPool[#ballPool+1] = c end
    end
    if #ballPool > 0 then
        local b = ballPool[rng:int(1, #ballPool)]
        offerings[#offerings+1] = {
            shopType = 'special_ball',
            id = b.id, name = b.name, desc = b.desc, rarity = b.rarity or 'common',
            ballType = b.ballType,
            cost = math.max(1, math.floor(b.cost * scale) - discount),
        }
    end

    -- Fill remaining slots with relics (target 4 offerings total)
    local target = 4
    while #offerings < target do
        local relic = rollRelic(run, rng)
        if not relic then break end
        -- avoid dupes within offerings
        local dup = false
        for _, o in ipairs(offerings) do
            if o.shopType == 'relic' and o.id == relic.id then dup = true; break end
        end
        if not dup then
            offerings[#offerings+1] = {
                shopType = 'relic',
                id = relic.id, name = relic.name, desc = relic.desc, rarity = relic.rarity,
                cost = math.max(1, math.floor(relic.cost * scale) - discount),
            }
        end
    end

    return offerings
end

function Shop:buyItem(run, meta, slotIndex, wheelSystem)
    local offering = run.shopOfferings[slotIndex]
    if not offering then return { ok = false, reason = 'empty_slot' } end
    if run.shopCurrency < offering.cost then return { ok = false, reason = 'not_enough_gold' } end

    run.shopCurrency = run.shopCurrency - offering.cost

    if offering.shopType == 'relic' then
        table.insert(run.relics, offering.id)
        Effect.applyInstant(run, offering.id)
    elseif offering.shopType == 'wheel_upgrade' then
        if wheelSystem then wheelSystem:applyUpgrade(run, offering.upgradeId) end
    elseif offering.shopType == 'special_ball' then
        if offering.ballType == 'generic' then
            run.genericBallsBought = (run.genericBallsBought or 0) + 1
            run.ballsLeft = run.ballsLeft + 1
        else
            table.insert(run.specialBalls, offering.ballType)
        end
    end

    run.shopOfferings[slotIndex] = false -- mark as sold (null)
    if self._events then self._events:emit('shop:bought', { offering = offering }) end
    return { ok = true, offering = offering }
end

function Shop:reroll(run, meta, rng)
    local baseCost = BALANCE.SHOP_REROLL_BASE + (run.rerollCount or 0) * 2
    local cost = math.max(1, baseCost - Effect.getRerollDiscount(run))
    if run.shopCurrency < cost then return { ok = false, reason = 'not_enough_gold' } end
    run.shopCurrency = run.shopCurrency - cost
    run.rerollCount = (run.rerollCount or 0) + 1
    run.shopOfferings = self:generateOfferings(run, rng)
    if self._events then self._events:emit('shop:rerolled', { cost = cost, offerings = run.shopOfferings }) end
    return { ok = true, cost = cost }
end

function Shop:rerollCost(run)
    local base = BALANCE.SHOP_REROLL_BASE + (run.rerollCount or 0) * 2
    return math.max(1, base - Effect.getRerollDiscount(run))
end

return Shop
