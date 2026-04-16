--[[
    BitmapFont — 4x6 pixel bitmap font
    Port of BitmapFont.js
    Draws pixel-by-pixel via love.graphics.rectangle
]]

local W = 4
local H = 6

-- ── Glyph definitions ('.'/space = empty, '#' = pixel) ──────────────
local GLYPHS = {
    ['0'] = {'.##.','#..#','#..#','#..#','.##.','....'},
    ['1'] = {'..#.','..#.','..#.','..#.','..#.','....'},
    ['2'] = {'.##.','#..#','..#.','.#..','####','....'},
    ['3'] = {'.##.','#..#','..#.','#..#','.##.','....'},
    ['4'] = {'#..#','#..#','####','...#','...#','....'},
    ['5'] = {'####','#...','###.','...#','###.','....'},
    ['6'] = {'.##.','#...','###.','#..#','.##.','....'},
    ['7'] = {'####','...#','..#.','.#..','.#..','....'},
    ['8'] = {'.##.','#..#','.##.','#..#','.##.','....'},
    ['9'] = {'.##.','#..#','.###','...#','.##.','....'},
    ['A'] = {'.##.','#..#','####','#..#','#..#','....'},
    ['B'] = {'###.','#..#','###.','#..#','###.','....'},
    ['C'] = {'.###','#...','#...','#...','.###','....'},
    ['D'] = {'###.','#..#','#..#','#..#','###.','....'},
    ['E'] = {'####','#...','###.','#...','####','....'},
    ['F'] = {'####','#...','###.','#...','#...','....'},
    ['G'] = {'.###','#...','#.##','#..#','.###','....'},
    ['H'] = {'#..#','#..#','####','#..#','#..#','....'},
    ['I'] = {'###.','.#..','.#..','.#..','###.','....'},
    ['J'] = {'..##','...#','...#','#..#','.##.','....'},
    ['K'] = {'#..#','#.#.','##..','#.#.','#..#','....'},
    ['L'] = {'#...','#...','#...','#...','####','....'},
    ['M'] = {'#..#','####','####','#..#','#..#','....'},
    ['N'] = {'#..#','##.#','#.##','#..#','#..#','....'},
    ['O'] = {'.##.','#..#','#..#','#..#','.##.','....'},
    ['P'] = {'###.','#..#','###.','#...','#...','....'},
    ['Q'] = {'.##.','#..#','#..#','#.#.','.#.#','....'},
    ['R'] = {'###.','#..#','###.','#.#.','#..#','....'},
    ['S'] = {'.###','#...','####','...#','###.','....'},
    ['T'] = {'####','..#.','..#.','..#.','..#.','....'},
    ['U'] = {'#..#','#..#','#..#','#..#','.##.','....'},
    ['V'] = {'#..#','#..#','#..#','.##.','..#.','....'},
    ['W'] = {'#..#','#..#','####','####','#..#','....'},
    ['X'] = {'#..#','.##.','..#.','.##.','#..#','....'},
    ['Y'] = {'#..#','.##.','..#.','..#.','..#.','....'},
    ['Z'] = {'####','..#.','.#..','#...','####','....'},
    ['+'] = {'....','..#.','.###','..#.','....','....'},
    ['-'] = {'....','....','####','....','....','....'},
    ['/'] = {'...#','..#.','.#..','#...','....','....'},
    ['!'] = {'..#.','..#.','..#.','....','..#.','....'},
    [':'] = {'....','..#.','....','..#.','....','....'},
    ['.'] = {'....','....','....','....','..#.','....'},
    [' '] = {'....','....','....','....','....','....'},
    ['?'] = {'.##.','#..#','..#.','....','..#.','....'},
    -- Accented
    ['\195\137'] = {'..#.','####','#...','###.','#...','####'}, -- É
    ['\195\136'] = {'.#..','####','#...','###.','#...','####'}, -- È
    ['\195\138'] = {'.##.','####','#...','###.','#...','####'}, -- Ê
    ['\195\128'] = {'.#..','.##.','#..#','####','#..#','#..#'}, -- À
    ['\195\148'] = {'.##.','.##.','#..#','#..#','#..#','.##.'}, -- Ô
    ['\195\142'] = {'.##.','###.','.#..','.#..','.#..','###.'}, -- Î
    ['\195\153'] = {'.#..','#..#','#..#','#..#','#..#','.##.'}, -- Ù
    ['\195\135'] = {'.###','#...','#...','#...','.###','.#..'}, -- Ç
    ["'"] = {'..#.','..#.','....','....','....','....'},
    ['('] = {'..#.','.#..','.#..','.#..','..#.','....'},
    [')'] = {'.#..','..#.','..#.','..#.','.#..','....'},
}

-- Pre-parse into bitmask arrays
local PARSED = {}
for ch, rows in pairs(GLYPHS) do
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
    PARSED[ch] = bits
end

-- ── BitmapFont class ────────────────────────────────────────────────
local BitmapFont = {}
BitmapFont.__index = BitmapFont

function BitmapFont.new()
    return setmetatable({}, BitmapFont)
end

--- Internal: draw raw text (no outline)
function BitmapFont:_drawRaw(text, x, y, color, scale)
    love.graphics.setColor(color)
    local str = text:upper()
    local cx = x
    local i = 1
    while i <= #str do
        -- try 2-byte UTF-8 first
        local ch2 = str:sub(i, i + 1)
        local bits = PARSED[ch2]
        local advance = 2
        if not bits then
            local ch1 = str:sub(i, i)
            bits = PARSED[ch1]
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
    return #text * (W + 1) - 1
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

BitmapFont.CHAR_W = W
BitmapFont.CHAR_H = H

return BitmapFont
