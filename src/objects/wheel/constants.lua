local PAL = require('src.palette')

local C = {}

C.HUB_P          = 0.28
C.HUB_COLLIDE_P  = 0.32
C.POCKET_INNER_P = 0.30
C.POCKET_OUTER_P = 0.37
C.LABEL_P        = 0.425
C.LABEL_INNER_P  = 0.38
C.LABEL_OUTER_P  = 0.48
C.RIM_P          = 0.55
C.BALL_RADIUS_P  = 0.008

C.BOWL_GRAVITY   = 120
C.RESTITUTION    = 0.5
C.AIR_DAMPING    = 0.997
C.SURFACE_FRICTION = 220
C.SETTLE_SPEED   = 15
C.SETTLE_ANG_VEL = 0.3
C.SETTLE_TIME    = 0.15
C.PHYSICS_DT     = 1/120
C.SPIN_MIN       = 10
C.SPIN_MAX       = 14
C.SPIN_DECEL     = 0.996
C.GRAVITY_BOOST_THRESHOLD = 2.5
C.GRAVITY_BOOST_MAX = 6

C.DROP_STAGGER   = 0.05
C.DROP_DURATION  = 0.50
C.GAUGE_SPAN     = 0.60
C.TWO_PI         = math.pi * 2

C.GAUGE_CONFIGS = {
    { center = 0,               start = -0.30,              eend = 0.30 },
    { center = -math.pi/2,      start = -math.pi/2 - 0.30, eend = -math.pi/2 + 0.30 },
    { center =  math.pi/2,      start =  math.pi/2 - 0.30, eend =  math.pi/2 + 0.30 },
    { center =  math.pi,        start =  math.pi - 0.30,   eend =  math.pi + 0.30 },
}
C.MAX_BALLS_PER_GAUGE = 14
C.GAUGE_BALL_SPACING  = 0.04

C.SETTINGS_GAP   = 0.10
C.SETTINGS_COUNT = 4
C.SETTINGS_SECT_SPAN = (C.TWO_PI / C.SETTINGS_COUNT) - C.SETTINGS_GAP

function C.settingsSectStart(s)
    return -math.pi/2 + (s - 1) * (C.TWO_PI / C.SETTINGS_COUNT) + C.SETTINGS_GAP / 2
end

function C.drawAnnularArc(cx, cy, innerR, outerR, a0, a1, segments)
    segments = segments or 32
    local span = a1 - a0
    for i = 0, segments - 1 do
        local aa = a0 + span * (i / segments)
        local bb = a0 + span * ((i + 1) / segments)
        local cA, sA = math.cos(aa), math.sin(aa)
        local cB, sB = math.cos(bb), math.sin(bb)
        love.graphics.polygon('fill',
            cx + cA * innerR, cy + sA * innerR,
            cx + cA * outerR, cy + sA * outerR,
            cx + cB * outerR, cy + sB * outerR,
            cx + cB * innerR, cy + sB * innerR)
    end
end

C.SEG_A         = PAL.segA
C.SEG_B         = PAL.segB
C.DIVIDER_COLOR = PAL.dividerColor
C.HUB_BG        = PAL.hubBg
C.HUB_BORDER    = PAL.hubBorder
C.RIM_COLOR     = PAL.rimColor
C.PAL           = PAL

return C
