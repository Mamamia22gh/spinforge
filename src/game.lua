--[[
    Game bundle — orchestrates the scene manager, owns GameLoop + EventManager,
    bridges to the display / sprite / audio bundles via the kernel event bus.
]]

local GameLoop     = require('src.game_loop')
local EventManager = require('src.event_manager')
local Save         = require('src.save')

local SCENES = {
    IDLE      = require('src.scenes.hub'),
    SPINNING  = require('src.scenes.spin'),
    RESULTS   = require('src.scenes.results'),
    CHOICE    = require('src.scenes.choice'),
    SHOP      = require('src.scenes.shop'),
    GAME_OVER = require('src.scenes.game_over'),
    VICTORY   = require('src.scenes.victory'),
}

local Game = {}
Game.__index = Game

function Game.new()
    return setmetatable({
        name    = 'game',
        _kernel = nil,
        _atlas  = nil,
        _font   = nil,
        _mx = 0, _my = 0,
        loop    = nil,
        em      = nil,
        scene   = nil,
        ctx     = nil,
    }, Game)
end

function Game:register(kernel)
    self._kernel = kernel
    -- Subscribe to sprite.ready NOW (at addBundle time) so we don't miss it
    -- when SpriteBundle emits it during its own boot().
    kernel:on('sprite.ready', function(d)
        self._atlas = d.atlas
        self._font  = d.font
    end, -10)
end

function Game:_switchScene(phase)
    local S = SCENES[phase] or SCENES.IDLE
    if self.scene then self.scene:leave() end
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
    self:_switchScene('IDLE')
end

function Game:_bindLoopEvents()
    self.loop.events:on('phase:changed', function(d) self:_switchScene(d.phase) end)
    self.loop.events:on('ball:resolved', function(d)
        self._kernel:emit('audio.sfx', { name = d.isGold and 'jackpot' or 'coin' })
    end)
    self.loop.events:on('run:ended', function(d)
        Save.save(self.loop.state.meta)
        self._kernel:emit('audio.sfx', { name = (d.reason == 'victory') and 'jackpot' or 'hit' })
    end)
    self.loop.events:on('shop:bought', function()
        self._kernel:emit('audio.sfx', { name = 'coin' })
    end)
    self.loop.events:on('phase:changed', function(d)
        if d.phase == 'SHOP' then
            self._kernel:emit('audio.play_song', { song = require('src.data.songs').SHOP })
        else
            self._kernel:emit('audio.stop_song')
        end
    end)
end

local function make_ctx(game, kernel)
    local ctx = {
        kernel = kernel,
        loop   = game.loop,
        em     = game.em,
    }
    function ctx:restart() game:restart() end
    return ctx
end

function Game:boot(kernel, cfg)
    local savedMeta = Save.load()
    self.loop = GameLoop.new({ meta = savedMeta })
    self.em   = EventManager.new()
    self.ctx  = make_ctx(self, kernel)

    self:_bindLoopEvents()
    self:_switchScene('IDLE')

    kernel:on('kernel.update', function(d)
        self.em:update(d.dt)
        if self.scene and self.scene.update then self.scene:update(d.dt) end
        -- feed mouse pos to scene hover
        if self.scene and self.scene.mouse then self.scene:mouse(self._mx, self._my) end
    end)

    kernel:on('display.draw.main', function(d)
        if not self.scene or not self._font then return end
        self.scene:draw(d.g, self._font, self._atlas)
    end, 0)

    kernel:on('display.draw.lights', function(d)
        d.g:glow(self._mx, self._my, 50, 1, 0.9, 0.5, 0.05)
    end, 0)

    kernel:on('display.click', function(d)
        if self.scene and self.scene.click then self.scene:click(d.x, d.y) end
    end)

    kernel:on('display.mouse', function(d)
        self._mx = d.x
        self._my = d.y
    end)

    kernel:on('input.keypressed', function(d)
        if self.scene and self.scene.key then self.scene:key(d.key) end
    end)
end

return Game
