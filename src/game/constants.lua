local PAL = require('src.palette')

local C = {
    W = 480, H = 270,
    WHEEL_CX = 240, WHEEL_CY = 140,
    WHEEL_R = 130, UI_RING_R = 115,
    SPRITE_SIZE = 8, CH_W = 4, CH_H = 7,
    PAL = PAL,
}

C.RARITY_COL = {
    common    = PAL.white,
    uncommon  = PAL.green,
    rare      = PAL.blue,
    legendary = PAL.gold,
}

return C
