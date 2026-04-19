--[[
    HUB scene — IDLE phase. Click the wheel center to SPIN.
    Hieroglyph ring menu: retry/settings/exit/catalogue handled here.
]]

local Hub = {}
Hub.__index = Hub

function Hub.new() return setmetatable({}, Hub) end
function Hub:enter(ctx) self.ctx = ctx end
function Hub:leave() end
function Hub:update(dt) end
function Hub:mouse(x, y) end

function Hub:_clickHub(x, y)
    local g = self.ctx.game
    local dx = x - g.WHEEL_CX
    local dy = (y - g.WHEEL_CY) / math.max(0.05, self.ctx.wheel:getTilt())
    local r = self.ctx.wheel:getHubRadius()
    return dx*dx + dy*dy <= r*r
end

function Hub:click(x, y)
    -- Hub click → spin
    if self:_clickHub(x, y) then
        if self.ctx.loop.state.phase == 'IDLE' and self.ctx.loop.state.run then
            self.ctx:playSelect()
            self.ctx._startSpin()
        end
        return
    end
    -- Menu buttons now handled globally in game.lua
end

function Hub:key(key)
    if key == 'space' or key == 'return' then
        if self.ctx.loop.state.phase == 'IDLE' and self.ctx.loop.state.run then
            self.ctx._startSpin()
        end
    elseif key == 'r' then
        self.ctx:restart()
    end
end

function Hub:draw(g, font, atlas) end

return Hub
