-- scenes/shop.lua — SHOP phase: flipped wheel, buy/reroll/leave. Event-driven.

local C = require('src.game.constants')
local SA = C.SHOP_ACTION
local EV = C.EVENT

local SS = {}
SS.__index = SS
function SS.new() return setmetatable({}, SS) end

function SS:enter(game)
    self.game = game
    game.engine:clearEvents()
    self:_refreshShopUI()
    if game.wheel and not game.wheel:isFlipped() then game.wheel:startFlip(0.5) end
end

function SS:_refreshShopUI()
    local g = self.game
    local slots = g.engine:shopSlots()
    local offerings = {}
    for i, s in ipairs(slots) do
        if not s.sold then
            offerings[i] = {
                shopType = ({ [0]='ball', 'relic', 'upgrade' })[s.kind] or 'ball',
                name = self:_slotName(s),
                rarity = ({ [0]='common','uncommon','rare','legendary' })[s.rarity] or 'common',
                alteration = ({ [0]='normal', 'corrupted', 'purified' })[s.alteration] or 'normal',
                finalCost = s.price,
                description = '',
            }
        end
    end
    local tickets = g.engine:tickets()
    local rerollCost = g.engine:shopRerollCost()
    local nextQuota = g.engine:quota()
    g.wheel:setShop(offerings, tickets, rerollCost, nextQuota)
end

function SS:_slotName(s)
    local BALL_NAMES = { [0]='Score Once', 'Score Double', 'Score Adjacent', 'Score Tickets' }
    local RELIC_NAMES = { [0]='Set All 20', 'Set All 19', 'Golden Bonus', 'Corruption Shield' }
    local UPG_NAMES = { [0]='Ticket/Ball', 'Buy Discount', 'Round End Gold' }
    if s.kind == 0 then return BALL_NAMES[s.subtype] or 'Ball'
    elseif s.kind == 1 then return RELIC_NAMES[s.subtype] or 'Relic'
    else return UPG_NAMES[s.subtype] or 'Upgrade' end
end

function SS:leave()
    self.game.wheel:shopSetHover(nil)
    if self.game.wheel:isFlipped() then self.game.wheel:startFlip(0.5) end
end

function SS:_processShopEvents()
    local g = self.game
    local events = g.engine:pollEvents()
    for _, ev in ipairs(events) do
        if ev.kind == EV.ITEM_BOUGHT then
            g._kernel:emit('audio.sfx', { name = 'purchase' })
            g:_pop('BOUGHT!', nil, nil, { color = C.PAL.gold, noCoin = true })
        elseif ev.kind == EV.RELIC_TRIGGERED then
            g.wheel:flashRelic(ev.a)
        elseif ev.kind == EV.UPGRADE_TRIGGERED then
            g.wheel:flashUpgrade(ev.a)
        elseif ev.kind == EV.TICKETS_CHANGED then
            g.wheel:shopUpdateCurrency(ev.b)
        elseif ev.kind == EV.CORRUPTION_CHANGED then
            local newCorr = ev.b / 1000.0
            g.wheel:setCorruption(newCorr)
        end
    end
end

function SS:update(dt)
    local g = self.game
    if self._bufferedClick and not g.wheel._flip then
        local c = self._bufferedClick
        self._bufferedClick = nil
        self:click(c.x, c.y)
    end
end

function SS:click(x, y)
    local g = self.game
    local w = g.wheel
    if w._flip then self._bufferedClick = {x=x, y=y}; return end
    if not w:isFlipped() then return end

    local sellKey = w:sellHitTest(x, y)
    if sellKey == 'ball' then
        g:playSelect()
        g.engine:shopAction(SA.SELL_BALL)
        self:_processShopEvents()
        self:_refreshShopUI()
        g:_syncWheel()
        return
    elseif sellKey and sellKey:sub(1, 8) == 'upgrade_' then
        local idx = tonumber(sellKey:sub(9)) - 1
        g:playSelect()
        g.engine:shopAction(SA.SELL_UPGRADE_BASE + idx)
        self:_processShopEvents()
        self:_refreshShopUI()
        g:_syncWheel()
        return
    end

    local hit = w:shopHitTest(x, y, C.WHEEL_CX, C.WHEEL_CY)
    if not hit then return end
    if hit.type == 'offering' then
        local actionId = hit.index
        local slots = g.engine:shopSlots()
        local slot = slots[actionId + 1]
        if slot then
            local rustAction
            if slot.kind == 0 then rustAction = SA.BUY_BALL_1 + (actionId % 3)
            elseif slot.kind == 1 then rustAction = SA.BUY_RELIC_1 + ((actionId - 3) % 3)
            else rustAction = SA.BUY_UPGRADE end
            g.engine:shopAction(rustAction)
            self:_processShopEvents()
            self:_refreshShopUI()
        end
    elseif hit.type == 'reroll' then
        g:playSelect()
        g.engine:shopAction(SA.REROLL)
        self:_processShopEvents()
        self:_refreshShopUI()
    elseif hit.type == 'leave' then
        g:playSelect()
        g.engine:shopAction(SA.CONTINUE)
        g.engine:clearEvents()
        g:_syncWheel()
        g:_playSongForPhase('IDLE')
        g:_switchScene('IDLE')
    end
end

function SS:mouse(x, y)
    local w = self.game.wheel
    if w:isFlipped() then
        local sellKey = w:sellHitTest(x, y)
        w:shopSetSellHover(sellKey)

        local oldHover = w._shop.hoverIdx
        w:shopSetHover(w:shopHitTest(x, y, C.WHEEL_CX, C.WHEEL_CY))
        if w._shop.hoverIdx ~= -1 and w._shop.hoverIdx ~= oldHover then
            self.game:playHover()
        end
        if sellKey and not self._lastSellHover then
            self.game:playHover()
        end
        self._lastSellHover = sellKey
    else
        w:shopSetHover(nil)
        w:shopSetSellHover(nil)
    end
end

function SS:key(k)
    if k == 'r' then
        self.game.engine:shopAction(SA.REROLL)
        self:_processShopEvents()
        self:_refreshShopUI()
    elseif k == 'space' or k == 'return' or k == 'escape' then
        self.game.engine:shopAction(SA.CONTINUE)
        self.game.engine:clearEvents()
        self.game:_syncWheel()
        self.game:_playSongForPhase('IDLE')
        self.game:_switchScene('IDLE')
    end
end

function SS:draw(g, font, atlas)
    local hovered = self.game.wheel:getShopHoveredOffering()
    if not hovered then return end
    local col = { 0.91, 0.88, 0.82, 1 }
    local PAD, PW = 4, 160
    local PH = PAD * 3 + 10 + 8 + 8
    local PX0 = math.floor((480 - PW) / 2)
    local PY0 = 270 - PH - 8
    g:setColor(0, 0, 0, 0.88); g:rect('fill', PX0-1, PY0-1, PW+2, PH+2)
    g:setColor(0.04, 0.04, 0.04, 1); g:rect('fill', PX0, PY0, PW, PH)

    local qual = hovered.alteration or 'normal'
    if qual == 'corrupted' then
        g:setColor(0.55, 0.15, 0.75, 0.3); g:rect('fill', PX0, PY0, PW, PH)
        g:setColor(0.55, 0.15, 0.75, 1); g:rect('line', PX0, PY0, PW, PH)
    elseif qual == 'purified' then
        g:setColor(0.95, 0.95, 1.0, 0.2); g:rect('fill', PX0, PY0, PW, PH)
        g:setColor(0.95, 0.95, 1.0, 1); g:rect('line', PX0, PY0, PW, PH)
    else
        g:setColor(col[1], col[2], col[3], 1); g:rect('line', PX0, PY0, PW, PH)
    end

    local title = ((hovered.name or '???')):upper()
    font:drawCentered(title, PX0 + math.floor(PW/2), PY0 + PAD, col, 1)

    if qual ~= 'normal' then
        local qualLabel = qual == 'corrupted' and 'CORRUPTED' or 'PURIFIED'
        local qualCol = qual == 'corrupted' and { 0.55, 0.15, 0.75, 1 } or { 0.95, 0.95, 1.0, 1 }
        font:drawCentered(qualLabel, PX0 + math.floor(PW/2), PY0 + PAD + 12, qualCol, 1)
    end
end

return SS
