--[[
    EffectSystem — apply relic effects.
    Aggregates relic effects into per-stat getters.
]]

local getRelic = require('src.data.relics').getRelic

local Effect = {}

function Effect.applyInstant(run, relicId)
    local relic = getRelic(relicId)
    if not relic or not relic.effect then return end
    local e = relic.effect
    if e.type == 'instant_gold' then
        run.shopCurrency = (run.shopCurrency or 0) + e.value
    end
end

function Effect.getScoreFlatBonus(run)
    local bonus = 0
    for _, id in ipairs(run.relics) do
        local r = getRelic(id)
        if r and r.effect and r.effect.type == 'score_flat' then
            bonus = bonus + r.effect.value
        end
    end
    return bonus
end

function Effect.getGoldMultiplier(run)
    local mult = 1
    for _, id in ipairs(run.relics) do
        local r = getRelic(id)
        if r and r.effect and r.effect.type == 'gold_mult' then
            mult = mult * r.effect.value
        end
    end
    return mult
end

function Effect.getExtraBalls(run)
    local n = 0
    for _, id in ipairs(run.relics) do
        local r = getRelic(id)
        if r and r.effect and r.effect.type == 'extra_ball' then
            n = n + r.effect.value
        end
    end
    return n
end

function Effect.getBonusTickets(run)
    local n = 0
    for _, id in ipairs(run.relics) do
        local r = getRelic(id)
        if r and r.effect and r.effect.type == 'bonus_tickets' then
            n = n + r.effect.value
        end
    end
    return n
end

function Effect.getRerollDiscount(run)
    local d = 0
    for _, id in ipairs(run.relics) do
        local r = getRelic(id)
        if r and r.effect and r.effect.type == 'reroll_discount' then
            d = d + r.effect.value
        end
    end
    return d
end

function Effect.getGoldPocketMult(run)
    local best = 2
    for _, id in ipairs(run.relics) do
        local r = getRelic(id)
        if r and r.effect and r.effect.type == 'gold_pocket_mult' then
            if r.effect.value > best then best = r.effect.value end
        end
    end
    return best
end

function Effect.getPerfectMult(run)
    for _, id in ipairs(run.relics) do
        local r = getRelic(id)
        if r and r.effect and r.effect.type == 'perfect_mult' then
            return r.effect.value
        end
    end
    return 1
end

return Effect
