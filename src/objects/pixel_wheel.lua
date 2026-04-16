--[[
    PixelWheel — radial plinko-style drop wheel.
      - a big circle at screen bottom, divided into N pockets
      - ball drops from top, hits pegs with gravity and bounces, lands in a pocket
      - wheel rotates while balls fall for dynamism
]]

local BALANCE = require('src.data.balance').BALANCE

local PW = {}
PW.__index = PW

local function hsv2rgb(h, s, v)
    local r, g, b
    local i = math.floor(h * 6)
    local f = h * 6 - i
    local p = v * (1 - s)
    local q = v * (1 - f * s)
    local t = v * (1 - (1 - f) * s)
    i = i % 6
    if     i == 0 then r,g,b = v,t,p
    elseif i == 1 then r,g,b = q,v,p
    elseif i == 2 then r,g,b = p,v,t
    elseif i == 3 then r,g,b = p,q,v
    elseif i == 4 then r,g,b = t,p,v
    else              r,g,b = v,p,q end
    return r, g, b
end

function PW.new(cx, cy, radius)
    return setmetatable({
        cx = cx, cy = cy, r = radius,
        segments = {},
        rotation = 0,
        spinSpeed = 0,
        targetSpin = 0,
        ball = nil,              -- { x, y, vx, vy } during drop
        onResolve = nil,
        _time = 0,
        _ballsQueue = {},        -- upcoming balls to drop
        pegs = {},
    }, PW)
end

function PW:setSegments(n)
    self.segments = {}
    for i = 1, n do
        self.segments[i] = { index = i - 1, value = i }  -- 0-based index
    end
    self:_rebuildPegs()
end

function PW:_rebuildPegs()
    -- plinko pegs scattered above the wheel
    self.pegs = {}
    local rows = 6
    local topY = self.cy - self.r - 200
    local botY = self.cy - self.r - 30
    for row = 1, rows do
        local y = topY + (row - 1) * (botY - topY) / (rows - 1)
        local count = 4 + row
        local spacing = (self.r * 2 - 40) / count
        local offset = (row % 2 == 0) and spacing / 2 or 0
        for k = 1, count do
            local x = self.cx - (self.r - 20) + offset + (k - 0.5) * spacing
            self.pegs[#self.pegs+1] = { x = x, y = y, r = 3 }
        end
    end
end

function PW:startSpin()
    self.spinSpeed = 2 + math.random() * 2   -- rad/s
end

function PW:dropBall()
    self.ball = {
        x = self.cx + (math.random() - 0.5) * 80,
        y = self.cy - self.r - 220,
        vx = (math.random() - 0.5) * 40,
        vy = 0,
        r  = 6,
        landed = false,
        landIndex = nil,
    }
end

function PW:update(dt)
    self._time = self._time + dt
    self.rotation = self.rotation + self.spinSpeed * dt
    -- damp
    self.spinSpeed = self.spinSpeed * (1 - dt * 0.3)

    local b = self.ball
    if not b or b.landed then return end
    b.vy = b.vy + 600 * dt
    b.x = b.x + b.vx * dt
    b.y = b.y + b.vy * dt

    -- peg collisions
    for _, p in ipairs(self.pegs) do
        local dx = b.x - p.x
        local dy = b.y - p.y
        local d2 = dx*dx + dy*dy
        local rr = (b.r + p.r)
        if d2 < rr * rr and d2 > 0.01 then
            local d = math.sqrt(d2)
            local nx, ny = dx / d, dy / d
            -- push out
            b.x = p.x + nx * rr
            b.y = p.y + ny * rr
            -- reflect
            local vdotn = b.vx * nx + b.vy * ny
            b.vx = (b.vx - 2 * vdotn * nx) * 0.55
            b.vy = (b.vy - 2 * vdotn * ny) * 0.55
            b.vx = b.vx + (math.random() - 0.5) * 30
        end
    end

    -- side clamp
    local minX, maxX = self.cx - self.r + 10, self.cx + self.r - 10
    if b.x < minX then b.x = minX; b.vx = -b.vx * 0.5 end
    if b.x > maxX then b.x = maxX; b.vx = -b.vx * 0.5 end

    -- hit the wheel rim (top arc) — when ball y crosses the rim
    if b.y >= self.cy - self.r then
        -- compute angle into the wheel from center
        local dx, dy = b.x - self.cx, b.y - self.cy
        -- find segment by angle relative to rotation
        local ang = math.atan2(dy, dx) -- around center
        -- normalize 0..2pi
        local a = ang - self.rotation
        while a < 0 do a = a + math.pi * 2 end
        while a >= math.pi * 2 do a = a - math.pi * 2 end
        local seg = math.floor(a / (math.pi * 2) * #self.segments)
        if seg < 0 then seg = 0 end
        if seg >= #self.segments then seg = #self.segments - 1 end
        b.landed = true
        b.landIndex = seg
        if self.onResolve then self.onResolve(seg) end
    end
end

function PW:draw(g, sprite)
    -- wheel circle
    local cx, cy, r = self.cx, self.cy, self.r

    -- outer disc
    g:setColor(0.12, 0.08, 0.15, 1)
    g:circle('fill', cx, cy, r + 6)
    g:setColor(0.35, 0.25, 0.15, 1)
    g:circle('line', cx, cy, r + 6)

    -- pockets
    local n = #self.segments
    if n > 0 then
        for i = 0, n - 1 do
            local a0 = self.rotation + (i / n) * math.pi * 2
            local a1 = self.rotation + ((i + 1) / n) * math.pi * 2
            local isGold = false
            for _, gp in ipairs(BALANCE.GOLD_POCKETS) do
                if gp == i then isGold = true; break end
            end
            if isGold then
                g:setColor(0.85, 0.72, 0.18, 1)
            else
                local rr, gg, bb = hsv2rgb((i / n) * 0.8, 0.45, 0.55)
                g:setColor(rr, gg, bb, 1)
            end
            -- polygon pie slice
            love.graphics.arc('fill', cx, cy, r, a0, a1, 24)
            g:setColor(0, 0, 0, 0.8)
            love.graphics.arc('line', cx, cy, r, a0, a1, 24)
        end
    end

    -- center cap
    g:setColor(0.1, 0.06, 0.1, 1)
    g:circle('fill', cx, cy, r * 0.25)
    g:setColor(0.9, 0.75, 0.3, 1)
    g:circle('line', cx, cy, r * 0.25)

    -- pegs
    g:setColor(0.9, 0.9, 0.95, 1)
    for _, p in ipairs(self.pegs) do
        g:circle('fill', p.x, p.y, p.r)
    end

    -- ball
    local b = self.ball
    if b then
        g:setColor(0, 0, 0, 0.5)
        g:circle('fill', b.x + 2, b.y + 2, b.r)
        g:setColor(1, 0.95, 0.6, 1)
        g:circle('fill', b.x, b.y, b.r)
        g:setColor(1, 1, 1, 1)
        g:circle('fill', b.x - 2, b.y - 2, b.r * 0.4)
    end

    -- top marker (pointer)
    g:setColor(0.95, 0.25, 0.25, 1)
    love.graphics.polygon('fill',
        cx - 8, cy - r - 14,
        cx + 8, cy - r - 14,
        cx,     cy - r - 2)
end

function PW:isBusy()
    return self.ball ~= nil and not self.ball.landed
end

function PW:clearBall()
    self.ball = nil
end

return PW
