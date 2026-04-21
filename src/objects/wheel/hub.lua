local C = require('src.objects.wheel.constants')
local PAL = C.PAL

return function(PW)

function PW:hubShowValue(symbolId, value)
    self._hub.lastSymbolId = symbolId or ''
    self._hub.lastValue = value or 0
    self._hub.valueFade = 1.5
    self._hub.history[#self._hub.history+1] = symbolId
    if #self._hub.history > 5 then table.remove(self._hub.history, 1) end
end

function PW:hubSetMulti(m) self._hub.multi = m end
function PW:hubSetScore(s) self._hub.scoreTarget = s end
function PW:hubSnapScore(s) self._hub.score = s; self._hub.scoreTarget = s end
function PW:hubMessage(msg) self._hub.message = msg; self._hub.messageFade = 2.5 end

function PW:_drawHubScreen(g, font, atlas, cx, cy)
    local h = self._hub
    local r = self._hubR - 3
    if r < 5 then return end
    local SPRITE_SIZE = 8

    g:push()
    g:clipCircle(cx, cy, r)

    local scoreStr = tostring(h.score)
    local scoreW = font:measure(scoreStr)
    local coinSz = SPRITE_SIZE
    local totalW = scoreW + 2 + coinSz
    local sx = math.floor(cx - totalW / 2)
    font:draw(scoreStr, sx, math.floor(cy - r * 0.25 - 3), PAL.gold, 1)
    if atlas then
        g:setColor(1, 1, 1, 1)
        atlas:drawAnim('coin', sx + scoreW + 2 + math.floor(coinSz / 2),
            math.floor(cy - r * 0.25), 1, self._time, 6)
    end

    if h.lastSymbolId and h.lastSymbolId ~= '' and h.valueFade > 0 and atlas then
        local alpha = math.min(1, h.valueFade)
        g:setColor(1, 1, 1, alpha)
        atlas:drawCentered(h.lastSymbolId, cx, math.floor(cy + 2), 2)
        g:setColor(1, 1, 1, 1)
    end

    if #h.history > 0 then
        local total = #h.history
        local spacing = math.min(6, math.floor((r * 1.4) / total))
        local startX = math.floor(cx - ((total - 1) * spacing) / 2)
        local histY = math.floor(cy + r * 0.55)
        for i = 1, total do
            local col = i % 2 == 1 and PAL.lightGray or PAL.midGray
            g:setColor(col[1], col[2], col[3], 1)
            g:rect('fill', startX + (i-1) * spacing, histY, 3, 3)
        end
    end

    if h.valueFade > 0 then
        local alpha = math.min(1, h.valueFade)
        local valStr = '+' .. h.lastValue
        local valW = font:measure(valStr)
        local tw2 = valW + 2 + coinSz
        local vsx = math.floor(cx - tw2 / 2)
        g:setColor(PAL.green[1], PAL.green[2], PAL.green[3], alpha)
        font:draw(valStr, vsx, math.floor(cy + r * 0.05 - 3), PAL.green, 1)
        if atlas then
            g:setColor(1, 1, 1, alpha)
            atlas:drawAnim('coin', vsx + valW + 2 + math.floor(coinSz / 2),
                math.floor(cy + r * 0.05), 1, self._time, 6)
        end
        g:setColor(1, 1, 1, 1)
    end

    if h.messageFade > 0 then
        local alpha = math.min(1, h.messageFade)
        g:setColor(PAL.gold[1], PAL.gold[2], PAL.gold[3], alpha)
        font:drawCentered(h.message, cx, math.floor(cy - r * 0.45), PAL.gold, 1)
        g:setColor(1, 1, 1, 1)
    end

    g:unclip()
    g:pop()
end

end
