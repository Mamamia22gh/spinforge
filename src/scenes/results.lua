--[[
    RESULTS scene — brief recap of round, SPACE to continue.
]]

local UI = require('src.ui')

local R = {}
R.__index = R
function R.new() return setmetatable({}, R) end

function R:enter(ctx) self.ctx = ctx; self._t = 0 end
function R:leave() end
function R:update(dt) self._t = self._t + dt end

function R:click(x, y)
    if UI.pointInRect(x, y, 140, 520, 200, 50) then
        self.ctx.loop:continueFromResults()
    end
end

function R:mouse(x, y)
    self._hot = UI.pointInRect(x, y, 140, 520, 200, 50)
end

function R:key(key)
    if key == 'space' or key == 'return' then
        self.ctx.loop:continueFromResults()
    end
end

function R:draw(g, font, atlas)
    local run = self.ctx.loop.state.run
    if not run or not run.lastRoundResult then return end
    local res = run.lastRoundResult

    font:drawCentered('ROUND ' .. run.round .. ' CLEARED', 240, 140, { 0.85, 0.95, 0.65, 1 }, 2)
    font:drawCentered(res.totalWon .. ' / ' .. res.quota, 240, 200, { 1, 0.85, 0.3, 1 }, 4)

    font:drawCentered('SURPLUS   ' .. res.surplus,      240, 290, { 0.9, 0.9, 0.9, 1 }, 2)
    font:drawCentered('GOLD +' .. res.shopCoins,         240, 320, { 0.95, 0.85, 0.3, 1 }, 2)
    font:drawCentered('TOTAL GOLD ' .. run.shopCurrency, 240, 350, { 0.9, 0.8, 0.4, 1 }, 1)

    UI.button(g, 140, 520, 200, 50, self._hot, false)
    font:drawCentered('CONTINUE', 240, 538, { 1, 0.95, 0.7, 1 }, 2)
end

return R
