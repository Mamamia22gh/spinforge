return function(PW)

function PW:getTilt() return math.abs(self._tilt) end
function PW:isFlipped() return self._tilt < 0 end

function PW:startFlip(duration)
    duration = duration or 0.45
    local to = self._tilt > 0 and -1 or 1
    self._flip = { from = self._tilt, to = to, duration = duration, elapsed = 0, midFired = false }
end

function PW:_updateFlip(dt)
    if not self._flip then return end
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

end
