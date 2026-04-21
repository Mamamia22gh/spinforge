local C = require('src.objects.wheel.constants')
local PAL = C.PAL
local drawAnnularArc = C.drawAnnularArc
local GAUGE_CONFIGS = C.GAUGE_CONFIGS

return function(PW)

function PW:_drawGauges(g, font, atlas, cx, cy)
    for gi = 1, #GAUGE_CONFIGS do
        if gi == 3 then self:_drawRimCounters(g, font, atlas, cx, cy)
        elseif gi == 2 then self:_drawRelicBar(g, font, atlas, cx, cy)
        elseif gi == 4 then self:_drawCorruptionGauge(g, font, atlas, cx, cy, GAUGE_CONFIGS[gi])
        else self:_drawOneGauge(g, font, atlas, cx, cy, gi) end
    end
end

function PW:_drawSellButton(g, font, cx, cy, cfg, label, key)
    if not self:isFlipped() then return end
    local OUTER = self._rimR + 21
    local btnR = OUTER + 8
    local midA = (cfg.start + cfg.eend) / 2
    local bx = math.floor(cx + math.cos(midA) * btnR)
    local by = math.floor(cy + math.sin(midA) * btnR)
    local tw = font:measure(label)
    local hw, hh = math.floor(tw / 2) + 3, 5
    local isHover = self._shop.sellHover == key
    local bgA = isHover and 0.7 or 0.4
    g:setColor(0.15, 0.0, 0.0, bgA)
    g:rect('fill', bx - hw, by - hh, hw * 2, hh * 2)
    local borderCol = isHover and PAL.red or PAL.midGray
    g:setColor(borderCol[1], borderCol[2], borderCol[3], 1)
    g:rect('line', bx - hw, by - hh, hw * 2, hh * 2)
    local txtCol = isHover and PAL.white or PAL.lightGray
    font:drawCentered(label, bx, by - 3, txtCol, 1)
    if not self._sellBtnRects then self._sellBtnRects = {} end
    self._sellBtnRects[key] = { x = bx - hw, y = by - hh, w = hw * 2, h = hh * 2 }
end

function PW:_drawOneGauge(g, font, atlas, cx, cy, gaugeIdx)
    local cfg = GAUGE_CONFIGS[gaugeIdx]
    local unlocked = self._gaugeUnlocks[gaugeIdx]
    local INNER = self._rimR + 16
    local OUTER = self._rimR + 21

    local fillColor = unlocked and C.SEG_B or PAL.black
    g:setColor(fillColor[1], fillColor[2], fillColor[3], 1)
    drawAnnularArc(cx, cy, INNER, OUTER, cfg.start, cfg.eend, 32)

    local borderCol = unlocked and C.RIM_COLOR or PAL.midGray
    g:setColor(borderCol[1], borderCol[2], borderCol[3], 1)
    love.graphics.arc('line', 'open', cx, cy, OUTER, cfg.start, cfg.eend, 32)
    love.graphics.arc('line', 'open', cx, cy, INNER, cfg.start, cfg.eend, 32)
    for _, a in ipairs({cfg.start, cfg.eend}) do
        g:line(cx + math.cos(a) * INNER, cy + math.sin(a) * INNER,
               cx + math.cos(a) * OUTER, cy + math.sin(a) * OUTER)
    end

    if not unlocked then
        local midA = (cfg.start + cfg.eend) / 2
        local midR = (INNER + OUTER) / 2
        local lx = math.floor(cx + math.cos(midA) * midR)
        local ly = math.floor(cy + math.sin(midA) * midR)
        g:setColor(PAL.midGray[1], PAL.midGray[2], PAL.midGray[3], 1)
        g:rect('fill', lx - 1, ly - 1, 1, 1); g:rect('fill', lx + 1, ly - 1, 1, 1)
        g:rect('fill', lx, ly, 1, 1)
        g:rect('fill', lx - 1, ly + 1, 1, 1); g:rect('fill', lx + 1, ly + 1, 1, 1)
        return
    end

    local gaugeBalls = self._inGauge and self._placedBalls or (self._ejecting and self._ejectQueue or {})
    local ballCount = 0
    for _, pb in ipairs(gaugeBalls) do
        if pb.gaugeIdx == gaugeIdx then
            ballCount = ballCount + 1
            local bx = math.floor(cx + pb.gaugeX)
            local by = math.floor(cy + pb.gaugeY)
            g:setColor(PAL.black[1], PAL.black[2], PAL.black[3], 1)
            g:rect('fill', bx - 4, by - 3, 7, 7)
            local glowColor = PAL.white
            if pb.special then
                if pb.special.effect == 'double' then glowColor = PAL.gold
                elseif pb.special.effect == 'splash' then glowColor = PAL.red
                elseif pb.special.effect == 'critical' then glowColor = PAL.neonPink
                elseif pb.special.effect == 'ticket' then glowColor = PAL.purple end
            end
            self._frameLights[#self._frameLights+1] = {
                x = cx + pb.gaugeX, y = cy + pb.gaugeY * self:getTilt(),
                r = pb.special and 8 or 6, color = glowColor,
                a = pb.special and 0.12 or 0.06,
            }
        end
    end

    if ballCount > 0 then
        local la = cfg.eend + 0.12
        local lr = (INNER + OUTER) / 2
        local lx = math.floor(cx + math.cos(la) * lr)
        local ly = math.floor(cy + math.sin(la) * lr)
        font:drawCentered(tostring(ballCount), lx, ly - 3, PAL.white, 1)
    end

    if gaugeIdx == 1 and #gaugeBalls > 0 then
        self:_drawSellButton(g, font, cx, cy, cfg, 'SELL', 'ball')
    end
end

function PW:_drawCorruptionGauge(g, font, atlas, cx, cy, cfg)
    local INNER = self._rimR + 16
    local OUTER = self._rimR + 21
    local fill = self._corruption
    local totalArc = cfg.eend - cfg.start
    local fillEnd = cfg.start + totalArc * fill

    g:setColor(PAL.darkPurple[1], PAL.darkPurple[2], PAL.darkPurple[3], 1)
    drawAnnularArc(cx, cy, INNER, OUTER, cfg.start, cfg.eend, 32)
    if fill > 0.001 then
        local fillCol = fill >= 0.85 and PAL.neonPink or PAL.purple
        g:setColor(fillCol[1], fillCol[2], fillCol[3], 1)
        drawAnnularArc(cx, cy, INNER, OUTER, cfg.start, fillEnd, 32)
    end

    local borderCol = fill >= 0.85 and PAL.neonPink or PAL.purple
    g:setColor(borderCol[1], borderCol[2], borderCol[3], 1)
    love.graphics.arc('line', 'open', cx, cy, OUTER, cfg.start, cfg.eend, 32)
    love.graphics.arc('line', 'open', cx, cy, INNER, cfg.start, cfg.eend, 32)
    for _, a in ipairs({cfg.start, cfg.eend}) do
        g:line(cx + math.cos(a) * INNER, cy + math.sin(a) * INNER,
               cx + math.cos(a) * OUTER, cy + math.sin(a) * OUTER)
    end
    if fill > 0.01 and fill < 0.99 then
        g:setColor(PAL.white[1], PAL.white[2], PAL.white[3], 1)
        g:line(cx + math.cos(fillEnd) * INNER, cy + math.sin(fillEnd) * INNER,
               cx + math.cos(fillEnd) * OUTER, cy + math.sin(fillEnd) * OUTER)
    end
    if fill >= 0.85 then
        local midA = (cfg.start + fillEnd) / 2
        local midR = (INNER + OUTER) / 2
        self._frameLights[#self._frameLights+1] = {
            x = cx + math.cos(midA) * midR,
            y = cy + math.sin(midA) * midR * math.abs(self._tilt),
            r = 12, color = PAL.neonPink, a = 0.15,
        }
    end
    if atlas then
        local skullA = cfg.start - 0.08
        local skullR = (INNER + OUTER) / 2
        g:setColor(1, 1, 1, 1)
        atlas:drawCentered('skull', math.floor(cx + math.cos(skullA) * skullR),
            math.floor(cy + math.sin(skullA) * skullR), 1)
    end
end

function PW:_drawRelicBar(g, font, atlas, cx, cy)
    local cfg = GAUGE_CONFIGS[2]
    local INNER = self._rimR + 16
    local OUTER = self._rimR + 21
    local MID_R = (INNER + OUTER) / 2
    local RARITIES = {'common', 'uncommon', 'rare', 'legendary'}
    local RARITY_COL = { common = PAL.white, uncommon = PAL.green, rare = PAL.blue, legendary = PAL.gold }
    local arcLen = cfg.eend - cfg.start

    local counts = { common = 0, uncommon = 0, rare = 0, legendary = 0 }
    for _, r in ipairs(self._relics) do
        if counts[r.rarity] ~= nil then counts[r.rarity] = counts[r.rarity] + 1 end
    end

    for i = 1, #RARITIES do
        local rarity = RARITIES[i]
        local a = cfg.start + arcLen * (i - 0.5) / #RARITIES
        local sx = math.floor(cx + math.cos(a) * MID_R)
        local sy = math.floor(cy + math.sin(a) * MID_R) + 4
        local count = counts[rarity]
        if atlas then
            if count > 0 then g.setColor(1, 1, 1, 1)
            else g.setColor(PAL.midGray[1], PAL.midGray[2], PAL.midGray[3], 1) end
            atlas:drawCentered('relic_' .. rarity, sx, sy, 1)
            g.setColor(1, 1, 1, 1)
        end
        local col = count > 0 and RARITY_COL[rarity] or PAL.midGray
        font:draw(tostring(count), sx + 3, sy + 1, col, 1)
    end

    for _, fl in ipairs(self._relicFlash) do
        local progress = fl.t / fl.dur
        local alpha = (1 - progress) * 0.6
        local pulse = 1 + 0.5 * math.sin(fl.t * 20)
        local fAngle = cfg.start + arcLen * 0.5
        local fx = math.floor(cx + math.cos(fAngle) * MID_R)
        local fy = math.floor(cy + math.sin(fAngle) * MID_R)
        g:setColor(PAL.gold[1], PAL.gold[2], PAL.gold[3], alpha * pulse)
        g:circle('fill', fx, fy, 8 + 6 * (1 - progress))
        self._frameLights[#self._frameLights+1] = {
            x = fx, y = fy, r = 20 + 10 * (1 - progress),
            color = PAL.gold, a = alpha * 0.4,
        }
    end
end

function PW:_drawRimCounters(g, font, atlas, cx, cy)
    local cfg = GAUGE_CONFIGS[3]
    local INNER = self._rimR + 16
    local OUTER = self._rimR + 21
    local MID_R = (INNER + OUTER) / 2
    local arcLen = cfg.eend - cfg.start
    local gap = 2
    local SPRITE_SIZE = 8
    local TICKET_W = 7
    local CH_H = 6

    if not self._goldQuotaAnim then
        local goldA = cfg.start + arcLen * 0.75
        local gx = math.floor(cx + math.cos(goldA) * MID_R)
        local gy = math.floor(cy + math.sin(goldA) * MID_R)
        if self._goldShake.intensity > 0 then
            local t = math.min(1, self._goldShake.time / self._goldShake.decay)
            local amp = self._goldShake.intensity * (1 - t)
            gx = gx + math.floor((math.random() - 0.5) * 2 * amp)
            gy = gy + math.floor((math.random() - 0.5) * 2 * amp)
        end
        local goldTxt = tostring(self._counterGold)
        local goldTW = font:measure(goldTxt)
        local goldTotalW = goldTW + gap + SPRITE_SIZE
        local gsx = gx - math.floor(goldTotalW / 2)
        font:draw(goldTxt, gsx, gy - math.floor(CH_H / 2), PAL.gold, 1)
        if atlas then
            g:setColor(1, 1, 1, 1)
            atlas:drawAnim('coin', gsx + goldTW + gap + math.floor(SPRITE_SIZE / 2), gy, 1, self._time, 6)
        end
    end

    if not self._ticketAnim then
        local tickA = cfg.start + arcLen * 0.25
        local tx = math.floor(cx + math.cos(tickA) * MID_R)
        local ty = math.floor(cy + math.sin(tickA) * MID_R)
        if self._ticketShake.intensity > 0 then
            local t = math.min(1, self._ticketShake.time / self._ticketShake.decay)
            local amp = self._ticketShake.intensity * (1 - t)
            tx = tx + math.floor((math.random() - 0.5) * 2 * amp)
            ty = ty + math.floor((math.random() - 0.5) * 2 * amp)
        end
        local tickTxt = tostring(self._counterTickets)
        local tickTW = font:measure(tickTxt)
        local tickTotalW = tickTW + gap + TICKET_W
        local tsx = tx - math.floor(tickTotalW / 2)
        font:draw(tickTxt, tsx, ty - math.floor(CH_H / 2), PAL.green, 1)
        if atlas then
            g:setColor(1, 1, 1, 1)
            atlas:drawCentered('ticket', tsx + tickTW + gap + math.floor(TICKET_W / 2) + 4, ty - 1, 1)
        end
    end

    self:_drawSellButton(g, font, cx, cy, cfg, 'SELL', 'upgrade')

    for _, fl in ipairs(self._upgradeFlash) do
        local progress = fl.t / fl.dur
        local alpha = (1 - progress) * 0.5
        local pulse = 1 + 0.3 * math.sin(fl.t * 18)
        local fAngle = cfg.start + arcLen * 0.5
        local fx = math.floor(cx + math.cos(fAngle) * MID_R)
        local fy = math.floor(cy + math.sin(fAngle) * MID_R)
        g:setColor(PAL.cyan[1], PAL.cyan[2], PAL.cyan[3], alpha * pulse)
        g:circle('fill', fx, fy, 6 + 4 * (1 - progress))
        self._frameLights[#self._frameLights+1] = {
            x = fx, y = fy, r = 15 + 8 * (1 - progress),
            color = PAL.cyan, a = alpha * 0.35,
        }
    end
end

end
