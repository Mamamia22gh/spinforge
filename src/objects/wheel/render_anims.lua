local C = require('src.objects.wheel.constants')
local PAL = C.PAL

return function(PW)

function PW:drawGoldAnims(g, font, atlas, cx, cy)
    local SPRITE_SIZE = 8
    local CH_H = 6
    for _, ga in ipairs(self._goldAnims) do
        local t = math.min(1, ga.elapsed / ga.duration)
        local ease = t < 0.5 and (2*t*t) or (1 - (-2*t + 2)^2 / 2)
        local x = ga.startX + (ga.targetX - ga.startX) * ease
        local y = ga.startY + (ga.targetY - ga.startY) * ease
        local scale = 1 + 0.3 * math.sin(math.pi * t)
        local alpha = ga.arrived and math.max(0, 1 - (ga.elapsed - ga.duration) / 0.15) or 1
        if alpha > 0 then
            local txtW = font:measure(ga.text)
            local totalW = txtW + 2 + SPRITE_SIZE
            local dx = math.floor(x - totalW / 2)
            local dy = math.floor(y)
            font:draw(ga.text, dx, dy - math.floor(CH_H * scale / 2),
                { PAL.gold[1], PAL.gold[2], PAL.gold[3], alpha }, scale)
            if atlas then
                g:setColor(1, 1, 1, alpha)
                atlas:drawAnim('coin', dx + txtW + 2 + math.floor(SPRITE_SIZE / 2), dy, scale, self._time, 6)
            end
            g:setColor(1, 1, 1, 1)
        end
    end
end

function PW:drawTicketFlyAnims(g, font, atlas, cx, cy)
    local SPRITE_SIZE = 8
    local CH_H = 6
    for _, ta in ipairs(self._ticketFlyAnims) do
        local t = math.min(1, ta.elapsed / ta.duration)
        local ease = t < 0.5 and (2*t*t) or (1 - (-2*t + 2)^2 / 2)
        local x = ta.startX + (ta.targetX - ta.startX) * ease
        local y = ta.startY + (ta.targetY - ta.startY) * ease
        local scale = 1 + 0.3 * math.sin(math.pi * t)
        local alpha = ta.arrived and math.max(0, 1 - (ta.elapsed - ta.duration) / 0.15) or 1
        if alpha > 0 then
            local txtW = font:measure(ta.text)
            local totalW = txtW + 2 + SPRITE_SIZE
            local dx = math.floor(x - totalW / 2)
            local dy = math.floor(y)
            font:draw(ta.text, dx, dy - math.floor(CH_H * scale / 2),
                { PAL.green[1], PAL.green[2], PAL.green[3], alpha }, scale)
            if atlas then
                g:setColor(1, 1, 1, alpha)
                atlas:drawCentered('ticket', dx + txtW + 2 + math.floor(SPRITE_SIZE / 2), dy, scale)
            end
            g:setColor(1, 1, 1, 1)
        end
    end
end

function PW:drawGoldQuotaAnim(g, font, atlas, cx, cy)
    local ga = self._goldQuotaAnim
    if not ga then return end
    local CH_H = 6
    local srcX = math.cos(ga.fromA) * ga.fromMidR
    local srcY = math.sin(ga.fromA) * ga.fromMidR
    local tgtX, tgtY = 0, -(self._hubR + 14)
    local t, x, y, scale, alpha = 0, 0, 0, 1, 1

    if ga.phase == 'fly' then
        t = math.min(1, ga.elapsed / ga.flyDur)
        local ease = t < 0.5 and (2*t*t) or (1 - (-2*t + 2)^2 / 2)
        x = srcX + (tgtX - srcX) * ease; y = srcY + (tgtY - srcY) * ease
        scale = 1 + 2 * ease; alpha = 0.5 + 0.5 * ease
    elseif ga.phase == 'count' then x = tgtX; y = tgtY; scale = 3; alpha = 1
    elseif ga.phase == 'hold' then x = tgtX; y = tgtY; scale = 3; alpha = 1
    elseif ga.phase == 'flyback' then
        t = math.min(1, ga.elapsed / ga.flybackDur)
        local ease = t * t
        x = tgtX + (srcX - tgtX) * ease; y = tgtY + (srcY - tgtY) * ease
        scale = 3 - 2 * ease; alpha = 1 - 0.5 * ease
    else return end

    local shakeX, shakeY = 0, 0
    if ga.phase == 'count' then
        local intensity = 2.5 * (1 - math.min(1, ga.elapsed / ga.countDur))
        shakeX = math.floor((math.random() - 0.5) * 2 * intensity)
        shakeY = math.floor((math.random() - 0.5) * 2 * intensity)
    end

    g:push()
    g:translate(cx + x + shakeX, cy + y + shakeY)
    if ga.phase == 'count' or ga.phase == 'hold' then
        g:setColor(PAL.gold[1], PAL.gold[2], PAL.gold[3], 0.12 + 0.06 * math.sin(self._time * 12))
        g:circle('fill', 0, 0, 22 * scale / 3)
    end
    if atlas then
        g:setColor(1, 1, 1, alpha)
        atlas:drawAnim('coin', 0, -math.floor(CH_H * scale / 2) - 2, scale, self._time, 6)
    end
    font:drawCentered(tostring(self._counterGold), 0, math.floor(CH_H * scale / 2) + 2,
        { PAL.gold[1], PAL.gold[2], PAL.gold[3], alpha }, scale)
    if ga.phase == 'count' or ga.phase == 'hold' then
        local deducted = ga.startGold - self._counterGold
        if deducted > 0 then
            font:drawCentered('-' .. deducted, 0,
                math.floor(CH_H * scale / 2) + 2 + math.ceil(CH_H * scale) + 2,
                { PAL.red[1], PAL.red[2], PAL.red[3], alpha }, scale * 0.7)
        end
    end
    g:setColor(1, 1, 1, 1)
    g:pop()
end

function PW:drawTicketAnim(g, font, atlas, cx, cy)
    local ta = self._ticketAnim
    if not ta then return end
    local CH_H = 6
    local srcX = math.cos(ta.fromA) * ta.fromMidR
    local srcY = math.sin(ta.fromA) * ta.fromMidR
    local tgtX, tgtY = 0, -(self._hubR + 14)
    local t, x, y, scale, alpha = 0, 0, 0, 1, 1

    if ta.phase == 'fly' then
        t = math.min(1, ta.elapsed / ta.flyDur)
        local ease = t < 0.5 and (2*t*t) or (1 - (-2*t + 2)^2 / 2)
        x = srcX + (tgtX - srcX) * ease; y = srcY + (tgtY - srcY) * ease
        scale = 1 + 2 * ease; alpha = 0.5 + 0.5 * ease
    elseif ta.phase == 'count' then x = tgtX; y = tgtY; scale = 3; alpha = 1
    elseif ta.phase == 'hold' then x = tgtX; y = tgtY; scale = 3; alpha = 1
    elseif ta.phase == 'flyback' then
        t = math.min(1, ta.elapsed / ta.flybackDur)
        local ease = t * t
        x = tgtX + (srcX - tgtX) * ease; y = tgtY + (srcY - tgtY) * ease
        scale = 3 - 2 * ease; alpha = 1 - 0.5 * ease
    else return end

    local shakeX, shakeY = 0, 0
    if ta.phase == 'count' then
        local intensity = 2.5 * (1 - math.min(1, ta.elapsed / ta.countDur))
        shakeX = math.floor((math.random() - 0.5) * 2 * intensity)
        shakeY = math.floor((math.random() - 0.5) * 2 * intensity)
    end

    g:push()
    g:translate(cx + x + shakeX, cy + y + shakeY)
    if ta.phase == 'count' or ta.phase == 'hold' then
        g:setColor(PAL.green[1], PAL.green[2], PAL.green[3], 0.12 + 0.06 * math.sin(self._time * 12))
        g:circle('fill', 0, 0, 22 * scale / 3)
    end
    if atlas then
        g:setColor(1, 1, 1, alpha)
        atlas:drawCentered('ticket', 0, -math.floor(CH_H * scale / 2) - 2, scale)
    end
    local displayCount = ta.baseTickets + ta.counted
    font:drawCentered(tostring(displayCount), 0, math.floor(CH_H * scale / 2) + 2,
        { PAL.green[1], PAL.green[2], PAL.green[3], alpha }, scale)
    g:setColor(1, 1, 1, 1)
    g:pop()
end

end
