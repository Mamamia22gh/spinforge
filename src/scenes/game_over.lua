local UI = require('src.ui')
local GO = {}
GO.__index = GO

function GO.new() return setmetatable({}, GO) end
function GO:enter(ctx) self.ctx = ctx end
function GO:leave() end
function GO:update(dt) end

function GO:click(x, y)
    if UI.pointInRect(x, y, 140, 440, 200, 50) then
        self.ctx:restart()
    elseif UI.pointInRect(x, y, 140, 510, 200, 40) then
        love.event.quit()
    end
end

function GO:mouse(x, y)
    self._hotRetry = UI.pointInRect(x, y, 140, 440, 200, 50)
    self._hotQuit  = UI.pointInRect(x, y, 140, 510, 200, 40)
end

function GO:key(key)
    if key == 'return' or key == 'space' then self.ctx:restart() end
end

function GO:draw(g, font, atlas)
    local run = self.ctx.loop.state.run
    font:drawCentered('GAME OVER', 240, 140, { 0.95, 0.25, 0.25, 1 }, 4)
    if run then
        font:drawCentered('ROUND ' .. run.round, 240, 220, { 0.9, 0.9, 0.9, 1 }, 2)
        font:drawCentered('SCORE ' .. (run.lastRoundResult and run.lastRoundResult.totalWon or run.score), 240, 260, { 0.85, 0.85, 0.95, 1 }, 2)
        font:drawCentered('QUOTA ' .. (run.lastRoundResult and run.lastRoundResult.quota or 0), 240, 290, { 0.55, 0.55, 0.65, 1 }, 1)
    end
    local meta = self.ctx.loop.state.meta
    font:drawCentered('TICKETS ' .. meta.tickets, 240, 340, { 0.85, 0.95, 0.65, 1 }, 2)

    UI.button(g, 140, 440, 200, 50, self._hotRetry)
    font:drawCentered('RETRY', 240, 458, { 1, 0.95, 0.7, 1 }, 2)
    UI.button(g, 140, 510, 200, 40, self._hotQuit)
    font:drawCentered('QUIT', 240, 524, { 0.9, 0.9, 0.9, 1 }, 1)
end

return GO
