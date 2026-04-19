--[[ Chromatic aberration helpers — port of legacy/client/gfx/ChromaFX.js
     Draws a faint red ghost offset right, faint blue ghost offset left,
     then the original color on top. Works for bitmap text and sprites. ]]

local PAL = require("src.palette")

local M = {}

local function _pushAlpha(mult)
    local r, g, b, a = love.graphics.getColor()
    return r, g, b, a, a * mult
end

--- @param font BitmapFont instance (has :draw / :drawCentered)
function M.text(font, text, x, y, color, scale, offset)
    scale  = scale  or 1
    offset = offset or 1
    local r, g, b, a, ghostA = _pushAlpha(0.08)
    font:draw(text, x + offset, y, PAL.red,  scale)
    love.graphics.setColor(r, g, b, ghostA)
    font:draw(text, x - offset, y, PAL.blue, scale)
    love.graphics.setColor(r, g, b, a)
    font:draw(text, x, y, color, scale)
end

function M.textCentered(font, text, cx, y, color, scale, offset)
    scale  = scale  or 1
    offset = offset or 1
    local r, g, b, a, ghostA = _pushAlpha(0.08)
    love.graphics.setColor(r, g, b, ghostA)
    font:drawCentered(text, cx + offset, y, PAL.red,  scale)
    font:drawCentered(text, cx - offset, y, PAL.blue, scale)
    love.graphics.setColor(r, g, b, a)
    font:drawCentered(text, cx, y, color, scale)
end

--- Draw a sprite centered with RGB-split ghosts.
--- @param draw function(dx, dy) — caller provides sprite draw closure
function M.sprite(draw, cx, cy, offset)
    offset = offset or 1
    local r, g, b, a, ghostA = _pushAlpha(0.05)
    love.graphics.setColor(PAL.red[1], PAL.red[2], PAL.red[3], ghostA)
    draw(cx + offset, cy)
    love.graphics.setColor(PAL.blue[1], PAL.blue[2], PAL.blue[3], ghostA)
    draw(cx - offset, cy)
    love.graphics.setColor(r, g, b, a)
    draw(cx, cy)
end

return M
