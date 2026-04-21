-- game/init.lua — Game bundle: wires engine, wheel, background, scenes.

local Engine = require('src.engine')
local Save = require('src.save')
local PixelWheel = require('src.objects.pixel_wheel')
local Background = require('src.objects.background')
local PAL = require('src.palette')
local C = require('src.game.constants')

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
        _phase = 'IDLE',
        _hubHover = false, _sweepTrigger = -10,
        _catalogueOpen = false, _catalogueTab = 0, _catalogueScroll = 0,
        _themeMenuOpen = false, _themeMenuHover = nil,
        _inSettings = false, _settingsHover = nil, _settingsDrag = nil,
        _cursorHover = false,
        _eventQueue = {},
        engine = nil, wheel = nil, bg = nil, scene = nil,
    }, Game)
end

require('src.game.lifecycle')(Game)
require('src.game.settings')(Game)
require('src.game.events')(Game)
require('src.game.hud')(Game)
require('src.game.render')(Game)
require('src.game.input')(Game)
require('src.game.overlays.theme')(Game)
require('src.game.overlays.catalogue')(Game)

function Game:boot(kernel, cfg)
    local savedMeta = Save.load()
    self.engine = Engine.new()
    if savedMeta and savedMeta.tickets then
        self.engine:setTickets(savedMeta.tickets or 0)
    end

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

    local s = savedMeta and savedMeta.settings or
        { masterVol = 0.5, bgmVol = 0.6, sfxVol = 0.8, fullscreen = true, theme = 'original' }
    self._settings_cache = s
    if s.theme then PAL.setTheme(s.theme) end
    kernel:emit('audio.set_volume', { master = s.masterVol, bgm = s.bgmVol, sfx = s.sfxVol })
    if love.window.getFullscreen() ~= (s.fullscreen ~= false) then
        love.window.setFullscreen(s.fullscreen ~= false, 'desktop')
    end

    self:_syncWheel()
    self:_switchScene('IDLE')

    kernel:on('kernel.update', function(d)
        self._time = self._time + d.dt
        self.bg:update(d.dt)
        self.wheel:update(d.dt)
        self:_processEventQueue(d.dt)
        self:_updateHoverState(d.dt)
        if self.scene and self.scene.update then self.scene:update(d.dt) end
        if self.scene and self.scene.mouse then self.scene:mouse(self._mx, self._my) end
    end)

    self:_bindRender(kernel)
    self:_bindInput(kernel)
end

function Game:_syncWheel()
    local segs = self.engine:segments()
    local wheel = {}
    local goldPockets = {}
    for i, s in ipairs(segs) do
        wheel[i] = { id = 'seg_' .. i, symbolId = nil, weight = 1, modifiers = {} }
        if s.kind == 1 then goldPockets[#goldPockets + 1] = i - 1 end
    end
    self.wheel:setWheel(wheel)
    self.wheel:setGoldPockets(goldPockets)
    self.wheel:setCorruption(self.engine:corruption())
    self.wheel:setBonusMode(false)
    self.wheel:setGaugeUnlocks({ true, false, false, true })
    self.wheel:setRelics({})

    local values = {}
    for i, s in ipairs(segs) do values[i] = s.value end
    self.wheel:setSegmentValues(values)

    local ballCount = self.engine:ballCount()
    self.wheel:placeBalls(ballCount, {})
    self.wheel:setCounters(self.engine:gold(), self.engine:tickets())
    self.wheel:hubSnapScore(self.engine:gold())
end

return Game
