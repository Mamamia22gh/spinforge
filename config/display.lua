--[[
    Display bundle configuration — ISO with JS legacy (480×270 landscape)
]]
return {
    -- Logical resolution (matches JS: W=480, H=270)
    width  = 480,
    height = 270,

    -- Background clear color (casino black)
    clearColor = { 0.04, 0.04, 0.04, 1 },

    -- Post-FX
    postfx = {
        enabled   = true,
        scanlines = 0.06,
        vignette  = 0.25,
        chroma    = 0.005,
        grain     = 0.08,
    },

    -- 16-color palette — ISO with JS PaletteDB casino-dark
    palette = {
        "0a0a0a", -- black
        "1a1a2e", -- darkGray
        "333346", -- midGray
        "6a6a7a", -- lightGray
        "e8e0d0", -- white
        "cc2233", -- red
        "6e1127", -- darkRed
        "2b4ccc", -- blue
        "162266", -- darkBlue
        "d4a520", -- gold
        "7a5e10", -- darkGold
        "22aa44", -- green
        "105522", -- darkGreen
        "8833cc", -- purple
        "441a66", -- darkPurple
        "ff44aa", -- neonPink
    },
}
