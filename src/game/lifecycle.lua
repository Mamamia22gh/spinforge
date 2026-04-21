-- game/lifecycle.lua — scene switching, restart, helpers.

local Save = require('src.save')
local C = require('src.game.constants')

local SCENES = {
    IDLE      = require('src.scenes.hub'),
    SPINNING  = require('src.scenes.spin'),
    RESULTS   = require('src.scenes.results'),
    SHOP      = require('src.scenes.shop'),
    GAME_OVER = require('src.scenes.game_over'),
    VICTORY   = require('src.scenes.victory'),
}

return function(Game)

function Game:register(kernel)
    self._kernel = kernel
    self._introDone = false
    kernel:on('intro:done', function() self._introDone = true end)
    kernel:on('sprite.ready', function(d)
        self._atlas = d.atlas
        self._font  = d.font
    end, -10)
end

function Game:_switchScene(phase)
    self._phase = phase
    local S = SCENES[phase] or SCENES.IDLE
    if self.scene and self.scene.leave then self.scene:leave() end
    self.scene = S.new()
    self.scene:enter(self)
end

function Game:restart()
    Save.save(self:_metaTable())
    self.engine:restart()
    self:_syncWheel()
    self:_switchScene('IDLE')
end

function Game:_pop(text, x, y, opts)
    opts = opts or {}
    self._pops[#self._pops + 1] = {
        text = text,
        x = x or (C.WHEEL_CX + (math.random() - 0.5) * 60),
        y = y or (C.WHEEL_CY - 50 - math.random() * 20),
        age = 0, color = opts.color, noCoin = opts.noCoin or false,
    }
end

function Game:_shakeStart(intensity, decay)
    self._shake.intensity = intensity
    self._shake.decay = decay or 0.3
    self._shake.time = 0
end

function Game:_metaTable()
    return {
        tickets = self.engine:tickets(),
        totalTickets = 0,
        runsCompleted = 0,
        bestRound = 0,
        settings = self._settings_cache,
    }
end

function Game:_relicBarHitTest(mx, my)
    return nil
end

function Game:playSelect() self._kernel:emit('audio.sfx', { name = 'select' }) end
function Game:playHover() self._kernel:emit('audio.tone', { freq = 1100, duration = 0.03, wave = 'sine', vol = 0.03 }) end

end
