--[[
    Seeded RNG — Mulberry32 algorithm.
    API matches legacy JS RNG class.
]]

local RNG = {}
RNG.__index = RNG

function RNG.new(seed)
    local self = setmetatable({}, RNG)
    local s = seed or math.floor(love.timer.getTime() * 1e6)
    self._initialSeed = s % 0x100000000
    self._state = self._initialSeed
    return self
end

function RNG:getSeed() return self._initialSeed end

local function u32(x)
    return x % 0x100000000
end

--- next() → [0, 1)  (matches JS .next())
function RNG:random()
    self._state = u32(self._state + 0x6D2B79F5)
    local t = self._state
    t = u32(bit.bxor(t, bit.rshift(t, 15)) * bit.bor(t, 1))
    t = u32(t + bit.bxor(t, bit.rshift(t, 7)) * bit.bor(t, 61))
    return u32(bit.bxor(t, bit.rshift(t, 14))) / 0x100000000
end

--- nextInt(min, max) inclusive
function RNG:int(min, max)
    return math.floor(self:random() * (max - min + 1)) + min
end

--- nextFloat(min, max)
function RNG:float(min, max)
    return self:random() * (max - min) + min
end

--- chance(p)
function RNG:chance(p) return self:random() < p end

--- pick(arr) — random element
function RNG:pick(arr)
    if #arr == 0 then error('Cannot pick from empty array') end
    return arr[self:int(1, #arr)]
end

--- pickWeighted(items, weights) — ISO with JS pickWeighted
function RNG:pickWeighted(items, weights)
    if #items == 0 then error('Cannot pick from empty array') end
    local total = 0
    for _, w in ipairs(weights) do total = total + w end
    if total <= 0 then error('Total weight must be positive') end
    local roll = self:random() * total
    for i, item in ipairs(items) do
        roll = roll - weights[i]
        if roll <= 0 then return item end
    end
    return items[#items]
end

--- shuffle(arr) — in-place
function RNG:shuffle(arr)
    for i = #arr, 2, -1 do
        local j = self:int(1, i)
        arr[i], arr[j] = arr[j], arr[i]
    end
    return arr
end

--- pickN(arr, n)
function RNG:pickN(arr, n)
    if n > #arr then error('Cannot pick ' .. n .. ' from ' .. #arr) end
    local copy = {}
    for i, v in ipairs(arr) do copy[i] = v end
    self:shuffle(copy)
    local result = {}
    for i = 1, n do result[i] = copy[i] end
    return result
end

--- fork()
function RNG:fork()
    return RNG.new(math.floor(self:random() * 0x100000000))
end

return RNG
