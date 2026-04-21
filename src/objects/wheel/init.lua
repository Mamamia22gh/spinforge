-- wheel/init.lua — façade PW : constructeur, update, assemblage des mixins.

local C = require('src.objects.wheel.constants')

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
        offerings = {}, currency = 0, rerollCost = 0,
        hoverIdx = -1, buyFlash = -1, buyFlashTimer = 0, nextQuota = 0,
    }

    self._settings = {
        active = false,
        masterVol = 0.5, bgmVol = 0.6, sfxVol = 0.8,
        fullscreen = true, hoverId = nil, dragging = nil,
    }

    return self
end

function PW:setRadius(r)
    self.R = r
    self:_updateRadii()
end

function PW:_updateRadii()
    local R = self.R
    self._hubR = R * C.HUB_P
    self._pocketInner = R * C.POCKET_INNER_P
    self._pocketOuter = R * C.POCKET_OUTER_P
    self._labelInner = R * C.LABEL_INNER_P
    self._labelOuter = R * C.LABEL_OUTER_P
    self._rimR = R * C.RIM_P
    self._ballRadius = math.max(1.5, R * C.BALL_RADIUS_P)
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
function PW:setSegmentValues(v) self._segmentValues = v or {} end
function PW:setGoldPockets(idx) self._goldPockets = idx or {} end
function PW:setBonusMode(b) self._bonusMode = b end
function PW:setSlots(d) self._slots = d or {} end
function PW:getSpeed() return math.abs(self._angVel) end
function PW:getHubRadius() return self._hubR end
function PW:getLights() return self._frameLights end

-- Wire mixins
require('src.objects.wheel.physics')(PW)
require('src.objects.wheel.spin')(PW)
require('src.objects.wheel.flip')(PW)
require('src.objects.wheel.hub')(PW)
require('src.objects.wheel.counters')(PW)
require('src.objects.wheel.shop_face')(PW)
require('src.objects.wheel.settings_face')(PW)
require('src.objects.wheel.render')(PW)
require('src.objects.wheel.render_balls')(PW)
require('src.objects.wheel.render_gauges')(PW)
require('src.objects.wheel.render_anims')(PW)
require('src.objects.wheel.render_orbit')(PW)

function PW:update(dt)
    self._time = self._time + dt

    for i = #self._highlights, 1, -1 do
        self._highlights[i].t = self._highlights[i].t + dt
        if self._highlights[i].t > 1.5 then table.remove(self._highlights, i) end
    end

    if self._hub.score < self._hub.scoreTarget then
        local diff = self._hub.scoreTarget - self._hub.score
        self._hub.score = self._hub.score + math.max(1, math.ceil(diff * 0.12))
        if self._hub.score > self._hub.scoreTarget then self._hub.score = self._hub.scoreTarget end
    end
    self._hub.valueFade = math.max(0, self._hub.valueFade - dt)
    self._hub.messageFade = math.max(0, self._hub.messageFade - dt)

    local function updateShake(sh)
        if sh.intensity > 0 then
            sh.time = sh.time + dt
            if sh.time >= sh.decay then sh.intensity = 0 end
        end
    end
    updateShake(self._ticketShake)
    updateShake(self._goldShake)

    self:_updateCounters(dt)
    self:_updateFlip(dt)
    self:_updateEject(dt)

    self._acc = self._acc + dt
    while self._acc >= C.PHYSICS_DT do
        self:_step(C.PHYSICS_DT)
        self._acc = self._acc - C.PHYSICS_DT
    end
end

return PW
