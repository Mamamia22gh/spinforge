-- game/hud.lua — HUD: title, pops, hub prompt, cursor.

local C = require('src.game.constants')
local PAL = C.PAL

return function(Game)

function Game:_drawTitle(g, hudOx, hudOy)
    local font = self._font
    if not font then return end
    local scale = 5
    local charStep = (C.CH_W + 1) * scale
    local fullW = font:measure('SPINFORGE') * scale
    local tx = math.floor(C.W / 2 + hudOx - fullW / 2)
    local ty = 6 + hudOy

    font:draw('SPINF', tx, ty, PAL.gold, scale)
    local flipT = self._time % 4.0
    local flipDur = 0.6
    local sY = 1
    if flipT < flipDur then sY = math.cos(flipT / flipDur * math.pi * 2) end
    local oX = tx + 5 * charStep
    local oCX = oX + C.CH_W * scale / 2
    local oCY = ty + C.CH_H * scale / 2
    g:push()
    g:translate(oCX, oCY)
    g:scale(1, sY)
    font:draw('O', -C.CH_W * scale / 2, -C.CH_H * scale / 2, PAL.gold, scale)
    g:pop()
    font:draw('RGE', tx + 6 * charStep, ty, PAL.gold, scale)
end

function Game:_drawPops(g)
    local font = self._font
    local atlas = self._atlas
    for _, p in ipairs(self._pops) do
        local col = p.color or (p.age < 1.0 and PAL.gold or PAL.darkGold)
        local a = p.age < 1.0 and 1 or math.max(0, 1 - (p.age - 1.0) / 0.5)
        local c  = { col[1], col[2], col[3], a }
        local oc = { PAL.black[1], PAL.black[2], PAL.black[3], a }
        if p.noCoin then
            font:drawCenteredOutlined(p.text, p.x, p.y, c, 1, oc)
        else
            local textW = #p.text * C.CH_W
            local totalW = C.SPRITE_SIZE + 2 + textW
            font:drawCenteredOutlined(p.text,
                math.floor(p.x - totalW / 2 + textW / 2), p.y, c, 1, oc)
            if atlas then
                g:setColor(1, 1, 1, a)
                atlas:drawAnim('coin', math.floor(p.x - totalW / 2 + textW + 2 + C.SPRITE_SIZE / 2),
                    p.y + math.floor(C.CH_H / 2), 1, self._time, 6)
            end
        end
    end
end

function Game:_drawHubPrompt(g, wox, woy)
    local gold = self.engine:gold()
    local quota = self.engine:quota()
    local pressed = self._phase == 'SPINNING' or self._phase == 'RESULTS'
    local hover = self._hubHover and not pressed
    local t = self._time
    local tilt = self.wheel:getTilt()
    local r = self.wheel:getHubRadius()
    local cx = C.WHEEL_CX + wox
    local cy = C.WHEEL_CY + woy
    local quotaReached = pressed and gold >= quota
    local font = self._font
    local atlas = self._atlas

    g:push()
    g:translate(cx, cy)
    g:scale(1, tilt)
    if not pressed then g:translate(0, hover and -4 or -2) end

    if quotaReached then
        local fc = math.sin(t * 8 * math.pi) > 0 and PAL.gold or PAL.darkGold
        g:setColor(fc[1], fc[2], fc[3], 1)
    else
        g:setColor(PAL.gold[1], PAL.gold[2], PAL.gold[3], 1)
    end
    g:circle('fill', 0, 0, r)

    if hover then
        g:setColor(PAL.white[1], PAL.white[2], PAL.white[3], 0.15)
        g:circle('fill', 0, 0, r)
    end

    if not pressed then
        local SWEEP_INTERVAL, SWEEP_DUR = 3.5, 0.25
        local periodicT = t % SWEEP_INTERVAL
        local hoverT = t - self._sweepTrigger
        local sweepProgress = -1
        if periodicT < SWEEP_DUR then sweepProgress = periodicT / SWEEP_DUR
        elseif hoverT >= 0 and hoverT < SWEEP_DUR then sweepProgress = hoverT / SWEEP_DUR end
        if sweepProgress >= 0 then
            g:clipCircle(0, 0, r - 2)
            g:setColor(PAL.white[1], PAL.white[2], PAL.white[3], 0.65)
            local sx = -r + sweepProgress * r * 2
            for dy = -r, r do g:rect('fill', math.floor(sx + dy * 0.4), dy, 3, 1) end
            g:unclip()
        end
    end

    if pressed and not quotaReached then
        g:setColor(PAL.black[1], PAL.black[2], PAL.black[3], 0.3)
        g:circle('fill', 0, 0, r)
    end

    if pressed then
        if quotaReached then
            font:drawCentered(gold .. '/' .. quota, 0, -math.floor(C.CH_H * 3), PAL.gold, 1, false)
            font:drawCentered('BONUS', 0, -math.floor(C.CH_H * 1), PAL.black, 1, false)
            local surplus = gold - quota
            local bStr = '+' .. surplus
            local bW = #bStr * C.CH_W * 2
            local bY = math.floor(C.CH_H * 1.5)
            local bCoinW = C.SPRITE_SIZE * 2
            local bOx = math.floor(-(2 + bCoinW) / 2)
            font:drawCentered(bStr, bOx, bY, PAL.gold, 2)
            if atlas then
                g:setColor(1, 1, 1, 1)
                atlas:drawAnim('coin', math.floor(bOx + bW / 2 + 2 + C.SPRITE_SIZE), bY + C.CH_H, 2, t, 8)
            end
        else
            local sStr = tostring(gold)
            local sW = #sStr * C.CH_W * 2
            local sY = -math.floor(C.CH_H * 1.5)
            font:drawCentered(sStr, 0, sY, PAL.gold, 2)
            if atlas then
                g:setColor(1, 1, 1, 1)
                atlas:drawAnim('coin', math.floor(sW / 2 + 2 + C.SPRITE_SIZE), sY + C.CH_H, 2, t, 8)
            end
            font:drawCentered('/' .. quota, 0, math.floor(C.CH_H * 1.5), PAL.midGray, 2, false)
        end
    else
        if self._phase ~= 'IDLE' then g:pop(); return end
        font:drawCentered('SPIN', 0, -math.floor(C.CH_H * 1.5), PAL.black, 2, false)
        local qStr = 'QUOTA ' .. quota
        local qW = #qStr * C.CH_W
        local qY = math.floor(C.CH_H * 0.5)
        local qOx = math.floor(-(1 + C.SPRITE_SIZE) / 2)
        font:drawCentered(qStr, qOx, qY, PAL.midGray, 1, false)
        if atlas then
            g:setColor(1, 1, 1, 1)
            atlas:drawAnim('coin', math.floor(qOx + qW / 2 + 1 + C.SPRITE_SIZE / 2) + 2,
                qY + math.floor(C.CH_H / 2) - 1, 1, t, 4)
        end
    end
    g:pop()
end

function Game:_drawGameOverHub(g, wox, woy)
    local tilt = self.wheel:getTilt()
    local r = self.wheel:getHubRadius()
    local cx = C.WHEEL_CX + wox
    local cy = C.WHEEL_CY + woy
    local hover = self._hubHover
    local font = self._font
    local atlas = self._atlas
    local round = self.engine:round()
    local gold = self.engine:gold()
    local quota = self.engine:quota()

    g:push()
    g:translate(cx, cy)
    g:scale(1, tilt)
    g:translate(0, hover and -4 or -2)
    g:setColor(PAL.darkRed[1], PAL.darkRed[2], PAL.darkRed[3], 1)
    g:circle('fill', 0, 0, r)
    if hover then
        g:setColor(PAL.white[1], PAL.white[2], PAL.white[3], 0.1)
        g:circle('fill', 0, 0, r)
    end
    if atlas then
        g:setColor(1, 1, 1, 1)
        atlas:drawCentered('skull', 0, -math.floor(r * 0.42), 1)
    end
    font:drawCentered('ROUND ' .. round, 0, -math.floor(C.CH_H * 0.4), PAL.lightGray, 1)
    font:drawCentered(gold .. '/' .. quota, 0, math.floor(C.CH_H * 0.8), PAL.red, 1, false)
    if atlas then
        g:setColor(1, 1, 1, 1)
        atlas:drawCentered('arrow_right', 0, math.floor(r * 0.35), 2)
    end
    font:drawCentered('RETRY', 0, math.floor(r * 0.55), PAL.gold, 1)
    g:pop()
end

function Game:_drawCursor(g)
    local mx, my = math.floor(self._mx), math.floor(self._my)
    local t = self._time
    if self._cursorHover then
        local pulse = 0.7 + 0.3 * math.sin(t * 6)
        g:setColor(0.95, 0.75, 0.25, 0.35 * pulse)
        g:rect('fill', mx - 4, my - 1, 9, 3); g:rect('fill', mx - 1, my - 4, 3, 9)
        g:setColor(0.98, 0.85, 0.35, 1)
        g:rect('fill', mx - 2, my, 5, 1); g:rect('fill', mx - 1, my - 1, 3, 3); g:rect('fill', mx, my - 2, 1, 5)
        g:setColor(1, 1, 0.85, 1); g:rect('fill', mx, my, 1, 1)
        g:setColor(0.15, 0.08, 0.03, 0.9)
        g:rect('fill', mx - 3, my, 1, 1); g:rect('fill', mx + 3, my, 1, 1)
        g:rect('fill', mx, my - 3, 1, 1); g:rect('fill', mx, my + 3, 1, 1)
    else
        g:setColor(0.05, 0.04, 0.08, 1)
        g:rect('fill', mx, my, 1, 7); g:rect('fill', mx+1, my+1, 1, 6)
        g:rect('fill', mx+2, my+2, 1, 5); g:rect('fill', mx+3, my+3, 1, 3)
        g:rect('fill', mx+4, my+4, 1, 2); g:rect('fill', mx+5, my+5, 1, 1)
        g:rect('fill', mx+1, my+7, 1, 1); g:rect('fill', mx+2, my+7, 2, 1)
        g:setColor(0.94, 0.88, 0.65, 1)
        g:rect('fill', mx+1, my+1, 1, 5); g:rect('fill', mx+2, my+2, 1, 4); g:rect('fill', mx+3, my+3, 1, 2)
        g:setColor(1, 1, 1, 1); g:rect('fill', mx+1, my+1, 1, 1)
    end
end

end
