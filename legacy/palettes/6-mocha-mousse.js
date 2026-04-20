/**
 * Spinforge master palette — Mocha Mousse 2025 (Warm espresso / copper)
 */

export const PAL = {
  black:      '#0c0908',
  darkGray:   '#1e1614',
  midGray:    '#3e302a',
  lightGray:  '#8a7568',
  white:      '#f2e8da',

  red:        '#c44536',
  darkRed:    '#6a2018',
  blue:       '#3a6080',
  darkBlue:   '#1a3040',
  gold:       '#c8963e',
  darkGold:   '#6e5020',
  green:      '#5a8a60',
  darkGreen:  '#2a4430',
  purple:     '#7a5070',
  darkPurple: '#3e2838',

  neonPink:   '#e87090',
  cyan:       '#6ab0a8',
  darkCyan:   '#307870',

  deepBlue:   '#101820',
  shadedBlue: '#284860',
  shadedCyan: '#4a9890',
};

export const PAL32 = {};
for (const [k, hex] of Object.entries(PAL)) {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  PAL32[k] = (255 << 24) | (b << 16) | (g << 8) | r;
}

export const SYM_COLORS = {};
export const SEG_A = PAL.darkGray;
export const SEG_B = PAL.black;
export const DIVIDER_COLOR = PAL.black;
export const HUB_BG = PAL.black;
export const HUB_BORDER = PAL.midGray;
export const RIM_COLOR = PAL.darkGray;
