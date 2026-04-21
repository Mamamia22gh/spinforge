local C = require('src.objects.wheel.constants')
local PAL = C.PAL
local drawAnnularArc = C.drawAnnularArc
local TWO_PI = C.TWO_PI

return function(PW)

function PW:draw(g, font, atlas, cx, cy, pox, poy, layers)
    pox = pox or 0; poy = poy or 0
    local data = self._data
    if #data == 0 then return end
    local tw = 0
    for _, s in ipairs(data) do tw = tw + s.weight end

    local TILT_Y = math.abs(self._tilt)
    self._frameLights = {}

    if TILT_Y < 0.01 then
        self:_drawGauges(g, font, atlas, cx + pox, cy + poy)
        return
    end

    g:push()
    g:translate(cx, cy)
    g:scale(1, TILT_Y)
    g:translate(-cx, -cy)

    if self._tilt < 0 then
        if self._settings.active then
            self:_drawSettingsFace(g, font, atlas, cx, cy)
        else
            self:_drawForgeFace(g, font, atlas, cx, cy)
        end
        g:pop()
        if not self._settings.active then
            self:_drawGauges(g, font, atlas, cx + pox, cy + poy)
            self:_drawOrbitSlots(g, font, atlas, cx + pox, cy + poy)
        end
        return
    end

    local isIdle = math.abs(self._angVel) < 0.1 and #self._highlights == 0
    local allSettled = true
    for _, b in ipairs(self._balls) do if not b.settled then allSettled = false; break end end
    isIdle = isIdle and allSettled

    local showChase = isIdle or self._bonusMode
    local chaseTrail = self._bonusMode and 6 or 4
    local chaseSpeed = self._bonusMode and 18 or 6
    local chasePos = self._time * chaseSpeed
    local chaseIdx = math.floor(chasePos) % #data

    local RAINBOW = {PAL.red, PAL.gold, PAL.green, PAL.blue, PAL.purple, PAL.neonPink}
    local pkOx = layers and layers.pocketX or 0
    local pkOy = layers and layers.pocketY or 0
    g:push()
    g:translate(cx + pkOx, cy + pkOy)
    g:rotate(self._angle)

    local off = 0
    for i = 1, #data do
        local seg = data[i]
        local angle = (seg.weight / tw) * TWO_PI
        local mid = off + angle / 2

        local isGold = false
        for _, gp in ipairs(self._goldPockets) do
            if gp == i-1 then isGold = true; break end
        end

        local dark = (i-1) % 2 == 0
        local fillColor = isGold and PAL.darkGold or (dark and C.SEG_A or C.SEG_B)
        g:setColor(fillColor[1], fillColor[2], fillColor[3], fillColor[4])
        drawAnnularArc(0, 0, self._pocketInner, self._pocketOuter, off, off + angle, 32)

        local hl = nil
        for _, h in ipairs(self._highlights) do
            if h.idx == i-1 then hl = h; break end
        end
        if hl then
            local hlColor = isGold and PAL.gold or PAL.white
            local a
            if hl.t < 0.15 then a = 0.9
            elseif hl.t < 0.4 then a = 0.7
            else a = math.max(0, 1 - (hl.t - 0.4) / 1.1) * 0.5 end
            g:setColor(hlColor[1], hlColor[2], hlColor[3], a)
            drawAnnularArc(0, 0, self._pocketInner, self._pocketOuter, off, off + angle, 32)
            local worldA = self._angle + mid
            local hlR = (self._pocketInner + self._pocketOuter) / 2
            self._frameLights[#self._frameLights+1] = {
                x = (cx + pkOx) + math.cos(worldA) * hlR,
                y = (cy + pkOy) + math.sin(worldA) * hlR * TILT_Y,
                r = 25, color = hlColor, a = math.max(0, 1 - hl.t/1.5) * 0.35,
            }
        elseif showChase then
            for t = 0, chaseTrail - 1 do
                local ti = (chaseIdx - t) % #data
                if ti < 0 then ti = ti + #data end
                if ti == i-1 then
                    local hlColor
                    if self._bonusMode then
                        hlColor = RAINBOW[((math.floor(chasePos) + t) % #RAINBOW) + 1]
                    else
                        hlColor = isGold and PAL.gold or PAL.white
                    end
                    local fade = 1 - t / chaseTrail
                    g:setColor(hlColor[1], hlColor[2], hlColor[3], 0.35 * fade * fade)
                    drawAnnularArc(0, 0, self._pocketInner, self._pocketOuter, off, off + angle, 32)
                    if t == 0 then
                        local worldA = self._angle + mid
                        local hlR2 = (self._pocketInner + self._pocketOuter) / 2
                        self._frameLights[#self._frameLights+1] = {
                            x = (cx + pkOx) + math.cos(worldA) * hlR2,
                            y = (cy + pkOy) + math.sin(worldA) * hlR2 * TILT_Y,
                            r = 18, color = hlColor, a = self._bonusMode and 0.3 or 0.2,
                        }
                    end
                end
            end
        end

        off = off + angle
    end
    g:pop()

    local lbOx = layers and layers.labelX or 0
    local lbOy = layers and layers.labelY or 0
    g:push()
    g:translate(cx + lbOx, cy + lbOy)
    g:rotate(self._angle)

    off = 0
    for i = 1, #data do
        local seg = data[i]
        local angle = (seg.weight / tw) * TWO_PI
        local dark = (i-1) % 2 == 0
        local ringColor = dark and PAL.darkRed or PAL.black
        g:setColor(ringColor[1], ringColor[2], ringColor[3], 1)
        drawAnnularArc(0, 0, self._labelInner, self._labelOuter, off, off + angle, 32)

        local lhl = nil
        for _, h in ipairs(self._highlights) do
            if h.idx == i-1 then lhl = h; break end
        end
        if lhl then
            local la
            if lhl.t < 0.15 then la = 0.9
            elseif lhl.t < 0.4 then la = 0.7
            else la = math.max(0, 1 - (lhl.t - 0.4) / 1.1) * 0.5 end
            g:setColor(PAL.white[1], PAL.white[2], PAL.white[3], la)
            drawAnnularArc(0, 0, self._labelInner, self._labelOuter, off, off + angle, 32)
        end

        g:setColor(C.DIVIDER_COLOR[1], C.DIVIDER_COLOR[2], C.DIVIDER_COLOR[3], 1)
        local dcos, dsin = math.cos(off), math.sin(off)
        g:line(dcos * self._pocketInner, dsin * self._pocketInner,
               dcos * self._labelOuter, dsin * self._labelOuter)
        off = off + angle
    end
    g:pop()

    local rmOx = layers and layers.rimX or 0
    local rmOy = layers and layers.rimY or 0
    g:setColor(C.RIM_COLOR[1], C.RIM_COLOR[2], C.RIM_COLOR[3], 1)
    g:circle('line', cx + rmOx, cy + rmOy, self._rimR)

    g:push()
    g:translate(cx, cy)
    g:rotate(self._angle)
    g:setColor(C.HUB_BG[1], C.HUB_BG[2], C.HUB_BG[3], 1)
    g:circle('fill', 0, 0, self._hubR)
    g:setColor(C.HUB_BORDER[1], C.HUB_BORDER[2], C.HUB_BORDER[3], 1)
    g:circle('line', 0, 0, self._hubR)
    self:_drawHubScreen(g, font, atlas, 0, 0)
    g:pop()

    for _, b in ipairs(self._balls) do
        if not b.settled then
            self._frameLights[#self._frameLights+1] = {
                x = cx + b.x, y = cy + b.y * self:getTilt(),
                r = 10, color = PAL.white, a = 0.12,
            }
        end
    end

    g:pop()
    self:_drawGauges(g, font, atlas, cx + pox, cy + poy)
    self:_drawOrbitSlots(g, font, atlas, cx + pox, cy + poy)
end

end
