--[[
    SpriteBundle — pixel art rendering + bitmap font
    Port of PixelSprites.js + BitmapFont.js + generate-sprites.js
    
    ZERO dependencies on other bundles.
    
    Events listened:
        kernel.boot             → generates all sprite data into memory
    
    Events emitted:
        sprite.ready            → { sprites = SpriteAtlas }
    
    Services exposed via events:
        sprite.draw             → { id, x, y, scale }
        sprite.draw_centered    → { id, cx, cy, scale }
        sprite.draw_anim        → { id, cx, cy, scale, time, fps }
        sprite.draw_text        → { text, x, y, color, scale, outline }
        sprite.draw_text_centered → { text, cx, y, color, scale }
        sprite.draw_text_outlined → { text, cx, y, color, scale, outlineColor }
        sprite.draw_text_wrapped  → { text, x, y, maxW, color, scale }
        sprite.measure_text     → { text } → mutates data.width
]]

local SpriteAtlas = require("bundles.sprite.atlas")
local BitmapFont  = require("bundles.sprite.font")

local SpriteBundle = {}
SpriteBundle.__index = SpriteBundle

function SpriteBundle.new()
    return setmetatable({
        name = "sprite",
        atlas = nil,
        font = nil,
    }, SpriteBundle)
end

function SpriteBundle:register(kernel)
    -- nothing
end

function SpriteBundle:boot(kernel, cfg)
    self.atlas = SpriteAtlas.new()
    self.atlas:generateAll()
    self.font = BitmapFont.new()

    -- ── Sprite drawing events ───────────────────────────────────
    kernel:on('sprite.draw', function(d)
        self.atlas:draw(d.id, d.x, d.y, d.scale or 1)
    end)

    kernel:on('sprite.draw_centered', function(d)
        self.atlas:drawCentered(d.id, d.cx, d.cy, d.scale or 1)
    end)

    kernel:on('sprite.draw_anim', function(d)
        self.atlas:drawAnim(d.id, d.cx, d.cy, d.scale or 1, d.time or 0, d.fps or 6)
    end)

    -- ── Text drawing events ─────────────────────────────────────
    kernel:on('sprite.draw_text', function(d)
        self.font:draw(d.text, d.x, d.y, d.color or {1,1,1,1}, d.scale or 1, d.outline ~= false)
    end)

    kernel:on('sprite.draw_text_centered', function(d)
        self.font:drawCentered(d.text, d.cx, d.y, d.color or {1,1,1,1}, d.scale or 1)
    end)

    kernel:on('sprite.draw_text_outlined', function(d)
        self.font:drawCenteredOutlined(d.text, d.cx, d.y,
            d.color or {1,1,1,1}, d.scale or 1,
            d.outlineColor or {0,0,0,1})
    end)

    kernel:on('sprite.draw_text_wrapped', function(d)
        d.height = self.font:drawWrapped(d.text, d.x, d.y, d.maxW,
            d.color or {1,1,1,1}, d.scale or 1)
    end)

    kernel:on('sprite.measure_text', function(d)
        d.width = self.font:measure(d.text)
    end)

    kernel:emit('sprite.ready', { atlas = self.atlas, font = self.font })
end

return SpriteBundle
