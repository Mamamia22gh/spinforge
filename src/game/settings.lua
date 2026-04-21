local Save = require('src.save')
local PAL = require('src.palette')

return function(Game)

function Game:_applySettings(saveNow)
    local meta = self.loop.state.meta
    meta.settings = meta.settings or {}
    local m, b, sx, fs = self.wheel:getSettingsValues()
    meta.settings.masterVol = m
    meta.settings.bgmVol = b
    meta.settings.sfxVol = sx
    meta.settings.fullscreen = fs
    meta.settings.theme = PAL.getTheme()
    self._kernel:emit('audio.set_volume', { master = m, bgm = b, sfx = sx })
    if love.window.getFullscreen() ~= fs then love.window.setFullscreen(fs, 'desktop') end
    if saveNow then Save.save(meta) end
end

function Game:_openSettings()
    if self._inSettings then return end
    if self.loop.state.phase ~= 'IDLE' then return end
    if self.wheel._flip then return end
    self._inSettings = true
    self._settingsHover = nil
    self._settingsDrag = nil
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
    self._settingsDrag = nil
    self:_applySettings(true)
    self.wheel:setSettingsMode(false)
    if self.wheel:isFlipped() then self.wheel:startFlip(0.5) end
end

end
