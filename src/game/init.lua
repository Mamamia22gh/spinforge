local GameLoop = require('src.game_loop')
local EventManager = require('src.event_manager')
local Save = require('src.save')
local PixelWheel = require('src.objects.pixel_wheel')
local Background = require('src.objects.background')
local PAL = require('src.palette')

local C = require('src.game.constants')
local make_ctx = require('src.game.context')

local Game = {}
Game.__index = Game
Game.WHEEL_CX = C.WHEEL_CX
Game.WHEEL_CY = C.WHEEL_CY
Game.WHEEL_R  = C.WHEEL_R
Game.UI_RING_R = C.UI_RING_R

function Game.new()
    return setmetatable({
        name = 'game',
        _kernel = nil, _atlas = nil, _font = nil,
        _mx = C.WHEEL_CX, _my = C.WHEEL_CY,
        _mnx = 0, _mny = 0,
        _time = 0, _pops = {},
        _shake = { x=0, y=0, intensity=0, decay=0.3, time=0 },
        _flash = 0,
        _spinning = false, _postSpinShow = false, _inShop = false,
        _hubHover = false, _sweepTrigger = -10,
        _catalogueOpen = false, _catalogueTab = 0, _catalogueScroll = 0,
        _themeMenuOpen = false, _themeMenuHover = nil,
        _debugSpritesOpen = false, _debugScroll = 0,
        _relicHoverRarity = nil,
        _inSettings = false, _settingsHover = nil, _settingsDrag = nil,
        _spriteIdsCache = nil, _cursorHover = false,
        loop = nil, em = nil, scene = nil, ctx = nil,
        wheel = nil, bg = nil,
    }, Game)
end

require('src.game.lifecycle')(Game)
require('src.game.sync')(Game)
require('src.game.settings')(Game)
require('src.game.events')(Game)
require('src.game.hud')(Game)
require('src.game.render')(Game)
require('src.game.input')(Game)
require('src.game.overlays.theme')(Game)
require('src.game.overlays.catalogue')(Game)
require('src.game.overlays.relic_tooltip')(Game)

function Game:boot(kernel, cfg)
    local savedMeta = Save.load()
    self.loop = GameLoop.new({ meta = savedMeta })
    self.em = EventManager.new()
    self.bg = Background.new()
    self.wheel = PixelWheel.new()
    self.wheel:setRadius(C.WHEEL_R)

    self.wheel.onPegHit = function()
        kernel:emit('audio.tone', { freq = 800 + math.random() * 400, duration = 0.02, wave = 'square', vol = 0.03 })
    end
    self.wheel.onFlipMid = function()
        kernel:emit('audio.tone', { freq = 250, duration = 0.08, wave = 'square', vol = 0.07 })
        kernel:emit('audio.tone', { freq = 190, duration = 0.06, wave = 'triangle', vol = 0.05 })
        self:_shakeStart(3, 0.2)
    end
    self.wheel.onFlipDone = function()
        kernel:emit('audio.tone', { freq = 130, duration = 0.12, wave = 'square', vol = 0.08 })
        kernel:emit('audio.tone', { freq = 95, duration = 0.15, wave = 'triangle', vol = 0.06 })
        self:_shakeStart(8, 0.3)
    end

    self.ctx = make_ctx(self, kernel)
    self:_bindLoopEvents()

    local meta = self.loop.state.meta
    meta.settings = meta.settings or { masterVol = 0.5, bgmVol = 0.6, sfxVol = 0.8, fullscreen = true, theme = 'original' }
    local s = meta.settings
    if s.theme then PAL.setTheme(s.theme) end
    kernel:emit('audio.set_volume', { master = s.masterVol, bgm = s.bgmVol, sfx = s.sfxVol })
    if love.window.getFullscreen() ~= (s.fullscreen ~= false) then
        love.window.setFullscreen(s.fullscreen ~= false, 'desktop')
    end

    self.loop:startRun()
    self:_syncWheel()
    self:_switchScene(self.loop.state.phase)

    kernel:on('kernel.update', function(d)
        self._time = self._time + d.dt
        self.em:update(d.dt)
        self.bg:update(d.dt)
        self.wheel:update(d.dt)
        self:_updateHoverState(d.dt)
        if self.scene and self.scene.update then self.scene:update(d.dt) end
        if self.scene and self.scene.mouse then self.scene:mouse(self._mx, self._my) end
    end)

    self:_bindRender(kernel)
    self:_bindInput(kernel)
end

return Game
