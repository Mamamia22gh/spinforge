local C = require('src.game.constants')
local PAL = C.PAL
local WU_DATA = require('src.data.wheel_upgrades').WHEEL_UPGRADES
local RELICS_MOD = require('src.data.relics')
local CHOICES_DATA = require('src.data.choices').CHOICES
local spritesData = require('bundles.sprite.sprites_data')

return function(Game)

function Game:_openCatalogue()
    if self._themeMenuOpen then self:_closeThemeMenu() end
    self._catalogueOpen = true
    self._catalogueTab = 0
    self._catalogueScroll = 0
end

function Game:_closeCatalogue()
    self._catalogueOpen = false
end

function Game:_drawCatalogue(g)
    if not self._catalogueOpen then return end
    local font = self._font
    if not font then return end

    local TAB_NAMES = { 'UPGRADES', 'RELIQUES', 'BILLES SP.' }
    local TAB_DATA = { {}, {}, {} }
    for _, u in ipairs(WU_DATA) do
        TAB_DATA[1][#TAB_DATA[1] + 1] = { name = u.name, rarity = u.rarity, desc = u.description or '' }
    end
    for _, r in ipairs(RELICS_MOD.RELICS) do
        TAB_DATA[2][#TAB_DATA[2] + 1] = {
            name = r.name, sprite = 'relic_' .. r.rarity,
            rarity = r.rarity, desc = r.description or ''
        }
    end
    for _, c in ipairs(CHOICES_DATA) do
        if c.type == 'special_ball' then
            TAB_DATA[3][#TAB_DATA[3] + 1] = {
                name = c.name, sprite = 'ball',
                rarity = c.rarity, desc = c.description or ''
            }
        end
    end

    local PW, PH = 320, 200
    local PX0 = math.floor((C.W - PW) / 2)
    local PY0 = math.floor((C.H - PH) / 2)
    local TAB_H, HEAD_H, ROW_H = 14, 12, 10
    local BODY_Y = PY0 + TAB_H + HEAD_H
    local BODY_H = PH - TAB_H - HEAD_H - 6
    local MAX_ROWS = math.floor(BODY_H / ROW_H)

    g:setColor(0, 0, 0, 0.82)
    g:rect('fill', PX0 - 2, PY0 - 2, PW + 4, PH + 4)
    g:setColor(PAL.black[1], PAL.black[2], PAL.black[3], 1)
    g:rect('fill', PX0, PY0, PW, PH)
    g:setColor(PAL.darkGold[1], PAL.darkGold[2], PAL.darkGold[3], 1)
    g:rect('line', PX0, PY0, PW, PH)

    local tabW = math.floor(PW / #TAB_NAMES)
    for t = 1, #TAB_NAMES do
        local tx = PX0 + (t - 1) * tabW
        if t - 1 == self._catalogueTab then
            g:setColor(PAL.darkRed[1], PAL.darkRed[2], PAL.darkRed[3], 1)
            g:rect('fill', tx, PY0, tabW, TAB_H)
        end
        g:setColor(PAL.darkGold[1], PAL.darkGold[2], PAL.darkGold[3], 1)
        g:rect('line', tx, PY0, tabW, TAB_H)
        local tc = (t - 1 == self._catalogueTab) and PAL.gold or PAL.midGray
        font:drawCentered(TAB_NAMES[t], tx + math.floor(tabW / 2), PY0 + 3, tc, 1)
    end

    font:draw('NOM', PX0 + 4, PY0 + TAB_H + 1, PAL.gold, 1)
    font:draw('DESCRIPTION', PX0 + 100, PY0 + TAB_H + 1, PAL.gold, 1)

    local items = TAB_DATA[self._catalogueTab + 1] or {}
    local maxScroll = math.max(0, #items - MAX_ROWS)
    if self._catalogueScroll > maxScroll then self._catalogueScroll = maxScroll end

    for i = 1, math.min(MAX_ROWS, #items - self._catalogueScroll) do
        local it = items[self._catalogueScroll + i]
        local ry = BODY_Y + (i - 1) * ROW_H
        local col = (it.rarity and C.RARITY_COL[it.rarity]) or PAL.white
        if it.sprite and self._atlas then
            g:setColor(1, 1, 1, 1)
            self._atlas:drawCentered(it.sprite,
                PX0 + 4 + math.floor(C.SPRITE_SIZE / 2),
                ry + math.floor(ROW_H / 2), 1)
        end
        font:draw(it.name or '', PX0 + 4 + C.SPRITE_SIZE + 2, ry, col, 1)
        font:draw(it.desc or '', PX0 + 100, ry, PAL.midGray, 1)
    end

    if #items > MAX_ROWS then
        local pct = self._catalogueScroll / math.max(1, #items - MAX_ROWS)
        local sbH = math.max(8, math.floor(BODY_H * MAX_ROWS / #items))
        local sbY = BODY_Y + math.floor((BODY_H - sbH) * pct)
        g:setColor(PAL.darkGold[1], PAL.darkGold[2], PAL.darkGold[3], 1)
        g:rect('fill', PX0 + PW - 5, sbY, 3, sbH)
    end

    font:drawCentered('[ESC] FERMER', PX0 + math.floor(PW / 2), PY0 + PH - 9, PAL.darkGold, 1)

    local dbtnW, dbtnH = 80, 12
    local dbtnX = PX0 + math.floor((PW - dbtnW) / 2)
    local dbtnY = PY0 + PH + 4
    g:setColor(PAL.midGray[1], PAL.midGray[2], PAL.midGray[3], 1)
    g:rect('fill', dbtnX, dbtnY, dbtnW, dbtnH)
    g:setColor(PAL.lightGray[1], PAL.lightGray[2], PAL.lightGray[3], 1)
    g:rect('line', dbtnX, dbtnY, dbtnW, dbtnH)
    font:drawCentered('DEBUG SPRITES', dbtnX + math.floor(dbtnW / 2), dbtnY + 2, PAL.white, 1)
end

function Game:_catalogueClick(x, y)
    local PW, PH = 320, 200
    local PX0 = math.floor((C.W - PW) / 2)
    local PY0 = math.floor((C.H - PH) / 2)
    local TAB_H = 14

    local dbtnW, dbtnH = 80, 12
    local dbtnX = PX0 + math.floor((PW - dbtnW) / 2)
    local dbtnY = PY0 + PH + 4
    if x >= dbtnX and x <= dbtnX + dbtnW and y >= dbtnY and y <= dbtnY + dbtnH then
        self:_closeCatalogue()
        self._debugSpritesOpen = true
        self._debugScroll = 0
        return
    end
    if x < PX0 or x > PX0 + PW or y < PY0 or y > PY0 + PH then
        self:_closeCatalogue()
        return
    end
    if y >= PY0 and y < PY0 + TAB_H then
        local tabW = math.floor(PW / 3)
        local t = math.floor((x - PX0) / tabW)
        if t >= 0 and t < 3 then
            self._catalogueTab = t
            self._catalogueScroll = 0
        end
    end
end

function Game:_getSpriteIds()
    if self._spriteIdsCache then return self._spriteIdsCache end
    local list = {}
    for id in pairs(spritesData.SPRITES or {}) do
        list[#list + 1] = { id = id, anim = false }
    end
    for id in pairs(spritesData.ANIM_SPRITES or {}) do
        list[#list + 1] = { id = id, anim = true }
    end
    table.sort(list, function(a, b)
        if a.anim ~= b.anim then return not a.anim end
        return a.id < b.id
    end)
    self._spriteIdsCache = list
    return list
end

function Game:_drawDebugSprites(g)
    if not self._debugSpritesOpen then return end
    local font = self._font
    local atlas = self._atlas
    if not font or not atlas then return end

    local allIds = self:_getSpriteIds()
    local PW, PH = 400, 230
    local PX0 = math.floor((C.W - PW) / 2)
    local PY0 = math.floor((C.H - PH) / 2)
    local CELL = 28
    local COLS = math.floor((PW - 8) / CELL)
    local ROWS = math.floor((PH - 20) / CELL)
    local maxScroll = math.max(0, math.ceil(#allIds / COLS) - ROWS)
    if self._debugScroll > maxScroll then self._debugScroll = maxScroll end

    g:setColor(0, 0, 0, 0.88)
    g:rect('fill', PX0 - 2, PY0 - 2, PW + 4, PH + 4)
    g:setColor(PAL.black[1], PAL.black[2], PAL.black[3], 1)
    g:rect('fill', PX0, PY0, PW, PH)
    g:setColor(PAL.midGray[1], PAL.midGray[2], PAL.midGray[3], 1)
    g:rect('line', PX0, PY0, PW, PH)

    font:drawCentered('DEBUG SPRITES (' .. #allIds .. ')',
        PX0 + math.floor(PW / 2), PY0 + 3, PAL.white, 1)

    local gridY0 = PY0 + 14
    love.graphics.setScissor(PX0, gridY0, PW, PH - 20)

    for i, entry in ipairs(allIds) do
        local row = math.floor((i - 1) / COLS) - self._debugScroll
        local col = (i - 1) % COLS
        if row >= -1 and row <= ROWS then
            local ccx = PX0 + 6 + col * CELL + math.floor(CELL / 2)
            local ccy = gridY0 + row * CELL + math.floor(CELL / 2)
            g:setColor(PAL.midGray[1], PAL.midGray[2], PAL.midGray[3], 0.5)
            g:rect('line', ccx - math.floor(CELL / 2), ccy - math.floor(CELL / 2), CELL - 1, CELL - 1)
            g:setColor(1, 1, 1, 1)
            if entry.anim then atlas:drawAnim(entry.id, ccx, ccy - 3, 1, self._time, 8)
            else atlas:drawCentered(entry.id, ccx, ccy - 3, 1) end
            local label = #entry.id > 5 and (entry.id:sub(1, 4) .. '.') or entry.id
            local lc = entry.anim and PAL.gold or PAL.darkGold
            font:drawCentered(label, ccx, ccy + 7, lc, 1)
        end
    end

    love.graphics.setScissor()
    if maxScroll > 0 then
        local sbTotalH = PH - 20
        local pct = self._debugScroll / maxScroll
        local sbH = math.max(8, math.floor(sbTotalH * ROWS / math.ceil(#allIds / COLS)))
        local sbY = gridY0 + math.floor((sbTotalH - sbH) * pct)
        g:setColor(PAL.midGray[1], PAL.midGray[2], PAL.midGray[3], 1)
        g:rect('fill', PX0 + PW - 5, sbY, 3, sbH)
    end
    font:drawCentered('[ESC] FERMER', PX0 + math.floor(PW / 2), PY0 + PH - 9, PAL.midGray, 1)
end

end
