--[[
    GAME OVER — wheel still shown, game-over hub overlay drawn by Game.
    Click anywhere on hub or press R to retry. Press ESC to quit.
]]

local GO = {}
GO.__index = GO
function GO.new() return setmetatable({}, GO) end
function GO:enter(ctx) self.ctx = ctx end
function GO:leave() end
function GO:update(dt) end
function GO:mouse(x, y) end

local function inHub(ctx, x, y)
    local g = ctx.game
    local dx = x - g.WHEEL_CX
    local dy = (y - g.WHEEL_CY) / math.max(0.05, ctx.wheel:getTilt())
    local r = ctx.wheel:getHubRadius()
    return dx*dx + dy*dy <= r*r
end

function GO:click(x, y)
    if inHub(self.ctx, x, y) then
        self.ctx:playSelect()
        self.ctx:restart()
    end
end
function GO:key(k)
    if k == 'return' or k == 'space' or k == 'r' then
        self.ctx:playSelect()
        self.ctx:restart()
    end
end

function GO:draw(g, font, atlas)
    local meta = self.ctx.loop.state.meta
    font:drawCentered('TICKETS ' .. meta.tickets, 240, 236, { 0.85, 0.95, 0.65, 1 }, 1)
    font:drawCentered('BEST ' .. meta.bestRound, 240, 248, { 0.65, 0.65, 0.75, 1 }, 1)
end

return GO
