--[[
    SHOP scene — buy items with gold, reroll, leave.
]]

local UI = require('src.ui')

local SS = {}
SS.__index = SS
function SS.new() return setmetatable({}, SS) end

function SS:enter(ctx) self.ctx = ctx; self._hot = -1; self._hotReroll = false; self._hotLeave = false end
function SS:leave() end
function SS:update(dt) end

function SS:_slotRects()
    local rects = {}
    local cols, rows = 2, 2
    local w, h = 210, 140
    local gap = 16
    local startX = (480 - (cols * w + (cols - 1) * gap)) / 2
    local startY = 120
    for i = 1, cols * rows do
        local col = (i - 1) % cols
        local row = math.floor((i - 1) / cols)
        rects[i] = {
            x = startX + col * (w + gap),
            y = startY + row * (h + gap),
            w = w, h = h,
        }
    end
    return rects
end

function SS:click(x, y)
    local rects = self:_slotRects()
    for i, r in ipairs(rects) do
        if UI.pointInRect(x, y, r.x, r.y, r.w, r.h) then
            local res = self.ctx.loop:shopBuy(i)
            if res and res.ok then
                self.ctx.kernel:emit('audio.sfx', { name = 'coin' })
            end
            return
        end
    end
    if UI.pointInRect(x, y, 60, 560, 160, 50) then
        local res = self.ctx.loop:shopReroll()
        if res and res.ok then self.ctx.kernel:emit('audio.sfx', { name = 'select' }) end
        return
    end
    if UI.pointInRect(x, y, 260, 560, 160, 50) then
        self.ctx.loop:endShop()
    end
end

function SS:mouse(x, y)
    self._hot = -1
    for i, r in ipairs(self:_slotRects()) do
        if UI.pointInRect(x, y, r.x, r.y, r.w, r.h) then self._hot = i end
    end
    self._hotReroll = UI.pointInRect(x, y, 60, 560, 160, 50)
    self._hotLeave  = UI.pointInRect(x, y, 260, 560, 160, 50)
end

function SS:key(key)
    if key == 'r' then self.ctx.loop:shopReroll()
    elseif key == 'space' or key == 'return' then self.ctx.loop:endShop()
    elseif key == '1' or key == '2' or key == '3' or key == '4' then
        local res = self.ctx.loop:shopBuy(tonumber(key))
        if res and res.ok then self.ctx.kernel:emit('audio.sfx', { name = 'coin' }) end
    end
end

function SS:draw(g, font, atlas)
    local run = self.ctx.loop.state.run
    if not run then return end

    font:drawCentered('THE FORGE', 240, 50, { 1, 0.85, 0.3, 1 }, 3)
    font:draw('GOLD ' .. run.shopCurrency, 10, 10, { 0.95, 0.85, 0.3, 1 }, 2)
    font:draw('RELICS ' .. #run.relics, 350, 10, { 0.55, 0.8, 0.95, 1 }, 2)

    local rects = self:_slotRects()
    for i, r in ipairs(rects) do
        local o = run.shopOfferings[i]
        UI.panel(g, r.x, r.y, r.w, r.h)
        if o then
            local rc = UI.rarityColor[o.rarity] or UI.rarityColor.common
            if self._hot == i then g:setColor(1, 1, 1, 0.12); g:rect('fill', r.x, r.y, r.w, r.h) end
            g:setColor(rc[1], rc[2], rc[3], 1); g:rect('fill', r.x, r.y, r.w, 4)

            font:drawWrapped(o.name:upper(), r.x + 8, r.y + 12, r.w - 16, rc, 1)
            font:draw((o.shopType or ''):upper(), r.x + 8, r.y + 30, { 0.55, 0.55, 0.65, 1 }, 1)
            font:drawWrapped(o.desc or '', r.x + 8, r.y + 48, r.w - 16, { 0.85, 0.85, 0.9, 1 }, 1)

            local priceColor = (run.shopCurrency >= o.cost) and { 0.95, 0.85, 0.3, 1 } or { 0.55, 0.35, 0.35, 1 }
            font:draw(o.cost .. ' G', r.x + 8, r.y + r.h - 18, priceColor, 2)
        elseif o == false then
            font:drawCentered('SOLD', r.x + r.w/2, r.y + r.h/2 - 5, { 0.4, 0.4, 0.45, 1 }, 2)
        end
    end

    -- Reroll button
    UI.button(g, 60, 560, 160, 50, self._hotReroll, false)
    local cost = self.ctx.loop.shop:rerollCost(run)
    font:drawCentered('REROLL ' .. cost .. 'G', 140, 576, { 1, 0.95, 0.7, 1 }, 2)

    UI.button(g, 260, 560, 160, 50, self._hotLeave, false)
    font:drawCentered('LEAVE', 340, 576, { 1, 0.95, 0.7, 1 }, 2)
end

return SS
