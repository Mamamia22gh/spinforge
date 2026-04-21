local C = require('src.objects.wheel.constants')
local PAL = C.PAL
local drawAnnularArc = C.drawAnnularArc
local TWO_PI = C.TWO_PI

return function(PW)

function PW:setShop(offerings, currency, rerollCost, nextQuota)
    self._shop.offerings = offerings or {}
    self._shop.currency = currency
    self._shop.rerollCost = rerollCost
    if nextQuota then self._shop.nextQuota = nextQuota end
    self._shop.hoverIdx = -1
    self._shop.buyFlash = -1
    self._shop.buyFlashTimer = 0
end

function PW:shopUpdateCurrency(c) self._shop.currency = c end
function PW:shopRemoveOffering(idx)
    self._shop.buyFlash = idx
    self._shop.buyFlashTimer = 0.4
end
function PW:shopSetOfferings(o) self._shop.offerings = o or {} end

function PW:shopHitTest(x, y, cx, cy)
    if not self:isFlipped() then return nil end
    local TILT_Y = math.abs(self._tilt)
    if TILT_Y < 0.05 then return nil end
    local dx = x - cx
    local dy = (y - cy) / TILT_Y
    local dist = math.sqrt(dx*dx + dy*dy)
    local angle = math.atan2(dy, dx)

    if dist < self._hubR then return { type = 'leave' } end
    if dist >= self._hubR + 3 and dist <= self._rimR - 3 then
        local QUAD_GAP = 0.10
        local SLOT_GAP = 0.04
        local QUAD_SPAN = math.pi / 2 - QUAD_GAP
        local SLOT_SPAN = (QUAD_SPAN - SLOT_GAP) / 2
        local quadStarts = {
            -math.pi/2 + QUAD_GAP/2, 0 + QUAD_GAP/2,
            math.pi/2 + QUAD_GAP/2, math.pi + QUAD_GAP/2,
        }
        for q = 1, 4 do
            for s = 0, 1 do
                local a0 = quadStarts[q] + s * (SLOT_SPAN + SLOT_GAP)
                local a1 = a0 + SLOT_SPAN
                local a = angle
                if q == 4 and a < 0 then a = a + TWO_PI end
                local inArc = false
                if a0 < -math.pi then
                    inArc = (a >= a0 + TWO_PI and a <= a1 + TWO_PI) or (a >= a0 and a <= a1)
                elseif a1 > math.pi then
                    inArc = (a >= a0) or (a <= a1 - TWO_PI)
                else
                    inArc = (a >= a0 and a <= a1)
                end
                if inArc then
                    local idx = (q-1) * 2 + s
                    if idx == 4 then return { type = 'reroll' } end
                    return { type = 'offering', index = idx }
                end
            end
        end
    end
    return nil
end

function PW:shopSetHover(hit)
    if not hit then self._shop.hoverIdx = -1; return end
    if hit.type == 'offering' then self._shop.hoverIdx = hit.index
    elseif hit.type == 'reroll' then self._shop.hoverIdx = 'reroll'
    elseif hit.type == 'leave' then self._shop.hoverIdx = 'leave'
    else self._shop.hoverIdx = -1 end
end

function PW:getShopHoveredOffering()
    local idx = self._shop.hoverIdx
    if type(idx) ~= 'number' or idx < 0 then return nil end
    return self._shop.offerings[idx+1] or nil
end

function PW:_drawForgeFace(g, font, atlas, cx, cy)
    local shop = self._shop
    if shop.buyFlashTimer > 0 then shop.buyFlashTimer = shop.buyFlashTimer - 1/60 end

    g:setColor(PAL.black[1], PAL.black[2], PAL.black[3], 1)
    g:circle('fill', cx, cy, self._rimR)

    local QUAD_GAP = 0.10
    local SLOT_GAP = 0.04
    local QUAD_SPAN = math.pi / 2 - QUAD_GAP
    local SLOT_SPAN = (QUAD_SPAN - SLOT_GAP) / 2
    local slotInner = self._hubR + 3
    local slotOuter = self._rimR - 3
    local slotMidR = (slotInner + slotOuter) / 2
    local quadStarts = {
        -math.pi/2 + QUAD_GAP/2, 0 + QUAD_GAP/2,
        math.pi/2 + QUAD_GAP/2, math.pi + QUAD_GAP/2,
    }
    local RARITY_COLORS = {
        common    = { fg = PAL.lightGray, bg = PAL.midGray, border = PAL.lightGray },
        uncommon  = { fg = PAL.green, bg = PAL.darkGreen, border = PAL.green },
        rare      = { fg = PAL.blue, bg = PAL.darkBlue, border = PAL.cyan },
        legendary = { fg = PAL.neonPink, bg = PAL.darkPurple, border = PAL.gold },
    }
    local QUALITY_COLORS = {
        corrupted = { 0.55, 0.15, 0.75 },
        purified  = { 0.95, 0.95, 1.0 },
    }
    local SPRITE_SIZE = 8
    local CH_H = 6
    local TICKET_W = 7
    if not self._shopParticles then self._shopParticles = {} end
    self._shopParticleTimer = (self._shopParticleTimer or 0) + 1/60

    for q = 1, 4 do
        for s = 0, 1 do
            local slotIdx = (q-1) * 2 + s
            local a0 = quadStarts[q] + s * (SLOT_SPAN + SLOT_GAP)
            local a1 = a0 + SLOT_SPAN
            local mid = a0 + SLOT_SPAN / 2
            local isHover = shop.hoverIdx == slotIdx
            local isBuyFlash = shop.buyFlash == slotIdx and shop.buyFlashTimer > 0

            g:setColor(PAL.midGray[1], PAL.midGray[2], PAL.midGray[3], 1)
            love.graphics.arc('line', 'open', cx, cy, slotOuter, a0, a1, 32)
            love.graphics.arc('line', 'open', cx, cy, slotInner, a0, a1, 32)

            if slotIdx == 4 then
                g:setColor(PAL.darkGray[1], PAL.darkGray[2], PAL.darkGray[3], 0.3)
                drawAnnularArc(cx, cy, slotInner + 1, slotOuter - 1, a0, a1, 32)
                g:setColor(PAL.lightGray[1], PAL.lightGray[2], PAL.lightGray[3], 1)
                love.graphics.arc('line', 'open', cx, cy, slotOuter, a0, a1, 32)
                love.graphics.arc('line', 'open', cx, cy, slotInner, a0, a1, 32)
                local rx = cx + math.cos(mid) * slotMidR
                local ry = cy + math.sin(mid) * slotMidR
                if atlas then
                    g:setColor(1, 1, 1, 1)
                    atlas:drawCentered('reroll', math.floor(rx), math.floor(ry), 2)
                end
                font:drawCentered(tostring(shop.rerollCost), math.floor(rx),
                    math.floor(ry + 14) - math.floor(CH_H/2), PAL.gold, 1)
                if shop.hoverIdx == 'reroll' and shop.currency >= shop.rerollCost then
                    g:setColor(PAL.white[1], PAL.white[2], PAL.white[3], 0.12)
                    drawAnnularArc(cx, cy, slotInner, slotOuter, a0, a1, 32)
                end
                goto continue_slot
            end

            local offering = shop.offerings[slotIdx + 1]
            if offering then
                local rc = RARITY_COLORS[offering.rarity] or RARITY_COLORS.common
                local tooExpensive = shop.currency < (offering.finalCost or 0)
                g:setColor(rc.bg[1], rc.bg[2], rc.bg[3], offering.rarity == 'common' and 0.15 or 0.3)
                drawAnnularArc(cx, cy, slotInner + 1, slotOuter - 1, a0, a1, 32)

                local qual = offering.quality or 'normal'
                local qc = QUALITY_COLORS[qual]
                if qc then
                    local pulse = 0.25 + 0.15 * math.sin(self._shopParticleTimer * 4 + slotIdx)
                    g:setColor(qc[1], qc[2], qc[3], pulse)
                    drawAnnularArc(cx, cy, slotInner + 2, slotOuter - 2, a0 + 0.02, a1 - 0.02, 32)
                    local pCount = 3
                    for p = 1, pCount do
                        local seed = slotIdx * 7 + p * 13
                        local t = (self._shopParticleTimer * (0.4 + (seed % 5) * 0.1) + seed) % 1.0
                        local pAngle = a0 + t * (a1 - a0)
                        local pR = slotInner + 4 + ((seed * 3 + math.floor(self._shopParticleTimer * 2 + p)) % math.floor(slotOuter - slotInner - 8))
                        local px2 = cx + math.cos(pAngle) * pR
                        local py2 = cy + math.sin(pAngle) * pR
                        local pAlpha = 0.4 + 0.4 * math.sin(self._shopParticleTimer * 6 + seed)
                        g:setColor(qc[1], qc[2], qc[3], pAlpha)
                        g:rect('fill', math.floor(px2), math.floor(py2), 2, 2)
                    end
                end

                g:setColor(rc.border[1], rc.border[2], rc.border[3], 1)
                love.graphics.arc('line', 'open', cx, cy, slotOuter, a0, a1, 32)
                love.graphics.arc('line', 'open', cx, cy, slotInner, a0, a1, 32)
                local sx2 = cx + math.cos(mid) * slotMidR
                local sy2 = cy + math.sin(mid) * slotMidR
                local spriteName
                if offering.shopType == 'symbol' then spriteName = offering.symbolId or 'ball'
                elseif offering.shopType == 'special_ball' then spriteName = 'ball'
                else spriteName = 'relic_' .. (offering.rarity or 'common') end
                if not isBuyFlash and tooExpensive then g:setColor(1, 1, 1, 0.35)
                else g:setColor(1, 1, 1, 1) end
                if atlas then atlas:drawCentered(spriteName, math.floor(sx2), math.floor(sy2), 2) end
                g:setColor(1, 1, 1, 1)
                local priceStr = tostring(offering.finalCost or 0)
                local priceColor = tooExpensive and PAL.red or PAL.gold
                local textW = font:measure(priceStr)
                local pTotalW = textW + 7 + TICKET_W
                local pStartX = math.floor(sx2 - pTotalW / 2)
                local pTextY = math.floor(sy2 + 14) - math.floor(CH_H / 2)
                font:draw(priceStr, pStartX, pTextY, priceColor, 1)
                if atlas then
                    g:setColor(1, 1, 1, 1)
                    atlas:drawCentered('ticket', pStartX + textW + 7 + math.floor(TICKET_W / 2),
                        math.floor(sy2 + 14), 1)
                end
                if isHover and not tooExpensive then
                    g:setColor(PAL.white[1], PAL.white[2], PAL.white[3], 0.12)
                    drawAnnularArc(cx, cy, slotInner, slotOuter, a0, a1, 32)
                end
                if isBuyFlash then
                    g:setColor(PAL.gold[1], PAL.gold[2], PAL.gold[3], shop.buyFlashTimer / 0.4 * 0.6)
                    drawAnnularArc(cx, cy, slotInner, slotOuter, a0, a1, 32)
                end
            else
                local ex = cx + math.cos(mid) * slotMidR
                local ey = cy + math.sin(mid) * slotMidR
                g:setColor(PAL.midGray[1], PAL.midGray[2], PAL.midGray[3], 0.3)
                g:rect('fill', math.floor(ex) - 1, math.floor(ey) - 1, 3, 3)
            end
            ::continue_slot::
        end
        local dAngle = quadStarts[q] - QUAD_GAP / 2
        local dc, ds = math.cos(dAngle), math.sin(dAngle)
        g:setColor(PAL.midGray[1], PAL.midGray[2], PAL.midGray[3], 1)
        g:line(cx + dc * slotInner, cy + ds * slotInner, cx + dc * slotOuter, cy + ds * slotOuter)
    end

    local leaveHover = shop.hoverIdx == 'leave'
    g:setColor(PAL.darkGray[1], PAL.darkGray[2], PAL.darkGray[3], leaveHover and 0.8 or 0.5)
    g:circle('fill', cx, cy, self._hubR - 1)
    local borderCol = leaveHover and PAL.lightGray or PAL.midGray
    g:setColor(borderCol[1], borderCol[2], borderCol[3], 1)
    g:circle('line', cx, cy, self._hubR - 1)
    if atlas then atlas:drawCentered('arrow_right', cx, cy - 8, 3) end
    font:drawCentered('CONTINUER', cx, cy + 4, PAL.lightGray, 1)
    if shop.nextQuota and shop.nextQuota > 0 then
        font:drawCentered('QUOTA ' .. shop.nextQuota, cx, cy + 14, PAL.midGray, 1, false)
    end
end

end
