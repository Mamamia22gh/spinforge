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
    { id = 'original', label = 'Original', colors = {
        black='#0a0a0a', darkGray='#1a1a2e', midGray='#333346', lightGray='#6a6a7a', white='#e8e0d0',
        red='#cc2233', darkRed='#6e1127', blue='#2b4ccc', darkBlue='#162266',
        gold='#d4a520', darkGold='#7a5e10', green='#22aa44', darkGreen='#105522',
        purple='#8833cc', darkPurple='#441a66',
        neonPink='#ff44aa', cyan='#44aadd', darkCyan='#0088bb',
        deepBlue='#0e1144', shadedBlue='#1a2e88', shadedCyan='#337799',
    }},
    { id = 'classic-casino', label = 'Classic Casino', colors = {
        black='#0b0a0d', darkGray='#1c1a24', midGray='#38333f', lightGray='#787382', white='#f0e9d8',
        red='#be3455', darkRed='#6a1a30', blue='#0f4c81', darkBlue='#0a2648',
        gold='#c9a227', darkGold='#6e5510', green='#00806a', darkGreen='#0a3e33',
        purple='#6b3fa0', darkPurple='#351e52',
        neonPink='#ff5e9e', cyan='#4ab5c9', darkCyan='#0d7a94',
        deepBlue='#0a1a3a', shadedBlue='#0c3668', shadedCyan='#2a8da8',
    }},
    { id = 'noir-velvet', label = 'Noir Velvet', colors = {
        black='#07070c', darkGray='#13142a', midGray='#2a2c48', lightGray='#6d6f88', white='#eae0c8',
        red='#a32638', darkRed='#5a1220', blue='#1b3a6b', darkBlue='#0b1c3a',
        gold='#b8860b', darkGold='#5f4408', green='#2f5d3b', darkGreen='#132a19',
        purple='#563d7c', darkPurple='#2a1d3e',
        neonPink='#e94b8e', cyan='#3a96b8', darkCyan='#0e6683',
        deepBlue='#0a0e28', shadedBlue='#142854', shadedCyan='#28799a',
    }},
    { id = 'peach-fuzz', label = 'Peach Fuzz', colors = {
        black='#0e0a08', darkGray='#241a18', midGray='#433230', lightGray='#8a7870', white='#f5e8d4',
        red='#d83a3a', darkRed='#6e1618', blue='#2a6478', darkBlue='#10333d',
        gold='#e0a96d', darkGold='#7a5434', green='#4a8c5a', darkGreen='#1f3f28',
        purple='#8b4a7a', darkPurple='#40223a',
        neonPink='#ff7fa8', cyan='#5ab0a8', darkCyan='#1a7068',
        deepBlue='#0c2028', shadedBlue='#1e4a5e', shadedCyan='#3a9088',
    }},
    { id = 'ultra-violet', label = 'Ultra Violet', colors = {
        black='#08060f', darkGray='#18142c', midGray='#342a55', lightGray='#7a6fa0', white='#ece4f5',
        red='#e03070', darkRed='#701534', blue='#3a4ad8', darkBlue='#151e6c',
        gold='#f0c419', darkGold='#80640a', green='#2ecc71', darkGreen='#0f5a30',
        purple='#5f4b8b', darkPurple='#2c2145',
        neonPink='#ff4ad1', cyan='#4fd5e0', darkCyan='#0090a8',
        deepBlue='#0e0a30', shadedBlue='#252080', shadedCyan='#20b0c0',
    }},
    { id = 'emerald-vault', label = 'Emerald Vault', colors = {
        black='#060a08', darkGray='#10211b', midGray='#24433a', lightGray='#6a8a7e', white='#e8e4d0',
        red='#b02840', darkRed='#5e1324', blue='#1e5a7a', darkBlue='#0a2a3d',
        gold='#d4a017', darkGold='#6e5210', green='#009b48', darkGreen='#005028',
        purple='#6a4c93', darkPurple='#33244a',
        neonPink='#f05890', cyan='#40c0a0', darkCyan='#108868',
        deepBlue='#081a14', shadedBlue='#143e58', shadedCyan='#2ea888',
    }},
    { id = 'mocha-mousse', label = 'Mocha Mousse', colors = {
        black='#0c0908', darkGray='#1e1614', midGray='#3e302a', lightGray='#8a7568', white='#f2e8da',
        red='#c44536', darkRed='#6a2018', blue='#3a6080', darkBlue='#1a3040',
        gold='#c8963e', darkGold='#6e5020', green='#5a8a60', darkGreen='#2a4430',
        purple='#7a5070', darkPurple='#3e2838',
        neonPink='#e87090', cyan='#6ab0a8', darkCyan='#307870',
        deepBlue='#101820', shadedBlue='#284860', shadedCyan='#4a9890',
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
