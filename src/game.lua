--[[
    Game bundle — root game state + demo rendering.
    No canvas ownership — uses DisplayBundle via events.
]]

local Game = {}
Game.__index = Game

function Game.new()
    return setmetatable({
        state = "hub",
        round = 1,
        score = 0,
        golds = 0,
        tickets = 0,
        _kernel = nil,
        _atlas = nil,
        _font = nil,
        _time = 0,
    }, Game)
end

function Game:register(kernel)
    self._kernel = kernel
end

function Game:boot(kernel)
    -- grab references from sprite bundle
    kernel:on('sprite.ready', function(d)
        self._atlas = d.atlas
        self._font = d.font
    end, -10)

    -- update
    kernel:on('kernel.update', function(d)
        self._time = self._time + d.dt
    end)

    -- ── Draw on main canvas (game world) ──
    kernel:on('display.draw.main', function(d)
        self:_drawMain(d.g)
    end, 0)

    -- ── Draw on lights canvas ──
    kernel:on('display.draw.lights', function(d)
        self:_drawLights(d.g)
    end, 0)

    -- input demo
    kernel:on('input.keypressed', function(d)
        if d.key == 's' then
            kernel:emit('audio.sfx', { name = 'coin' })
        elseif d.key == 'm' then
            kernel:emit('audio.sfx', { name = 'jackpot' })
        elseif d.key == 'f' then
            -- test flash
            kernel:emit('display.draw.main', {}) -- no-op, just for demo
        end
    end)
end

function Game:_drawMain(g)
    love.graphics.setColor(1, 1, 1, 1)

    -- demo: draw some sprites and text
    if self._font then
        self._font:drawCentered("SPINFORGE", 240, 50, {1, 0.85, 0.3, 1}, 3)
        self._font:drawCentered("STATE: " .. self.state:upper(), 240, 90, {1, 1, 1, 1}, 2)
        self._font:drawCentered("PRESS S FOR COIN SFX", 240, 580, {0.5, 0.5, 0.5, 1}, 1)
        self._font:drawCentered("PRESS M FOR JACKPOT", 240, 595, {0.5, 0.5, 0.5, 1}, 1)
    end

    if self._atlas then
        local sprites = { 'red', 'blue', 'ball', 'skull', 'anvil', 'ticket' }
        for i, id in ipairs(sprites) do
            self._atlas:drawCentered(id, 80 + (i-1) * 60, 160, 4)
        end

        local relics = { 'relic_common', 'relic_uncommon', 'relic_rare', 'relic_legendary' }
        for i, id in ipairs(relics) do
            self._atlas:drawCentered(id, 120 + (i-1) * 80, 240, 4)
        end

        self._atlas:drawAnim('coin', 240, 320, 5, self._time, 4)

        local hieros = { 'gear', 'exit', 'book', 'retry' }
        for i, id in ipairs(hieros) do
            self._atlas:drawCentered(id, 60 + (i-1) * 110, 430, 2)
        end

        self._atlas:drawCentered('cursor_default', 160, 520, 3)
        self._atlas:drawCentered('cursor_pointer', 320, 520, 3)
    end
end

function Game:_drawLights(g)
    -- Demo: pulsing glow at center
    local pulse = 0.12 + 0.08 * math.floor(math.sin(self._time * 3) * 4) / 4
    g:glow(240, 320, 80, 1, 0.85, 0.3, pulse)

    -- Mouse-following glow
    local m = g:getMouse()
    g:glow(m.x, m.y, 60, 1, 0.85, 0.3, 0.06)
end

return Game
