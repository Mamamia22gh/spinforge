local C = require('src.objects.wheel.constants')
local PAL = C.PAL
local TWO_PI = C.TWO_PI
local GAUGE_CONFIGS = C.GAUGE_CONFIGS

return function(PW)

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
    if atlas then atlas:drawCentered('ball', rx, ry, 1)
    else g:circle('fill', rx, ry, 3) end
end

function PW:drawBalls(g, atlas, cx, cy, pox, poy)
    local TILT_Y = math.abs(self._tilt)
    if TILT_Y < 0.01 then return end
    if self._tilt < 0 then return end

    g:push()
    g:translate(cx, cy)
    g:scale(1, TILT_Y)
    g:translate(-cx, -cy)

    for _, b in ipairs(self._balls) do
        if not b.settled then
            self:_drawPixelBall(g, atlas, cx + b.x, cy + b.y, false, b.special and b.special.effect)
        end
    end

    g:push()
    g:translate(cx, cy)
    g:rotate(self._angle)

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

    for _, b in ipairs(self._balls) do
        if b.settled and b.localX then
            self:_drawPixelBall(g, atlas, b.localX, b.localY, true, b.special and b.special.effect)
        end
    end

    g:pop()

    local gcx, gcy = cx + (pox or 0), cy + (poy or 0)
    for gi = 1, #GAUGE_CONFIGS do
        if gi ~= 2 and gi ~= 3 and gi ~= 4 and self._gaugeUnlocks[gi] then
            local gaugeBalls = self._inGauge and self._placedBalls or (self._ejecting and self._ejectQueue or {})
            for _, pb in ipairs(gaugeBalls) do
                if pb.gaugeIdx == gi then
                    self:_drawPixelBall(g, atlas,
                        math.floor(gcx + pb.gaugeX),
                        math.floor(gcy + pb.gaugeY),
                        false, pb.special and pb.special.effect)
                end
            end
        end
    end

    g:pop()
end

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

    local numR = self.R * C.LABEL_P
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

end
