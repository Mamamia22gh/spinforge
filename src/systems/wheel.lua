--[[
    WheelSystem — ISO with legacy JS WheelSystem.js.
    Manages segments, weights, spinning, add/remove/boost.
]]

local BALANCE = require('src.data.balance').BALANCE
local uid = require('src.state').uid
local getSymbol = require('src.data.symbols').getSymbol

local Wheel = {}
Wheel.__index = Wheel

function Wheel.new(events)
    return setmetatable({ _events = events }, Wheel)
end

--- Spin: pick random segment based on weights.
function Wheel:spin(run, rng)
    local wheel = run.wheel
    local totalWeight = 0
    for _, s in ipairs(wheel) do totalWeight = totalWeight + s.weight end

    local roll = rng:random() * totalWeight
    local segmentIndex = 0  -- 0-based

    for i, seg in ipairs(wheel) do
        roll = roll - seg.weight
        if roll <= 0 then segmentIndex = i - 1; break end
    end

    local segment = wheel[segmentIndex + 1]
    local symbol = segment.symbolId and getSymbol(segment.symbolId) or nil

    if self._events then
        self._events:emit('wheel:spun', { segmentIndex = segmentIndex, segment = segment, symbol = symbol })
    end

    return { segmentIndex = segmentIndex, segment = segment, symbol = symbol }
end

--- Get probability breakdown.
function Wheel:getProbabilities(wheel)
    local totalWeight = 0
    for _, seg in ipairs(wheel) do totalWeight = totalWeight + seg.weight end
    if totalWeight == 0 then return {} end

    local map = {}
    local order = {}
    for _, seg in ipairs(wheel) do
        local key = seg.symbolId or '__nil__'
        if not map[key] then
            map[key] = { symbolId = seg.symbolId, weight = 0, count = 0, symbol = seg.symbolId and getSymbol(seg.symbolId) or nil }
            order[#order+1] = key
        end
        map[key].weight = map[key].weight + seg.weight
        map[key].count = map[key].count + 1
    end

    local result = {}
    for _, key in ipairs(order) do
        local e = map[key]
        e.probability = e.weight / totalWeight
        result[#result+1] = e
    end
    return result
end

--- Add a new segment.
function Wheel:addSegment(run, symbolId)
    if #run.wheel >= BALANCE.MAX_SEGMENTS then
        if self._events then self._events:emit('wheel:max_segments') end
        return false
    end
    if symbolId then getSymbol(symbolId) end -- validate
    table.insert(run.wheel, { id = uid('seg'), symbolId = symbolId, weight = 1, modifiers = {} })
    if self._events then self._events:emit('wheel:segment_added', { symbolId = symbolId, totalSegments = #run.wheel }) end
    return true
end

--- Remove a segment by 0-based index.
function Wheel:removeSegment(run, index)
    if #run.wheel <= BALANCE.MIN_SEGMENTS then
        if self._events then self._events:emit('wheel:min_segments') end
        return false
    end
    if index < 0 or index >= #run.wheel then
        if self._events then self._events:emit('wheel:invalid_index', { index = index }) end
        return false
    end
    local removed = table.remove(run.wheel, index + 1)  -- 0-based → 1-based
    if self._events then self._events:emit('wheel:segment_removed', { removed = removed, totalSegments = #run.wheel }) end
    return true
end

--- Boost weight of a segment (0-based index).
function Wheel:boostWeight(run, index)
    local seg = run.wheel[index + 1]  -- 0-based → 1-based
    if not seg then return false end
    if seg.weight >= BALANCE.MAX_WEIGHT_PER_SEGMENT then
        if self._events then self._events:emit('wheel:max_weight', { index = index }) end
        return false
    end
    seg.weight = seg.weight + 1
    if self._events then self._events:emit('wheel:weight_boosted', { index = index, newWeight = seg.weight }) end
    return true
end

return Wheel
