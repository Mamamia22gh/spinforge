--[[
    HUB scene — between-rounds landing page: shows round/quota/gold/relics,
    press SPACE or click SPIN to start spinning.
]]

local UI = require('src.ui')

local Hub = {}
Hub.__index = Hub

function Hub.new() return setmetatable({ _hot = false }, Hub) end

function Hub:enter(ctx) self.ctx = ctx; self._hot = false end
function Hub:leave() end
function Hub:update(dt) end

function Hub:click(x, y)
    if UI.pointInRect(x, y, 120, 420, 240, 60) then
        self.ctx.loop:startRun() -- no-op if run exists; but initially triggered at Hub enter
    end
end

function Hub:mouse(x, y)
    self._hot = UI.pointInRect(x, y, 120, 420, 240, 60)
end

function Hub:key(key)
    if key == 'space' or key == 'return' then
        if self.ctx.loop.state.phase == 'IDLE' then
            self.ctx.loop:startRun()
        end
    end
end

function Hub:draw(g, font, atlas)
    local meta = self.ctx.loop.state.meta
    font:drawCentered('SPINFORGE', 240, 80, { 1, 0.85, 0.3, 1 }, 4)
    font:drawCentered('ROGUELIKE ROULETTE', 240, 130, { 0.7, 0.7, 0.8, 1 }, 1)

    font:drawCentered('TICKETS: ' .. tostring(meta.tickets), 240, 200, { 0.85, 0.85, 0.95, 1 }, 2)
    font:drawCentered('BEST ROUND: ' .. tostring(meta.bestRound), 240, 240, { 0.65, 0.65, 0.75, 1 }, 1)
    font:drawCentered('RUNS: ' .. tostring(meta.runsCompleted), 240, 260, { 0.65, 0.65, 0.75, 1 }, 1)

    UI.button(g, 120, 420, 240, 60, self._hot, false)
    font:drawCentered('START RUN', 240, 440, { 1, 0.95, 0.7, 1 }, 2)

    font:drawCentered('SPACE/ENTER or click to start', 240, 560, { 0.45, 0.45, 0.55, 1 }, 1)
    font:drawCentered('ESC to quit', 240, 580, { 0.35, 0.35, 0.45, 1 }, 1)
end

return Hub
