-- game/settings.lua — settings overlay on flipped wheel.

local Save = require('src.save')
local PAL = require('src.palette')

return function(Game)

function Game:_applySettings(saveNow)
    self._settings_cache = self._settings_cache or {}
    local s = self._settings_cache
    local m, b, sx, fs = self.wheel:getSettingsValues()
    s.masterVol = m
    s.bgmVol = b
    s.sfxVol = sx
    s.fullscreen = fs
    s.theme = PAL.getTheme()
    self._kernel:emit('audio.set_volume', { master = m, bgm = b, sfx = sx })
    if love.window.getFullscreen() ~= fs then love.window.setFullscreen(fs, 'desktop') end
    if saveNow then Save.save(self:_metaTable()) end
end

function Game:_openSettings()
    if self._inSettings then return end
    if self._phase ~= 'IDLE' then return end
    if self.wheel._flip then return end
    self._inSettings = true
    self._settingsHover = nil
    self._settingsDrag = nil
    local s = self._settings_cache or {}
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
    self._settingsDrag = nil
    self:_applySettings(true)
    self.wheel:setSettingsMode(false)
    if self.wheel:isFlipped() then self.wheel:startFlip(0.5) end
end

end
