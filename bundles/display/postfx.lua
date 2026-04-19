--[[
    PostFX — GPU palette quantization + scanlines + vignette + chromatic aberration.
    Single shader pass on the main canvas. Palette comes from config.
]]

local PostFX = {}
PostFX.__index = PostFX

-- No default palette — must come from config/display.lua

local function hexToRGB(hex)
    local r = tonumber(hex:sub(1, 2), 16) / 255
    local g = tonumber(hex:sub(3, 4), 16) / 255
    local b = tonumber(hex:sub(5, 6), 16) / 255
    return r, g, b
end

local SHADER_CODE = [[
extern vec3 palette[16];
extern float scanIntensity;
extern float vignetteIntensity;
extern float chromaIntensity;
extern float pixelScale;

vec4 effect(vec4 color, Image tex, vec2 tc, vec2 sc) {
    vec2 uv = tc - 0.5;
    float dist2 = dot(uv, uv);

    // Chromatic aberration — stronger at edges
    float edge = smoothstep(0.05, 0.30, dist2);
    float off = chromaIntensity * edge * dist2;
    vec3 c = vec3(
        Texel(tex, tc + vec2(off, 0.0)).r,
        Texel(tex, tc).g,
        Texel(tex, tc - vec2(off, 0.0)).b
    );

    // Quantize to nearest palette color
    float best = 99999.0;
    vec3 out_c = palette[0];
    for (int i = 0; i < 16; i++) {
        vec3 d = c - palette[i];
        float dd = dot(d, d);
        if (dd < best) { best = dd; out_c = palette[i]; }
    }
    c = out_c;

    // Scanlines (every other pixel row)
    float scan = mod(floor(sc.y / max(pixelScale, 1.0)), 2.0) < 1.0 ? 1.0 : 1.0 - scanIntensity;
    c *= scan;

    // Vignette
    c *= max(0.0, 1.0 - dist2 * 4.0 * vignetteIntensity);

    return vec4(c, 1.0);
}
]]

function PostFX.new(opts)
    opts = opts or {}
    local self = setmetatable({}, PostFX)

    self._shader = love.graphics.newShader(SHADER_CODE)
    self._canvas = nil

    -- Settings
    self._scanIntensity    = opts.scanlines or 0.06
    self._vignetteIntensity = opts.vignette or 0.25
    self._chromaIntensity  = opts.chroma or 0.005

    -- Upload palette (from config or default)
    local paletteHex = opts.palette
    if not paletteHex then
        error("PostFX: palette must be provided via config/display.lua")
    end
    local flat = {}
    for i, hex in ipairs(paletteHex) do
        local r, g, b = hexToRGB(hex)
        flat[i] = { r, g, b }
    end
    self._shader:send("palette", unpack(flat))
    self._shader:send("scanIntensity", self._scanIntensity)
    self._shader:send("vignetteIntensity", self._vignetteIntensity)
    self._shader:send("chromaIntensity", self._chromaIntensity)
    self._shader:send("pixelScale", 1.0)

    return self
end

--- Apply post-FX at a target output resolution (screen res).
--- Scanlines/chroma/vignette run per-output-pixel → crisp at native res.
function PostFX:apply(inputCanvas, outW, outH, offsetX, offsetY, scale)
    outW = outW or inputCanvas:getWidth()
    outH = outH or inputCanvas:getHeight()
    scale = scale or 1
    offsetX = offsetX or 0
    offsetY = offsetY or 0

    if not self._canvas or self._canvas:getWidth() ~= outW or self._canvas:getHeight() ~= outH then
        self._canvas = love.graphics.newCanvas(outW, outH)
        self._canvas:setFilter("nearest", "nearest")
    end

    inputCanvas:setFilter("nearest", "nearest")
    self._shader:send("pixelScale", scale)

    love.graphics.setCanvas(self._canvas)
    love.graphics.clear(0, 0, 0, 1)
    love.graphics.setColor(1, 1, 1, 1)
    love.graphics.setBlendMode("alpha")
    love.graphics.setShader(self._shader)
    love.graphics.draw(inputCanvas, offsetX, offsetY, 0, scale, scale)
    love.graphics.setShader()
    love.graphics.setCanvas()

    return self._canvas
end

--- Update a setting at runtime.
function PostFX:set(key, value)
    if key == "scanlines" then
        self._scanIntensity = value
        self._shader:send("scanIntensity", value)
    elseif key == "vignette" then
        self._vignetteIntensity = value
        self._shader:send("vignetteIntensity", value)
    elseif key == "chroma" then
        self._chromaIntensity = value
        self._shader:send("chromaIntensity", value)
    end
end

return PostFX
