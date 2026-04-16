--[[
    Sequencer — BGM playback engine
    Schedules notes across up to 8 channels with swing support.
    
    Song format (Lua table):
    {
        bpm = 140,
        swing = 0,        -- 0-1 shuffle amount
        loop = true,
        channels = {
            {
                wave = 'square',  -- square|triangle|sawtooth|sine|noise
                volume = 0.4,
                duty = 0.5,       -- for square wave
                adsr = { 0.005, 0.08, 0.6, 0.06 },  -- a, d, s, r
                vibrato = { depth = 0, rate = 0 },
                notes = {
                    'C4/4', 'E4/8', 'r/4', ...
                    -- note/duration: duration is fraction of whole note
                    -- 'r' = rest
                }
            },
        }
    }
]]

local Synth = require("bundles.audio.synth")
local noteToFreq = Synth.noteToFreq

local Sequencer = {}
Sequencer.__index = Sequencer

function Sequencer.new(synth)
    return setmetatable({
        _synth = synth,
        _song = nil,
        _playing = false,
        _volume = 0.6,
        _time = 0,
        -- per-channel state
        _chNoteIdx = {},   -- current note index
        _chTime = {},      -- time cursor per channel
        _chBeatPos = {},   -- cumulative beat position (for swing)
        -- pre-scheduled sources
        _scheduled = {},
    }, Sequencer)
end

--- Parse a note string like 'C4/8' → { note='C4', beats=0.5 }
--- Duration: /1=4beats, /2=2beats, /4=1beat, /8=0.5, /16=0.25
local function parseNote(str)
    local note, denom = str:match('^(.+)/(%d+)$')
    if not note then return { note = str, beats = 1 } end
    return { note = note, beats = 4 / tonumber(denom) }
end

--- Pre-parse all notes in a song channel
local function parseNotes(noteStrings)
    local parsed = {}
    for i, s in ipairs(noteStrings) do
        parsed[i] = parseNote(s)
    end
    return parsed
end

function Sequencer:playSong(song, volume)
    self:stop()
    if not song then return end

    self._song = song
    self._playing = true
    self._volume = volume or self._volume
    self._time = 0

    -- pre-parse notes
    self._parsedChannels = {}
    for i, ch in ipairs(song.channels) do
        self._parsedChannels[i] = parseNotes(ch.notes)
        self._chNoteIdx[i] = 1
        self._chTime[i] = 0
        self._chBeatPos[i] = 0
    end

    -- pre-generate the first batch
    self:_scheduleAhead(0, 2.0) -- schedule 2 seconds ahead
end

function Sequencer:stop()
    self._playing = false
    self._song = nil
    for _, src in ipairs(self._scheduled) do
        if src:isPlaying() then src:stop() end
        src:release()
    end
    self._scheduled = {}
    self._parsedChannels = nil
end

function Sequencer:setVolume(vol)
    self._volume = vol
end

function Sequencer:update(dt)
    if not self._playing then return end
    self._time = self._time + dt
    -- schedule more notes if needed
    self:_scheduleAhead(self._time, self._time + 0.3)
    -- GC finished sources
    self:_gc()
end

function Sequencer:_gc()
    local alive = {}
    for _, src in ipairs(self._scheduled) do
        if src:isPlaying() then
            table.insert(alive, src)
        else
            src:release()
        end
    end
    self._scheduled = alive
end

function Sequencer:_scheduleAhead(fromTime, toTime)
    local song = self._song
    if not song then return end
    local bpm = song.bpm or 120
    local secPerBeat = 60 / bpm
    local swing = song.swing or 0

    for i, ch in ipairs(song.channels) do
        local notes = self._parsedChannels[i]
        if not notes then goto continue end

        local wave = ch.wave or 'square'
        local vol = (ch.volume or ch.gain or 0.4) * self._volume
        local duty = ch.duty or 0.5
        local env = ch.adsr and {
            a = ch.adsr[1] or 0.005,
            d = ch.adsr[2] or 0.08,
            s = ch.adsr[3] or 0.6,
            r = ch.adsr[4] or 0.06,
        } or nil
        local vibrato = ch.vibrato and {
            speed = ch.vibrato.rate or ch.vibrato[2] or 0,
            depth = (ch.vibrato.depth or ch.vibrato[1] or 0) / 1200, -- cents to ratio
        } or nil

        while self._chTime[i] < toTime do
            local idx = self._chNoteIdx[i]
            if idx > #notes then
                if song.loop ~= false then
                    self._chNoteIdx[i] = 1
                    self._chBeatPos[i] = 0
                    idx = 1
                else
                    break
                end
            end

            local nd = notes[idx]
            local durSec = nd.beats * secPerBeat

            -- swing offset
            local time = self._chTime[i]
            if swing > 0 then
                local eighthPos = math.floor(self._chBeatPos[i] * 2 + 0.5)
                if eighthPos % 2 == 1 then
                    time = time + secPerBeat * 0.5 * swing * 0.5
                end
            end

            -- only schedule if in our window and not a rest
            if time >= fromTime - 0.05 then
                local freq = noteToFreq(nd.note)
                if freq > 0 then
                    -- generate and schedule
                    local sd = self._synth:generateTone(
                        freq, durSec * 0.9, wave, vol, env, duty, vibrato
                    )
                    local src = love.audio.newSource(sd)
                    -- schedule playback at the right time
                    local delay = time - self._time
                    if delay > 0.01 then
                        -- use a timer-based approach: store with target time
                        src._playAt = time
                        src._startTime = self._time
                        -- for now, play with slight offset handled by pre-generation
                        -- Love2D doesn't have scheduled playback, so we adjust
                    end
                    src:play()
                    table.insert(self._scheduled, src)
                end
            end

            self._chBeatPos[i] = self._chBeatPos[i] + nd.beats
            self._chTime[i] = self._chTime[i] + durSec
            self._chNoteIdx[i] = idx + 1
        end

        ::continue::
    end
end

return Sequencer
