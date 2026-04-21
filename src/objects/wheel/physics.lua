local C = require('src.objects.wheel.constants')

return function(PW)

function PW:_step(dt)
    if math.abs(self._angVel) > 0.01 then
        local decel = math.abs(self._angVel) < 3 and 0.985 or C.SPIN_DECEL
        self._angVel = self._angVel * (decel ^ (dt * 120))
        self._angle = self._angle + self._angVel * dt
    else
        self._angVel = 0
    end

    for _, b in ipairs(self._balls) do
        if not b.settled then
            local d = math.sqrt(b.x*b.x + b.y*b.y)
            local gravMul = 1
            if math.abs(self._angVel) < C.GRAVITY_BOOST_THRESHOLD then
                gravMul = 1 + (C.GRAVITY_BOOST_MAX - 1) * (1 - math.abs(self._angVel) / C.GRAVITY_BOOST_THRESHOLD)
            end
            if d > 1 then
                b.vx = b.vx - (b.x / d) * C.BOWL_GRAVITY * gravMul * dt
                b.vy = b.vy - (b.y / d) * C.BOWL_GRAVITY * gravMul * dt
            end
            local damp = C.AIR_DAMPING ^ (dt * 120)
            b.vx = b.vx * damp
            b.vy = b.vy * damp
            if math.abs(self._angVel) > 0.05 and d > 1 then
                local nx, ny = b.x / d, b.y / d
                local tx, ty = -ny, nx
                local drag = (self._angVel * d - (b.vx * tx + b.vy * ty)) * C.SURFACE_FRICTION * dt
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
            if spd < C.SETTLE_SPEED and math.abs(self._angVel) < C.SETTLE_ANG_VEL and inPockets then
                b.timer = b.timer + dt
                if b.timer >= C.SETTLE_TIME then self:_settle(b) end
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
    b.vx = (b.vx - 2*dot*nx) * C.RESTITUTION
    b.vy = (b.vy - 2*dot*ny) * C.RESTITUTION
    self:_peg()
end

function PW:_collideHub(b)
    local d = math.sqrt(b.x*b.x + b.y*b.y)
    local minR = self.R * C.HUB_COLLIDE_P + self._ballRadius
    if d >= minR or d == 0 then return end
    local nx, ny = b.x/d, b.y/d
    b.x = nx * minR; b.y = ny * minR
    local dot = b.vx*nx + b.vy*ny
    b.vx = (b.vx - 2*dot*nx) * C.RESTITUTION
    b.vy = (b.vy - 2*dot*ny) * C.RESTITUTION
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
    wa = (wa % C.TWO_PI + C.TWO_PI) % C.TWO_PI
    local tw = 0
    for _, seg in ipairs(self._data) do tw = tw + seg.weight end
    local acc, idx = 0, #self._data - 1
    for i = 1, #self._data do
        local sa = (self._data[i].weight / tw) * C.TWO_PI
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

end
