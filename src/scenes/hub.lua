-- scenes/hub.lua — IDLE phase. Click wheel center to SPIN.

local C = require('src.game.constants')

local Hub = {}
Hub.__index = Hub

function Hub.new() return setmetatable({}, Hub) end
function Hub:enter(game) self.game = game end
function Hub:leave() end
function Hub:update(dt) end
function Hub:mouse(x, y) end

function Hub:click(x, y)
    if self:_clickHub(x, y) then
        if self.game._phase == 'IDLE' then
            self.game:playSelect()
            self.game:_startSpin()
        end
    end
end

function Hub:_clickHub(x, y)
    local dx = x - C.WHEEL_CX
    local dy = (y - C.WHEEL_CY) / math.max(0.05, self.game.wheel:getTilt())
    local r = self.game.wheel:getHubRadius()
    return dx*dx + dy*dy <= r*r
end

function Hub:key(key)
    if key == 'space' or key == 'return' then
        if self.game._phase == 'IDLE' then self.game:_startSpin() end
    elseif key == 'r' then
        self.game:restart()
    end
end

function Hub:draw(g, font, atlas) end

return Hub
