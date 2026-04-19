--[[
    RESULTS scene — transient: auto-advances after short delay via loop.
    Wheel still visible. We just flash a "ROUND CLEARED" banner.
]]

local R = {}
R.__index = R
function R.new() return setmetatable({}, R) end

function R:enter(ctx)
    self.ctx = ctx
    self._t = 0
    local run = ctx.loop.state.run
    if run and run.lastRoundResult and run.lastRoundResult.ticketsEarned then
        ctx.wheel:startTicketAnim(run.lastRoundResult.ticketsEarned)
        ctx:shake(3, 0.4)
        -- Ticket fanfare (ISO legacy _playTicketFanfare)
        ctx.kernel:emit('audio.tone', { freq = 660, duration = 0.12, wave = 'square', vol = 0.06 })
        ctx.kernel:emit('audio.tone', { freq = 880, duration = 0.12, wave = 'square', vol = 0.06 })
        ctx.kernel:emit('audio.tone', { freq = 1100, duration = 0.15, wave = 'sine', vol = 0.08 })
        ctx.kernel:emit('audio.tone', { freq = 1320, duration = 0.20, wave = 'sine', vol = 0.07 })
        ctx.kernel:emit('audio.tone', { freq = 1760, duration = 0.30, wave = 'sine', vol = 0.05 })
    end
    -- Auto-advance after anim
    ctx.em:add({ trigger = 'after', delay = 1.6, blocking = false, func = function()
        if ctx.loop.state.phase == 'RESULTS' then ctx.loop:continueFromResults() end
        return true
    end })
end

function R:leave() end
function R:update(dt) self._t = self._t + dt end
function R:mouse(x, y) end
function R:click(x, y)
    if self.ctx.loop.state.phase == 'RESULTS' then self.ctx.loop:continueFromResults() end
end
function R:key(k)
    if k == 'space' or k == 'return' then
        if self.ctx.loop.state.phase == 'RESULTS' then self.ctx.loop:continueFromResults() end
    end
end

function R:draw(g, font, atlas)
    local run = self.ctx.loop.state.run
    if not run or not run.lastRoundResult then return end
    local res = run.lastRoundResult
    local passed = res.totalWon and res.quota and res.totalWon >= res.quota
    local banner = passed and 'ROUND CLEARED' or 'ROUND FAILED'
    local col = passed and { 0.83, 0.65, 0.13, 1 } or { 0.80, 0.13, 0.20, 1 }
    local a = math.min(1, self._t * 4)
    font:drawCentered(banner, 240, 240, { col[1], col[2], col[3], a }, 2)
    if res.surplus and res.surplus > 0 then
        font:drawCentered('SURPLUS +' .. res.surplus, 240, 256, { 0.91, 0.88, 0.82, a }, 1)
    end
end

return R
