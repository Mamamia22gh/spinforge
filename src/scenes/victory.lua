local UI = require('src.ui')
local V = {}
V.__index = V

function V.new() return setmetatable({}, V) end
function V:enter(ctx) self.ctx = ctx; self._t = 0 end
function V:leave() end
function V:update(dt) self._t = self._t + dt end

function V:click(x, y)
    if UI.pointInRect(x, y, 140, 500, 200, 50) then self.ctx:restart() end
end
function V:mouse(x, y)
    self._hot = UI.pointInRect(x, y, 140, 500, 200, 50)
end
function V:key(key)
    if key == 'return' or key == 'space' then self.ctx:restart() end
end

function V:draw(g, font, atlas)
    local meta = self.ctx.loop.state.meta
    font:drawCentered('VICTORY', 240, 120, { 1, 0.9, 0.4, 1 }, 5)
    font:drawCentered('RUN COMPLETED', 240, 190, { 0.9, 0.9, 0.95, 1 }, 2)
    font:drawCentered('TICKETS ' .. meta.tickets, 240, 270, { 0.85, 0.95, 0.65, 1 }, 2)
    font:drawCentered('RUNS ' .. meta.runsCompleted, 240, 310, { 0.75, 0.75, 0.85, 1 }, 1)

    UI.button(g, 140, 500, 200, 50, self._hot)
    font:drawCentered('NEW RUN', 240, 518, { 1, 0.95, 0.7, 1 }, 2)
end

return V
