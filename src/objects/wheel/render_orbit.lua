local C = require('src.objects.wheel.constants')
local PAL = C.PAL
local drawAnnularArc = C.drawAnnularArc

return function(PW)

function PW:_drawOrbitSlots(g, font, atlas, cx, cy)
    local INNER = self._rimR + 5
    local OUTER = self._rimR + 27
    local SLOT_ARC = 0.28
    local PAIR_GAP = 0.06
    local corners = {
        -math.pi * 3 / 4, -math.pi / 4, math.pi / 4, math.pi * 3 / 4,
    }
    local idx = 0
    for _, center in ipairs(corners) do
        local a0A = center - PAIR_GAP / 2 - SLOT_ARC
        local a1A = center - PAIR_GAP / 2
        self:_drawOneSlot(g, font, atlas, cx, cy, INNER, OUTER, a0A, a1A, idx)
        idx = idx + 1
        local a0B = center + PAIR_GAP / 2
        local a1B = center + PAIR_GAP / 2 + SLOT_ARC
        self:_drawOneSlot(g, font, atlas, cx, cy, INNER, OUTER, a0B, a1B, idx)
        idx = idx + 1
    end
end

function PW:_drawOneSlot(g, font, atlas, cx, cy, inner, outer, a0, a1, idx)
    local filled = self._slots and self._slots[idx + 1]
    local locked = idx >= 2

    g:setColor(PAL.black[1], PAL.black[2], PAL.black[3], 1)
    drawAnnularArc(cx, cy, inner, outer, a0, a1, 32)

    g:setColor(PAL.midGray[1], PAL.midGray[2], PAL.midGray[3], 1)
    love.graphics.arc('line', 'open', cx, cy, outer, a0, a1, 32)
    love.graphics.arc('line', 'open', cx, cy, inner, a0, a1, 32)
    g:line(cx + math.cos(a0) * inner, cy + math.sin(a0) * inner,
           cx + math.cos(a0) * outer, cy + math.sin(a0) * outer)
    g:line(cx + math.cos(a1) * inner, cy + math.sin(a1) * inner,
           cx + math.cos(a1) * outer, cy + math.sin(a1) * outer)

    local midA = (a0 + a1) / 2
    local midR = (inner + outer) / 2
    local mx = math.floor(cx + math.cos(midA) * midR)
    local my = math.floor(cy + math.sin(midA) * midR)

    if filled then
        if atlas then
            g:setColor(1, 1, 1, 1)
            atlas:drawCentered(filled.id or 'ticket', mx, my, 1)
        end
    elseif locked then
        g:setColor(PAL.midGray[1], PAL.midGray[2], PAL.midGray[3], 1)
        g:rect('fill', mx - 1, my - 1, 1, 1); g:rect('fill', mx + 1, my - 1, 1, 1)
        g:rect('fill', mx, my, 1, 1)
        g:rect('fill', mx - 1, my + 1, 1, 1); g:rect('fill', mx + 1, my + 1, 1, 1)
    else
        g:setColor(PAL.midGray[1], PAL.midGray[2], PAL.midGray[3], 1)
        g:rect('fill', mx, my, 1, 1)
    end
end

end
