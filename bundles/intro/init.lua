--[[
    IntroBundle — ISO port of legacy/client/intro.js
    Phase 0 : click-to-start (pulsing raccoon + CLICK TO START)
    Phase 1 : JOJO'S DEN logo (raccoon materialize, typewriter, slam, underlines)
    Phase 2 : wheel build (spark, hub, pockets, labels, rim, hiero, title, flash)
    Phase 3 : fade out (0.5s) → emits 'intro:done'
]]

local PAL = require("src.palette")

local W, H = 480, 270
local CX, CY = W / 2, H / 2
local WCX, WCY = 240, 140
local TWO_PI = math.pi * 2

-- Wheel geometry (mirrors PixelWheel R=150)
local R        = 150
local HUB_R    = math.floor(R * 0.28 + 0.5)
local PKT_IN   = math.floor(R * 0.30 + 0.5)
local PKT_OUT  = math.floor(R * 0.37 + 0.5)
local LBL_IN   = math.floor(R * 0.38 + 0.5)
local LBL_OUT  = math.floor(R * 0.48 + 0.5)
local RIM_R    = math.floor(R * 0.55 + 0.5)
local N_SEG    = 40
local SEG_ARC  = TWO_PI / N_SEG
local INIT_A   = -math.pi / 2 - math.pi / N_SEG
local N_HIERO  = 16
local HIERO_ARC = TWO_PI / N_HIERO
local HIERO_INIT = -math.pi / 2 - math.pi / N_HIERO
local H_IN     = 174
local H_OUT    = 220          -- ISO legacy (était 184 — cassé)

-- Raccoon 25×18
local RACCOON = {
    ".......KK.......KK.......",
    "......KMLK.....KLMK......",
    ".....KMLWK.....KWLMK.....",
    "....KMLLDKKKKKKKDLLMK....",
    "...KDLLLLLLLLLLLLLLLDK...",
    "...KDLLLLLLLWLLLLLLLDK...",
    "...KDLLLLLLWWWLLLLLLDK...",
    "...KDLDDDDLWWWLDDDDLDK...",
    "...KDLDDWGKDWDKGWDDLDK...",
    "...KDDDDKKLLLLLKKDDDDK...",
    "...KDDDDDLLLLLLLDDDDDK...",
    "...KDLLLLLLLLLLLLLLLDK...",
    "....KDLLLLLWWWLLLLLDK....",
    "....KDLLLLLWKWLLLLLDK....",
    "....KDLLLLLWWWLLLLLDK....",
    ".....KDLLLLLLLLLLLDK.....",
    "......KDDDDDDDDDDDK......",
    ".......KKKKKKKKKKK.......",
}
local _RCW = #RACCOON[1]
local _RCH = #RACCOON
local _RCCX = math.floor(_RCW / 2)
local _RCCY = math.floor(_RCH / 2)
local RCOL = {
    K = PAL.black, D = PAL.darkGray, M = PAL.midGray,
    L = PAL.lightGray, W = PAL.white, G = PAL.gold,
}

local function clamp(v, lo, hi)
    lo = lo or 0; hi = hi or 1
    if v < lo then return lo end
    if v > hi then return hi end
    return v
end

local function easeOut(t)
    t = clamp(t)
    return 1 - (1 - t) * (1 - t) * (1 - t)
end

local function easeOutElastic(t)
    t = clamp(t)
    if t == 0 or t == 1 then return t end
    return math.pow(2, -10 * t) * math.sin((t * 10 - 0.75) * (TWO_PI / 3)) + 1
end

-- Draw raccoon, optionally revealing only pixels within a circular radius
-- from sprite center (matches legacy revealR).
local function drawRaccoon(ox, oy, revealR)
    for ry = 1, _RCH do
        local row = RACCOON[ry]
        for rx = 1, _RCW do
            local c = row:sub(rx, rx)
            local col = RCOL[c]
            if col then
                if revealR then
                    local dx = (rx - 1) - _RCCX
                    local dy = (ry - 1) - _RCCY
                    if (dx * dx + dy * dy) > revealR * revealR then
                        goto continue
                    end
                end
                love.graphics.setColor(col)
                love.graphics.rectangle("fill", ox + (rx - 1), oy + (ry - 1), 1, 1)
            end
            ::continue::
        end
    end
end

-- Annular segment filled polygon (outer arc CCW, inner arc CW)
local function drawAnnularSegment(cx, cy, innerR, outerR, a0, a1, steps)
    steps = steps or 6
    local verts = {}
    for i = 0, steps do
        local a = a0 + (a1 - a0) * (i / steps)
        verts[#verts + 1] = cx + math.cos(a) * outerR
        verts[#verts + 1] = cy + math.sin(a) * outerR
    end
    for i = steps, 0, -1 do
        local a = a0 + (a1 - a0) * (i / steps)
        verts[#verts + 1] = cx + math.cos(a) * innerR
        verts[#verts + 1] = cy + math.sin(a) * innerR
    end
    love.graphics.polygon("fill", verts)
end

-- ────────────────────────────────────────────────────────────

local Intro = {}
Intro.__index = Intro

function Intro.new()
    return setmetatable({
        name   = "intro",
        phase  = 1,
        t      = 0,
        parts  = {},
        shakes = {},
        sfx    = {},
        _font  = nil,
        _atlas = nil,
        done   = false,
    }, Intro)
end

function Intro:register(kernel)
    self._kernel = kernel

    kernel:on("sprite.ready", function(d)
        self._font  = d.font
        self._atlas = d.atlas
    end, -20)

    kernel:on("kernel.update", function(d)
        if self.done then return end
        self.t = self.t + d.dt

        -- Particles (legacy: p.life -= dt*1.8, gravity 40)
        for i = #self.parts, 1, -1 do
            local p = self.parts[i]
            p.x = p.x + p.vx * d.dt
            p.y = p.y + p.vy * d.dt
            p.vy = p.vy + 40 * d.dt
            p.life = p.life - d.dt * 1.8
            if p.life <= 0 then table.remove(self.parts, i) end
        end

        -- Shake decay
        for i = #self.shakes, 1, -1 do
            local s = self.shakes[i]
            if (self.t - s.t0) > s.decay then table.remove(self.shakes, i) end
        end

        if self.phase == 1 and self.t > 3.8 then self:_advance() end
        if self.phase == 2 and self.t > 5.8 then self:_advance() end
        if self.phase == 3 and self.t > 0.5 then
            self.done = true
            self._kernel:emit("intro:done")
        end
    end, -20)

    kernel:on("display.click", function(d)
        if self.done then return end
        if self.phase == 3 then return end
        self:_advance()
        d._handled = true
        return d
    end, -9999)

    kernel:on("display.draw.main", function(d) self:_draw(d.g) end, 9999)
end

local function _trace(msg)
    local p = os.getenv("APPDATA") .. "\\LOVE\\spinforge\\intro_trace.log"
    local f = io.open(p, "a"); if f then f:write(os.date("%H:%M:%S ") .. msg .. "\n"); f:close() end
end

function Intro:_advance()
    if self.phase == 0 then
        _trace("phase 0->1")
        self.phase, self.t = 1, 0
        self.parts, self.sfx, self.shakes = {}, {}, {}
        if self._kernel then self._kernel:emit("audio.sfx", { name = "stamp" }) end
    elseif self.phase == 1 then
        _trace("phase 1->2")
        self.phase, self.t = 2, 0
        self.parts, self.sfx, self.shakes = {}, {}, {}
    elseif self.phase == 2 then
        _trace("phase 2->3")
        self.phase, self.t = 3, 0
    end
end

function Intro:_shake(amp, decay)
    table.insert(self.shakes, { t0 = self.t, amp = amp, decay = decay or 0.3 })
end

function Intro:_shakeOffset()
    local total = 0
    for _, s in ipairs(self.shakes) do
        local el = self.t - s.t0
        if el < s.decay then total = total + s.amp * (1 - el / s.decay) end
    end
    if total < 0.1 then return 0, 0 end
    return math.floor((math.random() - 0.5) * 2 * total + 0.5),
           math.floor((math.random() - 0.5) * 2 * total + 0.5)
end

function Intro:_tone(id, freq, dur, wave, vol)
    if self.sfx[id] then return end
    self.sfx[id] = true
    if self._kernel then
        self._kernel:emit("audio.tone", { freq = freq, duration = dur, wave = wave or "square", vol = vol or 0.04 })
    end
end

function Intro:_spawnSparks(x, y, n, color, speed)
    speed = speed or 40
    for _ = 1, n do
        local a = math.random() * TWO_PI
        local v = speed * (0.4 + math.random() * 0.6)
        table.insert(self.parts, {
            x = x, y = y,
            vx = math.cos(a) * v,
            vy = math.sin(a) * v,
            life = 1, color = color,
        })
    end
end

function Intro:_spawnRingSparks(cx, cy, r, n, color, speed)
    for _ = 1, n do
        local a = math.random() * TWO_PI
        local v = speed * (0.3 + math.random() * 0.7)
        table.insert(self.parts, {
            x = cx + math.cos(a) * r,
            y = cy + math.sin(a) * r,
            vx = math.cos(a) * v,
            vy = math.sin(a) * v,
            life = 1, color = color,
        })
    end
end

function Intro:_drawParts()
    for _, p in ipairs(self.parts) do
        local a = math.max(0, p.life * p.life)      -- quadratic fade (ISO legacy)
        love.graphics.setColor(p.color[1], p.color[2], p.color[3], a)
        love.graphics.rectangle("fill", math.floor(p.x + 0.5), math.floor(p.y + 0.5), 1, 1)
    end
    love.graphics.setColor(1, 1, 1, 1)
end

-- ────────────────────────────────────────────────────────────
-- Phase 0 — click to start

function Intro:_drawClick(g)
    g:setColor(PAL.black[1], PAL.black[2], PAL.black[3], 1)
    g:rect("fill", 0, 0, W, H)
    local pulse = 0.6 + 0.4 * math.sin(love.timer.getTime() * 3.6)
    g:setAlpha(pulse)
    drawRaccoon(CX - _RCCX, CY - 10 - _RCCY)
    g:setAlpha(1)
    if self._font and (math.floor(love.timer.getTime() * 60) % 80) < 55 then
        self._font:drawCentered("CLICK TO START", CX, CY + 8, PAL.midGray, 1)
    end
end

-- ────────────────────────────────────────────────────────────
-- Phase 1 — "JOJO'S DEN" logo (ISO _renderLogo)

function Intro:_drawLogo(g)
    local t = self.t
    g:setColor(PAL.black[1], PAL.black[2], PAL.black[3], 1)
    g:rect("fill", 0, 0, W, H)

    local sx, sy = self:_shakeOffset()
    g:push()
    g:translate(sx, sy)

    -- Raccoon materializes (0.0 → 0.55)
    if t > 0.05 then
        if not self.sfx.spark then
            self:_tone("ltone1", 110, 1.5, "sine", 0.07)
            self:_tone("ltone2", 220, 1.0, "sine", 0.04)
            self:_tone("ltone3",  55, 2.0, "sine", 0.03)
            self.sfx.spark = true
        end
        local dT = easeOut((t - 0.05) / 0.5)
        local revealR = dT * 16
        local rOX = CX - _RCCX
        local rOY = CY - 28 - _RCCY
        drawRaccoon(rOX, rOY, revealR)
        -- Eye sparkle
        if dT >= 1 and t > 0.4 and t < 1.2 then
            if math.sin(t * 12) > 0.5 then
                love.graphics.setColor(PAL.white)
                love.graphics.rectangle("fill", rOX + 9, rOY + 8, 1, 1)
                love.graphics.rectangle("fill", rOX + 15, rOY + 8, 1, 1)
            end
        end
    end

    -- "JOJO'S" typewriter (0.6s+)
    if t > 0.6 and self._font then
        local text = "JOJO'S"
        local scale = 4
        local CHAR_W = self._font.CHAR_W or 4
        local charStep = (CHAR_W + 1) * scale
        local totalW = self._font:measure(text) * scale
        local startX = math.floor(CX - totalW / 2)
        local yTxt = CY - 14
        local shown = math.min(#text, math.floor((t - 0.6) / 0.09))
        for i = 1, shown do
            if not self.sfx["tw" .. i] then
                self:_tone("twA" .. i, 600 + i * 100, 0.05, "square", 0.04)
                self:_tone("twB" .. i, 1200 + i * 200, 0.03, "sine", 0.02)
                self.sfx["tw" .. i] = true
            end
            local ch = text:sub(i, i)
            self._font:draw(ch, startX + (i - 1) * charStep, yTxt, PAL.gold, scale)
        end
    end

    -- "DEN" slam at t=1.5
    if t > 1.5 and self._font then
        if not self.sfx.slam then
            self:_tone("slamA",  60, 0.6, "square", 0.14)
            self:_tone("slamB", 120, 0.4, "sine",   0.10)
            self:_tone("slamC", 180, 0.3, "square", 0.06)
            self:_shake(6, 0.35)
            self:_spawnSparks(CX, CY + 30, 20, PAL.gold,  60)
            self:_spawnSparks(CX, CY + 30, 10, PAL.white, 40)
            self.sfx.slam = true
        end
        local zoomT = clamp((t - 1.5) / 0.18)
        local zoom = 1 + 0.6 * (1 - easeOut(zoomT))
        g:push()
        g:translate(CX, CY + 30)
        g:scale(zoom, zoom)
        self._font:drawCentered("DEN", 0, -math.floor((self._font.CHAR_H or 6) * 7 / 2), PAL.white, 7)
        g:pop()
    end

    -- Gold underlines at 1.9
    if t > 1.9 then
        if not self.sfx.line then self:_tone("uline", 1400, 0.12, "sine", 0.02); self.sfx.line = true end
        local lineW = math.floor(easeOut((t - 1.9) / 0.3) * 140)
        g:setColor(PAL.gold[1], PAL.gold[2], PAL.gold[3], 1)
        g:rect("fill", CX - lineW / 2, CY + 58, lineW, 1)
        g:rect("fill", CX - lineW / 2, CY + 61, lineW, 1)
    end

    -- Shimmer particles 2.0–3.0
    if t > 2.0 and t < 3.0 and math.random() < 0.15 then
        table.insert(self.parts, {
            x = CX + (math.random() - 0.5) * 100,
            y = CY + (math.random() - 0.5) * 40,
            vx = (math.random() - 0.5) * 8,
            vy = -10 - math.random() * 15,
            life = 0.6, color = PAL.gold,
        })
    end

    self:_drawParts()
    g:pop() -- shake

    -- Fade-out overlay
    if t > 2.8 then
        local a = clamp((t - 2.8) / 0.9)
        g:setColor(PAL.black[1], PAL.black[2], PAL.black[3], a)
        g:rect("fill", 0, 0, W, H)
    end
end

-- ────────────────────────────────────────────────────────────
-- Phase 2 — wheel build (ISO _renderBuild)

function Intro:_drawWheel(g)
    local t = self.t
    local cx, cy = WCX, WCY
    g:setColor(PAL.black[1], PAL.black[2], PAL.black[3], 1)
    g:rect("fill", 0, 0, W, H)

    local sx, sy = self:_shakeOffset()
    g:push()
    g:translate(sx, sy)

    -- 1. Center spark (0.05 – 0.6, shrinks 4→0)
    if t > 0.05 and t < 0.6 then
        if not self.sfx.sp then
            self:_tone("sp1", 2200, 0.08, "sine", 0.04)
            self:_tone("sp2", 1100, 0.12, "sine", 0.03)
            self.sfx.sp = true
        end
        local sparkR = math.max(0, 4 * (1 - clamp((t - 0.05) / 0.4)))
        if sparkR > 0.5 then
            g:setColor(PAL.white[1], PAL.white[2], PAL.white[3], 1)
            g:circle("fill", cx, cy, sparkR)
        end
    end

    -- 2. Hub (easeOutElastic 0.3 – 0.8)
    if t > 0.3 then
        if not self.sfx.hub then
            self:_tone("hubA", 160, 0.7, "sine",   0.09)
            self:_tone("hubB", 320, 0.4, "square", 0.05)
            self:_tone("hubC",  80, 0.5, "sine",   0.06)
            self:_shake(4, 0.3)
            self:_spawnSparks(cx, cy, 12, PAL.midGray, 50)
            self.sfx.hub = true
        end
        -- (drawn again on top at the end)
    end

    -- 3. Pocket segments 0.8+
    if t > 0.8 then
        local elapsed = t - 0.8
        local segsShown = math.min(N_SEG, math.floor(elapsed / 0.028))
        for i = 0, segsShown - 1 do
            if i % 5 == 0 and not self.sfx["s" .. i] then
                self:_tone("pkt" .. i, 350 + i * 8, 0.025, "square", 0.02)
                self.sfx["s" .. i] = true
            end
            local a0 = INIT_A + i * SEG_ARC
            local a1 = a0 + SEG_ARC
            if i % 2 == 0 then g:setColor(PAL.darkGray[1], PAL.darkGray[2], PAL.darkGray[3], 1)
            else g:setColor(PAL.black[1], PAL.black[2], PAL.black[3], 1) end
            drawAnnularSegment(cx, cy, PKT_IN, PKT_OUT, a0, a1, 6)
            -- Divider PKT_IN → LBL_OUT
            local dcx, dsn = math.cos(a0), math.sin(a0)
            g:setColor(PAL.black[1], PAL.black[2], PAL.black[3], 1)
            love.graphics.setLineWidth(1)
            g:line(cx + dcx * PKT_IN, cy + dsn * PKT_IN, cx + dcx * LBL_OUT, cy + dsn * LBL_OUT)
        end
        if segsShown >= N_SEG and not self.sfx.pkt_done then
            self.sfx.pkt_done = true
            self:_tone("pktdA", 250, 0.35, "sine",   0.07)
            self:_tone("pktdB", 500, 0.20, "square", 0.04)
            self:_shake(5, 0.3)
            self:_spawnRingSparks(cx, cy, PKT_OUT, 16, PAL.lightGray, 30)
        end
    end

    -- 4. Label ring 2.0+
    if t > 2.0 and self._font then
        local elapsed = t - 2.0
        local segsShown = math.min(N_SEG, math.floor(elapsed / 0.025))
        if not self.sfx.lbl_start then
            self.sfx.lbl_start = true
            self:_tone("lblS", 440, 0.25, "sine", 0.05)
        end
        for i = 0, segsShown - 1 do
            if i % 5 == 0 and not self.sfx["l" .. i] then
                self:_tone("lbl" .. i, 500 + i * 6, 0.02, "square", 0.015)
                self.sfx["l" .. i] = true
            end
            local a0 = INIT_A + i * SEG_ARC
            local a1 = a0 + SEG_ARC
            local mid = a0 + SEG_ARC / 2
            if i % 2 == 0 then g:setColor(PAL.darkRed[1], PAL.darkRed[2], PAL.darkRed[3], 1)
            else g:setColor(PAL.black[1], PAL.black[2], PAL.black[3], 1) end
            drawAnnularSegment(cx, cy, LBL_IN, LBL_OUT, a0, a1, 6)
            -- Number label, rotated
            local numR = R * 0.425
            g:push()
            g:translate(cx + math.cos(mid) * numR, cy + math.sin(mid) * numR)
            g:rotate(mid + math.pi / 2)
            self._font:drawCentered(tostring(i + 1), 0, -math.floor((self._font.CHAR_H or 6) / 2), PAL.white, 1)
            g:pop()
        end
        if segsShown >= N_SEG and not self.sfx.lbl_done then
            self.sfx.lbl_done = true
            self:_shake(4, 0.25)
            self:_tone("lbldone", 600, 0.2, "square", 0.04)
            self:_spawnRingSparks(cx, cy, LBL_OUT, 20, PAL.darkRed, 25)
        end
    end

    -- 5. Rim sweep 3.2+
    if t > 3.2 then
        if not self.sfx.rim then
            self:_tone("rimA", 900, 0.5, "sine",   0.04)
            self:_tone("rimB", 700, 0.4, "square", 0.03)
            self.sfx.rim = true
        end
        local rimT = easeOut(clamp((t - 3.2) / 0.45))
        local sweep = TWO_PI * rimT
        g:setColor(PAL.darkGray[1], PAL.darkGray[2], PAL.darkGray[3], 1)
        love.graphics.setLineWidth(1)
        g:arc("line", cx, cy, RIM_R, INIT_A, INIT_A + sweep, 64)
        if rimT >= 1 and not self.sfx.rim_done then
            self.sfx.rim_done = true
            self:_shake(3, 0.2)
            self:_tone("rimdone", 400, 0.15, "sine", 0.04)
        end
    end

    -- 6. Hiero slam-in 3.7+
    if t > 3.7 then
        local elapsed = t - 3.7
        local hieroShown = math.min(N_HIERO, math.floor(elapsed / 0.045))
        for i = 0, hieroShown - 1 do
            if not self.sfx["h" .. i] then
                self:_tone("hie" .. i, 180 + i * 25, 0.07, "square", 0.035)
                self.sfx["h" .. i] = true
            end
            local segT = easeOut(clamp((elapsed - i * 0.045) / 0.12))
            local overshoot = 40 * (1 - segT)
            local innerR = H_IN + overshoot
            local outerR = H_OUT + overshoot
            local a0 = HIERO_INIT + i * HIERO_ARC
            local a1 = a0 + HIERO_ARC
            if i % 2 == 0 then
                g:setColor(PAL.darkRed[1], PAL.darkRed[2], PAL.darkRed[3], segT)
            else
                g:setColor(PAL.darkGray[1], PAL.darkGray[2], PAL.darkGray[3], segT)
            end
            drawAnnularSegment(cx, cy, innerR, outerR, a0, a1, 6)
        end
        if hieroShown >= N_HIERO and not self.sfx.h_done then
            self.sfx.h_done = true
            self:_shake(7, 0.35)
            self:_tone("hdoneA", 100, 0.6, "sine",   0.12)
            self:_tone("hdoneB", 200, 0.4, "square", 0.07)
            self:_tone("hdoneC", 400, 0.3, "sine",   0.04)
            self:_spawnRingSparks(cx, cy, H_OUT, 30, PAL.gold,   40)
            self:_spawnRingSparks(cx, cy, H_IN,  15, PAL.darkRed, 25)
        end
    end

    -- Redraw hub on top (ISO legacy — so segments never cover it)
    if t > 0.3 then
        local hubT = (t > 0.8) and 1 or easeOutElastic(clamp((t - 0.3) / 0.5))
        local r = math.max(1, HUB_R * hubT)
        g:setColor(PAL.black[1], PAL.black[2], PAL.black[3], 1)
        g:circle("fill", cx, cy, r)
        g:setColor(PAL.midGray[1], PAL.midGray[2], PAL.midGray[3], 1)
        love.graphics.setLineWidth(1)
        g:circle("line", cx, cy, r)
    end

    -- 7. Title drop + UI ring 4.5+
    if t > 4.5 and self._font then
        if not self.sfx.title then
            self.sfx.title = true
            self:_tone("ttl1",  660, 0.15, "square", 0.07)
            self:_tone("ttl2",  880, 0.12, "square", 0.06)
            self:_tone("ttl3", 1100, 0.15, "sine",   0.05)
            self:_tone("ttl4", 1320, 0.20, "sine",   0.04)
        end
        local titleT = easeOut(clamp((t - 4.5) / 0.35))
        local titleY = -30 + titleT * 36         -- slide into y=6
        local titleA = clamp((t - 4.5) / 0.2)
        g:setAlpha(titleA)
        self._font:drawCentered("SPINFORGE", cx, titleY, PAL.gold, 5)
        g:setAlpha(1)
        local ringA = clamp((t - 4.7) / 0.3)
        g:setColor(PAL.midGray[1], PAL.midGray[2], PAL.midGray[3], ringA)
        g:circle("line", cx, cy, 115)
    end

    -- 8. White flash 5.0 – 5.3
    if t > 5.0 and t < 5.3 then
        local ft = clamp((t - 5.0) / 0.25)
        local fa = math.sin(ft * math.pi) * 0.5
        g:setColor(PAL.white[1], PAL.white[2], PAL.white[3], fa)
        g:rect("fill", 0, 0, W, H)
    end

    -- Fade to black after 5.3
    if t > 5.3 then
        local a = clamp((t - 5.3) / 0.5)
        g:setColor(PAL.black[1], PAL.black[2], PAL.black[3], a)
        g:rect("fill", 0, 0, W, H)
    end

    self:_drawParts()
    g:pop() -- shake
end

function Intro:_drawFade(g)
    local a = clamp(self.t / 0.5)
    g:setColor(PAL.black[1], PAL.black[2], PAL.black[3], 1 - a)
    g:rect("fill", 0, 0, W, H)
end

function Intro:_draw(g)
    if self.done then return end
    if not self._font then return end
    local ok, err
    if     self.phase == 0 then ok, err = pcall(self._drawClick, self, g)
    elseif self.phase == 1 then ok, err = pcall(self._drawLogo, self, g)
    elseif self.phase == 2 then ok, err = pcall(self._drawWheel, self, g)
    elseif self.phase == 3 then ok, err = pcall(self._drawFade, self, g)
    end
    if not ok then _trace("DRAW phase=" .. tostring(self.phase) .. " t=" .. tostring(self.t) .. " ERR: " .. tostring(err)); error(err) end
    love.graphics.setColor(1, 1, 1, 1)
end

return Intro
