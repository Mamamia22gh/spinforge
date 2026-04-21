local C = require('src.objects.wheel.constants')

return function(PW)

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
    for g = 1, #C.GAUGE_CONFIGS do
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
        if #perGauge[slot] < C.MAX_BALLS_PER_GAUGE then
            perGauge[slot][#perGauge[slot]+1] = i
        end
    end

    local globalIdx = 0
    for gi = 1, #activeGauges do
        local gIdx = activeGauges[gi]
        local cfg = C.GAUGE_CONFIGS[gIdx]
        local indices = perGauge[gi]
        for j = 1, #indices do
            local i = indices[j]
            local a = (i / n) * C.TWO_PI + (math.random() - 0.5) * 0.3
            local r = self._labelOuter + 2 + math.random() * (self._rimR - self._labelOuter - self._ballRadius * 2 - 3)
            local ga = cfg.eend - (j-1) * C.GAUGE_BALL_SPACING
            local isSpecial = globalIdx < #specials
            self._placedBalls[#self._placedBalls+1] = {
                localX = math.cos(a) * r,
                localY = math.sin(a) * r,
                gaugeX = math.cos(ga) * GAUGE_MID,
                gaugeY = math.sin(ga) * GAUGE_MID,
                gaugeAngle = ga, gaugeIdx = gIdx,
                dropDelay = (#indices - j) * C.DROP_STAGGER,
                dropDur = C.DROP_DURATION,
                special = isSpecial and specials[globalIdx+1] or nil,
            }
            globalIdx = globalIdx + 1
        end
    end
end

function PW:spinAndEject(callback)
    self._angVel = C.SPIN_MIN + math.random() * (C.SPIN_MAX - C.SPIN_MIN)
    self._results = {}
    self._onDone = callback
    self._balls = {}
    self._inGauge = false
    self._dropping = false

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

function PW:_updateEject(dt)
    if not self._ejecting then return end
    self._ejectClock = self._ejectClock + dt
    while #self._ejectQueue > 0 and self._ejectClock >= self._ejectQueue[1].dropDelay do
        local pb = table.remove(self._ejectQueue, 1)
        local cfg = C.GAUGE_CONFIGS[pb.gaugeIdx] or C.GAUGE_CONFIGS[1]
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

function PW:highlight(idx)
    self._highlights[#self._highlights+1] = { idx = idx, t = 0 }
end

function PW:getPocketPosition(idx, cx, cy)
    local data = self._data
    if #data == 0 or idx < 0 or idx >= #data then return cx, cy end
    local tw = 0
    for _, s in ipairs(data) do tw = tw + s.weight end
    local off = 0
    for i = 1, idx do off = off + (data[i].weight / tw) * C.TWO_PI end
    local angle = (data[idx+1].weight / tw) * C.TWO_PI
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

end
