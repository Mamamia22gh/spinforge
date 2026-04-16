--[[
    WheelSystem — wheel manipulation.
    Port of legacy/src/systems/WheelSystem.js (framework-agnostic).
]]

local BALANCE = require('src.data.balance').BALANCE
local getSymbol = require('src.data.symbols').getSymbol
local uid = require('src.state').uid

local Wheel = {}
Wheel.__index = Wheel

function Wheel.new(events) return setmetatable({ _events = events }, Wheel) end

function Wheel:getTotalWeight(wheelSegments)
    local total = 0
    for _, s in ipairs(wheelSegments) do total = total + (s.weight or 1) end
    return total
end

function Wheel:pickSegment(wheelSegments, rng)
    local total = self:getTotalWeight(wheelSegments)
    local roll = rng:random() * total
    local acc = 0
    for i, seg in ipairs(wheelSegments) do
        acc = acc + (seg.weight or 1)
        if roll < acc then
            return { index = i - 1, segment = seg }   -- 0-indexed segmentIndex
        end
    end
    return { index = #wheelSegments - 1, segment = wheelSegments[#wheelSegments] }
end

function Wheel:addSegment(run, symbolId)
    if #run.wheel >= BALANCE.MAX_SEGMENTS then return false end
    table.insert(run.wheel, {
        id = uid('seg'),
        symbolId = symbolId,
        weight = 1,
        modifiers = {},
    })
    if self._events then self._events:emit('wheel:segment_added', { symbolId = symbolId }) end
    return true
end

function Wheel:removeSegment(run, index)
    if #run.wheel <= BALANCE.MIN_SEGMENTS then return false end
    if index < 1 or index > #run.wheel then return false end
    local removed = table.remove(run.wheel, index)
    if self._events then self._events:emit('wheel:segment_removed', { segment = removed }) end
    return true
end

function Wheel:upgradeWeight(run, index, amount)
    amount = amount or 1
    local seg = run.wheel[index]
    if not seg then return false end
    seg.weight = math.min(BALANCE.MAX_WEIGHT_PER_SEGMENT, (seg.weight or 1) + amount)
    return true
end

function Wheel:applyUpgrade(run, upgradeId)
    table.insert(run.purchasedUpgrades, upgradeId)
    return true
end

function Wheel:countUpgrade(run, upgradeId)
    local n = 0
    for _, id in ipairs(run.purchasedUpgrades) do
        if id == upgradeId then n = n + 1 end
    end
    return n
end

return Wheel
