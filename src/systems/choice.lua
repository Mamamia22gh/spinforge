--[[
    ChoiceSystem — generate and apply choices between rounds.
    Generates and applies between-round reward choices.
]]

local CHOICES = require('src.data.choices').CHOICES
local RELICS_MOD = require('src.data.relics')

local Choice = {}
Choice.__index = Choice

function Choice.new(events)
    return setmetatable({ _events = events }, Choice)
end

function Choice:generate(run, rng, count)
    count = count or 3
    local pool = {}
    -- Wheel upgrades
    for _, c in ipairs(CHOICES) do
        if c.type == 'wheel_upgrade' then pool[#pool+1] = c end
    end
    -- Special balls
    for _, c in ipairs(CHOICES) do
        if c.type == 'special_ball' then pool[#pool+1] = c end
    end
    -- Some relics as choices
    for _, r in ipairs(RELICS_MOD.RELICS) do
        local owned = false
        for _, oid in ipairs(run.relics) do if oid == r.id then owned = true; break end end
        if not owned and (r.rarity == 'common' or r.rarity == 'uncommon') then
            pool[#pool+1] = {
                id = r.id, type = 'relic', name = r.name, desc = r.desc,
                cost = 0, rarity = r.rarity,
            }
        end
    end

    -- shuffle
    for i = #pool, 2, -1 do
        local j = rng:int(1, i)
        pool[i], pool[j] = pool[j], pool[i]
    end

    local picks = {}
    for i = 1, math.min(count, #pool) do picks[i] = pool[i] end
    return picks
end

function Choice:apply(run, choice, wheelSystem)
    if not choice then return false end
    if choice.type == 'relic' then
        table.insert(run.relics, choice.id)
        require('src.systems.effect').applyInstant(run, choice.id)
    elseif choice.type == 'wheel_upgrade' then
        if wheelSystem then wheelSystem:applyUpgrade(run, choice.upgradeId) end
    elseif choice.type == 'special_ball' then
        if choice.ballType == 'generic' then
            run.genericBallsBought = (run.genericBallsBought or 0) + 1
            run.ballsLeft = run.ballsLeft + 1
        else
            table.insert(run.specialBalls, choice.ballType)
        end
    end
    if self._events then self._events:emit('choice:applied', { choice = choice }) end
    return true
end

return Choice
