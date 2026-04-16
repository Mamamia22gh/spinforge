--[[
    AudioBundle — 8-channel chiptune synth + SFX engine
    Port of ChiptuneEngine.js to Love2D
    
    ZERO dependencies on other bundles.
    
    Events listened:
        kernel.update           → advances BGM sequencer
        audio.sfx               → { name = "coin" }
        audio.tone              → { freq, duration, wave, vol }
        audio.play_song         → { song = songData }
        audio.stop_song         → {}
        audio.set_volume        → { master, bgm, sfx }
        audio.mute              → {}
        audio.unmute             → {}
    
    Events emitted:
        audio.ready             → {}
        audio.song_finished     → {}
]]

local Synth    = require("bundles.audio.synth")
local SFX      = require("bundles.audio.sfx")
local Sequencer = require("bundles.audio.sequencer")

local AudioBundle = {}
AudioBundle.__index = AudioBundle

function AudioBundle.new()
    return setmetatable({
        name = "audio",
        synth = nil,
        sequencer = nil,
        _masterVol = 0.5,
        _bgmVol = 0.6,
        _sfxVol = 0.8,
        _muted = false,
    }, AudioBundle)
end

function AudioBundle:register(kernel)
    -- nothing needed at registration
end

function AudioBundle:boot(kernel, cfg)
    self._masterVol = cfg.masterVolume or self._masterVol
    self._bgmVol    = cfg.bgmVolume    or self._bgmVol
    self._sfxVol    = cfg.sfxVolume    or self._sfxVol

    self.synth = Synth.new(cfg)
    self.sequencer = Sequencer.new(self.synth)

    kernel:on('kernel.update', function(d)
        if not self._muted then
            self.sequencer:update(d.dt)
        end
    end)

    kernel:on('audio.sfx', function(d)
        if self._muted then return end
        local vol = (d.vol or 1) * self._sfxVol * self._masterVol
        SFX.play(self.synth, d.name, vol)
    end)

    kernel:on('audio.tone', function(d)
        if self._muted then return end
        local vol = (d.vol or 0.06) * self._sfxVol * self._masterVol
        self.synth:playTone(d.freq, d.duration or 0.1, d.wave or 'square', vol)
    end)

    kernel:on('audio.play_song', function(d)
        self.sequencer:playSong(d.song, self._bgmVol * self._masterVol)
    end)

    kernel:on('audio.stop_song', function()
        self.sequencer:stop()
    end)

    kernel:on('audio.set_volume', function(d)
        if d.master then self._masterVol = math.max(0, math.min(1, d.master)) end
        if d.bgm then self._bgmVol = math.max(0, math.min(1, d.bgm)) end
        if d.sfx then self._sfxVol = math.max(0, math.min(1, d.sfx)) end
        self.sequencer:setVolume(self._bgmVol * self._masterVol)
    end)

    kernel:on('audio.mute', function()
        self._muted = true
        self.sequencer:setVolume(0)
    end)

    kernel:on('audio.unmute', function()
        self._muted = false
        self.sequencer:setVolume(self._bgmVol * self._masterVol)
    end)

    kernel:emit('audio.ready')
end

return AudioBundle
