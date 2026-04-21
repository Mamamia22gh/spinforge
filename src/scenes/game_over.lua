-- scenes/game_over.lua — GAME OVER: click hub or press R to retry.

local C = require('src.game.constants')
local PAL = C.PAL

local GO = {}
GO.__index = GO
function GO.new() return setmetatable({}, GO) end
function GO:enter(game) self.game = game end
function GO:leave() end
function GO:update(dt) end
function GO:mouse(x, y) end

local function inHub(game, x, y)
    local dx = x - C.WHEEL_CX
    local dy = (y - C.WHEEL_CY) / math.max(0.05, game.wheel:getTilt())
    local r = game.wheel:getHubRadius()
    return dx*dx + dy*dy <= r*r
end

function GO:click(x, y)
    if inHub(self.game, x, y) then
        self.game:playSelect()
        self.game:restart()
    end
end

function GO:key(k)
    if k == 'return' or k == 'space' or k == 'r' then
        self.game:playSelect()
        self.game:restart()
    end
end

function GO:draw(g, font, atlas)
    local tickets = self.game.engine:tickets()
    local round = self.game.engine:round()
    font:drawCentered('TICKETS ' .. tickets, 240, 236, { 0.85, 0.95, 0.65, 1 }, 1)
    font:drawCentered('ROUND ' .. round, 240, 248, { 0.65, 0.65, 0.75, 1 }, 1)
end

return GO
