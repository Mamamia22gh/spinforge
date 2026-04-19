--[[
    ChoiceSystem — ISO with legacy JS ChoiceSystem.js.
    Generates weighted choices with type diversity, applies them.
]]

local CHOICES = require('src.data.choices').CHOICES
local BALANCE = require('src.data.balance').BALANCE
local uid = require('src.state').uid
local WHEEL_UPGRADE_MAP = require('src.data.wheel_upgrades').WHEEL_UPGRADE_MAP

local Choice = {}
Choice.__index = Choice

function Choice.new(events)
    return setmetatable({ _events = events }, Choice)
end

--- Generate 3 random choices for the player (weighted, type-diverse).
function Choice:generate(run, meta, rng)
    local available = {}
    for _, c in ipairs(CHOICES) do
        if self:_isAvailable(c, run, meta) then
            available[#available+1] = c
        end
    end
    if #available == 0 then return {} end

    local count = math.min(3, #available)
    local chosen = {}
    local usedIds = {}
    local usedTypes = {}

    for _ = 1, count do
        local remaining = {}
        for _, c in ipairs(available) do
            if not usedIds[c.id] then remaining[#remaining+1] = c end
        end
        if #remaining == 0 then break end

        -- Type diversity
        local diverse = {}
        for _, c in ipairs(remaining) do
            if not usedTypes[c.type] then diverse[#diverse+1] = c end
        end
        if #diverse > 0 then remaining = diverse end

        -- Weighted pick
        local weights = {}
        for i, c in ipairs(remaining) do weights[i] = c.weight end
        local pick = rng:pickWeighted(remaining, weights)

        -- Clone with instanceId
        local instance = {}
        for k, v in pairs(pick) do instance[k] = v end
        instance.instanceId = uid('choice')
        chosen[#chosen+1] = instance
        usedIds[pick.id] = true
        usedTypes[pick.type] = true
    end

    return chosen
end

--- Apply a chosen option.
--- @param targetIndex number|nil  0-based segment index for remove/boost
function Choice:apply(run, choice, targetIndex, wheelSystem)
    local t = choice.type
    if t == 'wheel_upgrade' then
        local upg = WHEEL_UPGRADE_MAP[choice.payload.upgradeId]
        if upg then
            if not run.purchasedUpgrades then run.purchasedUpgrades = {} end
            -- Store full upgrade object (clone)
            local clone = {}
            for k, v in pairs(upg) do clone[k] = v end
            table.insert(run.purchasedUpgrades, clone)
        end
        return true

    elseif t == 'add_symbol' then
        return wheelSystem:addSegment(run, choice.payload and choice.payload.symbolId or nil)

    elseif t == 'remove_symbol' then
        if targetIndex == nil then
            if self._events then self._events:emit('choice:needs_target', { choice = choice }) end
            return false
        end
        return wheelSystem:removeSegment(run, targetIndex)

    elseif t == 'boost_weight' then
        if targetIndex == nil then
            if self._events then self._events:emit('choice:needs_target', { choice = choice }) end
            return false
        end
        return wheelSystem:boostWeight(run, targetIndex)

    elseif t == 'special_ball' then
        return self:_addSpecialBall(run, choice)

    else
        if self._events then self._events:emit('error', { message = 'Unknown choice type: ' .. tostring(t) }) end
        return false
    end
end

function Choice:_isAvailable(choice, run, meta)
    if choice.requiresUnlock then
        local found = false
        for _, u in ipairs(meta.unlocks) do
            if u == choice.requiresUnlock then found = true; break end
        end
        if not found then return false end
    end
    if choice.minRound and run.round < choice.minRound then return false end

    local t = choice.type
    if t == 'add_symbol' then
        return #run.wheel < BALANCE.MAX_SEGMENTS
    elseif t == 'remove_symbol' then
        return #run.wheel > BALANCE.MIN_SEGMENTS
    elseif t == 'boost_weight' then
        for _, s in ipairs(run.wheel) do
            if s.weight < BALANCE.MAX_WEIGHT_PER_SEGMENT then return true end
        end
        return false
    end
    return true
end

function Choice:_addSpecialBall(run, choice)
    table.insert(run.specialBalls, {
        id = choice.id,
        name = choice.name,
        effect = choice.effect,
        rarity = choice.rarity or 'common',
    })
    run.ballsLeft = run.ballsLeft + 1
    if self._events then
        self._events:emit('special_ball:added', {
            ball = choice,
            totalSpecial = #run.specialBalls,
            ballsLeft = run.ballsLeft,
        })
    end
    return true
end

return Choice
