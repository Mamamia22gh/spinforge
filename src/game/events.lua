-- game/events.lua — process Rust front events + event queue system.

local C = require('src.game.constants')
local PAL = C.PAL
local Songs = require('src.data.songs')

return function(Game)

function Game:_queueEvent(ev)
    self._eventQueue[#self._eventQueue + 1] = ev
end

function Game:_processEventQueue(dt)
    local i = 1
    while i <= #self._eventQueue do
        local ev = self._eventQueue[i]
        if ev.delay then
            ev.delay = ev.delay - dt
            if ev.delay > 0 then
                if ev.blocking then break end
                i = i + 1
            else
                ev.delay = nil
            end
        end
        if not ev.delay then
            local done = ev.func(ev, dt)
            if done then
                table.remove(self._eventQueue, i)
            else
                if ev.blocking ~= false then break end
                i = i + 1
            end
        end
    end
end

function Game:_playSongForPhase(phase)
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
end

end
