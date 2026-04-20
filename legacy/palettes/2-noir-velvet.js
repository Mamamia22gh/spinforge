/**
 * Spinforge master palette — Noir / Velvet Lounge
 */

export const PAL = {
  black:      '#07070c',
  darkGray:   '#13142a',
  midGray:    '#2a2c48',
  lightGray:  '#6d6f88',
  white:      '#eae0c8',

  red:        '#a32638',
  darkRed:    '#5a1220',
  blue:       '#1b3a6b',
  darkBlue:   '#0b1c3a',
  gold:       '#b8860b',
  darkGold:   '#5f4408',
  green:      '#2f5d3b',
  darkGreen:  '#132a19',
  purple:     '#563d7c',
  darkPurple: '#2a1d3e',

  neonPink:   '#e94b8e',
  cyan:       '#3a96b8',
  darkCyan:   '#0e6683',

  deepBlue:   '#0a0e28',
  shadedBlue: '#142854',
  shadedCyan: '#28799a',
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
