--[[
    SpriteAtlas — generates pixel art sprites in memory as Love2D ImageData/Images
    Palette and hiero color come from config (injected via boot).
]]

local sprites_data = require("bundles.sprite.sprites_data")

local SpriteAtlas = {}
SpriteAtlas.__index = SpriteAtlas

function SpriteAtlas.new()
    return setmetatable({
        _images = {},      -- id → love.Image
        _anims = {},       -- id → { frames = { love.Image, ... }, w, h }
        _sizes = {},       -- id → { w, h }
    }, SpriteAtlas)
end

--- Convert pixel art string data into a love.ImageData
local function renderSprite(rows, palette)
    local h = #rows
    local w = #rows[1]
    local imgData = love.image.newImageData(w, h)
    for y = 0, h - 1 do
        local row = rows[y + 1]
        for x = 0, w - 1 do
            local ch = row:sub(x + 1, x + 1)
            if ch ~= '.' then
                local col = palette[ch]
                if col then
                    imgData:setPixel(x, y, col[1]/255, col[2]/255, col[3]/255, 1)
                end
            end
        end
    end
    return imgData
end

--- Convert hieroglyph (monochrome)
local function renderHiero(rows, hieroColor)
    local h = #rows
    local w = #rows[1]
    local imgData = love.image.newImageData(w, h)
    local wr = hieroColor[1]/255
    local wg = hieroColor[2]/255
    local wb = hieroColor[3]/255
    for y = 0, h - 1 do
        local row = rows[y + 1]
        for x = 0, w - 1 do
            if row:sub(x + 1, x + 1) == '#' then
                imgData:setPixel(x, y, wr, wg, wb, 1)
            end
        end
    end
    return imgData
end

function SpriteAtlas:generateAll(cfg)
    cfg = cfg or {}
    local palette = cfg.palette or sprites_data.PALETTE
    local hieroColor = cfg.hieroColor or { 0xe8, 0xe0, 0xd0 }
    local data = sprites_data

    -- Static sprites
    for id, info in pairs(data.SPRITES) do
        local imgData = renderSprite(info.rows, palette)
        local img = love.graphics.newImage(imgData)
        img:setFilter('nearest', 'nearest')
        self._images[id] = img
        self._sizes[id] = { w = #info.rows[1], h = #info.rows }
    end

    -- Animated sprites
    for id, info in pairs(data.ANIM_SPRITES) do
        local frames = {}
        for f, frameRows in ipairs(info.frames) do
            local imgData = renderSprite(frameRows, palette)
            local img = love.graphics.newImage(imgData)
            img:setFilter('nearest', 'nearest')
            frames[f] = img
        end
        self._anims[id] = { frames = frames, w = #info.frames[1][1], h = #info.frames[1] }
    end

    -- Hieroglyphs
    for id, rows in pairs(data.HIERO_GLYPHS) do
        local imgData = renderHiero(rows, hieroColor)
        local img = love.graphics.newImage(imgData)
        img:setFilter('nearest', 'nearest')
        self._images[id] = img
        self._sizes[id] = { w = #rows[1], h = #rows }
    end
end

--- Draw a sprite at (x, y) with scale
function SpriteAtlas:draw(id, x, y, scale)
    local img = self._images[id]
    if not img then return end
    love.graphics.draw(img, x, y, 0, scale, scale)
end

--- Draw centered at (cx, cy)
function SpriteAtlas:drawCentered(id, cx, cy, scale)
    local img = self._images[id]
    if not img then return end
    local w, h = img:getWidth() * scale, img:getHeight() * scale
    love.graphics.draw(img, math.floor(cx - w/2), math.floor(cy - h/2), 0, scale, scale)
end

--- Draw animated sprite centered
function SpriteAtlas:drawAnim(id, cx, cy, scale, time, fps)
    local anim = self._anims[id]
    if not anim then return end
    fps = fps or 6
    local frame = math.floor(time * fps) % #anim.frames + 1
    local img = anim.frames[frame]
    if not img then return end
    local w, h = img:getWidth() * scale, img:getHeight() * scale
    love.graphics.draw(img, math.floor(cx - w/2), math.floor(cy - h/2), 0, scale, scale)
end

--- Get sprite size
function SpriteAtlas:getSize(id)
    local s = self._sizes[id]
    if s then return s.w, s.h end
    local anim = self._anims[id]
    if anim then return anim.w, anim.h end
    return 0, 0
end

--- Get the raw Image for direct drawing
function SpriteAtlas:getImage(id)
    return self._images[id]
end

--- Get anim frame count
function SpriteAtlas:getAnimFrameCount(id)
    local anim = self._anims[id]
    return anim and #anim.frames or 0
end

return SpriteAtlas
