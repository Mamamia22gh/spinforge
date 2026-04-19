--[[
    Wheel symbols — matches legacy JS symbols.js (empty pool, scored by pocket number).
]]

local SYMBOLS = {}

local SYMBOL_MAP = {}

local function getSymbol(id)
    local s = SYMBOL_MAP[id]
    if not s then error('Unknown symbol: ' .. tostring(id)) end
    return s
end

local RARITY_WEIGHTS = { common = 50, uncommon = 30, rare = 15, legendary = 5 }

return {
    SYMBOLS = SYMBOLS,
    SYMBOL_MAP = SYMBOL_MAP,
    getSymbol = getSymbol,
    RARITY_WEIGHTS = RARITY_WEIGHTS,
}
