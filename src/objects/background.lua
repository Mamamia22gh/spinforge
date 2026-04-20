--[[
    Background — ISO port of JS legacy _initBackground (Forge Aura).
    Pre-renders a 488×278 canvas once (Bayer 4×4 dither, radial rays, hiero ring).
    Drawn every frame with bgOx/bgOy parallax offset.

    Dimensions match JS:
      W=480, H=270, BG_PAD=4, WHEEL_CX=240, WHEEL_CY=140
      ORBIT_OUTER=115, HIERO_INNER=174, HIERO_OUTER=220
      numSegs=16
]]

local BG = {}
BG.__index = BG

-- ── Palette (RGBA 0..255) — reads from central palette ────────
local _P = require('src.palette')
local PAL = setmetatable({}, { __index = function(_, k) return _P.rgb(k) end })

-- ── Constants matching JS ────────────────────────────────────
local W, H         = 480, 270
local BG_PAD       = 4
local BW, BH       = W + BG_PAD * 2, H + BG_PAD * 2
local WCX, WCY     = 240, 140
local CX, CY       = WCX + BG_PAD, WCY + BG_PAD
local ORBIT_OUTER  = 115
local AURA_TRANS   = 8
local HIERO_INNER  = 174
local HIERO_OUTER  = 220
local HIERO_MID    = (HIERO_INNER + HIERO_OUTER) / 2
local numSegs      = 16
local TWO_PI       = math.pi * 2

-- Bayer 4×4 ordered dither matrix (0..15)
local BAYER = {
    { 0, 8, 2,10},
    {12, 4,14, 6},
    { 3,11, 1, 9},
    {15, 7,13, 5},
}

-- Menu segments (offsetFromEnd → id, glyph)
local MENU_DEFS = {
    { offsetFromEnd = 12, id = 'catalogue', sprite = 'book',        scale = 1 },
    { offsetFromEnd = 3,  id = 'retry',     sprite = 'arrow_right', scale = 3, label = 'RETRY' },
    { offsetFromEnd = 4,  id = 'settings',  sprite = 'gear',        scale = 1 },
    { offsetFromEnd = 5,  id = 'exit',      sprite = 'exit',        scale = 1 },
}

local function hash(x, y)
    local v = (x * 374761393 + y * 668265263) % 4294967296
    return math.floor(v) % 256
end

-- ────────────────────────────────────────────────────────────
function BG.new()
    local self = setmetatable({
        _time   = 0,
        _image  = nil,
        _menus  = {},
        _hover  = nil,
    }, BG)
    self:_build()
    return self
end

function BG:_build()
    local img = love.image.newImageData(BW, BH)

    -- Precompute hiero segment arcs
    local initAngle = -math.pi/2 - math.pi/numSegs
    local arcs = {}
    for i = 0, numSegs do arcs[i] = i * TWO_PI / numSegs end

    local menuSegs = {}
    for _, def in ipairs(MENU_DEFS) do
        local idx = numSegs - def.offsetFromEnd
        if idx >= 0 and idx < numSegs then menuSegs[idx] = def end
    end

    local function setPx(x, y, c, a)
        img:setPixel(x, y, c[1]/255, c[2]/255, c[3]/255, (a or 255)/255)
    end

    for y = 0, BH - 1 do
        for x = 0, BW - 1 do
            local dx, dy = x - CX, y - CY
            local dist2 = dx*dx + dy*dy

            -- Inside UI ring — fully transparent
            if dist2 < ORBIT_OUTER * ORBIT_OUTER then
                img:setPixel(x, y, 0, 0, 0, 0)
            else
                local dist  = math.sqrt(dist2)
                local bayer = BAYER[(y % 4) + 1][(x % 4) + 1]

                -- Zone attenuation
                local zoneAtt
                if dist < ORBIT_OUTER + AURA_TRANS then
                    zoneAtt = (dist - ORBIT_OUTER) / AURA_TRANS
                else
                    zoneAtt = 1
                end

                -- Edge vignette
                local ex, ey = x - BG_PAD, y - BG_PAD
                local ed = math.min(ex, ey, W - 1 - ex, H - 1 - ey)
                local vignette = math.min(1, ed / 20)

                -- Radial fade
                local radialFade = math.max(0, 1 - math.max(0, dist - ORBIT_OUTER) / 90)

                -- Angle rays
                local angle = math.atan2(dy, dx)

                -- Rim-counter cutout
                if dist >= 94 and dist <= 108 then
                    local ca = angle % TWO_PI
                    if ca < 0 then ca = ca + TWO_PI end
                    if ca >= math.pi/2 - 0.38 and ca <= math.pi/2 + 0.38 then
                        img:setPixel(x, y, 0, 0, 0, 0)
                        goto continue
                    end
                end

                local cR = math.cos(angle * 4)
                local ray  = (cR > 0) and cR^6 or 0
                local ray2 = (cR < 0) and (-cR)^6 or 0

                -- Ring accents
                local ringDist = (dist - ORBIT_OUTER) % 32
                local ring = (dist > ORBIT_OUTER and ringDist < 1.0) and 0.25 or 0

                -- Hiero ring seg
                local hieroSeg = -1
                if dist >= HIERO_INNER and dist <= HIERO_OUTER then
                    local ha = angle - initAngle
                    ha = ha % TWO_PI
                    if ha < 0 then ha = ha + TWO_PI end
                    for i = 0, numSegs - 1 do
                        if ha < arcs[i + 1] then hieroSeg = i; break end
                    end
                    if hieroSeg < 0 then hieroSeg = numSegs - 1 end
                end

                local inHiero = hieroSeg >= 0
                local hieroAtt = inHiero and 1 or zoneAtt
                local brightness = inHiero
                    and (vignette * 0.80)
                    or (hieroAtt * vignette *
                        (0.08 + 0.28 * radialFade + 0.35 * ray * radialFade
                         + 0.15 * ray2 * radialFade + ring * radialFade))
                local threshold = brightness * 16

                local col
                if bayer < threshold then
                    if inHiero then
                        col = (hieroSeg % 2 == 0) and PAL.darkRed or PAL.darkGray
                    else
                        if radialFade > 0.35 and ray > 0.15 then
                            col = PAL.darkGold
                        elseif radialFade > 0.35 and ray2 > 0.15 then
                            col = PAL.midGray
                        else
                            col = PAL.darkGray
                        end
                    end
                else
                    if inHiero then
                        col = (hieroSeg % 2 == 0) and PAL.darkGray or PAL.black
                    else
                        col = (radialFade > 0.35 and ray2 > 0.15) and PAL.darkGray or PAL.black
                    end
                end
                setPx(x, y, col, 255)

                ::continue::
            end
        end
    end

    -- Glint scatter
    for y = 0, BH - 1 do
        for x = 0, BW - 1 do
            local dx, dy = x - CX, y - CY
            if dx*dx + dy*dy >= ORBIT_OUTER * ORBIT_OUTER then
                if hash(x, y) < 2 then setPx(x, y, PAL.midGray, 255) end
            end
        end
    end

    self._image = love.graphics.newImage(img)
    self._image:setFilter("nearest", "nearest")

    -- Store menu segments for hit testing and overlay drawing
    for s = 0, numSegs - 1 do
        local menu = menuSegs[s]
        if menu then
            local startA = initAngle + arcs[s]
            local endA   = initAngle + arcs[s + 1]
            local midA   = (startA + endA) / 2
            self._menus[#self._menus + 1] = {
                id       = menu.id,
                label    = menu.label,
                sprite   = menu.sprite,
                spriteScale = menu.scale or 1,
                startAngle = startA,
                endAngle   = endA,
                midAngle   = midA,
            }
        end
    end
end

function BG:rebuild()
    self:_build()
end

function BG:update(dt) self._time = self._time + dt end
function BG:setHover(id) self._hover = id end

-- Hit-test hieroglyph ring; returns menu id or nil
function BG:hitTest(mx, my)
    local dx, dy = mx - WCX, my - WCY
    local d2 = dx*dx + dy*dy
    if d2 < HIERO_INNER * HIERO_INNER or d2 > HIERO_OUTER * HIERO_OUTER then
        return nil
    end
    local a = math.atan2(dy, dx)
    for _, seg in ipairs(self._menus) do
        local na = a
        while na < seg.startAngle do na = na + TWO_PI end
        while na >= seg.startAngle + TWO_PI do na = na - TWO_PI end
        if na >= seg.startAngle and na < seg.endAngle then return seg.id end
    end
    return nil
end

function BG:getMenus() return self._menus end

function BG:draw(g, font, atlas, bgOx, bgOy)
    bgOx = bgOx or 0; bgOy = bgOy or 0
    love.graphics.setColor(1, 1, 1, 1)
    love.graphics.draw(self._image, -BG_PAD + bgOx, -BG_PAD + bgOy)

    -- Draw menu sprites/labels stamped into ring (ISO legacy: sprite glyphs)
    for _, seg in ipairs(self._menus) do
        local gx = WCX + math.cos(seg.midAngle) * HIERO_MID + bgOx
        local gy = WCY + math.sin(seg.midAngle) * HIERO_MID + bgOy
        if seg.sprite and atlas then
            love.graphics.setColor(1, 1, 1, 1)
            atlas:drawCentered(seg.sprite, math.floor(gx), math.floor(gy), seg.spriteScale or 1)
        end
        if seg.label and font then
            local col = { 0.83, 0.65, 0.13, 1 }
            if self._hover == seg.id then col = { 1, 1, 0.7, 1 } end
            font:drawCentered(seg.label, math.floor(gx), math.floor(gy + 16), col, 2)
        end
    end

    -- Hover highlight (gold arc ring overlay — ISO legacy lines 1060-1075)
    if self._hover then
        for _, seg in ipairs(self._menus) do
            if seg.id == self._hover then
                -- Stencil out the inner circle so we only highlight the ring
                love.graphics.stencil(function()
                    love.graphics.circle('fill',
                        WCX + bgOx, WCY + bgOy, HIERO_INNER + 1)
                end, 'replace', 1)
                love.graphics.setStencilTest('notequal', 1)
                love.graphics.setColor(0.83, 0.65, 0.13, 0.25)
                love.graphics.arc('fill', 'pie',
                    WCX + bgOx, WCY + bgOy, HIERO_OUTER - 1,
                    seg.startAngle, seg.endAngle, 32)
                love.graphics.setStencilTest()
                break
            end
        end
    end
end

return BG
