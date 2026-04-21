--[[
    ChoiceSystem — generates and applies between-round upgrade choices.
    ISO with legacy JS choices logic.
]]

local ChoiceData = require('src.data.choices')
local CHOICES    = ChoiceData.CHOICES
local getSymbol  = require('src.data.symbols').getSymbol
local BALANCE    = require('src.data.balance').BALANCE

local Choice = {}
Choice.__index = Choice

function Choice.new(events)
    return setmetatable({ events = events }, Choice)
end

function Choice:generate(run, meta, rng)
    local round = run.round
    local pool = {}
    for _, c in ipairs(CHOICES) do
        if round >= c.minRound then
            if not c.requiresUnlock or meta[c.requiresUnlock] then
                table.insert(pool, c)
            end
        end
    end

    local count = math.min(BALANCE.CHOICES_PER_ROUND or 3, #pool)
    local picked = {}
    local used = {}

    local totalWeight = 0
    for _, c in ipairs(pool) do totalWeight = totalWeight + c.weight end

    for _ = 1, count do
        local roll = rng:random() * totalWeight
        local acc = 0
        for i, c in ipairs(pool) do
            if not used[i] then
                acc = acc + c.weight
                if roll <= acc then
                    table.insert(picked, c)
                    used[i] = true
                    totalWeight = totalWeight - c.weight
                    break
                end
            end
        end
    end

    return picked
end

function Choice:apply(run, choice, targetIndex, wheel)
    local t = choice.type

    if t == 'add_symbol' then
        local symId = choice.payload and choice.payload.symbolId
        local sym
        if symId then
            sym = getSymbol(symId)
        else
            sym = { id = 'generic', name = 'Generic', baseValue = 1 }
        end
        wheel:addSegment(run, sym)
        return true

    elseif t == 'remove_symbol' then
        if not targetIndex then return false end
        return wheel:removeSegment(run, targetIndex)

    elseif t == 'boost_weight' then
        if not targetIndex then return false end
        local seg = run.segments[targetIndex]
        if not seg then return false end
        seg.weight = (seg.weight or 1) + 1
        self.events:emit('choice:boost_weight', { index = targetIndex, newWeight = seg.weight })
        return true

    elseif t == 'wheel_upgrade' then
        local uid = choice.payload and choice.payload.upgradeId
        if uid == 'upgrade_value_plus2' then
            run.valuePlus2 = (run.valuePlus2 or 0) + 1
            self.events:emit('choice:wheel_upgrade', { upgradeId = uid, stacks = run.valuePlus2 })
        end
        return true

    elseif t == 'special_ball' then
        local ball = {
            effect = choice.effect,
            rarity = choice.rarity,
            name   = choice.name,
        }
        run.specialBalls = run.specialBalls or {}
        table.insert(run.specialBalls, ball)
        self.events:emit('choice:special_ball', { ball = ball })
        return true
    end

    return false
end

return Choice
