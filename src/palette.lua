--[[ Central palette — runtime-switchable theme system.
     7 themes. Colors mutated IN PLACE so every module holding a reference
     to PAL sees the update without re-requiring.

     Usage:
       local PAL = require('src.palette')
       PAL.red          → {r, g, b, 1}  (0..1 floats)
       PAL.setTheme('noir-velvet')
       PAL.rgb('red')   → {R, G, B}     (0..255 ints, for ImageData)
]]

local function hex(h)
    h = h:gsub("#", "")
    local r = tonumber(h:sub(1,2), 16) / 255
    local g = tonumber(h:sub(3,4), 16) / 255
    local b = tonumber(h:sub(5,6), 16) / 255
    return { r, g, b, 1 }
end

local function hex255(h)
    h = h:gsub("#", "")
    return {
        tonumber(h:sub(1,2), 16),
        tonumber(h:sub(3,4), 16),
        tonumber(h:sub(5,6), 16),
    }
end

-- ── Theme definitions ──────────────────────────────────────────

local THEMES = {
    -- All hex values are verified Pantone colors (TCX / PMS C)
    { id = 'original', label = 'Pantone Classic', colors = {
        black='#000000',      darkGray='#2D3359',   midGray='#53565A',    lightGray='#97999B',  white='#F2F0EB',
        red='#BE3455',        darkRed='#662E3B',    blue='#0F4C81',       darkBlue='#233658',
        gold='#B08E51',       darkGold='#997B38',   green='#009473',      darkGreen='#11574A',
        purple='#5F4B8B',     darkPurple='#433455',
        neonPink='#D33479',   cyan='#00ABC0',       darkCyan='#117893',
        deepBlue='#101820',   shadedBlue='#273C76', shadedCyan='#008C8A',
    }},
    { id = 'classic-casino', label = 'Classic Casino', colors = {
        black='#000000',      darkGray='#353A4C',   midGray='#53565A',    lightGray='#97999B',  white='#EAE4DA',
        red='#BE3455',        darkRed='#72262C',    blue='#0F4C81',       darkBlue='#273C76',
        gold='#B08E51',       darkGold='#997B38',   green='#009473',      darkGreen='#19454B',
        purple='#7E5186',     darkPurple='#433455',
        neonPink='#D3507A',   cyan='#00ABC0',       darkCyan='#117893',
        deepBlue='#101820',   shadedBlue='#233658', shadedCyan='#008C8A',
    }},
    { id = 'noir-velvet', label = 'Noir Velvet', colors = {
        black='#000000',      darkGray='#423546',   midGray='#4A4B4D',    lightGray='#97999B',  white='#EAE4DA',
        red='#95263C',        darkRed='#72262C',    blue='#273C76',       darkBlue='#2D3359',
        gold='#B08E51',       darkGold='#997B38',   green='#11574A',      darkGreen='#19454B',
        purple='#7E5186',     darkPurple='#433455',
        neonPink='#D3507A',   cyan='#008C8A',       darkCyan='#117893',
        deepBlue='#101820',   shadedBlue='#233658', shadedCyan='#005366',
    }},
    { id = 'peach-fuzz', label = 'Peach Fuzz', colors = {
        black='#000000',      darkGray='#342A23',   midGray='#4F3F3B',    lightGray='#97999B',  white='#DDD5C7',
        red='#D01C1F',        darkRed='#662E3B',    blue='#117893',       darkBlue='#005366',
        gold='#FFBE98',       darkGold='#97572B',   green='#56C6A9',      darkGreen='#11574A',
        purple='#AFA4CE',     darkPurple='#433455',
        neonPink='#FF6F61',   cyan='#7FC9CB',       darkCyan='#008C8A',
        deepBlue='#101820',   shadedBlue='#233658', shadedCyan='#005780',
    }},
    { id = 'ultra-violet', label = 'Ultra Violet', colors = {
        black='#000000',      darkGray='#423546',   midGray='#4A4B4D',    lightGray='#AFA4CE',  white='#F2F0EB',
        red='#BE3455',        darkRed='#7E5186',    blue='#6667AB',       darkBlue='#273C76',
        gold='#F0C05A',       darkGold='#C89B40',   green='#009473',      darkGreen='#11574A',
        purple='#5F4B8B',     darkPurple='#433455',
        neonPink='#D33479',   cyan='#00ABC0',       darkCyan='#117893',
        deepBlue='#101820',   shadedBlue='#223A5E', shadedCyan='#008C8A',
    }},
    { id = 'emerald-vault', label = 'Emerald Vault', colors = {
        black='#000000',      darkGray='#19454B',   midGray='#4A4B4D',    lightGray='#97999B',  white='#F2F0EB',
        red='#95263C',        darkRed='#72262C',    blue='#005780',       darkBlue='#005366',
        gold='#D4AE40',       darkGold='#997B38',   green='#009473',      darkGreen='#11574A',
        purple='#7E5186',     darkPurple='#433455',
        neonPink='#D3507A',   cyan='#008C8A',       darkCyan='#117893',
        deepBlue='#101820',   shadedBlue='#233658', shadedCyan='#56C6A9',
    }},
    { id = 'mocha-mousse', label = 'Mocha Mousse', colors = {
        black='#000000',      darkGray='#342A23',   midGray='#4F3F3B',    lightGray='#97999B',  white='#DDD5C7',
        red='#964F4C',        darkRed='#662E3B',    blue='#005780',       darkBlue='#233658',
        gold='#A47864',       darkGold='#97572B',   green='#11574A',      darkGreen='#19454B',
        purple='#7E5186',     darkPurple='#433455',
        neonPink='#F5BCA7',   cyan='#008C8A',       darkCyan='#117893',
        deepBlue='#101820',   shadedBlue='#273C76', shadedCyan='#005366',
    }},
}

-- Build lookup
local THEME_MAP = {}
for _, t in ipairs(THEMES) do THEME_MAP[t.id] = t end

-- ── Color keys ─────────────────────────────────────────────────
local COLOR_KEYS = {
    'black','darkGray','midGray','lightGray','white',
    'red','darkRed','blue','darkBlue','gold','darkGold',
    'green','darkGreen','purple','darkPurple',
    'neonPink','cyan','darkCyan',
    'deepBlue','shadedBlue','shadedCyan',
}

-- ── Live PAL table (mutated in place) ──────────────────────────
local PAL = {}
local PAL_RGB = {}  -- 0-255 int format for ImageData

-- Pre-allocate tables so references survive theme swaps
for _, k in ipairs(COLOR_KEYS) do
    PAL[k] = {0, 0, 0, 1}
    PAL_RGB[k] = {0, 0, 0}
end

-- Segment / chrome aliases (table refs, point to same underlying tables)
PAL.segA         = PAL.darkGray
PAL.segB         = PAL.black
PAL.dividerColor = PAL.black
PAL.hubBg        = PAL.black
PAL.hubBorder    = PAL.midGray
PAL.rimColor     = PAL.darkGray

-- ── State ──────────────────────────────────────────────────────
local _currentTheme = 'original'
local _listeners = {}

local function _apply(id)
    local theme = THEME_MAP[id]
    if not theme then return end
    for _, k in ipairs(COLOR_KEYS) do
        local h = theme.colors[k]
        local c = hex(h)
        PAL[k][1], PAL[k][2], PAL[k][3], PAL[k][4] = c[1], c[2], c[3], 1
        local r = hex255(h)
        PAL_RGB[k][1], PAL_RGB[k][2], PAL_RGB[k][3] = r[1], r[2], r[3]
    end
    _currentTheme = id
end

-- ── Public API (attached to PAL for convenience) ───────────────

function PAL.getTheme()       return _currentTheme end
function PAL.getThemeLabel(id) return THEME_MAP[id or _currentTheme] and THEME_MAP[id or _currentTheme].label or (id or _currentTheme) end

function PAL.setTheme(id)
    if not THEME_MAP[id] or id == _currentTheme then return end
    _apply(id)
    for _, fn in ipairs(_listeners) do pcall(fn, id) end
end

function PAL.onThemeChange(fn)
    _listeners[#_listeners + 1] = fn
end

function PAL.getThemeList()
    local list = {}
    for _, t in ipairs(THEMES) do
        list[#list + 1] = { id = t.id, label = t.label }
    end
    return list
end

function PAL.getThemeCount() return #THEMES end

function PAL.getThemeIndex()
    for i, t in ipairs(THEMES) do
        if t.id == _currentTheme then return i end
    end
    return 1
end

function PAL.cycleTheme(dir)
    dir = dir or 1
    local idx = PAL.getThemeIndex() + dir
    if idx < 1 then idx = #THEMES end
    if idx > #THEMES then idx = 1 end
    PAL.setTheme(THEMES[idx].id)
end

--- Get 0-255 RGB table for ImageData pixel work (background.lua)
function PAL.rgb(key) return PAL_RGB[key] end

-- ── Bootstrap ──────────────────────────────────────────────────
_apply('original')

return PAL
