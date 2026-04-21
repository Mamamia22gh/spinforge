local C = require('src.game.constants')
local PAL = C.PAL
local RELICS_MOD = require('src.data.relics')

return function(Game)

function Game:_drawRelicTooltip(g)
    if not self._relicHoverRarity then return end
    local font = self._font
    if not font then return end
    local run = self.loop.state.run
    if not run then return end

    local rarity = self._relicHoverRarity
    local RARITY_NAMES = {
        common = 'COMMUNE', uncommon = 'PEU COMMUNE',
        rare = 'RARE', legendary = 'LEGENDAIRE'
    }
    local col = C.RARITY_COL[rarity] or PAL.white
    local owned = {}
    for _, r in ipairs(run.relics or {}) do
        if r.rarity == rarity then owned[#owned + 1] = r end
    end

    local PAD = 4
    local HEADER_H = 12
    local PW = 200
    local ROW_H = 10
    local totalBodyH = (#owned == 0) and ROW_H or (#owned * (ROW_H + 2))
    local PH = HEADER_H + totalBodyH + PAD * 3
    local PX0 = math.floor((C.W - PW) / 2)
    local PY0 = C.WHEEL_CY - 60

    g:setColor(0, 0, 0, 0.88)
    g:rect('fill', PX0 - 1, PY0 - 1, PW + 2, PH + 2)
    g:setColor(PAL.black[1], PAL.black[2], PAL.black[3], 1)
    g:rect('fill', PX0, PY0, PW, PH)
    g:setColor(col[1], col[2], col[3], 1)
    g:rect('line', PX0, PY0, PW, PH)

    font:drawCentered(RARITY_NAMES[rarity] or rarity:upper(),
        PX0 + math.floor(PW / 2), PY0 + PAD, col, 1)

    local curY = PY0 + PAD + HEADER_H
    if #owned == 0 then
        font:drawCentered('AUCUNE', PX0 + math.floor(PW / 2), curY, PAL.midGray, 1)
    else
        for _, r in ipairs(owned) do
            local def = RELICS_MOD.RELIC_MAP and RELICS_MOD.RELIC_MAP[r.id]
            local name = (def and def.name) or r.name or r.id
            local desc = (def and def.description) or r.description or ''
            if self._atlas then
                g:setColor(1, 1, 1, 1)
                self._atlas:drawCentered('relic_' .. rarity,
                    PX0 + PAD + math.floor(C.SPRITE_SIZE / 2),
                    curY + math.floor(ROW_H / 2), 1)
            end
            font:draw(name, PX0 + PAD + C.SPRITE_SIZE + 2, curY, col, 1)
            font:draw(desc, PX0 + 90, curY, PAL.midGray, 1)
            curY = curY + ROW_H + 2
        end
    end
end

end
