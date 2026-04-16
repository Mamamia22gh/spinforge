--[[
    UI — small helpers: buttons, boxes, rarity colors.
]]

local UI = {}

UI.rarityColor = {
    common    = { 0.75, 0.75, 0.80, 1 },
    uncommon  = { 0.40, 0.80, 0.45, 1 },
    rare      = { 0.40, 0.55, 0.95, 1 },
    legendary = { 0.95, 0.55, 0.20, 1 },
}

function UI.pointInRect(x, y, rx, ry, rw, rh)
    return x >= rx and x <= rx + rw and y >= ry and y <= ry + rh
end

-- Draws a pixel-art-ish box; returns nothing.
function UI.panel(g, x, y, w, h, tint)
    tint = tint or { 0.12, 0.10, 0.16, 1 }
    g:setColor(tint[1], tint[2], tint[3], tint[4] or 1)
    g:rect('fill', x, y, w, h)
    g:setColor(1, 1, 1, 0.25)
    g:rect('line', x, y, w, h)
end

function UI.button(g, x, y, w, h, hot, pressed)
    if pressed then
        g:setColor(0.32, 0.25, 0.12, 1)
    elseif hot then
        g:setColor(0.45, 0.32, 0.18, 1)
    else
        g:setColor(0.28, 0.20, 0.12, 1)
    end
    g:rect('fill', x, y, w, h)
    g:setColor(0.9, 0.75, 0.3, 1)
    g:rect('line', x, y, w, h)
end

return UI
