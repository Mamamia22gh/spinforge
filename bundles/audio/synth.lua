--[[
    Synth — low-level tone generation via Love2D SoundData
    Generates waveforms: square (variable duty), triangle, sawtooth, sine, noise
    Applies ADSR envelopes, vibrato LFO
]]

local SAMPLE_RATE = 44100  -- default, overridden at boot via config
local TAU = math.pi * 2

-- ── Note frequency table ────────────────────────────────────────────
local NOTE_NAMES = { C=0, ['C#']=1, D=2, ['D#']=3, E=4, F=5, ['F#']=6, G=7, ['G#']=8, A=9, ['A#']=10, B=11 }
local _noteCache = {}

local function noteToFreq(note)
    if type(note) == 'number' then return note end
    if _noteCache[note] then return _noteCache[note] end
    if note == '__' or note == '..' or note == 'r' then return 0 end
    local name, oct = note:match('^([A-G]#?)(%d)$')
    if not name then return 0 end
    local semi = NOTE_NAMES[name]
    if not semi then return 0 end
    local freq = 440 * 2 ^ ((semi - 9) / 12 + (tonumber(oct) - 4))
    _noteCache[note] = freq
    return freq
end

-- ── LFSR noise buffer (cached) ──────────────────────────────────────
local _noiseBuffer
local function getNoiseBuffer()
    if _noiseBuffer then return _noiseBuffer end
    local len = SAMPLE_RATE * 2
    _noiseBuffer = {}
    local lfsr = 0x7FFF
    for i = 1, len do
        local bit = ((lfsr % 2) ~ (math.floor(lfsr / 2) % 2))
        lfsr = math.floor(lfsr / 2) + bit * 16384
        _noiseBuffer[i] = (lfsr % 2 == 1) and 1 or -1
    end
    return _noiseBuffer
end

-- ── Waveform generators (return sample -1..1) ───────────────────────
local function wavSquare(phase, duty)
    return (phase % 1.0) < duty and 1 or -1
end

local function wavTriangle(phase)
    local p = phase % 1.0
    return math.abs(p * 4 - 2) - 1
end

local function wavSawtooth(phase)
    return (phase % 1.0) * 2 - 1
end

local function wavSine(phase)
    return math.sin(phase * TAU)
end

local function wavNoise(phase)
    local buf = getNoiseBuffer()
    local idx = math.floor(phase * SAMPLE_RATE) % #buf + 1
    return buf[idx]
end

-- ── ADSR envelope ───────────────────────────────────────────────────
local DEFAULT_ENV = { a = 0.005, d = 0.08, s = 0.6, r = 0.06 }  -- default, overridden at boot via config

local function adsrAt(env, t, duration)
    local a, d, s, r = env.a, env.d, env.s, env.r
    if t < 0 then return 0 end
    if t < a then return t / a end
    t = t - a
    if t < d then return 1 - (1 - s) * (t / d) end
    t = t - d
    local sustainTime = duration - a - d
    if sustainTime < 0 then sustainTime = 0 end
    if t < sustainTime then return s end
    t = t - sustainTime
    if t < r then return s * (1 - t / r) end
    return 0
end

-- ── Synth class ─────────────────────────────────────────────────────
local Synth = {}
Synth.__index = Synth

function Synth.new(cfg)
    cfg = cfg or {}
    if cfg.sampleRate then SAMPLE_RATE = cfg.sampleRate end
    if cfg.envelope then DEFAULT_ENV = cfg.envelope end
    return setmetatable({
        _sources = {},  -- active love.audio Sources for GC
    }, Synth)
end

--- Generate a SoundData for a single note/tone with envelope + vibrato.
--- @param freq number Hz
--- @param duration number seconds
--- @param wave string 'square'|'triangle'|'sawtooth'|'sine'|'noise'
--- @param vol number 0-1
--- @param env table {a,d,s,r} or nil for defaults
--- @param duty number 0-1 for square wave duty cycle (default 0.5)
--- @param vibrato table {speed, depth} or nil
--- @return love.SoundData
function Synth:generateTone(freq, duration, wave, vol, env, duty, vibrato)
    env = env or DEFAULT_ENV
    duty = duty or 0.5
    vol = vol or 0.5
    local totalDur = duration + (env.r or 0.06) + 0.01
    local samples = math.ceil(totalDur * SAMPLE_RATE)
    local sd = love.sound.newSoundData(samples, SAMPLE_RATE, 16, 1)

    local waveFn
    if wave == 'triangle' then waveFn = wavTriangle
    elseif wave == 'sawtooth' then waveFn = wavSawtooth
    elseif wave == 'sine' then waveFn = wavSine
    elseif wave == 'noise' then waveFn = wavNoise
    else waveFn = nil -- square handled inline for duty
    end

    local vSpeed = vibrato and vibrato.speed or 0
    local vDepth = vibrato and vibrato.depth or 0

    for i = 0, samples - 1 do
        local t = i / SAMPLE_RATE
        local envVal = adsrAt(env, t, duration) * vol

        -- vibrato modulates frequency
        local f = freq
        if vSpeed > 0 and vDepth > 0 then
            f = freq * (1 + math.sin(t * vSpeed * TAU) * vDepth)
        end

        local sample
        if waveFn then
            if wave == 'noise' then
                sample = wavNoise(t * f / 440) * envVal
            else
                sample = waveFn(t * f) * envVal
            end
        else
            -- square with variable duty
            sample = wavSquare(t * f, duty) * envVal
        end

        sd:setSample(i, sample)
    end

    return sd
end

--- Play a one-shot tone immediately.
function Synth:playTone(freq, duration, wave, vol, env, duty, vibrato)
    if freq <= 0 then return end
    local sd = self:generateTone(freq, duration, wave, vol, env, duty, vibrato)
    local source = love.audio.newSource(sd)
    source:play()
    -- track for GC
    table.insert(self._sources, source)
    self:_gc()
    return source
end

--- Play a pre-generated SoundData.
function Synth:playSound(soundData, vol)
    local source = love.audio.newSource(soundData)
    if vol then source:setVolume(vol) end
    source:play()
    table.insert(self._sources, source)
    self:_gc()
    return source
end

--- Cleanup finished sources
function Synth:_gc()
    local alive = {}
    for _, s in ipairs(self._sources) do
        if s:isPlaying() then
            table.insert(alive, s)
        else
            s:release()
        end
    end
    self._sources = alive
end

--- Stop all playing sources
function Synth:stopAll()
    for _, s in ipairs(self._sources) do
        s:stop()
        s:release()
    end
    self._sources = {}
end

-- Export noteToFreq for sequencer
Synth.noteToFreq = noteToFreq
Synth.DEFAULT_ENV = DEFAULT_ENV
Synth.SAMPLE_RATE = SAMPLE_RATE

return Synth
