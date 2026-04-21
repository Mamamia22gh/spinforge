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

C.EVENT = {
    BALL_LANDED = 1,
    SEGMENT_SCORED = 2,
    GOLD_CHANGED = 3,
    TICKETS_CHANGED = 4,
    CORRUPTION_CHANGED = 5,
    RELIC_TRIGGERED = 6,
    UPGRADE_TRIGGERED = 7,
    ROUND_ENDED = 8,
    ITEM_BOUGHT = 9,
}

C.SHOP_ACTION = {
    CONTINUE = 0,
    BUY_BALL_1 = 1, BUY_BALL_2 = 2, BUY_BALL_3 = 3,
    BUY_RELIC_1 = 4, BUY_RELIC_2 = 5, BUY_RELIC_3 = 6,
    BUY_UPGRADE = 7,
    REROLL = 8,
    SELL_BALL = 9,
    SELL_UPGRADE_BASE = 10,
}

return C
