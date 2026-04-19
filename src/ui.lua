--[[
    UI — small helpers: buttons, boxes, rarity colors. Landscape 480×270.
]]

local UI = {}

UI.WHEEL_CX = 240
UI.WHEEL_CY = 140
UI.WHEEL_R  = 110

UI.rarityColor = {
    common    = { 0.75, 0.75, 0.80, 1 },
    uncommon  = { 0.40, 0.80, 0.45, 1 },
    rare      = { 0.40, 0.55, 0.95, 1 },
    legendary = { 0.95, 0.55, 0.20, 1 },
}

function UI.pointInRect(x, y, rx, ry, rw, rh)
    return x >= rx and x <= rx + rw and y >= ry and y <= ry + rh
end

function UI.panel(g, x, y, w, h, tint)
    tint = tint or { 0.08, 0.07, 0.12, 0.92 }
    g:setColor(tint[1], tint[2], tint[3], tint[4] or 1)
    g:rect('fill', x, y, w, h)
    g:setColor(0.8, 0.65, 0.25, 0.55)
    g:rect('line', x, y, w, h)
end

function UI.button(g, x, y, w, h, hot, pressed)
    if pressed then
        g:setColor(0.28, 0.20, 0.08, 1)
    elseif hot then
        g:setColor(0.45, 0.32, 0.15, 1)
    else
        g:setColor(0.22, 0.16, 0.08, 1)
    end
    g:rect('fill', x, y, w, h)
    g:setColor(0.92, 0.75, 0.28, 1)
    g:rect('line', x, y, w, h)
    -- pixel corner beveling
    g:setColor(0.12, 0.10, 0.05, 1)
    g:rect('fill', x, y, 1, 1)
    g:rect('fill', x + w - 1, y, 1, 1)
    g:rect('fill', x, y + h - 1, 1, 1)
    g:rect('fill', x + w - 1, y + h - 1, 1, 1)
end

-- Small pill HUD chip for stats
function UI.chip(g, font, x, y, label, value, color)
    color = color or { 0.92, 0.86, 0.55, 1 }
    g:setColor(0.06, 0.05, 0.09, 0.85)
    g:rect('fill', x, y, 62, 15)
    g:setColor(color[1], color[2], color[3], 0.5)
    g:rect('line', x, y, 62, 15)
    font:draw(label, x + 3, y + 4, { 0.55, 0.5, 0.45, 1 }, 1)
    font:draw(tostring(value), x + 26, y + 4, color, 1)
end

return UI
