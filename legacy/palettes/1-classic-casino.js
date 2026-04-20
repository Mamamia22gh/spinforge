/**
 * Spinforge master palette — Classic Casino (Viva Magenta + Classic Blue)
 */

export const PAL = {
  black:      '#0b0a0d',
  darkGray:   '#1c1a24',
  midGray:    '#38333f',
  lightGray:  '#787382',
  white:      '#f0e9d8',

  red:        '#be3455',
  darkRed:    '#6a1a30',
  blue:       '#0f4c81',
  darkBlue:   '#0a2648',
  gold:       '#c9a227',
  darkGold:   '#6e5510',
  green:      '#00806a',
  darkGreen:  '#0a3e33',
  purple:     '#6b3fa0',
  darkPurple: '#351e52',

  neonPink:   '#ff5e9e',
  cyan:       '#4ab5c9',
  darkCyan:   '#0d7a94',

  deepBlue:   '#0a1a3a',
  shadedBlue: '#0c3668',
  shadedCyan: '#2a8da8',
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
