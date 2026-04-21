local Save = require('src.save')
local balMod = require('src.data.balance')
local getQuota = balMod.getQuota
local C = require('src.game.constants')
local PAL = C.PAL

return function(Game)

function Game:_bindLoopEvents()
    self.loop.events:on('phase:changed', function(d)
        local phase = d.phase
        if self._inSettings then
            self._inSettings = false
            self.wheel:setSettingsMode(false)
        end
        self._spinning = (phase == 'SPINNING')
        self._postSpinShow = false
        if phase == 'SPINNING' then self._revealIdx = 0 end
        if phase ~= 'SPINNING' then self.wheel:setBonusMode(false) end

        if phase == 'SHOP' then
            self._inShop = true
            if self.wheel and not self.wheel:isFlipped() then self.wheel:startFlip(0.5) end
        else
            if self._inShop and self.wheel and self.wheel:isFlipped() then self.wheel:startFlip(0.5) end
            self._inShop = false
        end

        local Songs = require('src.data.songs')
        local songMap = {
            IDLE = Songs.MAIN, SPINNING = Songs.MAIN, RESULTS = Songs.MAIN,
            SHOP = Songs.SHOP, GAME_OVER = Songs.GAME_OVER, VICTORY = Songs.VICTORY,
        }
        local nextSong = songMap[phase]
        if nextSong ~= self._currentSong then
            if nextSong then self._kernel:emit('audio.play_song', { song = nextSong })
            else self._kernel:emit('audio.stop_song') end
            self._currentSong = nextSong
        end

        if phase == 'CHOICE' then self.loop:skipChoice(); return end
        self:_switchScene(phase)
    end)

    self.loop.events:on('run:started',   function() self:_syncWheel() end)
    self.loop.events:on('round:preview', function() self:_syncWheel() end)

    self.loop.events:on('ball:resolved', function(d)
        self._kernel:emit('audio.sfx', { name = d.isGold and 'jackpot' or 'coin' })
        local revNotes = { 523, 587, 659, 784, 880, 1047 }
        self._revealIdx = (self._revealIdx or 0) + 1
        local f = revNotes[math.min(self._revealIdx, #revNotes)]
        self._kernel:emit('audio.tone', { freq = f, duration = 0.2, wave = 'square', vol = 0.08 })
        self._kernel:emit('audio.tone', { freq = f * 1.5, duration = 0.15, wave = 'sine', vol = 0.04 })
        self.wheel:hubSetScore(d.score)
        if d.result and d.result.symbol then
            self.wheel:hubShowValue(d.result.symbol.id, d.value)
        end
        local popX, popY
        if d.segmentIndex then
            self.wheel:highlight(d.segmentIndex)
            local px, py = self.wheel:getPocketPosition(d.segmentIndex, C.WHEEL_CX, C.WHEEL_CY)
            if px then
                popX, popY = px, py - 15
                self.wheel:startGoldFly('+' .. (d.value or 0), d.value or 0, px, py - 15, C.WHEEL_CX, C.WHEEL_CY)
                if d.result and d.result.ticketsEarned and d.result.ticketsEarned > 0 then
                    self.wheel:startTicketFly('+' .. d.result.ticketsEarned, d.result.ticketsEarned,
                        px, py - 15, C.WHEEL_CX, C.WHEEL_CY)
                end
            end
        end
        self:_pop('+' .. (d.value or 0), popX, popY)
        self:_shakeStart(1.5, 0.2)

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
        self._kernel:emit('audio.tone', { freq = 880, duration = 0.10, wave = 'square', vol = 0.07 })
        self._kernel:emit('audio.tone', { freq = 1175, duration = 0.10, wave = 'square', vol = 0.07 })
        self._kernel:emit('audio.tone', { freq = 1760, duration = 0.18, wave = 'sine', vol = 0.09 })
        self:_pop('BOUGHT!', nil, nil, { color = PAL.gold, noCoin = true })
    end)
end

end
