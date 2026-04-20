--[[
    PixelWheel — ISO port of JS PixelWheel.js
    Radial casino wheel with bowl physics, 3D tilt, flip animation,
    multi-layer parallax, gauges, hub screen, forge shop face, animations.

    All rendering uses the DrawAPI (g) and BitmapFont/SpriteAtlas passed in.
]]

local balMod = require('src.data.balance')
local BALANCE = balMod.BALANCE

-- ── Palette (central, runtime-switchable) ──────────────────────────
local PAL = require('src.palette')

local SEG_A         = PAL.segA
local SEG_B         = PAL.segB
local DIVIDER_COLOR = PAL.dividerColor
local HUB_BG        = PAL.hubBg
local HUB_BORDER    = PAL.hubBorder
local RIM_COLOR     = PAL.rimColor

-- ── Layout proportions (relative to R) ──
local HUB_P          = 0.28
local HUB_COLLIDE_P  = 0.32
local POCKET_INNER_P = 0.30
local POCKET_OUTER_P = 0.37
local LABEL_P        = 0.425
local LABEL_INNER_P  = 0.38
local LABEL_OUTER_P  = 0.48
local RIM_P          = 0.55

local BALL_RADIUS_P  = 0.008

-- ── Physics constants ──
local BOWL_GRAVITY   = 120
local RESTITUTION    = 0.5
local AIR_DAMPING    = 0.997
local SURFACE_FRICTION = 220
local SETTLE_SPEED   = 15
local SETTLE_ANG_VEL = 0.3
local SETTLE_TIME    = 0.15
local PHYSICS_DT     = 1/120
local SPIN_MIN       = 10
local SPIN_MAX       = 14
local SPIN_DECEL     = 0.996
local GRAVITY_BOOST_THRESHOLD = 2.5
local GRAVITY_BOOST_MAX = 6

-- ── Drop / gauge ──
local DROP_STAGGER   = 0.05
local DROP_DURATION  = 0.50
local GAUGE_SPAN     = 0.60
local GAUGE_CONFIGS  = {
    { center = 0,               start = -0.30,                 eend = 0.30 },
    { center = -math.pi/2,      start = -math.pi/2 - 0.30,    eend = -math.pi/2 + 0.30 },
    { center =  math.pi/2,      start =  math.pi/2 - 0.30,    eend =  math.pi/2 + 0.30 },
    { center =  math.pi,        start =  math.pi - 0.30,      eend =  math.pi + 0.30 },
}
local MAX_BALLS_PER_GAUGE = 14
local GAUGE_BALL_SPACING  = 0.04

local TWO_PI = math.pi * 2

-- ── Annular arc fill (donut slice) — replaces love.graphics.arc('fill') which
--    draws pies from center. Uses convex quads so polygon('fill') is safe.
local function drawAnnularArc(cx, cy, innerR, outerR, a0, a1, segments)
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

-- ── PixelWheel class ──
local PW = {}
PW.__index = PW

function PW.new()
    local self = setmetatable({}, PW)
    self.R = 150
    self:_updateRadii()

    self._data = {}
    self._angle = -math.pi/2 - math.pi/40
    self._angVel = 0
    self._balls = {}
    self._placedBalls = {}
    self._results = {}
    self._onDone = nil
    self._acc = 0
    self._time = 0
    self._highlights = {}
    self.onPegHit = nil
    self.onBallEject = nil
    self._lastPeg = 0
    self._slots = {}
    self._dropClock = 0
    self._dropping = false
    self._inGauge = false
    self._ejectQueue = {}
    self._ejecting = false
    self._ejectClock = 0
    self._frameLights = {}
    self._bonusMode = false
    self._gaugeUnlocks = {true, false, false, false}
    self._corruption = 0.5
    self._counterGold = 0
    self._counterTickets = 0
    self._ticketShake = {intensity=0, time=0, decay=0.35}
    self._goldShake = {intensity=0, time=0, decay=0.35}
    self._goldAnims = {}
    self._ticketFlyAnims = {}
    self._relics = {}
    self._segmentValues = {}
    self._goldPockets = {}

    self._ticketAnim = nil
    self._goldQuotaAnim = nil

    self._tilt = 1.0
    self._flip = nil
    self.onFlipMid = nil
    self.onFlipDone = nil

    self._hub = {
        lastSymbolId = '', lastValue = 0, valueFade = 0,
        multi = 1, history = {},
        message = '', messageFade = 0,
        score = 0, scoreTarget = 0,
    }

    self._shop = {
        offerings = {},
        currency = 0,
        rerollCost = 0,
        hoverIdx = -1,
        buyFlash = -1,
        buyFlashTimer = 0,
        nextQuota = 0,
    }

    self._settings = {
        active = false,
        masterVol = 0.5,
        bgmVol = 0.6,
        sfxVol = 0.8,
        fullscreen = true,
        hoverId = nil,
        dragging = nil,
    }

    return self
end

function PW:setRadius(r)
    self.R = r
    self:_updateRadii()
end

function PW:_updateRadii()
    local R = self.R
    self._hubR = R * HUB_P
    self._pocketInner = R * POCKET_INNER_P
    self._pocketOuter = R * POCKET_OUTER_P
    self._labelInner = R * LABEL_INNER_P
    self._labelOuter = R * LABEL_OUTER_P
    self._rimR = R * RIM_P
    self._ballRadius = math.max(1.5, R * BALL_RADIUS_P)
end

function PW:setWheel(data)
    self._data = data
    self._balls = {}
    self._placedBalls = {}
    self._results = {}
    self._highlights = {}
end

function PW:setGaugeUnlocks(u) self._gaugeUnlocks = u end
function PW:setCorruption(v) self._corruption = math.max(0, math.min(1, v)) end
function PW:setRelics(r) self._relics = r or {} end
function PW:setSegmentValues(v)
    self._segmentValues = v or {}
end
function PW:setGoldPockets(idx) self._goldPockets = idx or {} end
function PW:setBonusMode(b) self._bonusMode = b end
function PW:setSlots(d) self._slots = d or {} end

function PW:placeBalls(n, specialBalls)
    self._placedBalls = {}
    self._balls = {}
    self._results = {}
    self._dropClock = 0
    self._dropping = false
    self._inGauge = true

    local specials = specialBalls or {}
    local GAUGE_MID = (self._rimR + 16 + self._rimR + 21) / 2

    local activeGauges = {}
    for g = 1, #GAUGE_CONFIGS do
        if g ~= 2 and g ~= 3 and g ~= 4 then
            if self._gaugeUnlocks[g] then
                activeGauges[#activeGauges+1] = g
            end
        end
    end

    local perGauge = {}
    for i = 1, #activeGauges do perGauge[i] = {} end

    for i = 0, n-1 do
        local slot = (i % #activeGauges) + 1
        if #perGauge[slot] < MAX_BALLS_PER_GAUGE then
            perGauge[slot][#perGauge[slot]+1] = i
        end
    end

    local globalIdx = 0
    for gi = 1, #activeGauges do
        local gIdx = activeGauges[gi]
        local cfg = GAUGE_CONFIGS[gIdx]
        local indices = perGauge[gi]
        for j = 1, #indices do
            local i = indices[j]
            local a = (i / n) * TWO_PI + (math.random() - 0.5) * 0.3
            local r = self._labelOuter + 2 + math.random() * (self._rimR - self._labelOuter - self._ballRadius * 2 - 3)
            local ga = cfg.eend - (j-1) * GAUGE_BALL_SPACING
            local isSpecial = globalIdx < #specials
            self._placedBalls[#self._placedBalls+1] = {
                localX = math.cos(a) * r,
                localY = math.sin(a) * r,
                gaugeX = math.cos(ga) * GAUGE_MID,
                gaugeY = math.sin(ga) * GAUGE_MID,
                gaugeAngle = ga,
                gaugeIdx = gIdx,
                dropDelay = (#indices - j) * DROP_STAGGER,
                dropDur = DROP_DURATION,
                special = isSpecial and specials[globalIdx+1] or nil,
            }
            globalIdx = globalIdx + 1
        end
    end
end

-- ── Spin + eject ──
function PW:spinAndEject(callback)
    self._angVel = SPIN_MIN + math.random() * (SPIN_MAX - SPIN_MIN)
    self._results = {}
    self._onDone = callback
    self._balls = {}
    self._inGauge = false
    self._dropping = false

    -- Sort eject queue
    self._ejectQueue = {}
    for _, pb in ipairs(self._placedBalls) do
        self._ejectQueue[#self._ejectQueue+1] = pb
    end
    table.sort(self._ejectQueue, function(a, b) return a.dropDelay < b.dropDelay end)
    self._placedBalls = {}
    self._ejecting = true
    self._ejectClock = 0
end

function PW:spin(callback)
    return self:spinAndEject(callback)
end

function PW:highlight(idx)
    self._highlights[#self._highlights+1] = { idx = idx, t = 0 }
end

function PW:getPocketPosition(idx, cx, cy)
    local data = self._data
    if #data == 0 or idx < 0 or idx >= #data then return cx, cy end
    local tw = 0
    for _, s in ipairs(data) do tw = tw + s.weight end
    local off = 0
    for i = 1, idx do off = off + (data[i].weight / tw) * TWO_PI end
    local angle = (data[idx+1].weight / tw) * TWO_PI
    local mid = off + angle / 2
    local worldA = self._angle + mid
    local hlR = (self._pocketInner + self._pocketOuter) / 2
    local TILT_Y = math.abs(self._tilt)
    return cx + math.cos(worldA) * hlR, cy + math.sin(worldA) * hlR * TILT_Y
end

function PW:isSpinning()
    if self._angVel > 0.05 then return true end
    for _, b in ipairs(self._balls) do
        if not b.settled then return true end
    end
    return false
end

function PW:getSpeed() return math.abs(self._angVel) end
function PW:getHubRadius() return self._hubR end
function PW:getTilt() return math.abs(self._tilt) end
function PW:isFlipped() return self._tilt < 0 end

-- ── Forge shop API ──
function PW:setShop(offerings, currency, rerollCost, nextQuota)
    self._shop.offerings = offerings or {}
    self._shop.currency = currency
    self._shop.rerollCost = rerollCost
    if nextQuota then self._shop.nextQuota = nextQuota end
    self._shop.hoverIdx = -1
    self._shop.buyFlash = -1
    self._shop.buyFlashTimer = 0
end

function PW:shopUpdateCurrency(c) self._shop.currency = c end

function PW:shopRemoveOffering(idx)
    self._shop.buyFlash = idx
    self._shop.buyFlashTimer = 0.4
end

function PW:shopSetOfferings(o)
    self._shop.offerings = o or {}
end

-- ── Shop hit test ──
function PW:shopHitTest(x, y, cx, cy)
    if not self:isFlipped() then return nil end
    local TILT_Y = math.abs(self._tilt)
    if TILT_Y < 0.05 then return nil end

    local dx = x - cx
    local dy = (y - cy) / TILT_Y
    local dist = math.sqrt(dx*dx + dy*dy)
    local angle = math.atan2(dy, dx)

    if dist < self._hubR then
        return { type = 'leave' }
    end

    if dist >= self._hubR + 3 and dist <= self._rimR - 3 then
        local QUAD_GAP = 0.10
        local SLOT_GAP = 0.04
        local QUAD_SPAN = math.pi / 2 - QUAD_GAP
        local SLOT_SPAN = (QUAD_SPAN - SLOT_GAP) / 2
        local quadStarts = {
            -math.pi/2 + QUAD_GAP/2,
             0          + QUAD_GAP/2,
             math.pi/2  + QUAD_GAP/2,
             math.pi    + QUAD_GAP/2,
        }

        for q = 1, 4 do
            for s = 0, 1 do
                local a0 = quadStarts[q] + s * (SLOT_SPAN + SLOT_GAP)
                local a1 = a0 + SLOT_SPAN
                local a = angle
                if q == 4 and a < 0 then a = a + TWO_PI end

                local inArc = false
                if a0 < -math.pi then
                    inArc = (a >= a0 + TWO_PI and a <= a1 + TWO_PI) or (a >= a0 and a <= a1)
                elseif a1 > math.pi then
                    inArc = (a >= a0) or (a <= a1 - TWO_PI)
                else
                    inArc = (a >= a0 and a <= a1)
                end

                if inArc then
                    local idx = (q-1) * 2 + s
                    if idx == 4 then return { type = 'reroll' } end
                    return { type = 'offering', index = idx }
                end
            end
        end
    end

    return nil
end

function PW:shopSetHover(hit)
    if not hit then self._shop.hoverIdx = -1; return end
    if hit.type == 'offering' then self._shop.hoverIdx = hit.index
    elseif hit.type == 'reroll' then self._shop.hoverIdx = 'reroll'
    elseif hit.type == 'leave' then self._shop.hoverIdx = 'leave'
    else self._shop.hoverIdx = -1 end
end

function PW:getShopHoveredOffering()
    local idx = self._shop.hoverIdx
    if type(idx) ~= 'number' or idx < 0 then return nil end
    return self._shop.offerings[idx+1] or nil
end

-- ── Settings API ──
function PW:setSettingsMode(active)
    self._settings.active = active and true or false
    if not active then
        self._settings.hoverId = nil
        self._settings.dragging = nil
    end
end
function PW:isSettingsMode() return self._settings.active end
function PW:setSettingsValues(master, bgm, sfx, fs)
    self._settings.masterVol = master
    self._settings.bgmVol = bgm
    self._settings.sfxVol = sfx
    self._settings.fullscreen = fs and true or false
end
function PW:settingsSetHover(id) self._settings.hoverId = id end
function PW:settingsSetDragging(id) self._settings.dragging = id end
function PW:settingsSetSlider(id, value)
    value = math.max(0, math.min(1, value))
    if id == 'master' then self._settings.masterVol = value
    elseif id == 'bgm' then self._settings.bgmVol = value
    elseif id == 'sfx' then self._settings.sfxVol = value end
end
function PW:settingsToggleFullscreen()
    self._settings.fullscreen = not self._settings.fullscreen
end
function PW:getSettingsValues()
    local s = self._settings
    return s.masterVol, s.bgmVol, s.sfxVol, s.fullscreen
end

-- Settings face geometry (5 sections: master, bgm, sfx, fullscreen, theme)
local SETTINGS_GAP = 0.10
local SETTINGS_COUNT = 5
local SETTINGS_SECT_SPAN = (TWO_PI / SETTINGS_COUNT) - SETTINGS_GAP
local function settingsSectStart(s)
    return -math.pi/2 + (s - 1) * (TWO_PI / SETTINGS_COUNT) + SETTINGS_GAP / 2
end

function PW:settingsHitTest(x, y, cx, cy)
    if not self._settings.active or not self:isFlipped() then return nil end
    local TILT_Y = math.abs(self._tilt)
    if TILT_Y < 0.05 then return nil end

    local dx = x - cx
    local dy = (y - cy) / TILT_Y
    local dist = math.sqrt(dx*dx + dy*dy)
    local angle = math.atan2(dy, dx)

    if dist < self._hubR then return { type = 'close' } end

    local slotInner = self._hubR + 5
    local slotOuter = self._rimR - 3
    if dist < slotInner or dist > slotOuter then return nil end

    local IDS = { 'master', 'bgm', 'sfx' }
    for s = 1, SETTINGS_COUNT do
        local a0 = settingsSectStart(s)
        local a1 = a0 + SETTINGS_SECT_SPAN
        local a = angle
        while a < a0 - math.pi do a = a + TWO_PI end
        while a > a0 + math.pi do a = a - TWO_PI end
        if a >= a0 and a <= a1 then
            if s == 4 then
                return { type = 'toggle', id = 'fullscreen' }
            elseif s == 5 then
                return { type = 'theme' }
            else
                local rel = a - a0
                local value = math.max(0, math.min(1, rel / SETTINGS_SECT_SPAN))
                return { type = 'slider', id = IDS[s], value = value }
            end
        end
    end
    return nil
end

-- ── Flip ──
function PW:startFlip(duration)
    duration = duration or 0.45
    local to = self._tilt > 0 and -1 or 1
    self._flip = { from = self._tilt, to = to, duration = duration, elapsed = 0, midFired = false }
end

-- ── Hub screen API ──
function PW:hubShowValue(symbolId, value)
    self._hub.lastSymbolId = symbolId or ''
    self._hub.lastValue = value or 0
    self._hub.valueFade = 1.5
    self._hub.history[#self._hub.history+1] = symbolId
    if #self._hub.history > 5 then table.remove(self._hub.history, 1) end
end
function PW:hubSetMulti(m) self._hub.multi = m end
function PW:hubSetScore(s) self._hub.scoreTarget = s end
function PW:hubSnapScore(s) self._hub.score = s; self._hub.scoreTarget = s end
function PW:hubMessage(msg) self._hub.message = msg; self._hub.messageFade = 2.5 end

function PW:setCounters(gold, tickets)
    if tickets < self._counterTickets then
        self._ticketShake.intensity = 3
        self._ticketShake.time = 0
    end
    if #self._goldAnims == 0 and not self._goldQuotaAnim then
        self._counterGold = gold
    end
    if #self._ticketFlyAnims == 0 and not self._ticketAnim then
        self._counterTickets = tickets
    end
end

function PW:startGoldFly(text, value, sx, sy, cx, cy)
    local cfg = GAUGE_CONFIGS[3]
    local INNER = self._rimR + 16
    local OUTER = self._rimR + 21
    local MID_R = (INNER + OUTER) / 2
    local arcLen = cfg.eend - cfg.start
    local goldA = cfg.start + arcLen * 0.75
    local tx = cx + math.cos(goldA) * MID_R
    local ty = cy + math.sin(goldA) * MID_R
    self._goldAnims[#self._goldAnims+1] = {
        text = text, value = value,
        startX = sx, startY = sy,
        targetX = tx, targetY = ty,
        elapsed = 0, duration = 0.45,
        arrived = false,
    }
end

function PW:startTicketFly(text, value, sx, sy, cx, cy)
    local cfg = GAUGE_CONFIGS[3]
    local INNER = self._rimR + 16
    local OUTER = self._rimR + 21
    local MID_R = (INNER + OUTER) / 2
    local arcLen = cfg.eend - cfg.start
    local tickA = cfg.start + arcLen * 0.25
    local tx = cx + math.cos(tickA) * MID_R
    local ty = cy + math.sin(tickA) * MID_R
    self._ticketFlyAnims[#self._ticketFlyAnims+1] = {
        text = text, value = value,
        startX = sx, startY = sy,
        targetX = tx, targetY = ty,
        elapsed = 0, duration = 0.45,
        arrived = false,
    }
end

function PW:startGoldQuotaAnim(quota)
    local cfg = GAUGE_CONFIGS[3]
    local INNER = self._rimR + 16
    local OUTER = self._rimR + 21
    local MID_R = (INNER + OUTER) / 2
    local arcLen = cfg.eend - cfg.start
    local goldA = cfg.start + arcLen * 0.75
    self._goldQuotaAnim = {
        phase = 'fly', elapsed = 0,
        flyDur = 0.4, countDur = 0.8, holdDur = 0.6, flybackDur = 0.3,
        quota = quota, startGold = self._counterGold,
        fromA = goldA, fromMidR = MID_R,
    }
end

function PW:isGoldQuotaAnimDone() return not self._goldQuotaAnim end

function PW:startTicketAnim(earned)
    local cfg = GAUGE_CONFIGS[3]
    local INNER = self._rimR + 16
    local OUTER = self._rimR + 21
    local MID_R = (INNER + OUTER) / 2
    local arcLen = cfg.eend - cfg.start
    local tickA = cfg.start + arcLen * 0.25
    self._ticketAnim = {
        phase = 'fly', elapsed = 0,
        flyDur = 0.4, countDur = 0.8, holdDur = 0.6, flybackDur = 0.3,
        earned = earned, counted = 0,
        baseTickets = self._counterTickets,
        fromA = tickA, fromMidR = MID_R,
    }
end

function PW:isTicketAnimDone() return not self._ticketAnim end

-- ══════════════════════════════════════════════
--  UPDATE
-- ══════════════════════════════════════════════
function PW:update(dt)
    self._time = self._time + dt

    -- Highlights decay
    for i = #self._highlights, 1, -1 do
        self._highlights[i].t = self._highlights[i].t + dt
        if self._highlights[i].t > 1.5 then table.remove(self._highlights, i) end
    end

    -- Hub score lerp
    if self._hub.score < self._hub.scoreTarget then
        local diff = self._hub.scoreTarget - self._hub.score
        self._hub.score = self._hub.score + math.max(1, math.ceil(diff * 0.12))
        if self._hub.score > self._hub.scoreTarget then self._hub.score = self._hub.scoreTarget end
    end
    self._hub.valueFade = math.max(0, self._hub.valueFade - dt)
    self._hub.messageFade = math.max(0, self._hub.messageFade - dt)

    -- Shake decays
    local function updateShake(sh)
        if sh.intensity > 0 then
            sh.time = sh.time + dt
            if sh.time >= sh.decay then sh.intensity = 0 end
        end
    end
    updateShake(self._ticketShake)
    updateShake(self._goldShake)

    -- Gold fly anims
    for i = #self._goldAnims, 1, -1 do
        local ga = self._goldAnims[i]
        ga.elapsed = ga.elapsed + dt
        if not ga.arrived and ga.elapsed >= ga.duration then
            ga.arrived = true
            self._counterGold = self._counterGold + ga.value
            self._goldShake.intensity = 3
            self._goldShake.time = 0
        end
        if ga.elapsed >= ga.duration + 0.15 then
            table.remove(self._goldAnims, i)
        end
    end

    -- Ticket fly anims
    for i = #self._ticketFlyAnims, 1, -1 do
        local ta = self._ticketFlyAnims[i]
        ta.elapsed = ta.elapsed + dt
        if not ta.arrived and ta.elapsed >= ta.duration then
            ta.arrived = true
            self._counterTickets = self._counterTickets + ta.value
            self._ticketShake.intensity = 3
            self._ticketShake.time = 0
        end
        if ta.elapsed >= ta.duration + 0.15 then
            table.remove(self._ticketFlyAnims, i)
        end
    end

    -- Gold quota anim
    if self._goldQuotaAnim then
        local ga = self._goldQuotaAnim
        ga.elapsed = ga.elapsed + dt
        if ga.phase == 'fly' and ga.elapsed >= ga.flyDur then
            ga.phase = 'count'; ga.elapsed = 0
        elseif ga.phase == 'count' and ga.elapsed >= ga.countDur then
            ga.phase = 'hold'; ga.elapsed = 0
            self._counterGold = ga.startGold - ga.quota
        elseif ga.phase == 'hold' and ga.elapsed >= ga.holdDur then
            ga.phase = 'flyback'; ga.elapsed = 0
        elseif ga.phase == 'flyback' and ga.elapsed >= ga.flybackDur then
            self._goldQuotaAnim = nil
        end
        if ga and ga.phase == 'count' then
            local t = math.min(1, ga.elapsed / ga.countDur)
            self._counterGold = ga.startGold - math.floor(ga.quota * t)
        end
    end

    -- Ticket anim
    if self._ticketAnim then
        local ta = self._ticketAnim
        ta.elapsed = ta.elapsed + dt
        if ta.phase == 'fly' and ta.elapsed >= ta.flyDur then
            ta.phase = 'count'; ta.elapsed = 0
        elseif ta.phase == 'count' and ta.elapsed >= ta.countDur then
            ta.phase = 'hold'; ta.elapsed = 0
            ta.counted = ta.earned
            self._counterTickets = ta.baseTickets + ta.earned
        elseif ta.phase == 'hold' and ta.elapsed >= ta.holdDur then
            ta.phase = 'flyback'; ta.elapsed = 0
        elseif ta.phase == 'flyback' and ta.elapsed >= ta.flybackDur then
            self._ticketAnim = nil
        end
        if ta and ta.phase == 'count' then
            local t = math.min(1, ta.elapsed / ta.countDur)
            ta.counted = math.floor(ta.earned * t)
            self._counterTickets = ta.baseTickets + ta.counted
        end
    end

    -- Flip animation
    if self._flip then
        self._flip.elapsed = self._flip.elapsed + dt
        local t = math.min(1, self._flip.elapsed / self._flip.duration)
        local ease
        if t < 0.5 then ease = 2 * t * t
        else ease = 1 - (-2 * t + 2)^2 / 2 end
        self._tilt = self._flip.from + (self._flip.to - self._flip.from) * ease

        if not self._flip.midFired and (self._tilt > 0) ~= (self._flip.from > 0) then
            self._flip.midFired = true
            if self.onFlipMid then self.onFlipMid() end
        end

        if t >= 1 then
            self._tilt = self._flip.to
            local cb = self.onFlipDone
            self._flip = nil
            if cb then cb() end
        end
    end

    -- Staggered ball ejection
    if self._ejecting then
        self._ejectClock = self._ejectClock + dt
        while #self._ejectQueue > 0 and self._ejectClock >= self._ejectQueue[1].dropDelay do
            local pb = table.remove(self._ejectQueue, 1)
            local cfg = GAUGE_CONFIGS[pb.gaugeIdx] or GAUGE_CONFIGS[1]
            local spread = cfg.eend - cfg.start
            local entryAngle = cfg.start + math.random() * spread
            local entryR = self._rimR - 4
            local bx = math.cos(entryAngle) * entryR
            local by = math.sin(entryAngle) * entryR

            local inSpeed = 25 + math.random() * 40
            local inDir = math.atan2(-by, -bx) + (math.random() - 0.5) * 1.2
            local tanDir = inDir + math.pi / 2
            local tanSpeed = self._angVel * entryR * (0.1 + math.random() * 0.5)

            self._balls[#self._balls+1] = {
                x = bx, y = by,
                vx = math.cos(inDir)*inSpeed + math.cos(tanDir)*tanSpeed,
                vy = math.sin(inDir)*inSpeed + math.sin(tanDir)*tanSpeed,
                settled = false, timer = 0,
                special = pb.special,
            }
            if self.onBallEject then self.onBallEject() end
        end
        if #self._ejectQueue == 0 then self._ejecting = false end
    end

    -- Physics substep
    self._acc = self._acc + dt
    while self._acc >= PHYSICS_DT do
        self:_step(PHYSICS_DT)
        self._acc = self._acc - PHYSICS_DT
    end
end

-- ══════════════════════════════════════════════
--  PHYSICS (ISO with JS)
-- ══════════════════════════════════════════════
function PW:_step(dt)
    if math.abs(self._angVel) > 0.01 then
        local decel = math.abs(self._angVel) < 3 and 0.985 or SPIN_DECEL
        self._angVel = self._angVel * (decel ^ (dt * 120))
        self._angle = self._angle + self._angVel * dt
    else
        self._angVel = 0
    end

    for _, b in ipairs(self._balls) do
        if not b.settled then
            local d = math.sqrt(b.x*b.x + b.y*b.y)
            local gravMul = 1
            if math.abs(self._angVel) < GRAVITY_BOOST_THRESHOLD then
                gravMul = 1 + (GRAVITY_BOOST_MAX - 1) * (1 - math.abs(self._angVel) / GRAVITY_BOOST_THRESHOLD)
            end
            if d > 1 then
                b.vx = b.vx - (b.x / d) * BOWL_GRAVITY * gravMul * dt
                b.vy = b.vy - (b.y / d) * BOWL_GRAVITY * gravMul * dt
            end
            local damp = AIR_DAMPING ^ (dt * 120)
            b.vx = b.vx * damp
            b.vy = b.vy * damp
            if math.abs(self._angVel) > 0.05 and d > 1 then
                local nx, ny = b.x / d, b.y / d
                local tx, ty = -ny, nx
                local drag = (self._angVel * d - (b.vx * tx + b.vy * ty)) * SURFACE_FRICTION * dt
                b.vx = b.vx + tx * drag
                b.vy = b.vy + ty * drag
            end
            b.x = b.x + b.vx * dt
            b.y = b.y + b.vy * dt
            self:_collideRim(b)
            self:_collideHub(b)
        end
    end

    self:_ballBall()

    for _, b in ipairs(self._balls) do
        if not b.settled then
            local d = math.sqrt(b.x*b.x + b.y*b.y)
            local spd = math.sqrt(b.vx*b.vx + b.vy*b.vy)
            local inPockets = d >= self._pocketInner and d <= self._labelOuter
            if spd < SETTLE_SPEED and math.abs(self._angVel) < SETTLE_ANG_VEL and inPockets then
                b.timer = b.timer + dt
                if b.timer >= SETTLE_TIME then self:_settle(b) end
            else
                b.timer = 0
            end
        end
    end
end

function PW:_peg()
    local minInterval = math.abs(self._angVel) > 2 and 0.04 or 0.15
    if self._time - self._lastPeg < minInterval then return end
    if math.abs(self._angVel) < 0.5 then return end
    self._lastPeg = self._time
    if self.onPegHit then self.onPegHit() end
end

function PW:_collideRim(b)
    local d = math.sqrt(b.x*b.x + b.y*b.y)
    local maxR = self._rimR - self._ballRadius
    if d <= maxR then return end
    local nx, ny = b.x/d, b.y/d
    b.x = nx * maxR; b.y = ny * maxR
    local dot = b.vx*nx + b.vy*ny
    b.vx = (b.vx - 2*dot*nx) * RESTITUTION
    b.vy = (b.vy - 2*dot*ny) * RESTITUTION
    self:_peg()
end

function PW:_collideHub(b)
    local d = math.sqrt(b.x*b.x + b.y*b.y)
    local minR = self.R * HUB_COLLIDE_P + self._ballRadius
    if d >= minR or d == 0 then return end
    local nx, ny = b.x/d, b.y/d
    b.x = nx * minR; b.y = ny * minR
    local dot = b.vx*nx + b.vy*ny
    b.vx = (b.vx - 2*dot*nx) * RESTITUTION
    b.vy = (b.vy - 2*dot*ny) * RESTITUTION
    self:_peg()
end

function PW:_ballBall()
    for i = 1, #self._balls do
        if not self._balls[i].settled then
            for j = i+1, #self._balls do
                if not self._balls[j].settled then
                    local a, bb = self._balls[i], self._balls[j]
                    local dx, dy = a.x - bb.x, a.y - bb.y
                    local d = math.sqrt(dx*dx + dy*dy)
                    local minD = self._ballRadius * 2
                    if d < minD and d > 0.01 then
                        local nx, ny = dx/d, dy/d
                        local ov = (minD - d) / 2 + 0.3
                        a.x = a.x + nx*ov; a.y = a.y + ny*ov
                        bb.x = bb.x - nx*ov; bb.y = bb.y - ny*ov
                        local dvx, dvy = a.vx - bb.vx, a.vy - bb.vy
                        local dot = dvx*nx + dvy*ny
                        if dot <= 0 then
                            a.vx = a.vx - dot*nx*0.85; a.vy = a.vy - dot*ny*0.85
                            bb.vx = bb.vx + dot*nx*0.85; bb.vy = bb.vy + dot*ny*0.85
                        end
                    end
                end
            end
        end
    end
end

function PW:_settle(b)
    b.settled = true
    local c, s = math.cos(-self._angle), math.sin(-self._angle)
    b.localX = c * b.x - s * b.y
    b.localY = s * b.x + c * b.y
    local wa = math.atan2(b.y, b.x) - self._angle
    wa = (wa % TWO_PI + TWO_PI) % TWO_PI
    local tw = 0
    for _, seg in ipairs(self._data) do tw = tw + seg.weight end
    local acc, idx = 0, #self._data - 1
    for i = 1, #self._data do
        local sa = (self._data[i].weight / tw) * TWO_PI
        if wa < acc + sa then idx = i - 1; break end
        acc = acc + sa
    end
    self._results[#self._results+1] = idx

    local allSettled = true
    for _, bb in ipairs(self._balls) do
        if not bb.settled then allSettled = false; break end
    end
    if allSettled then
        self._angVel = 0
        if self._onDone then
            local cb = self._onDone
            self._onDone = nil
            cb(self._results)
        end
    end
end

-- ══════════════════════════════════════════════
--  DRAW — ISO with JS PixelWheel.draw()
-- ══════════════════════════════════════════════
function PW:draw(g, font, atlas, cx, cy, pox, poy, layers)
    pox = pox or 0; poy = poy or 0
    local data = self._data
    if #data == 0 then return end
    local tw = 0
    for _, s in ipairs(data) do tw = tw + s.weight end

    local TILT_Y = math.abs(self._tilt)
    self._frameLights = {}

    if TILT_Y < 0.01 then
        self:_drawGauges(g, font, atlas, cx + pox, cy + poy)
        return
    end

    -- ── Tilt transform ──
    g:push()
    g:translate(cx, cy)
    g:scale(1, TILT_Y)
    g:translate(-cx, -cy)

    -- ── Flipped: forge shop face ──
    if self._tilt < 0 then
        if self._settings.active then
            self:_drawSettingsFace(g, font, atlas, cx, cy)
        else
            self:_drawForgeFace(g, font, atlas, cx, cy)
        end
        g:pop()
        if not self._settings.active then
            self:_drawGauges(g, font, atlas, cx + pox, cy + poy)
            self:_drawOrbitSlots(g, font, atlas, cx + pox, cy + poy)
        end
        return
    end

    -- ── Precompute chase ──
    local isIdle = math.abs(self._angVel) < 0.1 and #self._highlights == 0
    local allSettled = true
    for _, b in ipairs(self._balls) do if not b.settled then allSettled = false; break end end
    isIdle = isIdle and allSettled

    local showChase = isIdle or self._bonusMode
    local chaseTrail = self._bonusMode and 6 or 4
    local chaseSpeed = self._bonusMode and 18 or 6
    local chasePos = self._time * chaseSpeed
    local chaseIdx = math.floor(chasePos) % #data

    -- ═══ PASS 1: Pockets ═══
    local RAINBOW = {PAL.red, PAL.gold, PAL.green, PAL.blue, PAL.purple, PAL.neonPink}
    local pkOx = layers and layers.pocketX or 0
    local pkOy = layers and layers.pocketY or 0
    g:push()
    g:translate(cx + pkOx, cy + pkOy)
    g:rotate(self._angle)

    local off = 0
    for i = 1, #data do
        local seg = data[i]
        local angle = (seg.weight / tw) * TWO_PI
        local mid = off + angle / 2

        -- Check gold pocket
        local isGold = false
        for _, gp in ipairs(self._goldPockets) do
            if gp == i-1 then isGold = true; break end
        end

        local dark = (i-1) % 2 == 0
        local fillColor = isGold and PAL.darkGold or (dark and SEG_A or SEG_B)

        g:setColor(fillColor[1], fillColor[2], fillColor[3], fillColor[4])
        drawAnnularArc(0, 0, self._pocketInner, self._pocketOuter, off, off + angle, 32)

        -- Highlight flash
        local hl = nil
        for _, h in ipairs(self._highlights) do
            if h.idx == i-1 then hl = h; break end
        end
        if hl then
            local hlColor = isGold and PAL.gold or PAL.white
            local a
            if hl.t < 0.15 then a = 0.9
            elseif hl.t < 0.4 then a = 0.7
            else a = math.max(0, 1 - (hl.t - 0.4) / 1.1) * 0.5 end
            g:setColor(hlColor[1], hlColor[2], hlColor[3], a)
            drawAnnularArc(0, 0, self._pocketInner, self._pocketOuter, off, off + angle, 32)

            local worldA = self._angle + mid
            local hlR = (self._pocketInner + self._pocketOuter) / 2
            self._frameLights[#self._frameLights+1] = {
                x = (cx + pkOx) + math.cos(worldA) * hlR,
                y = (cy + pkOy) + math.sin(worldA) * hlR * TILT_Y,
                r = 25, color = hlColor, a = math.max(0, 1 - hl.t/1.5) * 0.35,
            }
        elseif showChase then
            for t = 0, chaseTrail - 1 do
                local ti = (chaseIdx - t) % #data
                if ti < 0 then ti = ti + #data end
                if ti == i-1 then
                    local hlColor
                    if self._bonusMode then
                        hlColor = RAINBOW[((math.floor(chasePos) + t) % #RAINBOW) + 1]
                    else
                        hlColor = isGold and PAL.gold or PAL.white
                    end
                    local fade = 1 - t / chaseTrail
                    g:setColor(hlColor[1], hlColor[2], hlColor[3], 0.35 * fade * fade)
                    drawAnnularArc(0, 0, self._pocketInner, self._pocketOuter, off, off + angle, 32)
                    if t == 0 then
                        local worldA = self._angle + mid
                        local hlR2 = (self._pocketInner + self._pocketOuter) / 2
                        self._frameLights[#self._frameLights+1] = {
                            x = (cx + pkOx) + math.cos(worldA) * hlR2,
                            y = (cy + pkOy) + math.sin(worldA) * hlR2 * TILT_Y,
                            r = 18, color = hlColor, a = self._bonusMode and 0.3 or 0.2,
                        }
                    end
                end
            end
        end

        off = off + angle
    end
    g:pop() -- end pocket pass

    -- ═══ PASS 2: Label ring + dividers ═══
    local lbOx = layers and layers.labelX or 0
    local lbOy = layers and layers.labelY or 0
    g:push()
    g:translate(cx + lbOx, cy + lbOy)
    g:rotate(self._angle)

    off = 0
    for i = 1, #data do
        local seg = data[i]
        local angle = (seg.weight / tw) * TWO_PI
        local mid = off + angle / 2
        local dark = (i-1) % 2 == 0

        -- Label ring fill
        local ringColor = dark and PAL.darkRed or PAL.black
        g:setColor(ringColor[1], ringColor[2], ringColor[3], 1)
        drawAnnularArc(0, 0, self._labelInner, self._labelOuter, off, off + angle, 32)

        -- Label highlight flash (ISO legacy lines 938-954)
        local lhl = nil
        for _, h in ipairs(self._highlights) do
            if h.idx == i-1 then lhl = h; break end
        end
        if lhl then
            local hlColor2 = PAL.white
            local la
            if lhl.t < 0.15 then la = 0.9
            elseif lhl.t < 0.4 then la = 0.7
            else la = math.max(0, 1 - (lhl.t - 0.4) / 1.1) * 0.5 end
            g:setColor(hlColor2[1], hlColor2[2], hlColor2[3], la)
            drawAnnularArc(0, 0, self._labelInner, self._labelOuter, off, off + angle, 32)
        end


        -- Divider
        g:setColor(DIVIDER_COLOR[1], DIVIDER_COLOR[2], DIVIDER_COLOR[3], 1)
        local dcos, dsin = math.cos(off), math.sin(off)
        g:line(dcos * self._pocketInner, dsin * self._pocketInner,
               dcos * self._labelOuter, dsin * self._labelOuter)

        off = off + angle
    end
    g:pop() -- end label pass

    -- ═══ PASS 3: Rim border ═══
    local rmOx = layers and layers.rimX or 0
    local rmOy = layers and layers.rimY or 0
    g:setColor(RIM_COLOR[1], RIM_COLOR[2], RIM_COLOR[3], 1)
    g:circle('line', cx + rmOx, cy + rmOy, self._rimR)

    -- ═══ PASS 4: Balls + Hub ═══
    g:push()
    g:translate(cx, cy)
    g:rotate(self._angle)

    -- Placed balls that finished dropping (ISO legacy lines 987-995)
    if not self._inGauge then
        for _, pb in ipairs(self._placedBalls) do
            local skip = false
            if self._dropping then
                local elapsed = self._dropClock - pb.dropDelay
                if elapsed < pb.dropDur then skip = true end
            end
            if not skip and pb.localX then
                self:_drawPixelBall(g, atlas, pb.localX, pb.localY, false, pb.special and pb.special.effect)
            end
        end
    end

    -- Settled balls
    for _, b in ipairs(self._balls) do
        if b.settled and b.localX then
            self:_drawPixelBall(g, atlas, b.localX, b.localY, true, b.special and b.special.effect)
        end
    end

    -- Hub circle
    g:setColor(HUB_BG[1], HUB_BG[2], HUB_BG[3], 1)
    g:circle('fill', 0, 0, self._hubR)
    g:setColor(HUB_BORDER[1], HUB_BORDER[2], HUB_BORDER[3], 1)
    g:circle('line', 0, 0, self._hubR)

    self:_drawHubScreen(g, font, atlas, 0, 0)

    g:pop() -- end base pass

    -- Active balls (world space, inside tilt)
    for _, b in ipairs(self._balls) do
        if not b.settled then
            self:_drawPixelBall(g, atlas, cx + b.x, cy + b.y, false, b.special and b.special.effect)
            self._frameLights[#self._frameLights+1] = {
                x = cx + b.x, y = cy + b.y * self:getTilt(),
                r = 10, color = PAL.white, a = 0.12,
            }
        end
    end

    g:pop() -- end tilt

    -- Gauges
    self:_drawGauges(g, font, atlas, cx + pox, cy + poy)

    -- Orbit slots (ISO legacy _drawOrbitSlots)
    self:_drawOrbitSlots(g, font, atlas, cx + pox, cy + poy)
end

-- ── Pixel ball ──
function PW:_drawPixelBall(g, atlas, bx, by, settled, specialEffect)
    local rx, ry = math.floor(bx + 0.5), math.floor(by + 0.5)
    if specialEffect then
        local haloColor
        if specialEffect == 'double' then haloColor = PAL.gold
        elseif specialEffect == 'splash' then haloColor = PAL.red
        elseif specialEffect == 'critical' then haloColor = PAL.neonPink
        elseif specialEffect == 'ticket' then haloColor = PAL.purple
        else haloColor = PAL.white end
        g:setColor(haloColor[1], haloColor[2], haloColor[3], 1)
        g:rect('fill', rx - 5, ry - 3, 11, 7)
        g:rect('fill', rx - 3, ry - 5, 7, 11)
    end
    g:setColor(1, 1, 1, 1)
    if atlas then
        atlas:drawCentered('ball', rx, ry, 1)
    else
        g:circle('fill', rx, ry, 3)
    end
end

-- ── Hub screen (ISO legacy lines 1304-1361) ──
function PW:_drawHubScreen(g, font, atlas, cx, cy)
    local h = self._hub
    local r = self._hubR - 3
    if r < 5 then return end
    local SPRITE_SIZE = 8

    g:push()
    g:clipCircle(cx, cy, r)

    -- Score with coin icon (group-centered, ISO legacy lines 1314-1320)
    local scoreStr = tostring(h.score)
    local scoreW = font:measure(scoreStr)
    local coinSz = SPRITE_SIZE
    local totalW = scoreW + 2 + coinSz
    local sx = math.floor(cx - totalW / 2)
    font:draw(scoreStr, sx, math.floor(cy - r * 0.25 - 3), PAL.gold, 1)
    if atlas then
        g:setColor(1, 1, 1, 1)
        atlas:drawAnim('coin', sx + scoreW + 2 + math.floor(coinSz / 2),
            math.floor(cy - r * 0.25), 1, self._time, 6)
    end

    -- Last symbol sprite (ISO legacy lines 1323-1327)
    if h.lastSymbolId and h.lastSymbolId ~= '' and h.valueFade > 0 and atlas then
        local alpha = math.min(1, h.valueFade)
        g:setColor(1, 1, 1, alpha)
        atlas:drawCentered(h.lastSymbolId, cx, math.floor(cy + 2), 2)
        g:setColor(1, 1, 1, 1)
    end

    -- History pips
    if #h.history > 0 then
        local total = #h.history
        local spacing = math.min(6, math.floor((r * 1.4) / total))
        local startX = math.floor(cx - ((total - 1) * spacing) / 2)
        local histY = math.floor(cy + r * 0.55)
        for i = 1, total do
            local col = i % 2 == 1 and PAL.lightGray or PAL.midGray
            g:setColor(col[1], col[2], col[3], 1)
            g:rect('fill', startX + (i-1) * spacing, histY, 3, 3)
        end
    end

    -- Value flash with coin (ISO legacy lines 1342-1351)
    if h.valueFade > 0 then
        local alpha = math.min(1, h.valueFade)
        local valStr = '+' .. h.lastValue
        local valW = font:measure(valStr)
        local tw2 = valW + 2 + coinSz
        local vsx = math.floor(cx - tw2 / 2)
        g:setColor(PAL.green[1], PAL.green[2], PAL.green[3], alpha)
        font:draw(valStr, vsx, math.floor(cy + r * 0.05 - 3), PAL.green, 1)
        if atlas then
            g:setColor(1, 1, 1, alpha)
            atlas:drawAnim('coin', vsx + valW + 2 + math.floor(coinSz / 2),
                math.floor(cy + r * 0.05), 1, self._time, 6)
        end
        g:setColor(1, 1, 1, 1)
    end

    -- Message flash
    if h.messageFade > 0 then
        local alpha = math.min(1, h.messageFade)
        g:setColor(PAL.gold[1], PAL.gold[2], PAL.gold[3], alpha)
        font:drawCentered(h.message, cx, math.floor(cy - r * 0.45), PAL.gold, 1)
        g:setColor(1, 1, 1, 1)
    end

    g:unclip()
    g:pop()
end

-- ── Forge shop face (ISO legacy _drawForgeFace) ──
function PW:_drawForgeFace(g, font, atlas, cx, cy)
    local shop = self._shop

    if shop.buyFlashTimer > 0 then
        shop.buyFlashTimer = shop.buyFlashTimer - 1/60
    end

    -- Background disc
    g:setColor(PAL.black[1], PAL.black[2], PAL.black[3], 1)
    g:circle('fill', cx, cy, self._rimR)

    -- 8 arc slots (4 quadrants × 2 slots)
    local QUAD_GAP = 0.10
    local SLOT_GAP = 0.04
    local QUAD_SPAN = math.pi / 2 - QUAD_GAP
    local SLOT_SPAN = (QUAD_SPAN - SLOT_GAP) / 2
    local slotInner = self._hubR + 3
    local slotOuter = self._rimR - 3
    local slotMidR = (slotInner + slotOuter) / 2

    local quadStarts = {
        -math.pi/2 + QUAD_GAP/2,
         0          + QUAD_GAP/2,
         math.pi/2  + QUAD_GAP/2,
         math.pi    + QUAD_GAP/2,
    }

    local RARITY_COLORS = {
        common    = { fg = PAL.lightGray, bg = PAL.midGray, border = PAL.lightGray },
        uncommon  = { fg = PAL.green, bg = PAL.darkGreen, border = PAL.green },
        rare      = { fg = PAL.blue, bg = PAL.darkBlue, border = PAL.cyan },
        legendary = { fg = PAL.neonPink, bg = PAL.darkPurple, border = PAL.gold },
    }

    local SPRITE_SIZE = 8
    local CH_H = 6
    local TICKET_W = 7

    for q = 1, 4 do
        for s = 0, 1 do
            local slotIdx = (q-1) * 2 + s
            local a0 = quadStarts[q] + s * (SLOT_SPAN + SLOT_GAP)
            local a1 = a0 + SLOT_SPAN
            local mid = a0 + SLOT_SPAN / 2
            local isHover = shop.hoverIdx == slotIdx
            local isBuyFlash = shop.buyFlash == slotIdx and shop.buyFlashTimer > 0

            -- Slot outline
            g:setColor(PAL.midGray[1], PAL.midGray[2], PAL.midGray[3], 1)
            love.graphics.arc('line', 'open', cx, cy, slotOuter, a0, a1, 32)
            love.graphics.arc('line', 'open', cx, cy, slotInner, a0, a1, 32)

            -- Reroll button (slot 4 = index 4)
            if slotIdx == 4 then
                g:setColor(PAL.darkGray[1], PAL.darkGray[2], PAL.darkGray[3], 0.3)
                drawAnnularArc(cx, cy, slotInner + 1, slotOuter - 1, a0, a1, 32)

                g:setColor(PAL.lightGray[1], PAL.lightGray[2], PAL.lightGray[3], 1)
                love.graphics.arc('line', 'open', cx, cy, slotOuter, a0, a1, 32)
                love.graphics.arc('line', 'open', cx, cy, slotInner, a0, a1, 32)

                local rx = cx + math.cos(mid) * slotMidR
                local ry = cy + math.sin(mid) * slotMidR
                if atlas then
                    g:setColor(1, 1, 1, 1)
                    atlas:drawCentered('reroll', math.floor(rx), math.floor(ry), 2)
                end
                font:drawCentered(tostring(shop.rerollCost), math.floor(rx),
                    math.floor(ry + 14) - math.floor(CH_H/2), PAL.gold, 1)

                if shop.hoverIdx == 'reroll' and shop.currency >= shop.rerollCost then
                    g:setColor(PAL.white[1], PAL.white[2], PAL.white[3], 0.12)
                    drawAnnularArc(cx, cy, slotInner, slotOuter, a0, a1, 32)
                end
                goto continue_slot
            end

            -- Offering
            local offering = shop.offerings[slotIdx + 1]
            if offering then
                local rc = RARITY_COLORS[offering.rarity] or RARITY_COLORS.common
                local tooExpensive = shop.currency < (offering.finalCost or 0)

                -- Tinted fill
                g:setColor(rc.bg[1], rc.bg[2], rc.bg[3], offering.rarity == 'common' and 0.15 or 0.3)
                drawAnnularArc(cx, cy, slotInner + 1, slotOuter - 1, a0, a1, 32)

                -- Border
                g:setColor(rc.border[1], rc.border[2], rc.border[3], 1)
                love.graphics.arc('line', 'open', cx, cy, slotOuter, a0, a1, 32)
                love.graphics.arc('line', 'open', cx, cy, slotInner, a0, a1, 32)

                -- Sprite at center (ISO legacy _offeringSprite)
                local sx2 = cx + math.cos(mid) * slotMidR
                local sy2 = cy + math.sin(mid) * slotMidR
                local spriteName
                if offering.shopType == 'symbol' then
                    spriteName = offering.symbolId or 'ball'
                elseif offering.shopType == 'special_ball' then
                    spriteName = 'ball'
                else
                    spriteName = 'relic_' .. (offering.rarity or 'common')
                end

                if not isBuyFlash and tooExpensive then
                    g:setColor(1, 1, 1, 0.35)
                else
                    g:setColor(1, 1, 1, 1)
                end
                if atlas then atlas:drawCentered(spriteName, math.floor(sx2), math.floor(sy2), 2) end
                g:setColor(1, 1, 1, 1)

                -- Price with ticket sprite (ISO legacy lines 1193-1205)
                local priceStr = tostring(offering.finalCost or 0)
                local priceColor = tooExpensive and PAL.red or PAL.gold
                local textW = font:measure(priceStr)
                local gap = 7
                local tW = TICKET_W
                local pTotalW = textW + gap + tW
                local pStartX = math.floor(sx2 - pTotalW / 2)
                local pTextY = math.floor(sy2 + 14) - math.floor(CH_H / 2)
                font:draw(priceStr, pStartX, pTextY, priceColor, 1)
                if atlas then
                    g:setColor(1, 1, 1, 1)
                    atlas:drawCentered('ticket', pStartX + textW + gap + math.floor(tW / 2),
                        math.floor(sy2 + 14), 1)
                end

                -- Hover
                if isHover and not tooExpensive then
                    g:setColor(PAL.white[1], PAL.white[2], PAL.white[3], 0.12)
                    drawAnnularArc(cx, cy, slotInner, slotOuter, a0, a1, 32)
                end

                -- Buy flash
                if isBuyFlash then
                    g:setColor(PAL.gold[1], PAL.gold[2], PAL.gold[3], shop.buyFlashTimer / 0.4 * 0.6)
                    drawAnnularArc(cx, cy, slotInner, slotOuter, a0, a1, 32)
                end
            else
                -- Empty slot
                local ex = cx + math.cos(mid) * slotMidR
                local ey = cy + math.sin(mid) * slotMidR
                g:setColor(PAL.midGray[1], PAL.midGray[2], PAL.midGray[3], 0.3)
                g:rect('fill', math.floor(ex) - 1, math.floor(ey) - 1, 3, 3)
            end

            ::continue_slot::
        end

        -- Quadrant divider lines (ISO legacy lines 1251-1260)
        local dAngle = quadStarts[q] - QUAD_GAP / 2
        local dc, ds = math.cos(dAngle), math.sin(dAngle)
        g:setColor(PAL.midGray[1], PAL.midGray[2], PAL.midGray[3], 1)
        g:line(cx + dc * slotInner, cy + ds * slotInner,
               cx + dc * slotOuter, cy + ds * slotOuter)
    end

    -- Hub center: CONTINUER button
    local leaveHover = shop.hoverIdx == 'leave'
    g:setColor(PAL.darkGray[1], PAL.darkGray[2], PAL.darkGray[3], leaveHover and 0.8 or 0.5)
    g:circle('fill', cx, cy, self._hubR - 1)
    local borderCol = leaveHover and PAL.lightGray or PAL.midGray
    g:setColor(borderCol[1], borderCol[2], borderCol[3], 1)
    g:circle('line', cx, cy, self._hubR - 1)
    if atlas then atlas:drawCentered('arrow_right', cx, cy - 8, 3) end
    font:drawCentered('CONTINUER', cx, cy + 4, PAL.lightGray, 1)
    if shop.nextQuota and shop.nextQuota > 0 then
        font:drawCentered('QUOTA ' .. shop.nextQuota, cx, cy + 14, PAL.midGray, 1, false)
    end
end

-- ── Settings face ──
function PW:_drawSettingsFace(g, font, atlas, cx, cy)
    local s = self._settings
    local t = self._time

    -- Background disc
    g:setColor(PAL.black[1], PAL.black[2], PAL.black[3], 1)
    g:circle('fill', cx, cy, self._rimR)

    -- Animated gold outer ring glow
    for i = 0, 3 do
        local a = 0.08 - i * 0.015
        g:setColor(PAL.gold[1], PAL.gold[2], PAL.gold[3], a)
        g:circle('line', cx, cy, self._rimR - i)
    end

    -- Decorative rotating dot ring
    local dotCount = 16
    for i = 0, dotCount - 1 do
        local ang = (i / dotCount) * TWO_PI + t * 0.15
        local dx = cx + math.cos(ang) * (self._rimR - 6)
        local dy = cy + math.sin(ang) * (self._rimR - 6)
        local pulse = 0.3 + 0.3 * math.sin(t * 2 + i * 0.4)
        g:setColor(PAL.darkGold[1], PAL.darkGold[2], PAL.darkGold[3], pulse)
        g:rect('fill', math.floor(dx), math.floor(dy), 1, 1)
    end

    local slotInner = self._hubR + 5
    local slotOuter = self._rimR - 3
    local slotMidR = (slotInner + slotOuter) / 2

    local SLIDERS = {
        { id = 'master', label = 'GENERAL', value = s.masterVol },
        { id = 'bgm',    label = 'MUSIQUE', value = s.bgmVol },
        { id = 'sfx',    label = 'EFFETS',  value = s.sfxVol },
    }

    -- ── 3 volume arc sliders (S1, S2, S3) ──
    for q = 1, 3 do
        local sl = SLIDERS[q]
        local a0 = settingsSectStart(q)
        local a1 = a0 + SETTINGS_SECT_SPAN
        local isHover = s.hoverId == sl.id
        local isDrag = s.dragging == sl.id

        -- Track background
        g:setColor(PAL.darkGray[1], PAL.darkGray[2], PAL.darkGray[3], 0.55)
        drawAnnularArc(cx, cy, slotInner + 1, slotOuter - 1, a0, a1, 48)

        -- Filled portion
        if sl.value > 0.005 then
            local fillEnd = a0 + SETTINGS_SECT_SPAN * sl.value
            local baseAlpha = (isHover or isDrag) and 0.95 or 0.75
            g:setColor(PAL.darkGold[1], PAL.darkGold[2], PAL.darkGold[3], baseAlpha)
            drawAnnularArc(cx, cy, slotInner + 1, slotOuter - 1, a0, fillEnd, 48)
            g:setColor(PAL.gold[1], PAL.gold[2], PAL.gold[3], baseAlpha)
            drawAnnularArc(cx, cy, slotMidR - 3, slotMidR + 3, a0, fillEnd, 48)
            if sl.value < 0.995 then
                local mc, ms = math.cos(fillEnd), math.sin(fillEnd)
                g:setColor(PAL.white[1], PAL.white[2], PAL.white[3], 1)
                love.graphics.setLineWidth(2)
                g:line(cx + mc*slotInner, cy + ms*slotInner,
                       cx + mc*slotOuter, cy + ms*slotOuter)
                love.graphics.setLineWidth(1)
                g:setColor(PAL.white[1], PAL.white[2], PAL.white[3], 0.6 + 0.3 * math.sin(t * 6))
                g:circle('fill', cx + mc*slotMidR, cy + ms*slotMidR, 2)
            end
        end

        if isHover then
            g:setColor(PAL.white[1], PAL.white[2], PAL.white[3], 0.08)
            drawAnnularArc(cx, cy, slotInner, slotOuter, a0, a1, 48)
        end

        local borderCol = isHover and PAL.gold or PAL.midGray
        g:setColor(borderCol[1], borderCol[2], borderCol[3], 1)
        love.graphics.arc('line', 'open', cx, cy, slotOuter, a0, a1, 48)
        love.graphics.arc('line', 'open', cx, cy, slotInner, a0, a1, 48)
        local dc0, ds0 = math.cos(a0), math.sin(a0)
        local dc1, ds1 = math.cos(a1), math.sin(a1)
        g:line(cx + dc0*slotInner, cy + ds0*slotInner, cx + dc0*slotOuter, cy + ds0*slotOuter)
        g:line(cx + dc1*slotInner, cy + ds1*slotInner, cx + dc1*slotOuter, cy + ds1*slotOuter)

        local mid = a0 + SETTINGS_SECT_SPAN / 2
        local lx = math.floor(cx + math.cos(mid) * slotMidR)
        local ly = math.floor(cy + math.sin(mid) * slotMidR)
        local textCol = isHover and PAL.white or PAL.lightGray
        font:drawCentered(sl.label, lx, ly - 6, textCol, 1)
        font:drawCentered(math.floor(sl.value * 100) .. '%', lx, ly + 3, PAL.gold, 1)
    end

    -- ── S4: Fullscreen toggle ──
    do
        local a0 = settingsSectStart(4)
        local a1 = a0 + SETTINGS_SECT_SPAN
        local isHover = s.hoverId == 'fullscreen'

        g:setColor(PAL.darkGray[1], PAL.darkGray[2], PAL.darkGray[3], 0.55)
        drawAnnularArc(cx, cy, slotInner + 1, slotOuter - 1, a0, a1, 48)

        if s.fullscreen then
            g:setColor(PAL.darkGreen[1], PAL.darkGreen[2], PAL.darkGreen[3], 0.9)
            drawAnnularArc(cx, cy, slotInner + 1, slotOuter - 1, a0, a1, 48)
            g:setColor(PAL.green[1], PAL.green[2], PAL.green[3], 0.85)
            drawAnnularArc(cx, cy, slotMidR - 3, slotMidR + 3, a0, a1, 48)
        end

        if isHover then
            g:setColor(PAL.white[1], PAL.white[2], PAL.white[3], 0.1)
            drawAnnularArc(cx, cy, slotInner, slotOuter, a0, a1, 48)
        end

        local borderCol = isHover and PAL.gold or (s.fullscreen and PAL.green or PAL.midGray)
        g:setColor(borderCol[1], borderCol[2], borderCol[3], 1)
        love.graphics.arc('line', 'open', cx, cy, slotOuter, a0, a1, 48)
        love.graphics.arc('line', 'open', cx, cy, slotInner, a0, a1, 48)
        local dc0, ds0 = math.cos(a0), math.sin(a0)
        local dc1, ds1 = math.cos(a1), math.sin(a1)
        g:line(cx + dc0*slotInner, cy + ds0*slotInner, cx + dc0*slotOuter, cy + ds0*slotOuter)
        g:line(cx + dc1*slotInner, cy + ds1*slotInner, cx + dc1*slotOuter, cy + ds1*slotOuter)

        local mid = a0 + SETTINGS_SECT_SPAN / 2
        local lx = math.floor(cx + math.cos(mid) * slotMidR)
        local ly = math.floor(cy + math.sin(mid) * slotMidR)
        font:drawCentered('PLEIN', lx, ly - 10, isHover and PAL.white or PAL.lightGray, 1)
        font:drawCentered('ECRAN', lx, ly - 2, isHover and PAL.white or PAL.lightGray, 1)
        local stateStr = s.fullscreen and '[ON]' or '[OFF]'
        local stateCol = s.fullscreen and PAL.green or PAL.red
        font:drawCentered(stateStr, lx, ly + 7, stateCol, 1)
    end

    -- ── S5: Theme cycle ──
    do
        local a0 = settingsSectStart(5)
        local a1 = a0 + SETTINGS_SECT_SPAN
        local isHover = s.hoverId == 'theme'

        g:setColor(PAL.darkGray[1], PAL.darkGray[2], PAL.darkGray[3], 0.55)
        drawAnnularArc(cx, cy, slotInner + 1, slotOuter - 1, a0, a1, 48)

        -- Color swatch arc fill
        g:setColor(PAL.darkPurple[1], PAL.darkPurple[2], PAL.darkPurple[3], 0.7)
        drawAnnularArc(cx, cy, slotInner + 1, slotOuter - 1, a0, a1, 48)
        g:setColor(PAL.purple[1], PAL.purple[2], PAL.purple[3], 0.5)
        drawAnnularArc(cx, cy, slotMidR - 3, slotMidR + 3, a0, a1, 48)

        if isHover then
            g:setColor(PAL.white[1], PAL.white[2], PAL.white[3], 0.1)
            drawAnnularArc(cx, cy, slotInner, slotOuter, a0, a1, 48)
        end

        local borderCol = isHover and PAL.gold or PAL.purple
        g:setColor(borderCol[1], borderCol[2], borderCol[3], 1)
        love.graphics.arc('line', 'open', cx, cy, slotOuter, a0, a1, 48)
        love.graphics.arc('line', 'open', cx, cy, slotInner, a0, a1, 48)
        local dc0, ds0 = math.cos(a0), math.sin(a0)
        local dc1, ds1 = math.cos(a1), math.sin(a1)
        g:line(cx + dc0*slotInner, cy + ds0*slotInner, cx + dc0*slotOuter, cy + ds0*slotOuter)
        g:line(cx + dc1*slotInner, cy + ds1*slotInner, cx + dc1*slotOuter, cy + ds1*slotOuter)

        local mid = a0 + SETTINGS_SECT_SPAN / 2
        local lx = math.floor(cx + math.cos(mid) * slotMidR)
        local ly = math.floor(cy + math.sin(mid) * slotMidR)
        font:drawCentered('THEME', lx, ly - 6, isHover and PAL.white or PAL.lightGray, 1)
        local label = PAL.getThemeLabel()
        -- Truncate label to fit
        if #label > 10 then label = label:sub(1, 9) .. '.' end
        font:drawCentered(label, lx, ly + 3, PAL.cyan, 1)
    end
    end

    -- ── Hub center: RETOUR button ──
    local closeHover = s.hoverId == 'close'
    local pulse = 0.5 + 0.2 * math.sin(t * 3)
    g:setColor(PAL.darkGray[1], PAL.darkGray[2], PAL.darkGray[3], closeHover and 0.9 or 0.6)
    g:circle('fill', cx, cy, self._hubR - 1)

    -- Animated inner rings
    g:setColor(PAL.gold[1], PAL.gold[2], PAL.gold[3], closeHover and 0.35 or pulse * 0.25)
    g:circle('line', cx, cy, self._hubR - 3)
    g:setColor(PAL.gold[1], PAL.gold[2], PAL.gold[3], closeHover and 0.25 or pulse * 0.15)
    g:circle('line', cx, cy, self._hubR - 6)

    local borderCol = closeHover and PAL.gold or PAL.midGray
    g:setColor(borderCol[1], borderCol[2], borderCol[3], 1)
    g:circle('line', cx, cy, self._hubR - 1)

    if atlas then
        g:setColor(1, 1, 1, 1)
        atlas:drawCentered('gear', math.floor(cx), math.floor(cy - 7), 2)
    end
    font:drawCentered('RETOUR', math.floor(cx), math.floor(cy + 5),
        closeHover and PAL.gold or PAL.lightGray, 1)
end

-- ── Gauges ──
function PW:_drawGauges(g, font, atlas, cx, cy)
    for gi = 1, #GAUGE_CONFIGS do
        if gi == 3 then
            -- bottom = rim counters
            self:_drawRimCounters(g, font, atlas, cx, cy)
        elseif gi == 2 then
            self:_drawRelicBar(g, font, atlas, cx, cy)
        elseif gi == 4 then
            self:_drawCorruptionGauge(g, font, atlas, cx, cy, GAUGE_CONFIGS[gi])
        else
            self:_drawOneGauge(g, font, atlas, cx, cy, gi)
        end
    end
end

function PW:_drawOneGauge(g, font, atlas, cx, cy, gaugeIdx)
    local cfg = GAUGE_CONFIGS[gaugeIdx]
    local unlocked = self._gaugeUnlocks[gaugeIdx]
    local INNER = self._rimR + 16
    local OUTER = self._rimR + 21

    -- Channel fill
    local fillColor = unlocked and SEG_B or PAL.black
    g:setColor(fillColor[1], fillColor[2], fillColor[3], 1)
    drawAnnularArc(cx, cy, INNER, OUTER, cfg.start, cfg.eend, 32)

    -- Border arcs
    local borderCol = unlocked and RIM_COLOR or PAL.midGray
    g:setColor(borderCol[1], borderCol[2], borderCol[3], 1)
    love.graphics.arc('line', 'open', cx, cy, OUTER, cfg.start, cfg.eend, 32)
    love.graphics.arc('line', 'open', cx, cy, INNER, cfg.start, cfg.eend, 32)

    -- Endcap radial lines (ISO legacy lines 1566-1571)
    for _, a in ipairs({cfg.start, cfg.eend}) do
        g:line(cx + math.cos(a) * INNER, cy + math.sin(a) * INNER,
               cx + math.cos(a) * OUTER, cy + math.sin(a) * OUTER)
    end

    if not unlocked then
        -- Lock X indicator (ISO legacy lines 1581-1591)
        local midA = (cfg.start + cfg.eend) / 2
        local midR = (INNER + OUTER) / 2
        local lx = math.floor(cx + math.cos(midA) * midR)
        local ly = math.floor(cy + math.sin(midA) * midR)
        g:setColor(PAL.midGray[1], PAL.midGray[2], PAL.midGray[3], 1)
        g:rect('fill', lx - 1, ly - 1, 1, 1)
        g:rect('fill', lx + 1, ly - 1, 1, 1)
        g:rect('fill', lx, ly, 1, 1)
        g:rect('fill', lx - 1, ly + 1, 1, 1)
        g:rect('fill', lx + 1, ly + 1, 1, 1)
        return
    end

    -- Balls in gauge
    local gaugeBalls = self._inGauge and self._placedBalls or (self._ejecting and self._ejectQueue or {})
    local ballCount = 0
    for _, pb in ipairs(gaugeBalls) do
        if pb.gaugeIdx == gaugeIdx then
            ballCount = ballCount + 1
            local bx = math.floor(cx + pb.gaugeX)
            local by = math.floor(cy + pb.gaugeY)
            g:setColor(PAL.black[1], PAL.black[2], PAL.black[3], 1)
            g:rect('fill', bx - 4, by - 3, 7, 7)
            self:_drawPixelBall(g, atlas, bx, by, false, pb.special and pb.special.effect)
            -- Glow light (ISO legacy lines 1604-1612)
            local glowColor = PAL.white
            if pb.special then
                if pb.special.effect == 'double' then glowColor = PAL.gold
                elseif pb.special.effect == 'splash' then glowColor = PAL.red
                elseif pb.special.effect == 'critical' then glowColor = PAL.neonPink
                elseif pb.special.effect == 'ticket' then glowColor = PAL.purple
                end
            end
            self._frameLights[#self._frameLights+1] = {
                x = cx + pb.gaugeX, y = cy + pb.gaugeY * self:getTilt(),
                r = pb.special and 8 or 6, color = glowColor,
                a = pb.special and 0.12 or 0.06,
            }
        end
    end

    if ballCount > 0 then
        local la = cfg.eend + 0.12
        local lr = (INNER + OUTER) / 2
        local lx = math.floor(cx + math.cos(la) * lr)
        local ly = math.floor(cy + math.sin(la) * lr)
        font:drawCentered(tostring(ballCount), lx, ly - 3, PAL.white, 1)
    end
end

function PW:_drawCorruptionGauge(g, font, atlas, cx, cy, cfg)
    local INNER = self._rimR + 16
    local OUTER = self._rimR + 21
    local fill = self._corruption
    local totalArc = cfg.eend - cfg.start
    local fillEnd = cfg.start + totalArc * fill

    -- Background
    g:setColor(PAL.darkPurple[1], PAL.darkPurple[2], PAL.darkPurple[3], 1)
    drawAnnularArc(cx, cy, INNER, OUTER, cfg.start, cfg.eend, 32)

    -- Filled part
    if fill > 0.001 then
        local fillCol = fill >= 0.85 and PAL.neonPink or PAL.purple
        g:setColor(fillCol[1], fillCol[2], fillCol[3], 1)
        drawAnnularArc(cx, cy, INNER, OUTER, cfg.start, fillEnd, 32)
    end

    -- Border (ISO legacy lines 1650-1659)
    local borderCol = fill >= 0.85 and PAL.neonPink or PAL.purple
    g:setColor(borderCol[1], borderCol[2], borderCol[3], 1)
    love.graphics.arc('line', 'open', cx, cy, OUTER, cfg.start, cfg.eend, 32)
    love.graphics.arc('line', 'open', cx, cy, INNER, cfg.start, cfg.eend, 32)
    for _, a in ipairs({cfg.start, cfg.eend}) do
        g:line(cx + math.cos(a) * INNER, cy + math.sin(a) * INNER,
               cx + math.cos(a) * OUTER, cy + math.sin(a) * OUTER)
    end

    -- Fill edge tick mark (ISO legacy lines 1662-1669)
    if fill > 0.01 and fill < 0.99 then
        g:setColor(PAL.white[1], PAL.white[2], PAL.white[3], 1)
        g:line(cx + math.cos(fillEnd) * INNER, cy + math.sin(fillEnd) * INNER,
               cx + math.cos(fillEnd) * OUTER, cy + math.sin(fillEnd) * OUTER)
    end

    -- Glow at high corruption (ISO legacy lines 1672-1680)
    if fill >= 0.85 then
        local midA = (cfg.start + fillEnd) / 2
        local midR = (INNER + OUTER) / 2
        self._frameLights[#self._frameLights+1] = {
            x = cx + math.cos(midA) * midR,
            y = cy + math.sin(midA) * midR * math.abs(self._tilt),
            r = 12, color = PAL.neonPink, a = 0.15,
        }
    end

    -- Skull icon
    if atlas then
        local skullA = cfg.start - 0.08
        local skullR = (INNER + OUTER) / 2
        g:setColor(1, 1, 1, 1)
        atlas:drawCentered('skull', math.floor(cx + math.cos(skullA) * skullR), math.floor(cy + math.sin(skullA) * skullR), 1)
    end
end

function PW:_drawRelicBar(g, font, atlas, cx, cy)
    local cfg = GAUGE_CONFIGS[2]
    local INNER = self._rimR + 16
    local OUTER = self._rimR + 21
    local MID_R = (INNER + OUTER) / 2
    local RARITIES = {'common', 'uncommon', 'rare', 'legendary'}
    local RARITY_COL = { common = PAL.white, uncommon = PAL.green, rare = PAL.blue, legendary = PAL.gold }
    local arcLen = cfg.eend - cfg.start

    local counts = { common = 0, uncommon = 0, rare = 0, legendary = 0 }
    for _, r in ipairs(self._relics) do
        if counts[r.rarity] ~= nil then counts[r.rarity] = counts[r.rarity] + 1 end
    end

    for i = 1, #RARITIES do
        local rarity = RARITIES[i]
        local a = cfg.start + arcLen * (i - 0.5) / #RARITIES
        local sx = math.floor(cx + math.cos(a) * MID_R)
        local sy = math.floor(cy + math.sin(a) * MID_R) + 4

        local count = counts[rarity]
        if atlas then
            if count > 0 then
                g.setColor(1, 1, 1, 1)
            else
                g.setColor(PAL.midGray[1], PAL.midGray[2], PAL.midGray[3], 1)
            end
            atlas:drawCentered('relic_' .. rarity, sx, sy, 1)
            g.setColor(1, 1, 1, 1)
        end

        local col = count > 0 and RARITY_COL[rarity] or PAL.midGray
        font:draw(tostring(count), sx + 3, sy + 1, col, 1)
    end
end

function PW:_drawRimCounters(g, font, atlas, cx, cy)
    local cfg = GAUGE_CONFIGS[3]
    local INNER = self._rimR + 16
    local OUTER = self._rimR + 21
    local MID_R = (INNER + OUTER) / 2
    local arcLen = cfg.eend - cfg.start
    local gap = 2
    local SPRITE_SIZE = 8
    local TICKET_W = 7
    local CH_H = 6

    -- Gold counter (right half) — group-centered text+coin
    if not self._goldQuotaAnim then
        local goldA = cfg.start + arcLen * 0.75
        local gx = math.floor(cx + math.cos(goldA) * MID_R)
        local gy = math.floor(cy + math.sin(goldA) * MID_R)
        if self._goldShake.intensity > 0 then
            local t = math.min(1, self._goldShake.time / self._goldShake.decay)
            local amp = self._goldShake.intensity * (1 - t)
            gx = gx + math.floor((math.random() - 0.5) * 2 * amp)
            gy = gy + math.floor((math.random() - 0.5) * 2 * amp)
        end
        local goldTxt = tostring(self._counterGold)
        local goldTW = font:measure(goldTxt)
        local goldTotalW = goldTW + gap + SPRITE_SIZE
        local gsx = gx - math.floor(goldTotalW / 2)
        font:draw(goldTxt, gsx, gy - math.floor(CH_H / 2), PAL.gold, 1)
        if atlas then
            g:setColor(1, 1, 1, 1)
            atlas:drawAnim('coin', gsx + goldTW + gap + math.floor(SPRITE_SIZE / 2), gy, 1, self._time, 6)
        end
    end

    -- Ticket counter (left half) — group-centered text+ticket
    if not self._ticketAnim then
        local tickA = cfg.start + arcLen * 0.25
        local tx = math.floor(cx + math.cos(tickA) * MID_R)
        local ty = math.floor(cy + math.sin(tickA) * MID_R)
        if self._ticketShake.intensity > 0 then
            local t = math.min(1, self._ticketShake.time / self._ticketShake.decay)
            local amp = self._ticketShake.intensity * (1 - t)
            tx = tx + math.floor((math.random() - 0.5) * 2 * amp)
            ty = ty + math.floor((math.random() - 0.5) * 2 * amp)
        end
        local tickTxt = tostring(self._counterTickets)
        local tickTW = font:measure(tickTxt)
        local tickTotalW = tickTW + gap + TICKET_W
        local tsx = tx - math.floor(tickTotalW / 2)
        font:draw(tickTxt, tsx, ty - math.floor(CH_H / 2), PAL.green, 1)
        if atlas then
            g:setColor(1, 1, 1, 1)
            atlas:drawCentered('ticket', tsx + tickTW + gap + math.floor(TICKET_W / 2) + 4, ty - 1, 1)
        end
    end
end

-- ── Gold fly anims (ISO legacy lines 1393-1412) ──
--- Draw segment number labels — call from UI pass (screen-res) for crisp text
function PW:drawLabels(g, font, cx, cy)
    local data = self._data
    if #data == 0 then return end

    local TILT_Y = math.abs(self._tilt)
    if TILT_Y < 0.01 or self._tilt < 0 then return end

    local tw = 0
    for _, s in ipairs(data) do tw = tw + s.weight end

    g:push()
    g:translate(cx, cy)
    g:scale(1, TILT_Y)
    g:translate(-cx, -cy)

    g:push()
    g:translate(cx, cy)
    g:rotate(self._angle)

    local numR = self.R * LABEL_P
    local off = 0
    for i = 1, #data do
        local seg = data[i]
        local angle = (seg.weight / tw) * TWO_PI
        local mid = off + angle / 2

        local label = self._segmentValues[i] and tostring(self._segmentValues[i]) or tostring(i)
        local len = #label
        local sc = len <= 1 and 1 or len == 2 and 0.8 or len == 3 and 0.65 or 0.55
        local lw = font:measure(label) * sc
        local lh = font._H * sc

        g:push()
        g:translate(math.cos(mid) * numR, math.sin(mid) * numR)
        g:rotate(mid + math.pi / 2)
        font:draw(label, -lw / 2, -lh / 2 - sc, PAL.white, sc, false)
        g:pop()

        off = off + angle
    end

    g:pop()
    g:pop()
end

function PW:drawGoldAnims(g, font, atlas, cx, cy)
    local SPRITE_SIZE = 8
    local CH_H = 6
    for _, ga in ipairs(self._goldAnims) do
        local t = math.min(1, ga.elapsed / ga.duration)
        local ease = t < 0.5 and (2*t*t) or (1 - (-2*t + 2)^2 / 2)
        local x = ga.startX + (ga.targetX - ga.startX) * ease
        local y = ga.startY + (ga.targetY - ga.startY) * ease
        local scale = 1 + 0.3 * math.sin(math.pi * t)
        local alpha = ga.arrived and math.max(0, 1 - (ga.elapsed - ga.duration) / 0.15) or 1
        if alpha > 0 then
            local txtW = font:measure(ga.text)
            local coinSz = SPRITE_SIZE
            local totalW = txtW + 2 + coinSz
            local dx = math.floor(x - totalW / 2)
            local dy = math.floor(y)
            font:draw(ga.text, dx, dy - math.floor(CH_H * scale / 2),
                { PAL.gold[1], PAL.gold[2], PAL.gold[3], alpha }, scale)
            if atlas then
                g:setColor(1, 1, 1, alpha)
                atlas:drawAnim('coin', dx + txtW + 2 + math.floor(coinSz / 2), dy, scale, self._time, 6)
            end
            g:setColor(1, 1, 1, 1)
        end
    end
end

-- ── Ticket fly anims (mirror of gold fly) ──
function PW:drawTicketFlyAnims(g, font, atlas, cx, cy)
    local SPRITE_SIZE = 8
    local CH_H = 6
    for _, ta in ipairs(self._ticketFlyAnims) do
        local t = math.min(1, ta.elapsed / ta.duration)
        local ease = t < 0.5 and (2*t*t) or (1 - (-2*t + 2)^2 / 2)
        local x = ta.startX + (ta.targetX - ta.startX) * ease
        local y = ta.startY + (ta.targetY - ta.startY) * ease
        local scale = 1 + 0.3 * math.sin(math.pi * t)
        local alpha = ta.arrived and math.max(0, 1 - (ta.elapsed - ta.duration) / 0.15) or 1
        if alpha > 0 then
            local txtW = font:measure(ta.text)
            local iconSz = SPRITE_SIZE
            local totalW = txtW + 2 + iconSz
            local dx = math.floor(x - totalW / 2)
            local dy = math.floor(y)
            font:draw(ta.text, dx, dy - math.floor(CH_H * scale / 2),
                { PAL.green[1], PAL.green[2], PAL.green[3], alpha }, scale)
            if atlas then
                g:setColor(1, 1, 1, alpha)
                atlas:drawCentered('ticket', dx + txtW + 2 + math.floor(iconSz / 2), dy, scale)
            end
            g:setColor(1, 1, 1, 1)
        end
    end
end

-- ── Gold quota anim (ISO legacy lines 1439-1509) ──
function PW:drawGoldQuotaAnim(g, font, atlas, cx, cy)
    local ga = self._goldQuotaAnim
    if not ga then return end
    local CH_H = 6

    local srcX = math.cos(ga.fromA) * ga.fromMidR
    local srcY = math.sin(ga.fromA) * ga.fromMidR
    local tgtX, tgtY = 0, -(self._hubR + 14)
    local t, x, y, scale, alpha = 0, 0, 0, 1, 1

    if ga.phase == 'fly' then
        t = math.min(1, ga.elapsed / ga.flyDur)
        local ease = t < 0.5 and (2*t*t) or (1 - (-2*t + 2)^2 / 2)
        x = srcX + (tgtX - srcX) * ease
        y = srcY + (tgtY - srcY) * ease
        scale = 1 + 2 * ease; alpha = 0.5 + 0.5 * ease
    elseif ga.phase == 'count' then
        x = tgtX; y = tgtY; scale = 3; alpha = 1
    elseif ga.phase == 'hold' then
        x = tgtX; y = tgtY; scale = 3; alpha = 1
    elseif ga.phase == 'flyback' then
        t = math.min(1, ga.elapsed / ga.flybackDur)
        local ease = t * t
        x = tgtX + (srcX - tgtX) * ease
        y = tgtY + (srcY - tgtY) * ease
        scale = 3 - 2 * ease; alpha = 1 - 0.5 * ease
    else return end

    -- Shake during count phase
    local shakeX, shakeY = 0, 0
    if ga.phase == 'count' then
        local intensity = 2.5 * (1 - math.min(1, ga.elapsed / ga.countDur))
        shakeX = math.floor((math.random() - 0.5) * 2 * intensity)
        shakeY = math.floor((math.random() - 0.5) * 2 * intensity)
    end

    g:push()
    g:translate(cx + x + shakeX, cy + y + shakeY)

    -- Glow behind during count/hold
    if ga.phase == 'count' or ga.phase == 'hold' then
        g:setColor(PAL.gold[1], PAL.gold[2], PAL.gold[3], 0.12 + 0.06 * math.sin(self._time * 12))
        g:circle('fill', 0, 0, 22 * scale / 3)
    end

    if atlas then
        g:setColor(1, 1, 1, alpha)
        atlas:drawAnim('coin', 0, -math.floor(CH_H * scale / 2) - 2, scale, self._time, 6)
    end
    font:drawCentered(tostring(self._counterGold), 0, math.floor(CH_H * scale / 2) + 2,
        { PAL.gold[1], PAL.gold[2], PAL.gold[3], alpha }, scale)

    if ga.phase == 'count' or ga.phase == 'hold' then
        local deducted = ga.startGold - self._counterGold
        if deducted > 0 then
            font:drawCentered('-' .. deducted, 0,
                math.floor(CH_H * scale / 2) + 2 + math.ceil(CH_H * scale) + 2,
                { PAL.red[1], PAL.red[2], PAL.red[3], alpha }, scale * 0.7)
        end
    end
    g:setColor(1, 1, 1, 1)
    g:pop()
end

-- ── Ticket anim (ISO legacy lines 1794-1862) ──
function PW:drawTicketAnim(g, font, atlas, cx, cy)
    local ta = self._ticketAnim
    if not ta then return end
    local CH_H = 6

    local srcX = math.cos(ta.fromA) * ta.fromMidR
    local srcY = math.sin(ta.fromA) * ta.fromMidR
    local tgtX, tgtY = 0, -(self._hubR + 14)
    local t, x, y, scale, alpha = 0, 0, 0, 1, 1

    if ta.phase == 'fly' then
        t = math.min(1, ta.elapsed / ta.flyDur)
        local ease = t < 0.5 and (2*t*t) or (1 - (-2*t + 2)^2 / 2)
        x = srcX + (tgtX - srcX) * ease
        y = srcY + (tgtY - srcY) * ease
        scale = 1 + 2 * ease; alpha = 0.5 + 0.5 * ease
    elseif ta.phase == 'count' then
        x = tgtX; y = tgtY; scale = 3; alpha = 1
    elseif ta.phase == 'hold' then
        x = tgtX; y = tgtY; scale = 3; alpha = 1
    elseif ta.phase == 'flyback' then
        t = math.min(1, ta.elapsed / ta.flybackDur)
        local ease = t * t
        x = tgtX + (srcX - tgtX) * ease
        y = tgtY + (srcY - tgtY) * ease
        scale = 3 - 2 * ease; alpha = 1 - 0.5 * ease
    else return end

    -- Shake during count phase
    local shakeX, shakeY = 0, 0
    if ta.phase == 'count' then
        local intensity = 2.5 * (1 - math.min(1, ta.elapsed / ta.countDur))
        shakeX = math.floor((math.random() - 0.5) * 2 * intensity)
        shakeY = math.floor((math.random() - 0.5) * 2 * intensity)
    end

    g:push()
    g:translate(cx + x + shakeX, cy + y + shakeY)

    -- Glow behind during count/hold
    if ta.phase == 'count' or ta.phase == 'hold' then
        g:setColor(PAL.green[1], PAL.green[2], PAL.green[3], 0.12 + 0.06 * math.sin(self._time * 12))
        g:circle('fill', 0, 0, 22 * scale / 3)
    end

    if atlas then
        g:setColor(1, 1, 1, alpha)
        atlas:drawCentered('ticket', 0, -math.floor(CH_H * scale / 2) - 2, scale)
    end
    local displayCount = ta.baseTickets + ta.counted
    font:drawCentered(tostring(displayCount), 0, math.floor(CH_H * scale / 2) + 2,
        { PAL.green[1], PAL.green[2], PAL.green[3], alpha }, scale)
    g:setColor(1, 1, 1, 1)
    g:pop()
end

-- ── Orbit slots (ISO legacy _drawOrbitSlots lines 1864-1940) ──
function PW:_drawOrbitSlots(g, font, atlas, cx, cy)
    local INNER = self._rimR + 5
    local OUTER = self._rimR + 27
    local SLOT_ARC = 0.28
    local PAIR_GAP = 0.06

    local corners = {
        -math.pi * 3 / 4,  -- top-left
        -math.pi / 4,      -- top-right
         math.pi / 4,      -- bottom-right
         math.pi * 3 / 4,  -- bottom-left
    }

    local idx = 0
    for _, center in ipairs(corners) do
        local a0A = center - PAIR_GAP / 2 - SLOT_ARC
        local a1A = center - PAIR_GAP / 2
        self:_drawOneSlot(g, font, atlas, cx, cy, INNER, OUTER, a0A, a1A, idx)
        idx = idx + 1
        local a0B = center + PAIR_GAP / 2
        local a1B = center + PAIR_GAP / 2 + SLOT_ARC
        self:_drawOneSlot(g, font, atlas, cx, cy, INNER, OUTER, a0B, a1B, idx)
        idx = idx + 1
    end
end

function PW:_drawOneSlot(g, font, atlas, cx, cy, inner, outer, a0, a1, idx)
    local filled = self._slots and self._slots[idx + 1]
    local locked = idx >= 2

    -- Arc fill (black annular segment)
    g:setColor(PAL.black[1], PAL.black[2], PAL.black[3], 1)
    drawAnnularArc(cx, cy, inner, outer, a0, a1, 32)

    -- Borders + radial dividers
    g:setColor(PAL.midGray[1], PAL.midGray[2], PAL.midGray[3], 1)
    love.graphics.arc('line', 'open', cx, cy, outer, a0, a1, 32)
    love.graphics.arc('line', 'open', cx, cy, inner, a0, a1, 32)
    g:line(cx + math.cos(a0) * inner, cy + math.sin(a0) * inner,
           cx + math.cos(a0) * outer, cy + math.sin(a0) * outer)
    g:line(cx + math.cos(a1) * inner, cy + math.sin(a1) * inner,
           cx + math.cos(a1) * outer, cy + math.sin(a1) * outer)

    -- Content
    local midA = (a0 + a1) / 2
    local midR = (inner + outer) / 2
    local mx = math.floor(cx + math.cos(midA) * midR)
    local my = math.floor(cy + math.sin(midA) * midR)

    if filled then
        if atlas then
            g:setColor(1, 1, 1, 1)
            atlas:drawCentered(filled.id or 'ticket', mx, my, 1)
        end
    elseif locked then
        g:setColor(PAL.midGray[1], PAL.midGray[2], PAL.midGray[3], 1)
        g:rect('fill', mx - 1, my - 1, 1, 1)
        g:rect('fill', mx + 1, my - 1, 1, 1)
        g:rect('fill', mx, my, 1, 1)
        g:rect('fill', mx - 1, my + 1, 1, 1)
        g:rect('fill', mx + 1, my + 1, 1, 1)
    else
        g:setColor(PAL.midGray[1], PAL.midGray[2], PAL.midGray[3], 1)
        g:rect('fill', mx, my, 1, 1)
    end
end

-- ── Lights accessor ──
function PW:getLights() return self._frameLights end

return PW
