--[[
    CHOICE scene — pick 1 of 3 between-round offerings.
]]

local UI = require('src.ui')

local CS = {}
CS.__index = CS
function CS.new() return setmetatable({}, CS) end

function CS:enter(ctx) self.ctx = ctx; self._hot = -1 end
function CS:leave() end
function CS:update(dt) end

function CS:_rects()
    local rects = {}
    local w, h = 300, 100
    local x = (480 - w) / 2
    for i = 1, 3 do
        rects[i] = { x = x, y = 130 + (i - 1) * 120, w = w, h = h }
    end
    return rects
end

function CS:click(x, y)
    local rects = self:_rects()
    for i, r in ipairs(rects) do
        if UI.pointInRect(x, y, r.x, r.y, r.w, r.h) then
            self.ctx.loop:makeChoice(i)
            return
        end
    end
    if UI.pointInRect(x, y, 170, 560, 140, 40) then
        self.ctx.loop:skipChoice()
    end
end

function CS:mouse(x, y)
    self._hot = -1
    for i, r in ipairs(self:_rects()) do
        if UI.pointInRect(x, y, r.x, r.y, r.w, r.h) then self._hot = i; return end
    end
end

function CS:key(key)
    if key == '1' or key == '2' or key == '3' then
        self.ctx.loop:makeChoice(tonumber(key))
    elseif key == 's' or key == 'escape' then
        self.ctx.loop:skipChoice()
    end
end

function CS:draw(g, font, atlas)
    local run = self.ctx.loop.state.run
    if not run then return end

    font:drawCentered('CHOOSE A BOON', 240, 60, { 1, 0.85, 0.3, 1 }, 3)

    local rects = self:_rects()
    for i, r in ipairs(rects) do
        local c = run.currentChoices[i]
        if c then
            local rcolor = UI.rarityColor[c.rarity] or UI.rarityColor.common
            UI.panel(g, r.x, r.y, r.w, r.h, { 0.12, 0.10, 0.18, 1 })
            if self._hot == i then
                g:setColor(1, 1, 1, 0.15)
                g:rect('fill', r.x, r.y, r.w, r.h)
            end
            g:setColor(rcolor[1], rcolor[2], rcolor[3], 1)
            g:rect('fill', r.x, r.y, 6, r.h)

            font:draw(c.name:upper(), r.x + 16, r.y + 12, rcolor, 2)
            font:draw((c.type or ''):upper(), r.x + 16, r.y + 36, { 0.55, 0.55, 0.65, 1 }, 1)
            font:drawWrapped(c.desc or '', r.x + 16, r.y + 54, r.w - 32, { 0.85, 0.85, 0.9, 1 }, 1)
        else
            UI.panel(g, r.x, r.y, r.w, r.h)
            font:drawCentered('- empty -', r.x + r.w/2, r.y + r.h/2 - 5, { 0.5, 0.5, 0.5, 1 }, 1)
        end
    end

    UI.button(g, 170, 560, 140, 40, false, false)
    font:drawCentered('SKIP', 240, 574, { 0.9, 0.9, 0.9, 1 }, 2)
    font:drawCentered('press 1/2/3 or click', 240, 608, { 0.45, 0.45, 0.55, 1 }, 1)
end

return CS
