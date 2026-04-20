/**
 * Spinforge master palette — Peach Fuzz 2024 (Vegas 70s rétro)
 */

export const PAL = {
  black:      '#0e0a08',
  darkGray:   '#241a18',
  midGray:    '#433230',
  lightGray:  '#8a7870',
  white:      '#f5e8d4',

  red:        '#d83a3a',
  darkRed:    '#6e1618',
  blue:       '#2a6478',
  darkBlue:   '#10333d',
  gold:       '#e0a96d',
  darkGold:   '#7a5434',
  green:      '#4a8c5a',
  darkGreen:  '#1f3f28',
  purple:     '#8b4a7a',
  darkPurple: '#40223a',

  neonPink:   '#ff7fa8',
  cyan:       '#5ab0a8',
  darkCyan:   '#1a7068',

  deepBlue:   '#0c2028',
  shadedBlue: '#1e4a5e',
  shadedCyan: '#3a9088',
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
