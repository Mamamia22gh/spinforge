--[[
    SPIN scene — drives wheel spin + ball ejection. Wheel draws the action;
    this overlay is minimal (small top-left progress hint only).
]]

local Spin = {}
Spin.__index = Spin

function Spin.new() return setmetatable({}, Spin) end

function Spin:enter(ctx)
    self.ctx = ctx
    local run = ctx.loop.state.run
    if not run then return end
    self.wheel = ctx.wheel
    self.wheel:placeBalls(run.ballsLeft, run.specialBalls)

    self.wheel.onBallEject = function()
        -- Eject sound (ISO legacy _playEject)
        ctx.kernel:emit('audio.tone', { freq = 1400 + math.random() * 200, duration = 0.04, wave = 'sine', vol = 0.05 })
        ctx.kernel:emit('audio.tone', { freq = 900 + math.random() * 200, duration = 0.03, wave = 'square', vol = 0.03 })
    end

    self.wheel:spinAndEject(function(results)
        self:_resolveAll(results)
    end)
    ctx.kernel:emit('audio.sfx', { name = 'spin' })
    ctx:shake(3, 0.5)
end

function Spin:_resolveAll(results)
    -- Sequential blocking reveal chain (ISO legacy _doSpin await loop)
    for i, idx in ipairs(results) do
        self.ctx.em:add({ trigger = 'after', delay = (i == 1) and 0.15 or 0.45, blocking = true, func = function()
            local phase = self.ctx.loop.state.phase
            if phase == 'SPINNING' then
                self.ctx.loop:resolveBallAt(idx)
            end
            return true
        end })
    end

    -- Wait for all gold + ticket fly anims to finish (ISO legacy line 678)
    self.ctx.em:add({ trigger = 'after', delay = 0.1, blocking = true, func = function()
        if self.wheel and (#self.wheel._goldAnims > 0 or #self.wheel._ticketFlyAnims > 0) then return false end
        return true
    end })

    -- Gold quota deduction animation (ISO legacy lines 681-688)
    self.ctx.em:add({ trigger = 'immediate', blocking = true, func = function(ev)
        if not ev._quotaStarted then
            ev._quotaStarted = true
            local run = self.ctx.loop.state.run
            if run then
                local quota = require('src.data.balance').getQuota(run.round)
                if quota > 0 then
                    self.wheel:startGoldQuotaAnim(quota)
                    self.ctx:shake(3, 0.4)
                end
            end
            return false
        end
        if not self.wheel:isGoldQuotaAnimDone() then return false end
        return true
    end })

    -- Small pause then trigger end-of-round
    self.ctx.em:add({ trigger = 'after', delay = 0.3, blocking = true, func = function()
        if self.ctx.loop.state.phase == 'SPINNING' then
            self.ctx.loop:finishSpinRound()
        end
        return true
    end })
end

function Spin:leave() self.wheel.onBallEject = nil end
function Spin:update(dt) end
function Spin:mouse(x, y) end
function Spin:click(x, y) end
function Spin:key(k) end
function Spin:draw(g, font, atlas) end

return Spin
