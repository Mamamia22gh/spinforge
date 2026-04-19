--[[ Central palette — port of legacy/client/gfx/PaletteDB.js
     16-color casino-dark PICO-8 palette, the entire game pulls from here. ]]

local function hex(h)
    h = h:gsub("#", "")
    local r = tonumber(h:sub(1,2), 16) / 255
    local g = tonumber(h:sub(3,4), 16) / 255
    local b = tonumber(h:sub(5,6), 16) / 255
    return { r, g, b, 1 }
end

local PAL = {
    black      = hex("#0a0a0a"),
    darkGray   = hex("#1a1a2e"),
    midGray    = hex("#333346"),
    lightGray  = hex("#6a6a7a"),
    white      = hex("#e8e0d0"),

    red        = hex("#cc2233"),
    darkRed    = hex("#6e1127"),
    blue       = hex("#2b4ccc"),
    darkBlue   = hex("#162266"),
    gold       = hex("#d4a520"),
    darkGold   = hex("#7a5e10"),
    green      = hex("#22aa44"),
    darkGreen  = hex("#105522"),
    purple     = hex("#8833cc"),
    darkPurple = hex("#441a66"),

    neonPink   = hex("#ff44aa"),
    cyan       = hex("#44aadd"),
    darkCyan   = hex("#0088bb"),

    deepBlue   = hex("#0e1144"),
    shadedBlue = hex("#1a2e88"),
    shadedCyan = hex("#337799"),
}

-- Segment alternation & UI chrome references
PAL.segA          = PAL.darkGray
PAL.segB          = PAL.black
PAL.dividerColor  = PAL.black
PAL.hubBg         = PAL.black
PAL.hubBorder     = PAL.midGray
PAL.rimColor      = PAL.darkGray

return PAL
