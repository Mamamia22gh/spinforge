/**
 * Spinforge master palette — runtime-switchable themes.
 * PAL / PAL32 are mutable singletons: all importers share the same object.
 * Call setTheme(id) to hot-swap at runtime.
 */

// ── Theme definitions ──────────────────────────────────────────

export const THEMES = {
  // ── All hex values are verified Pantone colors (TCX / PMS C) ──
  original: {
    label: 'Pantone Classic',
    colors: {
      black:'#000000',      // Neutral Black C
      darkGray:'#2D3359',   // 19-3939 Blue Depths
      midGray:'#53565A',    // Cool Gray 11 C
      lightGray:'#97999B',  // Cool Gray 7 C
      white:'#F2F0EB',      // 11-0602 Snow White
      red:'#BE3455',        // 18-1750 Viva Magenta
      darkRed:'#662E3B',    // 19-1725 Tawny Port
      blue:'#0F4C81',       // 19-4052 Classic Blue
      darkBlue:'#233658',   // 19-4027 Estate Blue
      gold:'#B08E51',       // 16-1133 Mustard Gold
      darkGold:'#997B38',   // 18-0840 Dried Tobacco
      green:'#009473',      // 17-5641 Emerald
      darkGreen:'#11574A',  // 19-5420 Evergreen
      purple:'#5F4B8B',     // 18-3838 Ultra Violet
      darkPurple:'#433455', // 19-3728 Grape Compote
      neonPink:'#D33479',   // 18-2436 Fuchsia Purple
      cyan:'#00ABC0',       // 16-4725 Scuba Blue
      darkCyan:'#117893',   // 18-4528 Mosaic Blue
      deepBlue:'#101820',   // Black 6 C
      shadedBlue:'#273C76', // 19-3864 Mazarine Blue
      shadedCyan:'#008C8A', // 17-5034 Viridian Green
    },
  },
  'classic-casino': {
    label: 'Classic Casino',
    colors: {
      black:'#000000',      // Neutral Black C
      darkGray:'#353A4C',   // 19-4025 Mood Indigo
      midGray:'#53565A',    // Cool Gray 11 C
      lightGray:'#97999B',  // Cool Gray 7 C
      white:'#EAE4DA',      // 11-4800 Ivory
      red:'#BE3455',        // 18-1750 Viva Magenta
      darkRed:'#72262C',    // 19-1534 Merlot
      blue:'#0F4C81',       // 19-4052 Classic Blue
      darkBlue:'#273C76',   // 19-3864 Mazarine Blue
      gold:'#B08E51',       // 16-1133 Mustard Gold
      darkGold:'#997B38',   // 18-0840 Dried Tobacco
      green:'#009473',      // 17-5641 Emerald
      darkGreen:'#19454B',  // 19-4241 Deep Teal
      purple:'#7E5186',     // 19-3438 Bright Violet
      darkPurple:'#433455', // 19-3728 Grape Compote
      neonPink:'#D3507A',   // 18-2133 Pink Flambé
      cyan:'#00ABC0',       // 16-4725 Scuba Blue
      darkCyan:'#117893',   // 18-4528 Mosaic Blue
      deepBlue:'#101820',   // Black 6 C
      shadedBlue:'#233658', // 19-4027 Estate Blue
      shadedCyan:'#008C8A', // 17-5034 Viridian Green
    },
  },
  'noir-velvet': {
    label: 'Noir Velvet',
    colors: {
      black:'#000000',      // Neutral Black C
      darkGray:'#423546',   // 19-3712 Nightshade
      midGray:'#4A4B4D',    // 19-3906 Dark Shadow
      lightGray:'#97999B',  // Cool Gray 7 C
      white:'#EAE4DA',      // 11-4800 Ivory
      red:'#95263C',        // 19-1863 Haute Red
      darkRed:'#72262C',    // 19-1534 Merlot
      blue:'#273C76',       // 19-3864 Mazarine Blue
      darkBlue:'#2D3359',   // 19-3939 Blue Depths
      gold:'#B08E51',       // 16-1133 Mustard Gold
      darkGold:'#997B38',   // 18-0840 Dried Tobacco
      green:'#11574A',      // 19-5420 Evergreen
      darkGreen:'#19454B',  // 19-4241 Deep Teal
      purple:'#7E5186',     // 19-3438 Bright Violet
      darkPurple:'#433455', // 19-3728 Grape Compote
      neonPink:'#D3507A',   // 18-2133 Pink Flambé
      cyan:'#008C8A',       // 17-5034 Viridian Green
      darkCyan:'#117893',   // 18-4528 Mosaic Blue
      deepBlue:'#101820',   // Black 6 C
      shadedBlue:'#233658', // 19-4027 Estate Blue
      shadedCyan:'#005366', // 19-4540 Deep Lagoon
    },
  },
  'peach-fuzz': {
    label: 'Peach Fuzz',
    colors: {
      black:'#000000',      // Neutral Black C
      darkGray:'#342A23',   // Black 4 C (warm)
      midGray:'#4F3F3B',    // 19-1015 Bracken
      lightGray:'#97999B',  // Cool Gray 7 C
      white:'#DDD5C7',      // 13-0905 Birch
      red:'#D01C1F',        // 18-1664 Fiery Red
      darkRed:'#662E3B',    // 19-1725 Tawny Port
      blue:'#117893',       // 18-4528 Mosaic Blue
      darkBlue:'#005366',   // 19-4540 Deep Lagoon
      gold:'#FFBE98',       // 13-1023 Peach Fuzz (COY 2024)
      darkGold:'#97572B',   // 18-1148 Leather Brown
      green:'#56C6A9',      // 16-5127 Biscay Green
      darkGreen:'#11574A',  // 19-5420 Evergreen
      purple:'#AFA4CE',     // 15-3817 Lavender
      darkPurple:'#433455', // 19-3728 Grape Compote
      neonPink:'#FF6F61',   // 16-1546 Living Coral
      cyan:'#7FC9CB',       // 14-4811 Aqua Sky
      darkCyan:'#008C8A',   // 17-5034 Viridian Green
      deepBlue:'#101820',   // Black 6 C
      shadedBlue:'#233658', // 19-4027 Estate Blue
      shadedCyan:'#005780', // 18-4434 Mykonos Blue
    },
  },
  'ultra-violet': {
    label: 'Ultra Violet',
    colors: {
      black:'#000000',      // Neutral Black C
      darkGray:'#423546',   // 19-3712 Nightshade
      midGray:'#4A4B4D',    // 19-3906 Dark Shadow
      lightGray:'#AFA4CE',  // 15-3817 Lavender
      white:'#F2F0EB',      // 11-0602 Snow White
      red:'#BE3455',        // 18-1750 Viva Magenta
      darkRed:'#7E5186',    // 19-3438 Bright Violet
      blue:'#6667AB',       // 17-3938 Very Peri (COY 2022)
      darkBlue:'#273C76',   // 19-3864 Mazarine Blue
      gold:'#F0C05A',       // 14-0848 Mimosa
      darkGold:'#C89B40',   // 15-1050 Gold Fusion
      green:'#009473',      // 17-5641 Emerald
      darkGreen:'#11574A',  // 19-5420 Evergreen
      purple:'#5F4B8B',     // 18-3838 Ultra Violet (COY 2018)
      darkPurple:'#433455', // 19-3728 Grape Compote
      neonPink:'#D33479',   // 18-2436 Fuchsia Purple
      cyan:'#00ABC0',       // 16-4725 Scuba Blue
      darkCyan:'#117893',   // 18-4528 Mosaic Blue
      deepBlue:'#101820',   // Black 6 C
      shadedBlue:'#223A5E', // 19-4029 Navy Peony
      shadedCyan:'#008C8A', // 17-5034 Viridian Green
    },
  },
  'emerald-vault': {
    label: 'Emerald Vault',
    colors: {
      black:'#000000',      // Neutral Black C
      darkGray:'#19454B',   // 19-4241 Deep Teal
      midGray:'#4A4B4D',    // 19-3906 Dark Shadow
      lightGray:'#97999B',  // Cool Gray 7 C
      white:'#F2F0EB',      // 11-0602 Snow White
      red:'#95263C',        // 19-1863 Haute Red
      darkRed:'#72262C',    // 19-1534 Merlot
      blue:'#005780',       // 18-4434 Mykonos Blue
      darkBlue:'#005366',   // 19-4540 Deep Lagoon
      gold:'#D4AE40',       // 15-0751 Ceylon Yellow
      darkGold:'#997B38',   // 18-0840 Dried Tobacco
      green:'#009473',      // 17-5641 Emerald
      darkGreen:'#11574A',  // 19-5420 Evergreen
      purple:'#7E5186',     // 19-3438 Bright Violet
      darkPurple:'#433455', // 19-3728 Grape Compote
      neonPink:'#D3507A',   // 18-2133 Pink Flambé
      cyan:'#008C8A',       // 17-5034 Viridian Green
      darkCyan:'#117893',   // 18-4528 Mosaic Blue
      deepBlue:'#101820',   // Black 6 C
      shadedBlue:'#233658', // 19-4027 Estate Blue
      shadedCyan:'#56C6A9', // 16-5127 Biscay Green
    },
  },
  'mocha-mousse': {
    label: 'Mocha Mousse',
    colors: {
      black:'#000000',      // Neutral Black C
      darkGray:'#342A23',   // Black 4 C (warm)
      midGray:'#4F3F3B',    // 19-1015 Bracken
      lightGray:'#97999B',  // Cool Gray 7 C
      white:'#DDD5C7',      // 13-0905 Birch
      red:'#964F4C',        // 18-1438 Marsala
      darkRed:'#662E3B',    // 19-1725 Tawny Port
      blue:'#005780',       // 18-4434 Mykonos Blue
      darkBlue:'#233658',   // 19-4027 Estate Blue
      gold:'#A47864',       // 17-1230 Mocha Mousse (COY 2025)
      darkGold:'#97572B',   // 18-1148 Leather Brown
      green:'#11574A',      // 19-5420 Evergreen
      darkGreen:'#19454B',  // 19-4241 Deep Teal
      purple:'#7E5186',     // 19-3438 Bright Violet
      darkPurple:'#433455', // 19-3728 Grape Compote
      neonPink:'#F5BCA7',   // 13-1409 Peach Blush
      cyan:'#008C8A',       // 17-5034 Viridian Green
      darkCyan:'#117893',   // 18-4528 Mosaic Blue
      deepBlue:'#101820',   // Black 6 C
      shadedBlue:'#273C76', // 19-3864 Mazarine Blue
      shadedCyan:'#005366', // 19-4540 Deep Lagoon
    },
  },
};

export const THEME_ORDER = [
  'original', 'classic-casino', 'noir-velvet', 'peach-fuzz',
  'ultra-violet', 'emerald-vault', 'mocha-mousse',
];

// ── Mutable palette singletons ─────────────────────────────────
export const PAL = {};
export const PAL32 = {};
export const SYM_COLORS = {};

// Derived references (live bindings, updated by setTheme)
export let SEG_A, SEG_B, DIVIDER_COLOR, HUB_BG, HUB_BORDER, RIM_COLOR;

let _currentTheme = 'original';
const _listeners = new Set();

function _hexToABGR(hex) {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return (255 << 24) | (b << 16) | (g << 8) | r;
}

function _apply(name) {
  const theme = THEMES[name];
  if (!theme) return;
  for (const [k, hex] of Object.entries(theme.colors)) {
    PAL[k] = hex;
    PAL32[k] = _hexToABGR(hex);
  }
  SEG_A = PAL.darkGray;
  SEG_B = PAL.black;
  DIVIDER_COLOR = PAL.black;
  HUB_BG = PAL.black;
  HUB_BORDER = PAL.midGray;
  RIM_COLOR = PAL.darkGray;
  _currentTheme = name;
}

// ── Public API ─────────────────────────────────────────────────

export function getCurrentTheme() { return _currentTheme; }
export function getThemeLabel(name) { return THEMES[name || _currentTheme]?.label ?? name; }

export function onThemeChange(fn) {
  _listeners.add(fn);
  return () => _listeners.delete(fn);
}

export function setTheme(name) {
  if (!THEMES[name]) return;
  _apply(name);
  try { localStorage.setItem('spinforge.theme', name); } catch (_) {}
  for (const fn of _listeners) { try { fn(name); } catch (e) { console.error(e); } }
}

export function cycleTheme(dir = 1) {
  const idx = THEME_ORDER.indexOf(_currentTheme);
  const next = THEME_ORDER[(idx + dir + THEME_ORDER.length) % THEME_ORDER.length];
  setTheme(next);
  return next;
}

// ── Bootstrap with saved theme ─────────────────────────────────
let _saved = 'original';
try { const s = localStorage.getItem('spinforge.theme'); if (s && THEMES[s]) _saved = s; } catch (_) {}
_apply(_saved);
