local GameLoop = require('src.game_loop')
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
    local S = SCENES[phase] or SCENES.IDLE
    if self.scene and self.scene.leave then self.scene:leave() end
    self.scene = S.new()
    self.scene:enter(self.ctx)
end

function Game:restart()
    self.em:clear()
    Save.save(self.loop.state.meta)
    local meta = self.loop.state.meta
    self.loop = GameLoop.new({ meta = meta })
    self.ctx.loop = self.loop
    self:_bindLoopEvents()
    self.loop:startRun()
    self:_syncWheel()
    self:_switchScene(self.loop.state.phase)
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

function Game:_relicBarHitTest(mx, my)
    local dx = mx - C.WHEEL_CX
    local dy = my - C.WHEEL_CY
    local d2 = dx * dx + dy * dy
    if d2 < 80 * 80 or d2 > 100 * 100 then return nil end
    local a = math.atan2(dy, dx)
    local ARC = 0.30
    if a > -math.pi / 2 - ARC and a < -math.pi / 2 + ARC then
        local rarities = { 'common', 'uncommon', 'rare', 'legendary' }
        local t = (a - (-math.pi / 2 - ARC)) / (ARC * 2)
        local idx = math.max(1, math.min(4, math.floor(t * 4) + 1))
        return rarities[idx]
    end
    return nil
end

end
