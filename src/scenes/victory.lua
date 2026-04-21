-- scenes/victory.lua — flashy overlay. Click hub or press enter for new run.

local C = require('src.game.constants')

local V = {}
V.__index = V
function V.new() return setmetatable({ _t = 0 }, V) end
function V:enter(game) self.game = game; self._t = 0 end
function V:leave() end
function V:update(dt) self._t = self._t + dt end
function V:mouse(x, y) end

local function inHub(game, x, y)
    local dx = x - C.WHEEL_CX
    local dy = (y - C.WHEEL_CY) / math.max(0.05, game.wheel:getTilt())
    local r = game.wheel:getHubRadius()
    return dx*dx + dy*dy <= r*r
end

function V:click(x, y)
    if inHub(self.game, x, y) then
        self.game:playSelect()
        self.game:restart()
    end
end

function V:key(k)
    if k == 'return' or k == 'space' then
        self.game:playSelect()
        self.game:restart()
    end
end

function V:drawUnder(g, font, atlas)
    g:setColor(0, 0, 0, 0.35); g:rect('fill', 0, 0, 480, 270)
end

function V:draw(g, font, atlas)
    local pulse = 0.6 + 0.4 * math.sin(self._t * 3)
    local tickets = self.game.engine:tickets()
    font:drawCentered('VICTORY', 240, 230,
        { 1, 0.9 * pulse + 0.1, 0.3, 1 }, 3)
    font:drawCentered('TICKETS ' .. tickets, 240, 255,
        { 0.85, 0.95, 0.65, 1 }, 1)
end

return V
