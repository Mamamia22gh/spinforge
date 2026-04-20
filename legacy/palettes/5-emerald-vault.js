/**
 * Spinforge master palette — Emerald Vault (James Bond / Gringotts)
 */

export const PAL = {
  black:      '#060a08',
  darkGray:   '#10211b',
  midGray:    '#24433a',
  lightGray:  '#6a8a7e',
  white:      '#e8e4d0',

  red:        '#b02840',
  darkRed:    '#5e1324',
  blue:       '#1e5a7a',
  darkBlue:   '#0a2a3d',
  gold:       '#d4a017',
  darkGold:   '#6e5210',
  green:      '#009b48',
  darkGreen:  '#005028',
  purple:     '#6a4c93',
  darkPurple: '#33244a',

  neonPink:   '#f05890',
  cyan:       '#40c0a0',
  darkCyan:   '#108868',

  deepBlue:   '#081a14',
  shadedBlue: '#143e58',
  shadedCyan: '#2ea888',
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
