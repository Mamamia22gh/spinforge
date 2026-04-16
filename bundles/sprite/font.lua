--[[
    BitmapFont — pixel bitmap font
    Glyph definitions come from config (injected via configure()).
    Draws pixel-by-pixel via love.graphics.rectangle
]]

local BitmapFont = {}
BitmapFont.__index = BitmapFont

function BitmapFont.new(cfg)
    cfg = cfg or {}
    local W = cfg.charWidth  or 4
    local H = cfg.charHeight or 6
    local glyphs = cfg.glyphs or {}

    -- Pre-parse into bitmask arrays
    local parsed = {}
    for ch, rows in pairs(glyphs) do
        local bits = {}
        for r = 1, #rows do
            local b = 0
            for i = 1, W do
                if rows[r]:sub(i, i) == '#' then
                    b = b + (2 ^ (W - i))
                end
            end
            bits[r] = b
        end
        parsed[ch] = bits
    end

    return setmetatable({
        _W = W,
        _H = H,
        _parsed = parsed,
    }, BitmapFont)
end

--- Internal: draw raw text (no outline)
function BitmapFont:_drawRaw(text, x, y, color, scale)
    love.graphics.setColor(color)
    local str = text:upper()
    local cx = x
    local W, H = self._W, self._H
    local parsed = self._parsed
    local i = 1
    while i <= #str do
        -- try 2-byte UTF-8 first
        local ch2 = str:sub(i, i + 1)
        local bits = parsed[ch2]
        local advance = 2
        if not bits then
            local ch1 = str:sub(i, i)
            bits = parsed[ch1]
            advance = 1
        end
        if not bits then
            cx = cx + (W + 1) * scale
            i = i + 1
        else
            for row = 0, H - 1 do
                for col = 0, W - 1 do
                    if bits[row + 1] and (math.floor(bits[row + 1] / (2 ^ (W - 1 - col))) % 2) == 1 then
                        love.graphics.rectangle('fill',
                            cx + col * scale,
                            y + row * scale,
                            scale, scale)
                    end
                end
            end
            cx = cx + (W + 1) * scale
            i = i + advance
        end
    end
end

--- Draw text with optional 4-dir outline
function BitmapFont:draw(text, x, y, color, scale, outline)
    scale = scale or 1
    if outline == nil then outline = true end
    if outline then
        local oc = {0, 0, 0, 1}
        for _, d in ipairs({{-1,0},{1,0},{0,-1},{0,1}}) do
            self:_drawRaw(text, x + d[1] * scale, y + d[2] * scale, oc, scale)
        end
    end
    self:_drawRaw(text, x, y, color, scale)
end

--- Measure text width in pixels (before scaling)
function BitmapFont:measure(text)
    return #text * (self._W + 1) - 1
end

--- Draw centered at cx
function BitmapFont:drawCentered(text, cx, y, color, scale)
    scale = scale or 1
    local w = self:measure(text) * scale
    self:draw(text, math.floor(cx - w / 2), y, color, scale, true)
end

--- Draw centered with outline color
function BitmapFont:drawCenteredOutlined(text, cx, y, color, scale, outlineColor)
    scale = scale or 1
    outlineColor = outlineColor or {0, 0, 0, 1}
    local w = self:measure(text) * scale
    local x = math.floor(cx - w / 2)
    for _, d in ipairs({{-1,0},{1,0},{0,-1},{0,1}}) do
        self:_drawRaw(text, x + d[1], y + d[2], outlineColor, scale)
    end
    self:_drawRaw(text, x, y, color, scale)
end

--- Draw with word-wrap. Returns total height used.
function BitmapFont:drawWrapped(text, x, y, maxW, color, scale)
    scale = scale or 1
    local H = self._H
    local str = text:upper()
    local words = {}
    for w in str:gmatch('%S+') do table.insert(words, w) end
    local line = ''
    local ly = y
    for _, word in ipairs(words) do
        local test = line ~= '' and (line .. ' ' .. word) or word
        if self:measure(test) * scale > maxW and line ~= '' then
            self:draw(line, x, ly, color, scale)
            ly = ly + (H + 2) * scale
            line = word
        else
            line = test
        end
    end
    if line ~= '' then self:draw(line, x, ly, color, scale) end
    return ly + H * scale - y
end

BitmapFont.CHAR_W = 4  -- legacy compat, use instance._W
BitmapFont.CHAR_H = 6  -- legacy compat, use instance._H

return BitmapFont
