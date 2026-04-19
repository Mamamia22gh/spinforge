--[[
    Game bundle — owns GameLoop + EventManager, PixelWheel + Background.
    ISO with legacy main.js: multi-layer parallax, pre-rendered bg, SPINFORGE
    title with flipping O, hub-button-as-wheel-center, popups, lights,
    catalogue overlay, debug sprites grid, relic/shop tooltips, invert flash.

    Render order (ISO with legacy _render):
      bg → wheel → UI ring → title → gold anims → pops → hub overlay
      → gold-quota anim → ticket anim → invert flash
      UI overlay pass (NOT postfx'd): catalogue/debug/relic tooltip
      Lights pass: hub glow + cursor glow + wheel.lights
]]

local GameLoop     = require('src.game_loop')
local EventManager = require('src.event_manager')
local Save         = require('src.save')
local PixelWheel   = require('src.objects.pixel_wheel')
local Background   = require('src.objects.background')
local balMod       = require('src.data.balance')
local BALANCE, getQuota = balMod.BALANCE, balMod.getQuota
local WU_DATA      = require('src.data.wheel_upgrades').WHEEL_UPGRADES
local RELICS_MOD   = require('src.data.relics')
local Effect       = require('src.systems.effect')
local CHOICES_DATA = require('src.data.choices').CHOICES
local spritesData  = require('bundles.sprite.sprites_data')

local SCENES = {
    IDLE      = require('src.scenes.hub'),
    SPINNING  = require('src.scenes.spin'),
    RESULTS   = require('src.scenes.results'),
    SHOP      = require('src.scenes.shop'),
    GAME_OVER = require('src.scenes.game_over'),
    VICTORY   = require('src.scenes.victory'),
}

local W, H          = 480, 270
local WHEEL_CX      = 240
local WHEEL_CY      = 140
local WHEEL_R       = 130
local UI_RING_R     = 115
local SPRITE_SIZE   = 8
local CH_W          = 4   -- char width (matches font.lua charWidth=4)
local CH_H          = 7   -- char height + gap (matches legacy CHAR_H)

local PAL = {
    gold     = {0.83, 0.65, 0.13, 1},
    darkGold = {0.48, 0.37, 0.06, 1},
    midGray  = {0.20, 0.20, 0.27, 1},
    lightGray= {0.42, 0.42, 0.48, 1},
    white    = {0.91, 0.88, 0.82, 1},
    black    = {0.04, 0.04, 0.04, 1},
    red      = {0.80, 0.13, 0.20, 1},
    darkRed  = {0.43, 0.07, 0.15, 1},
    green    = {0.13, 0.67, 0.27, 1},
    blue     = {0.17, 0.30, 0.80, 1},
}

local RARITY_COL = {
    common    = PAL.white,
    uncommon  = PAL.green,
    rare      = PAL.blue,
    legendary = PAL.gold,
}

local Game = {}
Game.__index = Game

function Game.new()
    return setmetatable({
        name    = 'game',
        _kernel = nil, _atlas = nil, _font = nil,
        _mx = 240, _my = 140,
        _mnx = 0,   _mny = 0,
        _time = 0,
        _pops = {},
        _shake = { x=0, y=0, intensity=0, decay=0.3, time=0 },
        _flash = 0,
        _spinning = false,
        _postSpinShow = false,
        _inShop   = false,
        _hubHover = false,
        _sweepTrigger = -10,
        _catalogueOpen = false,
        _catalogueTab  = 0,
        _catalogueScroll = 0,
        _debugSpritesOpen = false,
        _debugScroll = 0,
        _relicHoverRarity = nil,
        _inSettings = false,
        _settingsHover = nil,
        _settingsDrag = nil,
        _spriteIdsCache = nil,
        _cursorHover = false,
        loop = nil, em = nil, scene = nil, ctx = nil,
        wheel = nil, bg = nil,
    }, Game)
end

function Game:register(kernel)
    self._kernel = kernel
    self._introDone = false
    kernel:on('intro:done', function() self._introDone = true end)

    kernel:on('sprite.ready', function(d)
        self._atlas = d.atlas
        self._font  = d.font
    end, -10)
end

-- ── Layout helpers ─────────────────────────────────
Game.WHEEL_CX = WHEEL_CX
Game.WHEEL_CY = WHEEL_CY
Game.WHEEL_R  = WHEEL_R
Game.UI_RING_R = UI_RING_R

-- ── State sync ────────────────────────────────────
function Game:_syncWheel()
    local run = self.loop.state.run
    if not run then return end
    self.wheel:setWheel(run.wheel)
    self.wheel:setGoldPockets(BALANCE.GOLD_POCKETS)
    self.wheel:setRelics(run.relics)
    self.wheel:setCorruption(run.corruption or 0.5)
    self.wheel:setBonusMode(false)
    self.wheel:setGaugeUnlocks({ true, false, false, true })
    local mods = Effect.compute(run.relics)
    local upgradeCount = 0
    for _, u in ipairs(run.purchasedUpgrades or {}) do
        if u.effect == 'value_plus_2' then upgradeCount = upgradeCount + 1 end
    end
    local goldSet = {}
    for _, gp in ipairs(BALANCE.GOLD_POCKETS) do goldSet[gp] = true end
    local values = {}
    for i = 1, #run.wheel do
        local segment = run.wheel[i]
        local baseVal = (mods.setBaseValue ~= nil) and mods.setBaseValue or i
        if baseVal % 2 == 0 then
            baseVal = baseVal + mods.addEven
        else
            baseVal = baseVal + mods.addOdd
        end
        local v = baseVal * (segment.weight or 1)
        if upgradeCount > 0 then v = v + 2 * upgradeCount end
        if goldSet[i - 1] then v = v * 2 end
        values[i] = v
    end
    self.wheel:setSegmentValues(values)
    local previewBalls = self._inShop
        and (BALANCE.BALLS_PER_ROUND + #run.specialBalls + (run.genericBallsBought or 0))
        or run.ballsLeft
    self.wheel:placeBalls(previewBalls, run.specialBalls)
    self.wheel:setCounters(run.score, self.loop.state.meta.tickets)
    self.wheel:hubSnapScore(run.score)
end

function Game:_switchScene(phase)
    local S = SCENES[phase] or SCENES.IDLE
    if self.scene and self.scene.leave then self.scene:leave() end
    self.scene = S.new()
    self.scene:enter(self.ctx)
end

function Game:_bindLoopEvents()
    -- ── Single phase:changed handler (ISO legacy ordering) ──
    -- Order: update flags → wheel flip → CHOICE auto-skip → scene switch.
    -- CHOICE auto-skip emits phase:changed(SHOP) which is QUEUED by
    -- EventBus re-entrant guard and processed after this handler returns.
    self.loop.events:on('phase:changed', function(d)
        local phase = d.phase

        -- Close settings on any phase change
        if self._inSettings then
            self._inSettings = false
            self.wheel:setSettingsMode(false)
        end

        -- 1. Flags
        self._spinning = (phase == 'SPINNING')
        self._postSpinShow = false
        if phase == 'SPINNING' then self._revealIdx = 0 end
        if phase ~= 'SPINNING' then
            self.wheel:setBonusMode(false)
        end

        -- 2. Wheel flip for shop (ISO legacy _openForgeShop / _closeForgeShop)
        if phase == 'SHOP' then
            self._inShop = true
            if self.wheel and not self.wheel:isFlipped() then
                self.wheel:startFlip(0.5)
            end
        else
            if self._inShop and self.wheel and self.wheel:isFlipped() then
                self.wheel:startFlip(0.5)
            end
            self._inShop = false
        end

        -- 2b. BGM per phase
        local Songs = require('src.data.songs')
        local songMap = {
            IDLE = Songs.MAIN, SPINNING = Songs.MAIN, RESULTS = Songs.MAIN,
            SHOP = Songs.SHOP, GAME_OVER = Songs.GAME_OVER, VICTORY = Songs.VICTORY,
        }
        local nextSong = songMap[phase]
        if nextSong ~= self._currentSong then
            if nextSong then
                self._kernel:emit('audio.play_song', { song = nextSong })
            else
                self._kernel:emit('audio.stop_song')
            end
            self._currentSong = nextSong
        end

        -- 3. CHOICE auto-skip (queued via EventBus re-entrant guard)
        if phase == 'CHOICE' then
            self.loop:skipChoice()
            return
        end

        -- 4. Scene switch
        self:_switchScene(phase)
    end)

    self.loop.events:on('run:started',    function() self:_syncWheel() end)
    self.loop.events:on('round:preview',  function() self:_syncWheel() end)

    self.loop.events:on('ball:resolved', function(d)
        self._kernel:emit('audio.sfx', { name = d.isGold and 'jackpot' or 'coin' })
        -- Reveal tone (ISO legacy _playReveal)
        local revNotes = { 523, 587, 659, 784, 880, 1047 }
        self._revealIdx = (self._revealIdx or 0) + 1
        local f = revNotes[math.min(self._revealIdx, #revNotes)]
        self._kernel:emit('audio.tone', { freq = f, duration = 0.2, wave = 'square', vol = 0.08 })
        self._kernel:emit('audio.tone', { freq = f * 1.5, duration = 0.15, wave = 'sine', vol = 0.04 })
        self.wheel:hubSetScore(d.score)
        if d.result and d.result.symbol then
            self.wheel:hubShowValue(d.result.symbol.id, d.value)
        end
        -- Highlight pocket + gold fly anim (ISO legacy main.js:652-659)
        local popX, popY
        if d.segmentIndex then
            self.wheel:highlight(d.segmentIndex)
            local px, py = self.wheel:getPocketPosition(d.segmentIndex, WHEEL_CX, WHEEL_CY)
            if px then
                popX, popY = px, py - 15
                self.wheel:startGoldFly('+' .. (d.value or 0), d.value or 0,
                    px, py - 15, WHEEL_CX, WHEEL_CY)
                -- Ticket fly anim for ticket balls (ISO legacy)
                if d.result and d.result.ticketsEarned and d.result.ticketsEarned > 0 then
                    self.wheel:startTicketFly('+' .. d.result.ticketsEarned, d.result.ticketsEarned,
                        px, py - 15, WHEEL_CX, WHEEL_CY)
                end
            end
        end
        self:_pop('+' .. (d.value or 0), popX, popY)
        self:_shakeStart(1.5, 0.2)

        -- Invert flash + bonus mode on quota cross (ISO legacy line 664)
        local run = self.loop.state.run
        if run and d.score then
            local quota = getQuota(run.round)
            local prevScore = d.score - (d.value or 0)
            if d.score >= quota and prevScore < quota then
                self._flash = 0.3
                self:_shakeStart(5, 0.5)
                self.wheel:setBonusMode(true)
            end
        end
    end)

    self.loop.events:on('game:over', function() Save.save(self.loop.state.meta) end)
    self.loop.events:on('game:won',  function() Save.save(self.loop.state.meta) end)
    self.loop.events:on('shop:item_bought', function(d)
        self._kernel:emit('audio.sfx', { name = 'purchase' })
        -- Buy cha-ching (ISO legacy _playBuy)
        self._kernel:emit('audio.tone', { freq = 880, duration = 0.10, wave = 'square', vol = 0.07 })
        self._kernel:emit('audio.tone', { freq = 1175, duration = 0.10, wave = 'square', vol = 0.07 })
        self._kernel:emit('audio.tone', { freq = 1760, duration = 0.18, wave = 'sine', vol = 0.09 })
        self:_pop('BOUGHT!', nil, nil, { color = PAL.gold, noCoin = true })
    end)
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

-- ── Pops ─────────────────────────────────────────────
function Game:_pop(text, x, y, opts)
    opts = opts or {}
    self._pops[#self._pops + 1] = {
        text   = text,
        x      = x or (WHEEL_CX + (math.random() - 0.5) * 60),
        y      = y or (WHEEL_CY - 50 - math.random() * 20),
        age    = 0,
        color  = opts.color,
        noCoin = opts.noCoin or false,
    }
end

function Game:_shakeStart(intensity, decay)
    self._shake.intensity = intensity
    self._shake.decay     = decay or 0.3
    self._shake.time      = 0
end

-- ── Catalogue control ─────────────────────────────
function Game:_openCatalogue()
    self._catalogueOpen = true
    self._catalogueTab = 0
    self._catalogueScroll = 0
end

function Game:_closeCatalogue()
    self._catalogueOpen = false
end

-- ── Settings control ──────────────────────────────
function Game:_applySettings(saveNow)
    local meta = self.loop.state.meta
    meta.settings = meta.settings or {}
    local m, b, sx, fs = self.wheel:getSettingsValues()
    meta.settings.masterVol  = m
    meta.settings.bgmVol     = b
    meta.settings.sfxVol     = sx
    meta.settings.fullscreen = fs
    self._kernel:emit('audio.set_volume', { master = m, bgm = b, sfx = sx })
    local curFs = love.window.getFullscreen()
    if curFs ~= fs then love.window.setFullscreen(fs, 'desktop') end
    if saveNow then Save.save(meta) end
end

function Game:_openSettings()
    if self._inSettings then return end
    if self.loop.state.phase ~= 'IDLE' then return end
    if self.wheel._flip then return end
    self._inSettings = true
    self._settingsHover = nil
    self._settingsDrag  = nil
    local meta = self.loop.state.meta
    local s = meta.settings or {}
    self.wheel:setSettingsValues(
        s.masterVol or 0.5, s.bgmVol or 0.6,
        s.sfxVol or 0.8, s.fullscreen ~= false)
    self.wheel:setSettingsMode(true)
    if not self.wheel:isFlipped() then self.wheel:startFlip(0.5) end
end

function Game:_closeSettings()
    if not self._inSettings then return end
    self._inSettings = false
    self._settingsHover = nil
    self._settingsDrag  = nil
    self:_applySettings(true)
    self.wheel:setSettingsMode(false)
    if self.wheel:isFlipped() then self.wheel:startFlip(0.5) end
end

-- ── Relic bar hit-test (approximate; top of wheel, tilt-aware) ──
function Game:_relicBarHitTest(mx, my)
    local dx = mx - WHEEL_CX
    local dy = my - WHEEL_CY
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

-- ── Context passed to scenes ────────────────────────
local function make_ctx(g, kernel)
    local ctx = {
        kernel = kernel, loop = g.loop, em = g.em,
        wheel = g.wheel, bg = g.bg, game = g,
    }
    function ctx:restart() g:restart() end
    function ctx:mouseNorm() return g._mnx, g._mny end
    function ctx:mousePos() return g._mx, g._my end
    function ctx:pop(t, x, y, o) g:_pop(t, x, y, o) end
    function ctx:shake(i, d) g:_shakeStart(i, d) end
    function ctx:triggerSweep() g._sweepTrigger = g._time end
    function ctx:openCatalogue() g:_openCatalogue() end
    function ctx:playSelect() kernel:emit('audio.sfx', { name = 'select' }) end
    function ctx:playHover() kernel:emit('audio.tone', { freq = 1100, duration = 0.03, wave = 'sine', vol = 0.03 }) end
    ctx._startSpin = function() g.loop:beginSpinning() end
    return ctx
end

-- ── Boot ─────────────────────────────────────────────
function Game:boot(kernel, cfg)
    local savedMeta = Save.load()
    self.loop  = GameLoop.new({ meta = savedMeta })
    self.em    = EventManager.new()
    self.bg    = Background.new()
    self.wheel = PixelWheel.new()
    self.wheel:setRadius(WHEEL_R)

    -- ── Audio wiring (ISO legacy main.js:128-131) ──
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

    -- Initialize settings from saved meta (apply volume + fullscreen)
    local meta = self.loop.state.meta
    meta.settings = meta.settings or { masterVol = 0.5, bgmVol = 0.6, sfxVol = 0.8, fullscreen = true }
    local s = meta.settings
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

        -- Flash decay
        if self._flash > 0 then
            self._flash = self._flash - d.dt
            if self._flash < 0 then self._flash = 0 end
        end

        -- Shake decay
        if self._shake.intensity > 0 then
            self._shake.time = self._shake.time + d.dt
            local t = math.min(1, self._shake.time / self._shake.decay)
            local amp = self._shake.intensity * (1 - t)
            self._shake.x = (math.random() - 0.5) * 2 * amp
            self._shake.y = (math.random() - 0.5) * 2 * amp
            if t >= 1 then
                self._shake.intensity = 0
                self._shake.x, self._shake.y = 0, 0
            end
        end

        -- Pops
        for i = #self._pops, 1, -1 do
            self._pops[i].age = self._pops[i].age + d.dt
            self._pops[i].y   = self._pops[i].y - d.dt * 25
            if self._pops[i].age > 1.5 then table.remove(self._pops, i) end
        end

        -- Block all interactive hovers during animations (non-IDLE phases, flip anim)
        local busy = (self.loop.state.phase ~= 'IDLE')
            or (self.wheel._flip ~= nil)
            or self._inSettings

        -- Hub hover (ellipse inside hub radius with tilt)
        local tilt = self.wheel:getTilt()
        local dx = self._mx - WHEEL_CX
        local dy = (self._my - WHEEL_CY) / math.max(0.05, tilt)
        local r = self.wheel:getHubRadius()
        local wasHover = self._hubHover
        self._hubHover = not busy and (dx*dx + dy*dy) <= r*r and not self.wheel:isFlipped()

        -- Trigger sweep on hover enter (ISO legacy line 209)
        if self._hubHover and not wasHover then
            self._sweepTrigger = self._time
            self._kernel:emit('audio.tone', { freq = 1100, duration = 0.03, wave = 'sine', vol = 0.03 })
        end

        -- Background menu hover (hiero ring) — always available except overlays
        local oldBgHover = self.bg._hover
        if self._catalogueOpen or self._debugSpritesOpen then
            self.bg:setHover(nil)
        else
            self.bg:setHover(self.bg:hitTest(self._mx, self._my))
        end
        if self.bg._hover and self.bg._hover ~= oldBgHover then
            self._kernel:emit('audio.tone', { freq = 1100, duration = 0.03, wave = 'sine', vol = 0.03 })
        end

        -- Relic bar hover (blocked by overlays)
        local oldRelicHover = self._relicHoverRarity
        if busy or self._catalogueOpen or self._debugSpritesOpen or self._inShop then
            self._relicHoverRarity = nil
        else
            self._relicHoverRarity = self:_relicBarHitTest(self._mx, self._my)
        end
        if self._relicHoverRarity and self._relicHoverRarity ~= oldRelicHover then
            self._kernel:emit('audio.tone', { freq = 1100, duration = 0.03, wave = 'sine', vol = 0.03 })
        end

        -- Settings hover + drag update
        if self._inSettings and self.wheel:isFlipped() and not self.wheel._flip then
            local hit = self.wheel:settingsHitTest(self._mx, self._my, WHEEL_CX, WHEEL_CY)
            local hoverId = hit and (hit.id or hit.type) or nil
            if hoverId ~= self._settingsHover then
                if hoverId then
                    self._kernel:emit('audio.tone', { freq = 1100, duration = 0.03, wave = 'sine', vol = 0.03 })
                end
                self._settingsHover = hoverId
                self.wheel:settingsSetHover(hoverId)
            end
            -- Drag: follow mouse to update slider value
            if self._settingsDrag and hit and hit.type == 'slider' and hit.id == self._settingsDrag then
                self.wheel:settingsSetSlider(self._settingsDrag, hit.value)
                self:_applySettings(false)
            elseif self._settingsDrag then
                local TILT_Y = math.abs(self.wheel:getTilt())
                if TILT_Y >= 0.05 then
                    local dx = self._mx - WHEEL_CX
                    local dy = (self._my - WHEEL_CY) / TILT_Y
                    local a = math.atan2(dy, dx)
                    local qMap = { master = 1, bgm = 2, sfx = 3 }
                    local q = qMap[self._settingsDrag]
                    if q then
                        local GAP = 0.12
                        local SPAN = math.pi/2 - GAP
                        local bases = { -math.pi/2, 0, math.pi/2, math.pi }
                        local a0 = bases[q] + GAP/2
                        local rel = a - a0
                        if rel < -math.pi then rel = rel + 2*math.pi end
                        if rel > math.pi then rel = rel - 2*math.pi end
                        local v = math.max(0, math.min(1, rel / SPAN))
                        self.wheel:settingsSetSlider(self._settingsDrag, v)
                        self:_applySettings(false)
                    end
                end
            end
        end

        -- Cursor hover state
        self._cursorHover = false
        if self._hubHover then
            self._cursorHover = true
        elseif self.bg._hover then
            self._cursorHover = true
        elseif self._relicHoverRarity then
            self._cursorHover = true
        elseif self._inSettings and self._settingsHover then
            self._cursorHover = true
        elseif self._inShop and self.wheel._shop and self.wheel._shop.hoverIdx ~= -1 then
            self._cursorHover = true
        elseif self.loop.state.phase == 'RESULTS' then
            self._cursorHover = true
        end

        if self.scene and self.scene.update then self.scene:update(d.dt) end
        if self.scene and self.scene.mouse then self.scene:mouse(self._mx, self._my) end
    end)

    kernel:on('display.draw.main', function(d)
        if not self.scene or not self._font then return end
        local g = d.g

        g:push()
        g:translate(self._shake.x, self._shake.y)

        -- Parallax offsets (ISO with JS _render)
        local px, py = self._mnx, self._mny
        local wheelOx, wheelOy = px * 1.5, py * 1.0
        local periOx,  periOy  = px * 2.0, py * 2.0
        local bgOx,    bgOy    = px * 3.0, py * 2.5
        local uiOx,    uiOy    = px * 3.0, py * 2.5
        local hudOx,   hudOy   = px * 4.5, py * 3.0
        local hubBtnOx, hubBtnOy = px * 1.7, py * 1.1

        self.bg:draw(g, self._font, self._atlas, bgOx, bgOy)

        if self.scene.drawUnder then self.scene:drawUnder(g, self._font, self._atlas) end

        local drawWheel = self.scene.drawWheel
        if drawWheel == nil then drawWheel = true end
        if drawWheel then
            self.wheel:draw(g, self._font, self._atlas,
                WHEEL_CX + wheelOx, WHEEL_CY + wheelOy,
                periOx - wheelOx, periOy - wheelOy)
        end

        if drawWheel then
            g:setColor(PAL.midGray[1], PAL.midGray[2], PAL.midGray[3], 0.9)
            g:circle('line', WHEEL_CX + uiOx, WHEEL_CY + uiOy, UI_RING_R)
        end

        self:_drawTitle(g, hudOx, hudOy)

        self._font:draw('v0', W - 14, H - 8, PAL.lightGray, 1)

        if drawWheel then
            self.wheel:drawGoldAnims(g, self._font, self._atlas,
                WHEEL_CX + wheelOx, WHEEL_CY + wheelOy)
            self.wheel:drawTicketFlyAnims(g, self._font, self._atlas,
                WHEEL_CX + wheelOx, WHEEL_CY + wheelOy)
        end

        self:_drawPops(g)

        if drawWheel and not self.wheel:isFlipped() then
            if self.loop.state.phase == 'GAME_OVER' then
                self:_drawGameOverHub(g, hubBtnOx, hubBtnOy)
            else
                self:_drawHubPrompt(g, hubBtnOx, hubBtnOy)
            end
        end

        if drawWheel then
            self.wheel:drawGoldQuotaAnim(g, self._font, self._atlas,
                WHEEL_CX + wheelOx, WHEEL_CY + wheelOy)
            self.wheel:drawTicketAnim(g, self._font, self._atlas,
                WHEEL_CX + wheelOx, WHEEL_CY + wheelOy)
        end

        self.scene:draw(g, self._font, self._atlas)

        g:pop()

        -- Invert flash (shader-based color inversion)
        if self._flash > 0 then
            local a = math.min(1, self._flash / 0.15)
            if not self._invertShader then
                self._invertShader = love.graphics.newShader[[
                    vec4 effect(vec4 color, Image tex, vec2 tc, vec2 sc) {
                        vec4 pixel = Texel(tex, tc);
                        return vec4(vec3(1.0) - pixel.rgb, pixel.a) * color;
                    }
                ]]
            end
            local canvas = love.graphics.getCanvas()
            if canvas then
                local cw, ch = canvas:getDimensions()
                if not self._invertSnap or self._invertSnap:getWidth() ~= cw or self._invertSnap:getHeight() ~= ch then
                    if self._invertSnap then self._invertSnap:release() end
                    self._invertSnap = love.graphics.newCanvas(cw, ch)
                end
                love.graphics.push('all')
                love.graphics.origin()
                love.graphics.setCanvas(self._invertSnap)
                love.graphics.clear(0, 0, 0, 0)
                love.graphics.setColor(1, 1, 1, 1)
                love.graphics.setBlendMode('alpha')
                love.graphics.draw(canvas, 0, 0)
                love.graphics.setCanvas(canvas)
                love.graphics.setShader(self._invertShader)
                love.graphics.setColor(1, 1, 1, a)
                love.graphics.draw(self._invertSnap, 0, 0)
                love.graphics.pop()
            end
        end
    end, 0)

    -- ── UI overlay pass (catalogue/debug/relic tooltip — NOT postfx'd) ──
    kernel:on('display.draw.ui', function(d)
        if not self._font then return end
        local g = d.g

        -- Wheel segment labels at screen-res for crisp text
        local drawWheel = not self.scene or self.scene.drawWheel
        if drawWheel == nil then drawWheel = true end
        if drawWheel and self._introDone then
            local px, py = self._mnx, self._mny
            local wheelOx, wheelOy = px * 1.5, py * 1.0
            g:push()
            g:translate(self._shake.x, self._shake.y)
            self.wheel:drawLabels(g, self._font,
                WHEEL_CX + wheelOx, WHEEL_CY + wheelOy)
            g:pop()
        end

        self:_drawRelicTooltip(g)
        self:_drawCatalogue(g)
        self:_drawDebugSprites(g)
        self:_drawCursor(g)
    end, 0)

    kernel:on('display.draw.lights', function(d)
        local L = d.g
        if not self._spinning and not self._inShop and self.loop.state.phase ~= 'GAME_OVER' then
            local raw = math.sin(self._time * 3)
            local stepped = math.floor(raw * 4) / 4
            local pulse = 0.12 + 0.08 * stepped
            L:glow(WHEEL_CX, WHEEL_CY, 65, 0.83, 0.65, 0.13, pulse)
        end
        L:glow(self._mx, self._my, 60, 0.83, 0.65, 0.13, 0.05)
        for _, l in ipairs(self.wheel._frameLights or {}) do
            local c = l.color or {1,1,1,1}
            L:glow(l.x + WHEEL_CX, l.y + WHEEL_CY, l.r or 8,
                c[1], c[2], c[3], l.a or 0.2)
        end
    end, 0)

    kernel:on('display.click', function(d)
        if d._handled then return end
        if self._debugSpritesOpen then
            self._debugSpritesOpen = false
            return
        end
        if self._catalogueOpen then
            self:_catalogueClick(d.x, d.y)
            return
        end
        -- Settings menu: handle clicks on sliders/toggle/close
        if self._inSettings then
            if self.wheel._flip then return end
            local hit = self.wheel:settingsHitTest(d.x, d.y, WHEEL_CX, WHEEL_CY)
            if not hit then return end
            if hit.type == 'close' then
                self._kernel:emit('audio.sfx', { name = 'select' })
                self:_closeSettings()
            elseif hit.type == 'toggle' then
                self._kernel:emit('audio.sfx', { name = 'select' })
                self.wheel:settingsToggleFullscreen()
                self:_applySettings(false)
            elseif hit.type == 'slider' then
                self._kernel:emit('audio.tone', { freq = 1400, duration = 0.04, wave = 'square', vol = 0.05 })
                self._settingsDrag = hit.id
                self.wheel:settingsSetDragging(hit.id)
                self.wheel:settingsSetSlider(hit.id, hit.value)
                self:_applySettings(false)
            end
            return
        end
        -- Global menu buttons (exit/retry/catalogue/settings) — always clickable
        local menu = self.bg:hitTest(d.x, d.y)
        if menu then
            self._kernel:emit('audio.sfx', { name = 'select' })
            if menu == 'exit' then love.event.quit()
            elseif menu == 'retry' then self:restart()
            elseif menu == 'catalogue' then self:_openCatalogue()
            elseif menu == 'settings' then self:_openSettings()
            end
            return
        end
        if self.scene and self.scene.click then self.scene:click(d.x, d.y) end
    end)

    kernel:on('display.release', function(d)
        if self._settingsDrag then
            self._settingsDrag = nil
            self.wheel:settingsSetDragging(nil)
            self:_applySettings(true)
        end
    end)

    kernel:on('display.mouse', function(d)
        self._mx, self._my = d.x, d.y
        self._mnx = (d.x - W / 2) / (W / 2)
        self._mny = (d.y - H / 2) / (H / 2)
        if self._mnx < -1 then self._mnx = -1 elseif self._mnx > 1 then self._mnx = 1 end
        if self._mny < -1 then self._mny = -1 elseif self._mny > 1 then self._mny = 1 end
    end)

    kernel:on('input.keypressed', function(d)
        if d.key == 'escape' then
            if self._debugSpritesOpen then
                self._debugSpritesOpen = false
                return
            end
            if self._catalogueOpen then
                self:_closeCatalogue()
                return
            end
            if self._inSettings then
                self:_closeSettings()
                return
            end
            love.event.quit()
            return
        end
        if self._catalogueOpen or self._debugSpritesOpen or self._inSettings then return end
        if self.scene and self.scene.key then self.scene:key(d.key) end
    end)

    kernel:on('input.wheelmoved', function(d)
        local dir = (d.y and d.y < 0) and 1 or ((d.y and d.y > 0) and -1 or 0)
        if self._debugSpritesOpen then
            self._debugScroll = math.max(0, self._debugScroll + dir)
            return
        end
        if self._catalogueOpen then
            self._catalogueScroll = math.max(0, self._catalogueScroll + dir)
            return
        end
    end)
end

-- ── Title: SPINF + flipping O + RGE (ISO legacy scale=5, lines 1088-1113) ──
function Game:_drawTitle(g, hudOx, hudOy)
    local font = self._font
    if not font then return end
    local scale = 5
    local charStep = (CH_W + 1) * scale
    local fullW = font:measure('SPINFORGE') * scale
    local tx = math.floor(W / 2 + hudOx - fullW / 2)
    local ty = 6 + hudOy

    font:draw('SPINF', tx, ty, PAL.gold, scale)

    local flipT = self._time % 4.0
    local flipDur = 0.6
    local sY = 1
    if flipT < flipDur then sY = math.cos(flipT / flipDur * math.pi * 2) end
    local oX = tx + 5 * charStep
    local oCX = oX + CH_W * scale / 2
    local oCY = ty + CH_H * scale / 2

    g:push()
    g:translate(oCX, oCY)
    g:scale(1, sY)
    font:draw('O', -CH_W * scale / 2, -CH_H * scale / 2, PAL.gold, scale)
    g:pop()

    font:draw('RGE', tx + 6 * charStep, ty, PAL.gold, scale)
end

-- ── Pops (ISO legacy: outlined + coin + gold→darkGold + 1s/0.5s fade) ──
function Game:_drawPops(g)
    local font = self._font
    local atlas = self._atlas
    for _, p in ipairs(self._pops) do
        local col = p.color or (p.age < 1.0 and PAL.gold or PAL.darkGold)
        local a = p.age < 1.0 and 1 or math.max(0, 1 - (p.age - 1.0) / 0.5)
        local c  = { col[1], col[2], col[3], a }
        local oc = { PAL.black[1], PAL.black[2], PAL.black[3], a }
        if p.noCoin then
            font:drawCenteredOutlined(p.text, p.x, p.y, c, 1, oc)
        else
            local textW = #p.text * CH_W
            local coinSz = SPRITE_SIZE
            local totalW = coinSz + 2 + textW
            font:drawCenteredOutlined(p.text,
                math.floor(p.x - totalW / 2 + textW / 2), p.y, c, 1, oc)
            if atlas then
                g:setColor(1, 1, 1, a)
                atlas:drawAnim('coin',
                    math.floor(p.x - totalW / 2 + textW + 2 + coinSz / 2),
                    p.y + math.floor(CH_H / 2), 1, self._time, 6)
            end
        end
    end
end

-- ── Hub prompt: gold filled button (ISO legacy _drawHubBtn lines 1213-1318) ──
function Game:_drawHubPrompt(g, wox, woy)
    local run = self.loop.state.run
    if not run then return end
    local quota = getQuota(run.round)
    local score = run.score
    local pressed = self._spinning or self._postSpinShow
    local hover = self._hubHover and not pressed
    local t = self._time
    local tilt = self.wheel:getTilt()
    local r = self.wheel:getHubRadius()
    local cx = WHEEL_CX + wox
    local cy = WHEEL_CY + woy
    local quotaReached = pressed and score >= quota
    local font = self._font
    local atlas = self._atlas

    g:push()
    g:translate(cx, cy)
    g:scale(1, tilt)

    -- Raise: -2 default, -4 hover, flush when pressed (ISO legacy line 1228)
    if not pressed then
        g:translate(0, hover and -4 or -2)
    end

    -- Fill (blinks gold/darkGold at 4Hz when quota reached during spin)
    if quotaReached then
        local fc = math.sin(t * 8 * math.pi) > 0 and PAL.gold or PAL.darkGold
        g:setColor(fc[1], fc[2], fc[3], 1)
    else
        g:setColor(PAL.gold[1], PAL.gold[2], PAL.gold[3], 1)
    end
    g:circle('fill', 0, 0, r)

    -- Hover brighten (subtle white overlay)
    if hover then
        g:setColor(PAL.white[1], PAL.white[2], PAL.white[3], 0.15)
        g:circle('fill', 0, 0, r)
    end

    -- Glass sweep (idle only — periodic 3.5s + hover triggered, ISO legacy lines 1251-1271)
    if not pressed then
        local SWEEP_INTERVAL = 3.5
        local SWEEP_DUR = 0.25
        local periodicT = t % SWEEP_INTERVAL
        local hoverT = t - self._sweepTrigger
        local sweepProgress = -1
        if periodicT < SWEEP_DUR then
            sweepProgress = periodicT / SWEEP_DUR
        elseif hoverT >= 0 and hoverT < SWEEP_DUR then
            sweepProgress = hoverT / SWEEP_DUR
        end
        if sweepProgress >= 0 then
            g:clipCircle(0, 0, r - 2)
            g:setColor(PAL.white[1], PAL.white[2], PAL.white[3], 0.65)
            local sx = -r + sweepProgress * r * 2
            for dy = -r, r do
                g:rect('fill', math.floor(sx + dy * 0.4), dy, 3, 1)
            end
            g:unclip()
        end
    end

    -- Pressed overlay (darken, only if quota NOT yet reached)
    if pressed and not quotaReached then
        g:setColor(PAL.black[1], PAL.black[2], PAL.black[3], 0.3)
        g:circle('fill', 0, 0, r)
    end

    -- Labels
    if pressed then
        if quotaReached then
            -- Quota reached: score/quota + BONUS + surplus with coin (ISO legacy lines 1283-1294)
            font:drawCentered(score .. '/' .. quota, 0, -math.floor(CH_H * 3), PAL.gold, 1, false)
            font:drawCentered('BONUS', 0, -math.floor(CH_H * 1), PAL.black, 1, false)
            local surplus = score - quota
            local bStr = '+' .. surplus
            local bW = #bStr * CH_W * 2
            local bY = math.floor(CH_H * 1.5)
            local bCoinW = SPRITE_SIZE * 2
            local bOx = math.floor(-(2 + bCoinW) / 2)
            font:drawCentered(bStr, bOx, bY, PAL.gold, 2)
            if atlas then
                g:setColor(1, 1, 1, 1)
                atlas:drawAnim('coin',
                    math.floor(bOx + bW / 2 + 2 + SPRITE_SIZE), bY + CH_H, 2, t, 8)
            end
        else
            -- During spin: score + coin (scale 2) + /quota below (ISO legacy lines 1296-1302)
            local sStr = tostring(score)
            local sW = #sStr * CH_W * 2
            local sY = -math.floor(CH_H * 1.5)
            font:drawCentered(sStr, 0, sY, PAL.gold, 2)
            if atlas then
                g:setColor(1, 1, 1, 1)
                atlas:drawAnim('coin',
                    math.floor(sW / 2 + 2 + SPRITE_SIZE), sY + CH_H, 2, t, 8)
            end
            font:drawCentered('/' .. quota, 0, math.floor(CH_H * 1.5), PAL.midGray, 2, false)
        end
    else
        if self.loop.state.phase ~= 'IDLE' then
            g:pop()
            return
        end
        -- Idle: SPIN (scale 2) + QUOTA + coin (ISO legacy lines 1305-1314)
        font:drawCentered('SPIN', 0, -math.floor(CH_H * 1.5), PAL.black, 2, false)
        local qStr = 'QUOTA ' .. quota
        local qW = #qStr * CH_W
        local qY = math.floor(CH_H * 0.5)
        local coinSz = SPRITE_SIZE
        local qGap = 1
        local qOx = math.floor(-(qGap + coinSz) / 2)
        font:drawCentered(qStr, qOx, qY, PAL.midGray, 1, false)
        if atlas then
            g:setColor(1, 1, 1, 1)
            atlas:drawAnim('coin',
                math.floor(qOx + qW / 2 + qGap + coinSz / 2) + 2,
                qY + math.floor(CH_H / 2) - 1, 1, t, 4)
        end
    end

    g:pop()
end

-- ── Game over hub (ISO legacy _drawGameOver lines 1320-1358) ──
function Game:_drawGameOverHub(g, wox, woy)
    local run = self.loop.state.run
    local tilt = self.wheel:getTilt()
    local r = self.wheel:getHubRadius()
    local cx = WHEEL_CX + wox
    local cy = WHEEL_CY + woy
    local hover = self._hubHover
    local font = self._font
    local atlas = self._atlas

    g:push()
    g:translate(cx, cy)
    g:scale(1, tilt)
    -- Hover raise (ISO legacy line 1329)
    g:translate(0, hover and -4 or -2)

    -- Dark red fill
    g:setColor(PAL.darkRed[1], PAL.darkRed[2], PAL.darkRed[3], 1)
    g:circle('fill', 0, 0, r)

    -- Hover brighten
    if hover then
        g:setColor(PAL.white[1], PAL.white[2], PAL.white[3], 0.1)
        g:circle('fill', 0, 0, r)
    end

    -- Skull sprite (scale 2, ISO legacy line 1346)
    if atlas then
        g:setColor(1, 1, 1, 1)
        atlas:drawCentered('skull', 0, -math.floor(r * 0.42), 1)
    end

    -- ROUND X (ISO legacy line 1349)
    if run then
        font:drawCentered('ROUND ' .. run.round, 0, -math.floor(CH_H * 0.4), PAL.lightGray, 1)
        font:drawCentered(run.score .. '/' .. getQuota(run.round),
            0, math.floor(CH_H * 0.8), PAL.red, 1, false)
    end

    -- Arrow right sprite (scale 3, ISO legacy line 1355)
    if atlas then
        g:setColor(1, 1, 1, 1)
        atlas:drawCentered('arrow_right', 0, math.floor(r * 0.35), 2)
    end

    -- RETRY (scale 2, ISO legacy line 1356)
    font:drawCentered('RETRY', 0, math.floor(r * 0.55), PAL.gold, 1)

    g:pop()
end

-- ── Catalogue overlay (ISO legacy _drawCatalogue lines 291-373) ──
function Game:_drawCatalogue(g)
    if not self._catalogueOpen then return end
    local font = self._font
    if not font then return end

    local TAB_NAMES = { 'UPGRADES', 'RELIQUES', 'BILLES SP.' }
    local TAB_DATA = { {}, {}, {} }
    for _, u in ipairs(WU_DATA) do
        TAB_DATA[1][#TAB_DATA[1] + 1] = { name = u.name, rarity = u.rarity, desc = u.description or '' }
    end
    for _, r in ipairs(RELICS_MOD.RELICS) do
        TAB_DATA[2][#TAB_DATA[2] + 1] = {
            name = r.name, sprite = 'relic_' .. r.rarity,
            rarity = r.rarity, desc = r.description or ''
        }
    end
    for _, c in ipairs(CHOICES_DATA) do
        if c.type == 'special_ball' then
            TAB_DATA[3][#TAB_DATA[3] + 1] = {
                name = c.name, sprite = 'ball',
                rarity = c.rarity, desc = c.description or ''
            }
        end
    end

    local PW, PH = 320, 200
    local PX0 = math.floor((W - PW) / 2)
    local PY0 = math.floor((H - PH) / 2)
    local TAB_H, HEAD_H, ROW_H = 14, 12, 10
    local BODY_Y = PY0 + TAB_H + HEAD_H
    local BODY_H = PH - TAB_H - HEAD_H - 6
    local MAX_ROWS = math.floor(BODY_H / ROW_H)

    -- Backdrop
    g:setColor(0, 0, 0, 0.82)
    g:rect('fill', PX0 - 2, PY0 - 2, PW + 4, PH + 4)
    g:setColor(PAL.black[1], PAL.black[2], PAL.black[3], 1)
    g:rect('fill', PX0, PY0, PW, PH)
    g:setColor(PAL.darkGold[1], PAL.darkGold[2], PAL.darkGold[3], 1)
    g:rect('line', PX0, PY0, PW, PH)

    -- Tabs
    local tabW = math.floor(PW / #TAB_NAMES)
    for t = 1, #TAB_NAMES do
        local tx = PX0 + (t - 1) * tabW
        if t - 1 == self._catalogueTab then
            g:setColor(PAL.darkRed[1], PAL.darkRed[2], PAL.darkRed[3], 1)
            g:rect('fill', tx, PY0, tabW, TAB_H)
        end
        g:setColor(PAL.darkGold[1], PAL.darkGold[2], PAL.darkGold[3], 1)
        g:rect('line', tx, PY0, tabW, TAB_H)
        local tc = (t - 1 == self._catalogueTab) and PAL.gold or PAL.midGray
        font:drawCentered(TAB_NAMES[t], tx + math.floor(tabW / 2), PY0 + 3, tc, 1)
    end

    -- Column header
    local hdrY = PY0 + TAB_H + 1
    font:draw('NOM', PX0 + 4, hdrY, PAL.gold, 1)
    font:draw('DESCRIPTION', PX0 + 100, hdrY, PAL.gold, 1)

    -- Rows
    local items = TAB_DATA[self._catalogueTab + 1] or {}
    local maxScroll = math.max(0, #items - MAX_ROWS)
    if self._catalogueScroll > maxScroll then self._catalogueScroll = maxScroll end
    local scroll = self._catalogueScroll

    for i = 1, math.min(MAX_ROWS, #items - scroll) do
        local it = items[scroll + i]
        local ry = BODY_Y + (i - 1) * ROW_H
        local col = (it.rarity and RARITY_COL[it.rarity]) or PAL.white
        if it.sprite and self._atlas then
            g:setColor(1, 1, 1, 1)
            self._atlas:drawCentered(it.sprite,
                PX0 + 4 + math.floor(SPRITE_SIZE / 2),
                ry + math.floor(ROW_H / 2), 1)
        end
        font:draw(it.name or '', PX0 + 4 + SPRITE_SIZE + 2, ry, col, 1)
        font:draw(it.desc or '', PX0 + 100, ry, PAL.midGray, 1)
    end

    -- Scrollbar
    if #items > MAX_ROWS then
        local pct = scroll / math.max(1, #items - MAX_ROWS)
        local sbH = math.max(8, math.floor(BODY_H * MAX_ROWS / #items))
        local sbY = BODY_Y + math.floor((BODY_H - sbH) * pct)
        g:setColor(PAL.darkGold[1], PAL.darkGold[2], PAL.darkGold[3], 1)
        g:rect('fill', PX0 + PW - 5, sbY, 3, sbH)
    end

    -- Close hint
    font:drawCentered('[ESC] FERMER', PX0 + math.floor(PW / 2), PY0 + PH - 9, PAL.darkGold, 1)

    -- Debug button below catalogue
    local dbtnW, dbtnH = 80, 12
    local dbtnX = PX0 + math.floor((PW - dbtnW) / 2)
    local dbtnY = PY0 + PH + 4
    g:setColor(PAL.midGray[1], PAL.midGray[2], PAL.midGray[3], 1)
    g:rect('fill', dbtnX, dbtnY, dbtnW, dbtnH)
    g:setColor(PAL.lightGray[1], PAL.lightGray[2], PAL.lightGray[3], 1)
    g:rect('line', dbtnX, dbtnY, dbtnW, dbtnH)
    font:drawCentered('DEBUG SPRITES', dbtnX + math.floor(dbtnW / 2), dbtnY + 2, PAL.white, 1)
end

function Game:_catalogueClick(x, y)
    local PW, PH = 320, 200
    local PX0 = math.floor((W - PW) / 2)
    local PY0 = math.floor((H - PH) / 2)
    local TAB_H = 14

    -- Debug button hit
    local dbtnW, dbtnH = 80, 12
    local dbtnX = PX0 + math.floor((PW - dbtnW) / 2)
    local dbtnY = PY0 + PH + 4
    if x >= dbtnX and x <= dbtnX + dbtnW and y >= dbtnY and y <= dbtnY + dbtnH then
        self:_closeCatalogue()
        self._debugSpritesOpen = true
        self._debugScroll = 0
        return
    end

    -- Outside panel → close
    if x < PX0 or x > PX0 + PW or y < PY0 or y > PY0 + PH then
        self:_closeCatalogue()
        return
    end

    -- Tab row click
    if y >= PY0 and y < PY0 + TAB_H then
        local tabW = math.floor(PW / 3)
        local t = math.floor((x - PX0) / tabW)
        if t >= 0 and t < 3 then
            self._catalogueTab = t
            self._catalogueScroll = 0
        end
    end
end

-- ── Debug sprites grid (ISO legacy _drawDebugSprites lines 411-487) ──
function Game:_getSpriteIds()
    if self._spriteIdsCache then return self._spriteIdsCache end
    local list = {}
    for id in pairs(spritesData.SPRITES or {}) do
        list[#list + 1] = { id = id, anim = false }
    end
    for id in pairs(spritesData.ANIM_SPRITES or {}) do
        list[#list + 1] = { id = id, anim = true }
    end
    table.sort(list, function(a, b)
        if a.anim ~= b.anim then return not a.anim end
        return a.id < b.id
    end)
    self._spriteIdsCache = list
    return list
end

function Game:_drawDebugSprites(g)
    if not self._debugSpritesOpen then return end
    local font = self._font
    local atlas = self._atlas
    if not font or not atlas then return end

    local allIds = self:_getSpriteIds()

    local PW, PH = 400, 230
    local PX0 = math.floor((W - PW) / 2)
    local PY0 = math.floor((H - PH) / 2)
    local CELL = 28
    local COLS = math.floor((PW - 8) / CELL)
    local ROWS = math.floor((PH - 20) / CELL)
    local maxScroll = math.max(0, math.ceil(#allIds / COLS) - ROWS)
    if self._debugScroll > maxScroll then self._debugScroll = maxScroll end

    -- Backdrop
    g:setColor(0, 0, 0, 0.88)
    g:rect('fill', PX0 - 2, PY0 - 2, PW + 4, PH + 4)
    g:setColor(PAL.black[1], PAL.black[2], PAL.black[3], 1)
    g:rect('fill', PX0, PY0, PW, PH)
    g:setColor(PAL.midGray[1], PAL.midGray[2], PAL.midGray[3], 1)
    g:rect('line', PX0, PY0, PW, PH)

    -- Title
    font:drawCentered('DEBUG SPRITES (' .. #allIds .. ')',
        PX0 + math.floor(PW / 2), PY0 + 3, PAL.white, 1)

    -- Grid
    local gridY0 = PY0 + 14
    love.graphics.setScissor(PX0, gridY0, PW, PH - 20)

    for i, entry in ipairs(allIds) do
        local row = math.floor((i - 1) / COLS) - self._debugScroll
        local col = (i - 1) % COLS
        if row >= -1 and row <= ROWS then
            local ccx = PX0 + 6 + col * CELL + math.floor(CELL / 2)
            local ccy = gridY0 + row * CELL + math.floor(CELL / 2)

            -- Cell border
            g:setColor(PAL.midGray[1], PAL.midGray[2], PAL.midGray[3], 0.5)
            g:rect('line', ccx - math.floor(CELL / 2),
                ccy - math.floor(CELL / 2), CELL - 1, CELL - 1)

            -- Sprite
            g:setColor(1, 1, 1, 1)
            if entry.anim then
                atlas:drawAnim(entry.id, ccx, ccy - 3, 1, self._time, 8)
            else
                atlas:drawCentered(entry.id, ccx, ccy - 3, 1)
            end

            -- Label (truncated)
            local label = #entry.id > 5 and (entry.id:sub(1, 4) .. '.') or entry.id
            local lc = entry.anim and PAL.gold or PAL.darkGold
            font:drawCentered(label, ccx, ccy + 7, lc, 1)
        end
    end

    love.graphics.setScissor()

    -- Scrollbar
    if maxScroll > 0 then
        local sbTotalH = PH - 20
        local pct = self._debugScroll / maxScroll
        local sbH = math.max(8, math.floor(sbTotalH * ROWS / math.ceil(#allIds / COLS)))
        local sbY = gridY0 + math.floor((sbTotalH - sbH) * pct)
        g:setColor(PAL.midGray[1], PAL.midGray[2], PAL.midGray[3], 1)
        g:rect('fill', PX0 + PW - 5, sbY, 3, sbH)
    end

    font:drawCentered('[ESC] FERMER',
        PX0 + math.floor(PW / 2), PY0 + PH - 9, PAL.midGray, 1)
end

-- ── Relic tooltip (ISO legacy _drawRelicTooltip lines 1434-1517) ──
function Game:_drawRelicTooltip(g)
    if not self._relicHoverRarity then return end
    local font = self._font
    if not font then return end
    local run = self.loop.state.run
    if not run then return end

    local rarity = self._relicHoverRarity
    local RARITY_NAMES = {
        common = 'COMMUNE', uncommon = 'PEU COMMUNE',
        rare = 'RARE', legendary = 'LEGENDAIRE'
    }
    local col = RARITY_COL[rarity] or PAL.white
    local owned = {}
    for _, r in ipairs(run.relics or {}) do
        if r.rarity == rarity then owned[#owned + 1] = r end
    end

    local PAD = 4
    local HEADER_H = 12
    local PW = 200
    local ROW_H = 10

    local totalBodyH = (#owned == 0) and ROW_H or (#owned * (ROW_H + 2))
    local PH = HEADER_H + totalBodyH + PAD * 3
    local PX0 = math.floor((W - PW) / 2)
    local PY0 = WHEEL_CY - 60

    -- Backdrop
    g:setColor(0, 0, 0, 0.88)
    g:rect('fill', PX0 - 1, PY0 - 1, PW + 2, PH + 2)
    g:setColor(PAL.black[1], PAL.black[2], PAL.black[3], 1)
    g:rect('fill', PX0, PY0, PW, PH)
    g:setColor(col[1], col[2], col[3], 1)
    g:rect('line', PX0, PY0, PW, PH)

    -- Header
    font:drawCentered(RARITY_NAMES[rarity] or rarity:upper(),
        PX0 + math.floor(PW / 2), PY0 + PAD, col, 1)

    -- Relic list
    local curY = PY0 + PAD + HEADER_H
    if #owned == 0 then
        font:drawCentered('AUCUNE', PX0 + math.floor(PW / 2), curY, PAL.midGray, 1)
    else
        for _, r in ipairs(owned) do
            local def = RELICS_MOD.RELIC_MAP and RELICS_MOD.RELIC_MAP[r.id]
            local name = (def and def.name) or r.name or r.id
            local desc = (def and def.description) or r.description or ''
            if self._atlas then
                g:setColor(1, 1, 1, 1)
                self._atlas:drawCentered('relic_' .. rarity,
                    PX0 + PAD + math.floor(SPRITE_SIZE / 2),
                    curY + math.floor(ROW_H / 2), 1)
            end
            font:draw(name, PX0 + PAD + SPRITE_SIZE + 2, curY, col, 1)
            font:draw(desc, PX0 + 90, curY, PAL.midGray, 1)
            curY = curY + ROW_H + 2
        end
    end
end

-- ── Custom cursor ──────────────────────────────────────
function Game:_drawCursor(g)
    local mx, my = math.floor(self._mx), math.floor(self._my)
    local t = self._time

    if self._cursorHover then
        -- Pointer: gold diamond with pulsing ring
        local pulse = 0.7 + 0.3 * math.sin(t * 6)
        g:setColor(0.95, 0.75, 0.25, 0.35 * pulse)
        g:rect('fill', mx - 4, my - 1, 9, 3)
        g:rect('fill', mx - 1, my - 4, 3, 9)
        -- Core diamond (solid gold)
        g:setColor(0.98, 0.85, 0.35, 1)
        g:rect('fill', mx - 2, my, 5, 1)
        g:rect('fill', mx - 1, my - 1, 3, 3)
        g:rect('fill', mx, my - 2, 1, 5)
        -- Hot pixel (bright center)
        g:setColor(1, 1, 0.85, 1)
        g:rect('fill', mx, my, 1, 1)
        -- Dark outline for readability
        g:setColor(0.15, 0.08, 0.03, 0.9)
        g:rect('fill', mx - 3, my, 1, 1)
        g:rect('fill', mx + 3, my, 1, 1)
        g:rect('fill', mx, my - 3, 1, 1)
        g:rect('fill', mx, my + 3, 1, 1)
    else
        -- Normal: pixel arrow (top-left anchored)
        -- Dark outline
        g:setColor(0.05, 0.04, 0.08, 1)
        g:rect('fill', mx,     my,     1, 7)
        g:rect('fill', mx + 1, my + 1, 1, 6)
        g:rect('fill', mx + 2, my + 2, 1, 5)
        g:rect('fill', mx + 3, my + 3, 1, 3)
        g:rect('fill', mx + 4, my + 4, 1, 2)
        g:rect('fill', mx + 5, my + 5, 1, 1)
        g:rect('fill', mx + 1, my + 7, 1, 1)
        g:rect('fill', mx + 2, my + 7, 2, 1)
        -- Light fill
        g:setColor(0.94, 0.88, 0.65, 1)
        g:rect('fill', mx + 1, my + 1, 1, 5)
        g:rect('fill', mx + 2, my + 2, 1, 4)
        g:rect('fill', mx + 3, my + 3, 1, 2)
        -- Bright tip
        g:setColor(1, 1, 1, 1)
        g:rect('fill', mx + 1, my + 1, 1, 1)
    end
end

return Game
