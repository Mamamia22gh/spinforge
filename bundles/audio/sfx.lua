--[[
    SFX — preset one-shot sound effects
    Each preset generates and plays tones through the Synth.
    Pre-generates SoundData on first call, then caches.
]]

local Synth = require("bundles.audio.synth")
local noteToFreq = Synth.noteToFreq
local RATE = Synth.SAMPLE_RATE
local TAU = math.pi * 2

local _cache = {}

-- ── Helpers ─────────────────────────────────────────────────────────

local function genBuffer(duration, fn)
    local samples = math.ceil(duration * RATE)
    local sd = love.sound.newSoundData(samples, RATE, 16, 1)
    for i = 0, samples - 1 do
        local t = i / RATE
        sd:setSample(i, fn(t))
    end
    return sd
end

local function square(phase) return (phase % 1 < 0.5) and 1 or -1 end
local function tri(phase) return math.abs((phase % 1) * 4 - 2) - 1 end
local function sine(phase) return math.sin(phase * TAU) end

local function noiseAt(t)
    -- deterministic LFSR-ish
    local idx = math.floor(t * RATE)
    -- simple hash-based noise
    local x = idx * 1103515245 + 12345
    x = math.floor(x / 65536) % 32768
    return (x / 16384) - 1
end

local function lerp(a, b, t) return a + (b - a) * t end
local function clamp01(x) return math.max(0, math.min(1, x)) end

local function expDecay(t, start, target, duration)
    if t >= duration then return 0.001 end
    local k = -math.log(0.001 / start) / duration
    return start * math.exp(-k * t)
end

-- ── Preset generators ───────────────────────────────────────────────

local PRESETS = {}

function PRESETS.coin(vol)
    return genBuffer(0.2, function(t)
        local freq = t < 0.06 and 987.77 or 1318.51
        local gain = vol * 0.4 * clamp01(1 - t / 0.2) ^ 2
        return square(t * freq) * gain
    end)
end

function PRESETS.hit(vol)
    return genBuffer(0.1, function(t)
        local gain = vol * 0.5 * clamp01(1 - t / 0.08) ^ 2
        return noiseAt(t) * gain
    end)
end

function PRESETS.powerup(vol)
    return genBuffer(0.35, function(t)
        local freq = 200 * (1200/200) ^ (t / 0.25)
        if freq > 1200 then freq = 1200 end
        local gain = vol * 0.3 * clamp01(1 - t / 0.35) ^ 2
        return square(t * freq) * gain
    end)
end

function PRESETS.select(vol)
    return genBuffer(0.08, function(t)
        local gain = vol * 0.25 * clamp01(1 - t / 0.08) ^ 2
        return square(t * 660) * gain
    end)
end

function PRESETS.error(vol)
    return genBuffer(0.25, function(t)
        local freq = t < 0.1 and 200 or 150
        local gain = vol * 0.35 * clamp01(1 - t / 0.25) ^ 2
        return square(t * freq) * gain
    end)
end

function PRESETS.explosion(vol)
    return genBuffer(0.5, function(t)
        -- low sine sweep
        local freq = 150 * (20/150) ^ clamp01(t / 0.3)
        local s1 = sine(t * freq) * vol * 0.5 * clamp01(1 - t / 0.4) ^ 2
        -- noise layer
        local s2 = noiseAt(t) * vol * 0.4 * clamp01(1 - t / 0.5) ^ 2
        return s1 + s2
    end)
end

function PRESETS.spin(vol)
    return genBuffer(0.25, function(t)
        local freq
        if t < 0.12 then
            freq = 300 * (800/300) ^ (t / 0.12)
        else
            freq = 800 * (600/800) ^ ((t - 0.12) / 0.08)
        end
        local gain = vol * 0.25 * clamp01(1 - t / 0.25) ^ 2
        return tri(t * freq) * gain
    end)
end

function PRESETS.tick(vol)
    return genBuffer(0.03, function(t)
        local gain = vol * 0.15 * clamp01(1 - t / 0.03) ^ 2
        return square(t * 1200) * gain
    end)
end

function PRESETS.jackpot(vol)
    local notes = { 523.25, 659.25, 783.99, 1046.5 }
    return genBuffer(0.55, function(t)
        local out = 0
        for i, freq in ipairs(notes) do
            local offset = (i - 1) * 0.1
            local lt = t - offset
            if lt >= 0 and lt < 0.25 then
                local gain = vol * 0.3 * clamp01(1 - lt / 0.25) ^ 2
                out = out + square(t * freq) * gain
            end
        end
        return out
    end)
end

function PRESETS.gameover(vol)
    local notes = { 392, 349.23, 311.13, 261.63 }
    return genBuffer(1.0, function(t)
        local out = 0
        for i, freq in ipairs(notes) do
            local offset = (i - 1) * 0.2
            local lt = t - offset
            if lt >= 0 and lt < 0.4 then
                local gain = vol * 0.3 * clamp01(1 - lt / 0.4) ^ 2
                out = out + square(t * freq) * gain
            end
        end
        return out
    end)
end

function PRESETS.kick(vol)
    return genBuffer(0.15, function(t)
        local freq = 150 * (30/150) ^ clamp01(t / 0.1)
        local gain = vol * 0.5 * clamp01(1 - t / 0.15) ^ 2
        return sine(t * freq) * gain
    end)
end

function PRESETS.snare(vol)
    return genBuffer(0.13, function(t)
        local s1 = noiseAt(t) * vol * 0.35 * clamp01(1 - t / 0.12) ^ 2
        local freq = 180 * (80/180) ^ clamp01(t / 0.04)
        local s2 = tri(t * freq) * vol * 0.3 * clamp01(1 - t / 0.08) ^ 2
        return s1 + s2
    end)
end

function PRESETS.hihat(vol)
    return genBuffer(0.06, function(t)
        local gain = vol * 0.2 * clamp01(1 - t / 0.05) ^ 2
        return noiseAt(t * 3) * gain  -- higher pitch noise
    end)
end

function PRESETS.laser(vol)
    return genBuffer(0.2, function(t)
        local freq = 1500 * (100/1500) ^ clamp01(t / 0.15)
        local gain = vol * 0.25 * clamp01(1 - t / 0.2) ^ 2
        local p = t * freq
        return ((p % 1) * 2 - 1) * gain -- sawtooth
    end)
end

function PRESETS.jump(vol)
    return genBuffer(0.18, function(t)
        local freq
        if t < 0.08 then
            freq = 300 * (600/300) ^ (t / 0.08)
        else
            freq = 600 * (200/600) ^ ((t - 0.08) / 0.07)
        end
        local gain = vol * 0.25 * clamp01(1 - t / 0.18) ^ 2
        return square(t * freq) * gain
    end)
end

function PRESETS.levelup(vol)
    local notes = { 523.25, 659.25, 783.99, 1046.5, 1318.51 }
    return genBuffer(0.45, function(t)
        local out = 0
        for i, freq in ipairs(notes) do
            local offset = (i - 1) * 0.06
            local lt = t - offset
            if lt >= 0 and lt < 0.15 then
                local gain = vol * 0.25 * clamp01(1 - lt / 0.15) ^ 2
                out = out + square(t * freq) * gain
            end
        end
        return out
    end)
end

function PRESETS.purchase(vol)
    return genBuffer(0.2, function(t)
        local s1 = 0
        if t < 0.06 then
            s1 = tri(t * 1500) * vol * 0.2 * clamp01(1 - t / 0.06) ^ 2
        end
        local s2 = 0
        if t >= 0.05 then
            local lt = t - 0.05
            s2 = tri(t * 2500) * vol * 0.25 * clamp01(1 - lt / 0.15) ^ 2
        end
        return s1 + s2
    end)
end

-- ── Public API ──────────────────────────────────────────────────────

local SFX = {}

--- Play a named SFX preset.
function SFX.play(synth, name, vol)
    vol = vol or 0.5
    local key = name .. '_' .. tostring(math.floor(vol * 100))
    if not _cache[key] then
        local generator = PRESETS[name]
        if not generator then return end
        _cache[key] = generator(vol)
    end
    synth:playSound(_cache[key])
end

--- List available SFX names.
function SFX.list()
    local names = {}
    for k in pairs(PRESETS) do table.insert(names, k) end
    table.sort(names)
    return names
end

return SFX
