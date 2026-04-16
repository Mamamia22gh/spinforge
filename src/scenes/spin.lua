--[[
    SPIN scene — shows the wheel, allows dropping balls, displays HUD.
]]

local UI       = require('src.ui')
local PixelWheel = require('src.objects.pixel_wheel')
local balMod   = require('src.data.balance')
local BALANCE, getQuota = balMod.BALANCE, balMod.getQuota

local Spin = {}
Spin.__index = Spin

function Spin.new() return setmetatable({}, Spin) end

function Spin:enter(ctx)
    self.ctx = ctx
    self.wheel = PixelWheel.new(240, 470, 130)
    self:_syncSegments()
    self.wheel.onResolve = function(segIndex)
        -- Small delay so the ball visually settles
        self.ctx.em:add({ trigger = 'after', delay = 0.25, blocking = false, func = function()
            self.ctx.loop:resolveBallAt(segIndex)
            self.wheel:clearBall()
            -- auto-drop next after small delay if still in SPINNING
            self.ctx.em:add({ trigger = 'after', delay = 0.4, blocking = false, func = function()
                if self.ctx.loop.state.phase == 'SPINNING'
                   and self.ctx.loop.state.run
                   and self.ctx.loop.state.run.ballsLeft > 0 then
                    self:_dropBall()
                end
                return true
            end })
            return true
        end })
    end
    -- initial drop
    self.ctx.em:add({ trigger = 'after', delay = 0.5, blocking = false, func = function()
        self:_dropBall(); return true
    end })
end

function Spin:_syncSegments()
    local run = self.ctx.loop.state.run
    if not run then return end
    self.wheel:setSegments(#run.wheel)
end

function Spin:_dropBall()
    if self.ctx.loop.state.phase ~= 'SPINNING' then return end
    if not self.ctx.loop.state.run or self.ctx.loop.state.run.ballsLeft <= 0 then return end
    self.wheel:startSpin()
    self.wheel:dropBall()
    self.ctx.kernel:emit('audio.sfx', { name = 'spin' })
end

function Spin:leave() end

function Spin:update(dt)
    self.wheel:update(dt)
end

function Spin:click(x, y) end
function Spin:mouse(x, y) end
function Spin:key(key) end

function Spin:draw(g, font, atlas)
    local run = self.ctx.loop.state.run
    if not run then return end
    local quota = getQuota(run.round)

    -- HUD top
    font:draw('ROUND ' .. run.round .. '/' .. BALANCE.ROUNDS_PER_RUN, 10, 10, { 1, 0.85, 0.3, 1 }, 2)
    font:draw('QUOTA ' .. run.score .. '/' .. quota, 10, 34, { 0.9, 0.9, 0.95, 1 }, 2)
    font:draw('BALLS ' .. run.ballsLeft, 10, 58, { 0.75, 0.95, 0.75, 1 }, 2)
    font:draw('GOLD  ' .. run.shopCurrency, 10, 82, { 0.95, 0.85, 0.3, 1 }, 2)

    -- corruption bar
    g:setColor(0.2, 0.05, 0.05, 1); g:rect('fill', 300, 10, 170, 10)
    local cw = 170 * math.min(1, run.corruption or 0)
    g:setColor(0.85, 0.25, 0.25, 1); g:rect('fill', 300, 10, cw, 10)
    font:draw('CORR', 440, 22, { 0.65, 0.35, 0.35, 1 }, 1)

    -- Special balls remaining
    local remaining = #run.specialBalls - (run._specialBallsFired or 0)
    if remaining > 0 then
        local nextBall = run.specialBalls[(run._specialBallsFired or 0) + 1]
        font:draw('NEXT: ' .. (nextBall or ''):upper(), 300, 35, { 0.75, 0.45, 0.95, 1 }, 1)
        font:draw('SPECIAL x' .. remaining, 300, 50, { 0.65, 0.35, 0.85, 1 }, 1)
    end

    -- Relics count
    font:draw('RELICS ' .. #run.relics, 300, 70, { 0.55, 0.8, 0.95, 1 }, 1)

    -- Wheel
    self.wheel:draw(g, atlas)

    -- Latest ball result popup
    if #run.spinResults > 0 then
        local last = run.spinResults[#run.spinResults]
        local color = last.isGold and { 0.95, 0.8, 0.3, 1 } or { 0.9, 0.9, 0.9, 1 }
        font:drawCentered('+' .. last.value, 240, 620, color, 2)
    end
end

return Spin
