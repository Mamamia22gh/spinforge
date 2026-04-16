--[[
    Symbol definitions — currently empty placeholder list (legacy was emptied).
]]

local SYMBOLS = {}

local function getSymbol(id)
    for _, s in ipairs(SYMBOLS) do
        if s.id == id then return s end
    end
    return nil
end

return { SYMBOLS = SYMBOLS, getSymbol = getSymbol }
