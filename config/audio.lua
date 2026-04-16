--[[
    Audio bundle configuration
]]
return {
    masterVolume = 0.5,
    bgmVolume    = 0.6,
    sfxVolume    = 0.8,

    -- Synth settings
    sampleRate = 44100,

    -- Default ADSR envelope
    envelope = { a = 0.005, d = 0.08, s = 0.6, r = 0.06 },
}
