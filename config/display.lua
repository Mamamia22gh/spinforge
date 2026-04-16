--[[
    Display bundle configuration
]]
return {
    -- Logical resolution
    width  = 480,
    height = 640,

    -- Background clear color
    clearColor = { 0.05, 0.05, 0.1, 1 },

    -- Post-FX
    postfx = {
        enabled   = true,
        scanlines = 0.06,
        vignette  = 0.25,
        chroma    = 0.5,
    },

    -- 16-color palette (Dawnbringer DB16)
    palette = {
        "140c1c", "442434", "30346d", "4e4a4e",
        "854c30", "346524", "d04648", "757161",
        "597dce", "d27d2c", "8595a1", "6daa2c",
        "d2aa99", "6dc2ca", "dad45e", "deeed6",
    },
}
