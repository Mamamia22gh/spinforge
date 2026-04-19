--[[
    SHOP scene — flipped wheel shows forge face. Scene routes clicks & draws
    tooltip for hovered offering at the bottom (uioverlay).
]]

local BALANCE = require('src.data.balance').BALANCE

local SS = {}
SS.__index = SS
function SS.new() return setmetatable({}, SS) end

function SS:enter(ctx)
    self.ctx = ctx
    local run  = ctx.loop.state.run
    local meta = ctx.loop.state.meta
    local rerollCost = ctx.loop.shop:rerollCost(run)
    local nextQuota  = 0
    if run then
        nextQuota = require('src.data.balance').getQuota(run.round + 1)
    end
    ctx.wheel:setShop(run.shopOfferings, meta.tickets, rerollCost, nextQuota)
end

function SS:leave() self.ctx.wheel:shopSetHover(nil) end

function SS:update(dt)
    local run = self.ctx.loop.state.run
    local meta = self.ctx.loop.state.meta
    local w = self.ctx.wheel
    w:shopUpdateCurrency(meta.tickets)
    w:shopSetOfferings(run.shopOfferings)

    if self._bufferedClick and not w._flip then
        local c = self._bufferedClick
        self._bufferedClick = nil
        self:click(c.x, c.y)
    end
end

function SS:click(x, y)
    local w = self.ctx.wheel
    if w._flip then
        self._bufferedClick = {x = x, y = y}
        return
    end
    if not w:isFlipped() then return end
    local hit = w:shopHitTest(x, y, self.ctx.game.WHEEL_CX, self.ctx.game.WHEEL_CY)
    if not hit then return end
    if hit.type == 'offering' then
        self.ctx.loop:shopBuy(hit.index + 1)
    elseif hit.type == 'reroll' then
        self.ctx:playSelect()
        self.ctx.loop:shopReroll()
    elseif hit.type == 'leave' then
        self.ctx:playSelect()
        self.ctx.loop:endShop()
    end
end

function SS:mouse(x, y)
    local w = self.ctx.wheel
    if w:isFlipped() then
        local oldHover = w._shop.hoverIdx
        w:shopSetHover(w:shopHitTest(x, y, self.ctx.game.WHEEL_CX, self.ctx.game.WHEEL_CY))
        if w._shop.hoverIdx ~= -1 and w._shop.hoverIdx ~= oldHover then
            self.ctx:playHover()
        end
    else
        w:shopSetHover(nil)
    end
end

function SS:key(k)
    if k == 'r' then self.ctx.loop:shopReroll()
    elseif k == 'space' or k == 'return' or k == 'escape' then self.ctx.loop:endShop()
    elseif tonumber(k) and tonumber(k) >= 1 and tonumber(k) <= 8 then
        self.ctx.loop:shopBuy(tonumber(k))
    end
end

local function rarityColor(r)
    if r == 'legendary' then return {0.95, 0.55, 0.20, 1}
    elseif r == 'rare' then return {0.40, 0.55, 0.95, 1}
    elseif r == 'uncommon' then return {0.40, 0.80, 0.45, 1}
    else return {0.91, 0.88, 0.82, 1} end
end

local TYPE_LABELS = {
    symbol       = 'SYMBOLE',
    special_ball = 'BILLE SPECIALE',
    relic        = 'RELIQUE',
}

function SS:draw(g, font, atlas)
    local hovered = self.ctx.wheel:getShopHoveredOffering()
    if not hovered then return end

    local col = rarityColor(hovered.rarity)
    local PAD = 4
    local LINE_H = 8
    local PW = 160
    local descMaxW = PW - PAD * 2

    -- Pre-calc wrap height (word-by-word, ISO legacy)
    local desc = (hovered.description or hovered.desc or ''):upper()
    local descLines = 0
    local words = {}
    for w in desc:gmatch('%S+') do words[#words+1] = w end
    local line = ''
    for _, word in ipairs(words) do
        local test = line ~= '' and (line .. ' ' .. word) or word
        if font:measure(test) > descMaxW and line ~= '' then
            descLines = descLines + 1
            line = word
        else
            line = test
        end
    end
    if line ~= '' then descLines = descLines + 1 end
    descLines = math.max(1, descLines)

    local HEADER_H = 10
    local TYPE_H = 8
    local PH = PAD * 3 + HEADER_H + TYPE_H + descLines * LINE_H

    local PX0 = math.floor((480 - PW) / 2)
    local PY0 = 270 - PH - 8

    -- Backdrop (ISO legacy _drawShopTooltip lines 1413-1420)
    g:setColor(0, 0, 0, 0.88); g:rect('fill', PX0 - 1, PY0 - 1, PW + 2, PH + 2)
    g:setColor(0.04, 0.04, 0.04, 1); g:rect('fill', PX0, PY0, PW, PH)
    g:setColor(col[1], col[2], col[3], 1); g:rect('line', PX0, PY0, PW, PH)

    -- Header: name centered (ISO legacy line 1424)
    local title = ((hovered.name or hovered.id or '???')):upper()
    font:drawCentered(title, PX0 + math.floor(PW / 2), PY0 + PAD, col, 1)

    -- Type label (ISO legacy line 1428 — was missing in Lua)
    local typeLabel = TYPE_LABELS[hovered.shopType] or ''
    font:drawCentered(typeLabel, PX0 + math.floor(PW / 2),
        PY0 + PAD + HEADER_H, { 0.42, 0.42, 0.48, 1 }, 1)

    -- Description (word-wrapped)
    font:drawWrapped(hovered.description or hovered.desc or '',
        PX0 + PAD, PY0 + PAD * 2 + HEADER_H + TYPE_H,
        descMaxW, { 0.42, 0.42, 0.48, 1 }, 1)
end

return SS
