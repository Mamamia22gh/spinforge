--[[
    DisplayBundle — owns the render pipeline, canvas, scaling, post-fx.
    100% independent — no knowledge of game, sprites, audio, etc.

    RENDER PIPELINE (4 passes, like legacy):
      1. Main canvas (480×640) — game world with shake + parallax
      2. Post-FX shader        — palette quantize + scanlines + vignette + chromatic aberration
      3. UI overlay canvas      — popups/menus, NOT post-processed
      4. Lights canvas          — additive glow, NOT quantized

    EVENTS LISTENED:
        kernel.update           → tracks time, mouse normalization
        kernel.draw             → executes full render pipeline
        kernel.resize           → recalculates scaling
        input.mousepressed      → transforms coords to logical space, re-emits
        input.mousereleased     → same
        input.mousemoved        → tracks mouse for parallax

    EVENTS EMITTED:
        display.ready           → { display = self } after boot
        display.draw.main       → { g = DrawAPI } draw game world (priority layers)
        display.draw.ui         → { g = DrawAPI } draw UI overlay
        display.draw.lights     → { g = LightsAPI } draw glow/lights
        display.click           → { x, y, button } in logical coords (480×640)
        display.release         → { x, y, button } in logical coords
        display.mouse           → { x, y, nx, ny } normalized mouse (-1..1)

    DRAW API (passed as `g` in draw events):
        g:push() / g:pop()                      — save/restore transform+state
        g:translate(x, y)
        g:rotate(angle)
        g:scale(sx, sy)
        g:setAlpha(a)                            — sets global alpha
        g:setColor(r, g, b, a)
        g:setBlend(mode)                         — "alpha", "multiply", "add", "subtract"
        g:rect(mode, x, y, w, h)                — "fill" or "line"
        g:arc(mode, x, y, r, a1, a2, segments)
        g:circle(mode, x, y, r)
        g:line(x1, y1, x2, y2)
        g:clip(x, y, w, h)  / g:clipCircle(cx, cy, r) / g:unclip()
        g:gradient(cx, cy, r, c1, c2, alpha)     — radial gradient circle
        g:flash(duration)                        — invert flash (difference blend)
        g:shake(dx, dy)                          — set screen shake offset
        g:getTime()                              — elapsed time in seconds
        g:getMouse()                             — { x, y, nx, ny }
        g:W() / g:H()                            — logical dimensions (480, 640)

    LIGHTS API (passed as `g` in display.draw.lights):
        g:glow(cx, cy, radius, r, g, b, alpha)  — additive radial glow
]]

local PostFX = require("bundles.display.postfx")

local W, H  -- set from config in boot()

-- ─── DrawAPI ─────────────────────────────────────────────────────────────────

local DrawAPI = {}
DrawAPI.__index = DrawAPI

function DrawAPI.new(display)
    return setmetatable({ _d = display }, DrawAPI)
end

function DrawAPI:push()
    love.graphics.push("all")
end

function DrawAPI:pop()
    love.graphics.pop()
end

function DrawAPI:translate(x, y)
    love.graphics.translate(x, y)
end

function DrawAPI:rotate(angle)
    love.graphics.rotate(angle)
end

function DrawAPI:scale(sx, sy)
    love.graphics.scale(sx, sy or sx)
end

function DrawAPI:setAlpha(a)
    local r, g, b = love.graphics.getColor()
    love.graphics.setColor(r, g, b, a)
end

function DrawAPI:setColor(r, g, b, a)
    love.graphics.setColor(r, g, b, a or 1)
end

function DrawAPI:setBlend(mode)
    if mode == "add" then
        love.graphics.setBlendMode("add")
    elseif mode == "multiply" then
        love.graphics.setBlendMode("multiply", "premultiplied")
    elseif mode == "subtract" then
        love.graphics.setBlendMode("subtract")
    else
        love.graphics.setBlendMode("alpha")
    end
end

function DrawAPI:rect(mode, x, y, w, h)
    love.graphics.rectangle(mode, x, y, w, h)
end

function DrawAPI:arc(mode, cx, cy, r, a1, a2, segments)
    love.graphics.arc(mode, cx, cy, r, a1, a2, segments or 64)
end

function DrawAPI:circle(mode, cx, cy, r)
    love.graphics.circle(mode, cx, cy, r)
end

function DrawAPI:line(x1, y1, x2, y2)
    love.graphics.line(x1, y1, x2, y2)
end

function DrawAPI:polygon(mode, ...)
    love.graphics.polygon(mode, ...)
end

--- Rectangular clip (stencil-based)
function DrawAPI:clip(x, y, w, h)
    love.graphics.stencil(function()
        love.graphics.rectangle("fill", x, y, w, h)
    end, "replace", 1)
    love.graphics.setStencilTest("greater", 0)
end

--- Circular clip (stencil-based)
function DrawAPI:clipCircle(cx, cy, r)
    love.graphics.stencil(function()
        love.graphics.circle("fill", cx, cy, r)
    end, "replace", 1)
    love.graphics.setStencilTest("greater", 0)
end

function DrawAPI:unclip()
    love.graphics.setStencilTest()
end

--- Radial gradient — draws a filled circle with color fading to transparent.
--- Uses a pre-generated mesh for performance.
function DrawAPI:gradient(cx, cy, radius, color, alpha, outerColor)
    alpha = alpha or 1
    local segs = 32
    local r1, g1, b1 = color[1], color[2], color[3]
    local r2, g2, b2
    if outerColor then
        r2, g2, b2 = outerColor[1], outerColor[2], outerColor[3]
    else
        r2, g2, b2 = 0, 0, 0
    end

    -- Fan mesh: center + ring
    local verts = { { cx, cy, 0.5, 0.5, r1, g1, b1, alpha } }
    for i = 0, segs do
        local a = (i / segs) * math.pi * 2
        local px = cx + math.cos(a) * radius
        local py = cy + math.sin(a) * radius
        verts[#verts + 1] = { px, py, 0.5, 0.5, r2, g2, b2, 0 }
    end
    local mesh = love.graphics.newMesh(verts, "fan", "stream")
    love.graphics.draw(mesh)
end

--- Trigger invert-flash effect (difference blend overlay).
function DrawAPI:flash(duration)
    self._d._flash = duration or 0.3
end

--- Set screen shake offset (applied next frame).
function DrawAPI:shake(dx, dy)
    self._d._shakeX = dx or 0
    self._d._shakeY = dy or 0
end

function DrawAPI:getTime()
    return self._d._time
end

function DrawAPI:getMouse()
    return {
        x = self._d._logicalMX,
        y = self._d._logicalMY,
        nx = self._d._normMX,
        ny = self._d._normMY,
    }
end

function DrawAPI:W() return W end
function DrawAPI:H() return H end

--- Draw an Image/Canvas directly (for sprites, sub-canvases, etc.)
function DrawAPI:drawImage(img, x, y, r, sx, sy, ox, oy)
    love.graphics.draw(img, x, y, r or 0, sx or 1, sy or sx or 1, ox or 0, oy or 0)
end

--- Get the raw love.graphics module (escape hatch for advanced usage)
function DrawAPI:raw()
    return love.graphics
end

-- ─── LightsAPI ───────────────────────────────────────────────────────────────

local LightsAPI = {}
LightsAPI.__index = LightsAPI

function LightsAPI.new(display)
    return setmetatable({ _d = display }, LightsAPI)
end

--- Additive radial glow.
function LightsAPI:glow(cx, cy, radius, r, g, b, alpha)
    alpha = alpha or 0.15
    local segs = 32
    local verts = { { cx, cy, 0.5, 0.5, r, g, b, alpha } }
    for i = 0, segs do
        local a = (i / segs) * math.pi * 2
        local px = cx + math.cos(a) * radius
        local py = cy + math.sin(a) * radius
        verts[#verts + 1] = { px, py, 0.5, 0.5, 0, 0, 0, 0 }
    end
    local mesh = love.graphics.newMesh(verts, "fan", "stream")
    love.graphics.draw(mesh)
end

function LightsAPI:getTime()
    return self._d._time
end

function LightsAPI:getMouse()
    return {
        x = self._d._logicalMX,
        y = self._d._logicalMY,
        nx = self._d._normMX,
        ny = self._d._normMY,
    }
end

-- ─── DisplayBundle ───────────────────────────────────────────────────────────

local DisplayBundle = {}
DisplayBundle.__index = DisplayBundle

function DisplayBundle.new(opts)
    opts = opts or {}
    local self = setmetatable({}, DisplayBundle)
    self._kernel = nil

    -- Canvases
    self._mainCanvas   = nil  -- game world (post-fx applied)
    self._uiCanvas     = nil  -- UI overlay (no post-fx)
    self._lightsCanvas = nil  -- additive glow (no post-fx)

    -- Scaling
    self._scale   = 1
    self._offsetX = 0
    self._offsetY = 0

    -- Shake
    self._shakeX = 0
    self._shakeY = 0

    -- Flash (difference invert)
    self._flash = 0

    -- Time
    self._time = 0

    -- Mouse (logical space)
    self._logicalMX = 0
    self._logicalMY = 0
    self._normMX = 0  -- -1..1
    self._normMY = 0

    -- Post-FX
    self._postfx = nil
    self._postfxEnabled = opts.postfx ~= false

    -- APIs
    self._drawAPI   = DrawAPI.new(self)
    self._lightsAPI = LightsAPI.new(self)

    return self
end

function DisplayBundle:register(kernel)
    self._kernel = kernel
end

function DisplayBundle:boot(kernel, cfg)
    -- Apply config
    W = cfg.width
    H = cfg.height
    self._clearColor = cfg.clearColor

    -- Create canvases
    self._mainCanvas   = love.graphics.newCanvas(W, H)
    self._uiCanvas     = love.graphics.newCanvas(W, H)
    self._lightsCanvas = love.graphics.newCanvas(W, H)

    -- Set nearest-neighbor filtering on all canvases
    self._mainCanvas:setFilter("nearest", "nearest")
    self._uiCanvas:setFilter("nearest", "nearest")
    self._lightsCanvas:setFilter("nearest", "nearest")

    -- Post-FX shader
    local pfxCfg = cfg.postfx or {}
    if pfxCfg.enabled ~= false then
        self._postfx = PostFX.new({
            scanlines = pfxCfg.scanlines,
            vignette  = pfxCfg.vignette,
            chroma    = pfxCfg.chroma,
            palette   = cfg.palette,
        })
    end

    -- Initial resize
    self:_resize(love.graphics.getDimensions())

    -- ── Event wiring ─────────────────────────────────────────

    -- Resize
    kernel:on('kernel.resize', function(d)
        self:_resize(d.w, d.h)
    end, -100)

    -- Update (high priority — runs before game logic)
    kernel:on('kernel.update', function(d)
        self._time = self._time + d.dt
        self:_updateMouse()
    end, -100)

    -- Draw (very high priority — sets up canvases BEFORE anyone draws)
    kernel:on('kernel.draw', function()
        self:_render()
    end, -100)

    -- Mouse input → transform to logical space and re-emit
    kernel:on('input.mousepressed', function(d)
        local lx, ly = self:_screenToLogical(d.x, d.y)
        kernel:emit('display.click', { x = lx, y = ly, button = d.button })
    end, -50)

    kernel:on('input.mousereleased', function(d)
        local lx, ly = self:_screenToLogical(d.x, d.y)
        kernel:emit('display.release', { x = lx, y = ly, button = d.button })
    end, -50)

    -- Emit ready
    kernel:emit('display.ready', { display = self })
end

function DisplayBundle:_resize(w, h)
    local sx = w / W
    local sy = h / H
    self._scale = math.min(sx, sy)
    self._offsetX = (w - W * self._scale) / 2
    self._offsetY = (h - H * self._scale) / 2
end

function DisplayBundle:_screenToLogical(sx, sy)
    local lx = (sx - self._offsetX) / self._scale
    local ly = (sy - self._offsetY) / self._scale
    return lx, ly
end

function DisplayBundle:_updateMouse()
    local sx, sy = love.mouse.getPosition()
    self._logicalMX, self._logicalMY = self:_screenToLogical(sx, sy)
    -- Normalized -1..1
    self._normMX = (self._logicalMX / W) * 2 - 1
    self._normMY = (self._logicalMY / H) * 2 - 1
    -- Clamp
    self._normMX = math.max(-1, math.min(1, self._normMX))
    self._normMY = math.max(-1, math.min(1, self._normMY))

    self._kernel:emit('display.mouse', {
        x = self._logicalMX, y = self._logicalMY,
        nx = self._normMX, ny = self._normMY,
    })
end

function DisplayBundle:_render()
    local g = self._drawAPI

    -- ── Pass 1: Main canvas (game world) ──────────────────────
    love.graphics.setCanvas(self._mainCanvas)
    love.graphics.clear(self._clearColor[1], self._clearColor[2], self._clearColor[3], self._clearColor[4] or 1)
    love.graphics.setColor(1, 1, 1, 1)
    love.graphics.setBlendMode("alpha")

    -- Apply screen shake
    love.graphics.push()
    love.graphics.translate(self._shakeX, self._shakeY)

    self._kernel:emit('display.draw.main', { g = g })

    -- Invert flash (difference blend)
    if self._flash > 0 then
        self._flash = self._flash - love.timer.getDelta()
        love.graphics.push("all")
        love.graphics.setBlendMode("subtract")
        local a = math.min(1, self._flash / 0.15)
        love.graphics.setColor(a, a, a, a)
        love.graphics.rectangle("fill", 0, 0, W, H)
        love.graphics.pop()
    end

    love.graphics.pop() -- shake
    love.graphics.setCanvas()

    -- Decay shake toward zero
    self._shakeX = self._shakeX * 0.85
    self._shakeY = self._shakeY * 0.85
    if math.abs(self._shakeX) < 0.1 then self._shakeX = 0 end
    if math.abs(self._shakeY) < 0.1 then self._shakeY = 0 end

    -- ── Pass 2: Apply post-FX to main canvas ──────────────────
    local mainResult = self._mainCanvas
    if self._postfx then
        mainResult = self._postfx:apply(self._mainCanvas)
    end

    -- ── Pass 3: UI overlay canvas ─────────────────────────────
    love.graphics.setCanvas(self._uiCanvas)
    love.graphics.clear(0, 0, 0, 0)
    love.graphics.setColor(1, 1, 1, 1)
    love.graphics.setBlendMode("alpha")

    self._kernel:emit('display.draw.ui', { g = g })

    love.graphics.setCanvas()

    -- ── Pass 4: Lights canvas ─────────────────────────────────
    love.graphics.setCanvas(self._lightsCanvas)
    love.graphics.clear(0, 0, 0, 0)
    love.graphics.setColor(1, 1, 1, 1)
    love.graphics.setBlendMode("alpha")

    self._kernel:emit('display.draw.lights', { g = self._lightsAPI })

    love.graphics.setCanvas()

    -- ── Composite to screen ───────────────────────────────────
    love.graphics.setColor(1, 1, 1, 1)
    love.graphics.setBlendMode("alpha")

    -- Main (post-processed)
    love.graphics.draw(mainResult, self._offsetX, self._offsetY, 0, self._scale, self._scale)

    -- UI overlay (no post-fx, drawn on top)
    love.graphics.draw(self._uiCanvas, self._offsetX, self._offsetY, 0, self._scale, self._scale)

    -- Lights (additive/screen blend on top)
    love.graphics.setBlendMode("add")
    love.graphics.draw(self._lightsCanvas, self._offsetX, self._offsetY, 0, self._scale, self._scale)
    love.graphics.setBlendMode("alpha")
end

return DisplayBundle
