--[[
    Seeded RNG — Mulberry32 port from legacy/src/core/RNG.js
]]

local RNG = {}
RNG.__index = RNG

function RNG.new(seed)
    local self = setmetatable({}, RNG)
    self._state = seed or math.floor(love.timer.getTime() * 1e6)
    return self
end

local function u32(x)
    return x % 0x100000000
end

function RNG:random()
    self._state = u32(self._state + 0x6D2B79F5)
    local t = self._state
    t = u32(bit.bxor(t, bit.rshift(t, 15)) * bit.bor(t, 1))
    t = u32(t + bit.bxor(t, bit.rshift(t, 7)) * bit.bor(t, 61))
    return u32(bit.bxor(t, bit.rshift(t, 14))) / 0x100000000
end

function RNG:int(min, max)
    return math.floor(self:random() * (max - min + 1)) + min
end

function RNG:pick(list)
    if #list == 0 then return nil end
    return list[self:int(1, #list)]
end

function RNG:weighted(items, weightKey)
    weightKey = weightKey or 'weight'
    local total = 0
    for _, it in ipairs(items) do total = total + (it[weightKey] or 1) end
    local r = self:random() * total
    local acc = 0
    for _, it in ipairs(items) do
        acc = acc + (it[weightKey] or 1)
        if r <= acc then return it end
    end
    return items[#items]
end

function RNG:shuffle(list)
    for i = #list, 2, -1 do
        local j = self:int(1, i)
        list[i], list[j] = list[j], list[i]
    end
    return list
end

return RNG
