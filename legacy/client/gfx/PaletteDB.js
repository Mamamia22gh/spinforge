/**
 * Spinforge master palette — runtime-switchable themes.
 * PAL / PAL32 are mutable singletons: all importers share the same object.
 * Call setTheme(id) to hot-swap at runtime.
 */

// ── Theme definitions ──────────────────────────────────────────

export const THEMES = {
  original: {
    label: 'Original',
    colors: {
      black:'#0a0a0a', darkGray:'#1a1a2e', midGray:'#333346', lightGray:'#6a6a7a', white:'#e8e0d0',
      red:'#cc2233', darkRed:'#6e1127', blue:'#2b4ccc', darkBlue:'#162266',
      gold:'#d4a520', darkGold:'#7a5e10', green:'#22aa44', darkGreen:'#105522',
      purple:'#8833cc', darkPurple:'#441a66',
      neonPink:'#ff44aa', cyan:'#44aadd', darkCyan:'#0088bb',
      deepBlue:'#0e1144', shadedBlue:'#1a2e88', shadedCyan:'#337799',
    },
  },
  'classic-casino': {
    label: 'Classic Casino',
    colors: {
      black:'#0b0a0d', darkGray:'#1c1a24', midGray:'#38333f', lightGray:'#787382', white:'#f0e9d8',
      red:'#be3455', darkRed:'#6a1a30', blue:'#0f4c81', darkBlue:'#0a2648',
      gold:'#c9a227', darkGold:'#6e5510', green:'#00806a', darkGreen:'#0a3e33',
      purple:'#6b3fa0', darkPurple:'#351e52',
      neonPink:'#ff5e9e', cyan:'#4ab5c9', darkCyan:'#0d7a94',
      deepBlue:'#0a1a3a', shadedBlue:'#0c3668', shadedCyan:'#2a8da8',
    },
  },
  'noir-velvet': {
    label: 'Noir Velvet',
    colors: {
      black:'#07070c', darkGray:'#13142a', midGray:'#2a2c48', lightGray:'#6d6f88', white:'#eae0c8',
      red:'#a32638', darkRed:'#5a1220', blue:'#1b3a6b', darkBlue:'#0b1c3a',
      gold:'#b8860b', darkGold:'#5f4408', green:'#2f5d3b', darkGreen:'#132a19',
      purple:'#563d7c', darkPurple:'#2a1d3e',
      neonPink:'#e94b8e', cyan:'#3a96b8', darkCyan:'#0e6683',
      deepBlue:'#0a0e28', shadedBlue:'#142854', shadedCyan:'#28799a',
    },
  },
  'peach-fuzz': {
    label: 'Peach Fuzz',
    colors: {
      black:'#0e0a08', darkGray:'#241a18', midGray:'#433230', lightGray:'#8a7870', white:'#f5e8d4',
      red:'#d83a3a', darkRed:'#6e1618', blue:'#2a6478', darkBlue:'#10333d',
      gold:'#e0a96d', darkGold:'#7a5434', green:'#4a8c5a', darkGreen:'#1f3f28',
      purple:'#8b4a7a', darkPurple:'#40223a',
      neonPink:'#ff7fa8', cyan:'#5ab0a8', darkCyan:'#1a7068',
      deepBlue:'#0c2028', shadedBlue:'#1e4a5e', shadedCyan:'#3a9088',
    },
  },
  'ultra-violet': {
    label: 'Ultra Violet',
    colors: {
      black:'#08060f', darkGray:'#18142c', midGray:'#342a55', lightGray:'#7a6fa0', white:'#ece4f5',
      red:'#e03070', darkRed:'#701534', blue:'#3a4ad8', darkBlue:'#151e6c',
      gold:'#f0c419', darkGold:'#80640a', green:'#2ecc71', darkGreen:'#0f5a30',
      purple:'#5f4b8b', darkPurple:'#2c2145',
      neonPink:'#ff4ad1', cyan:'#4fd5e0', darkCyan:'#0090a8',
      deepBlue:'#0e0a30', shadedBlue:'#252080', shadedCyan:'#20b0c0',
    },
  },
  'emerald-vault': {
    label: 'Emerald Vault',
    colors: {
      black:'#060a08', darkGray:'#10211b', midGray:'#24433a', lightGray:'#6a8a7e', white:'#e8e4d0',
      red:'#b02840', darkRed:'#5e1324', blue:'#1e5a7a', darkBlue:'#0a2a3d',
      gold:'#d4a017', darkGold:'#6e5210', green:'#009b48', darkGreen:'#005028',
      purple:'#6a4c93', darkPurple:'#33244a',
      neonPink:'#f05890', cyan:'#40c0a0', darkCyan:'#108868',
      deepBlue:'#081a14', shadedBlue:'#143e58', shadedCyan:'#2ea888',
    },
  },
  'mocha-mousse': {
    label: 'Mocha Mousse',
    colors: {
      black:'#0c0908', darkGray:'#1e1614', midGray:'#3e302a', lightGray:'#8a7568', white:'#f2e8da',
      red:'#c44536', darkRed:'#6a2018', blue:'#3a6080', darkBlue:'#1a3040',
      gold:'#c8963e', darkGold:'#6e5020', green:'#5a8a60', darkGreen:'#2a4430',
      purple:'#7a5070', darkPurple:'#3e2838',
      neonPink:'#e87090', cyan:'#6ab0a8', darkCyan:'#307870',
      deepBlue:'#101820', shadedBlue:'#284860', shadedCyan:'#4a9890',
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
