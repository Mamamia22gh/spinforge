local C = require('src.objects.wheel.constants')
local PAL = C.PAL
local drawAnnularArc = C.drawAnnularArc
local TWO_PI = C.TWO_PI
local settingsSectStart = C.settingsSectStart

return function(PW)

function PW:setSettingsMode(active)
    self._settings.active = active and true or false
    if not active then
        self._settings.hoverId = nil
        self._settings.dragging = nil
    end
end
function PW:isSettingsMode() return self._settings.active end
function PW:setSettingsValues(master, bgm, sfx, fs)
    self._settings.masterVol = master
    self._settings.bgmVol = bgm
    self._settings.sfxVol = sfx
    self._settings.fullscreen = fs and true or false
end
function PW:settingsSetHover(id) self._settings.hoverId = id end
function PW:settingsSetDragging(id) self._settings.dragging = id end
function PW:settingsSetSlider(id, value)
    value = math.max(0, math.min(1, value))
    if id == 'master' then self._settings.masterVol = value
    elseif id == 'bgm' then self._settings.bgmVol = value
    elseif id == 'sfx' then self._settings.sfxVol = value end
end
function PW:settingsToggleFullscreen()
    self._settings.fullscreen = not self._settings.fullscreen
end
function PW:getSettingsValues()
    local s = self._settings
    return s.masterVol, s.bgmVol, s.sfxVol, s.fullscreen
end

function PW:settingsHitTest(x, y, cx, cy)
    if not self._settings.active or not self:isFlipped() then return nil end
    local TILT_Y = math.abs(self._tilt)
    if TILT_Y < 0.05 then return nil end
    local dx = x - cx
    local dy = (y - cy) / TILT_Y
    local dist = math.sqrt(dx*dx + dy*dy)
    local angle = math.atan2(dy, dx)

    if dist < self._hubR then return { type = 'close' } end
    local slotInner = self._hubR + 5
    local slotOuter = self._rimR - 3
    if dist < slotInner or dist > slotOuter then return nil end

    local IDS = { 'master', 'bgm', 'sfx' }
    for s = 1, C.SETTINGS_COUNT do
        local a0 = settingsSectStart(s)
        local a1 = a0 + C.SETTINGS_SECT_SPAN
        local a = angle
        while a < a0 - math.pi do a = a + TWO_PI end
        while a > a0 + math.pi do a = a - TWO_PI end
        if a >= a0 and a <= a1 then
            if s == 4 then
                return { type = 'toggle', id = 'fullscreen' }
            else
                local rel = a - a0
                local value = math.max(0, math.min(1, rel / C.SETTINGS_SECT_SPAN))
                return { type = 'slider', id = IDS[s], value = value }
            end
        end
    end
    return nil
end

function PW:_drawSettingsFace(g, font, atlas, cx, cy)
    local s = self._settings
    local t = self._time

    g:setColor(PAL.black[1], PAL.black[2], PAL.black[3], 1)
    g:circle('fill', cx, cy, self._rimR)

    for i = 0, 3 do
        local a = 0.08 - i * 0.015
        g:setColor(PAL.gold[1], PAL.gold[2], PAL.gold[3], a)
        g:circle('line', cx, cy, self._rimR - i)
    end

    local dotCount = 16
    for i = 0, dotCount - 1 do
        local ang = (i / dotCount) * TWO_PI + t * 0.15
        local dx = cx + math.cos(ang) * (self._rimR - 6)
        local dy = cy + math.sin(ang) * (self._rimR - 6)
        local pulse = 0.3 + 0.3 * math.sin(t * 2 + i * 0.4)
        g:setColor(PAL.darkGold[1], PAL.darkGold[2], PAL.darkGold[3], pulse)
        g:rect('fill', math.floor(dx), math.floor(dy), 1, 1)
    end

    local slotInner = self._hubR + 5
    local slotOuter = self._rimR - 3
    local slotMidR = (slotInner + slotOuter) / 2

    local SLIDERS = {
        { id = 'master', label = 'GENERAL', value = s.masterVol },
        { id = 'bgm',    label = 'MUSIQUE', value = s.bgmVol },
        { id = 'sfx',    label = 'EFFETS',  value = s.sfxVol },
    }

    for q = 1, 3 do
        local sl = SLIDERS[q]
        local a0 = settingsSectStart(q)
        local a1 = a0 + C.SETTINGS_SECT_SPAN
        local isHover = s.hoverId == sl.id
        local isDrag = s.dragging == sl.id

        g:setColor(PAL.darkGray[1], PAL.darkGray[2], PAL.darkGray[3], 0.55)
        drawAnnularArc(cx, cy, slotInner + 1, slotOuter - 1, a0, a1, 48)

        if sl.value > 0.005 then
            local fillEnd = a0 + C.SETTINGS_SECT_SPAN * sl.value
            local baseAlpha = (isHover or isDrag) and 0.95 or 0.75
            g:setColor(PAL.darkGold[1], PAL.darkGold[2], PAL.darkGold[3], baseAlpha)
            drawAnnularArc(cx, cy, slotInner + 1, slotOuter - 1, a0, fillEnd, 48)
            g:setColor(PAL.gold[1], PAL.gold[2], PAL.gold[3], baseAlpha)
            drawAnnularArc(cx, cy, slotMidR - 3, slotMidR + 3, a0, fillEnd, 48)
            if sl.value < 0.995 then
                local mc, ms = math.cos(fillEnd), math.sin(fillEnd)
                g:setColor(PAL.white[1], PAL.white[2], PAL.white[3], 1)
                love.graphics.setLineWidth(2)
                g:line(cx + mc*slotInner, cy + ms*slotInner, cx + mc*slotOuter, cy + ms*slotOuter)
                love.graphics.setLineWidth(1)
                g:setColor(PAL.white[1], PAL.white[2], PAL.white[3], 0.6 + 0.3 * math.sin(t * 6))
                g:circle('fill', cx + mc*slotMidR, cy + ms*slotMidR, 2)
            end
        end

        if isHover then
            g:setColor(PAL.white[1], PAL.white[2], PAL.white[3], 0.08)
            drawAnnularArc(cx, cy, slotInner, slotOuter, a0, a1, 48)
        end

        local borderCol = isHover and PAL.gold or PAL.midGray
        g:setColor(borderCol[1], borderCol[2], borderCol[3], 1)
        love.graphics.arc('line', 'open', cx, cy, slotOuter, a0, a1, 48)
        love.graphics.arc('line', 'open', cx, cy, slotInner, a0, a1, 48)
        local dc0, ds0 = math.cos(a0), math.sin(a0)
        local dc1, ds1 = math.cos(a1), math.sin(a1)
        g:line(cx + dc0*slotInner, cy + ds0*slotInner, cx + dc0*slotOuter, cy + ds0*slotOuter)
        g:line(cx + dc1*slotInner, cy + ds1*slotInner, cx + dc1*slotOuter, cy + ds1*slotOuter)

        local mid = a0 + C.SETTINGS_SECT_SPAN / 2
        local lx = math.floor(cx + math.cos(mid) * slotMidR)
        local ly = math.floor(cy + math.sin(mid) * slotMidR)
        local textCol = isHover and PAL.white or PAL.lightGray
        font:drawCentered(sl.label, lx, ly - 6, textCol, 1)
        font:drawCentered(math.floor(sl.value * 100) .. '%', lx, ly + 3, PAL.gold, 1)
    end

    do
        local a0 = settingsSectStart(4)
        local a1 = a0 + C.SETTINGS_SECT_SPAN
        local isHover = s.hoverId == 'fullscreen'

        g:setColor(PAL.darkGray[1], PAL.darkGray[2], PAL.darkGray[3], 0.55)
        drawAnnularArc(cx, cy, slotInner + 1, slotOuter - 1, a0, a1, 48)

        if s.fullscreen then
            g:setColor(PAL.darkGreen[1], PAL.darkGreen[2], PAL.darkGreen[3], 0.9)
            drawAnnularArc(cx, cy, slotInner + 1, slotOuter - 1, a0, a1, 48)
            g:setColor(PAL.green[1], PAL.green[2], PAL.green[3], 0.85)
            drawAnnularArc(cx, cy, slotMidR - 3, slotMidR + 3, a0, a1, 48)
        end

        if isHover then
            g:setColor(PAL.white[1], PAL.white[2], PAL.white[3], 0.1)
            drawAnnularArc(cx, cy, slotInner, slotOuter, a0, a1, 48)
        end

        local borderCol = isHover and PAL.gold or (s.fullscreen and PAL.green or PAL.midGray)
        g:setColor(borderCol[1], borderCol[2], borderCol[3], 1)
        love.graphics.arc('line', 'open', cx, cy, slotOuter, a0, a1, 48)
        love.graphics.arc('line', 'open', cx, cy, slotInner, a0, a1, 48)
        local dc0, ds0 = math.cos(a0), math.sin(a0)
        local dc1, ds1 = math.cos(a1), math.sin(a1)
        g:line(cx + dc0*slotInner, cy + ds0*slotInner, cx + dc0*slotOuter, cy + ds0*slotOuter)
        g:line(cx + dc1*slotInner, cy + ds1*slotInner, cx + dc1*slotOuter, cy + ds1*slotOuter)

        local mid = a0 + C.SETTINGS_SECT_SPAN / 2
        local lx = math.floor(cx + math.cos(mid) * slotMidR)
        local ly = math.floor(cy + math.sin(mid) * slotMidR)
        font:drawCentered('PLEIN', lx, ly - 10, isHover and PAL.white or PAL.lightGray, 1)
        font:drawCentered('ECRAN', lx, ly - 2, isHover and PAL.white or PAL.lightGray, 1)
        local stateStr = s.fullscreen and '[ON]' or '[OFF]'
        local stateCol = s.fullscreen and PAL.green or PAL.red
        font:drawCentered(stateStr, lx, ly + 7, stateCol, 1)
    end

    local closeHover = s.hoverId == 'close'
    local pulse = 0.5 + 0.2 * math.sin(t * 3)
    g:setColor(PAL.darkGray[1], PAL.darkGray[2], PAL.darkGray[3], closeHover and 0.9 or 0.6)
    g:circle('fill', cx, cy, self._hubR - 1)
    g:setColor(PAL.gold[1], PAL.gold[2], PAL.gold[3], closeHover and 0.35 or pulse * 0.25)
    g:circle('line', cx, cy, self._hubR - 3)
    g:setColor(PAL.gold[1], PAL.gold[2], PAL.gold[3], closeHover and 0.25 or pulse * 0.15)
    g:circle('line', cx, cy, self._hubR - 6)
    local borderCol = closeHover and PAL.gold or PAL.midGray
    g:setColor(borderCol[1], borderCol[2], borderCol[3], 1)
    g:circle('line', cx, cy, self._hubR - 1)
    if atlas then
        g:setColor(1, 1, 1, 1)
        atlas:drawCentered('gear', math.floor(cx), math.floor(cy - 3), 2)
    end
    font:drawCentered('RETOUR', math.floor(cx), math.floor(cy + 8),
        closeHover and PAL.gold or PAL.lightGray, 1)
end

end
