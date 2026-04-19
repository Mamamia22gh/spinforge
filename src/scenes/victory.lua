--[[
    VICTORY — flashy overlay. Click hub or press enter for new run.
]]

local V = {}
V.__index = V
function V.new() return setmetatable({ _t = 0 }, V) end
function V:enter(ctx) self.ctx = ctx; self._t = 0 end
function V:leave() end
function V:update(dt) self._t = self._t + dt end
function V:mouse(x, y) end

local function inHub(ctx, x, y)
    local g = ctx.game
    local dx = x - g.WHEEL_CX
    local dy = (y - g.WHEEL_CY) / math.max(0.05, ctx.wheel:getTilt())
    local r = ctx.wheel:getHubRadius()
    return dx*dx + dy*dy <= r*r
end
function V:click(x, y)
    if inHub(self.ctx, x, y) then
        self.ctx:playSelect()
        self.ctx:restart()
    end
end
function V:key(k)
    if k == 'return' or k == 'space' then
        self.ctx:playSelect()
        self.ctx:restart()
    end
end

function V:drawUnder(g, font, atlas)
    g:setColor(0, 0, 0, 0.35); g:rect('fill', 0, 0, 480, 270)
end

function V:draw(g, font, atlas)
    local pulse = 0.6 + 0.4 * math.sin(self._t * 3)
    local meta = self.ctx.loop.state.meta
    font:drawCentered('VICTORY', 240, 230,
        { 1, 0.9 * pulse + 0.1, 0.3, 1 }, 3)
    font:drawCentered('TICKETS ' .. meta.tickets, 240, 255,
        { 0.85, 0.95, 0.65, 1 }, 1)
end

return V
