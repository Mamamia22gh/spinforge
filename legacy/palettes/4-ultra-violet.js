/**
 * Spinforge master palette — Ultra Violet / Neon Noir (Cyberpunk arcade)
 */

export const PAL = {
  black:      '#08060f',
  darkGray:   '#18142c',
  midGray:    '#342a55',
  lightGray:  '#7a6fa0',
  white:      '#ece4f5',

  red:        '#e03070',
  darkRed:    '#701534',
  blue:       '#3a4ad8',
  darkBlue:   '#151e6c',
  gold:       '#f0c419',
  darkGold:   '#80640a',
  green:      '#2ecc71',
  darkGreen:  '#0f5a30',
  purple:     '#5f4b8b',
  darkPurple: '#2c2145',

  neonPink:   '#ff4ad1',
  cyan:       '#4fd5e0',
  darkCyan:   '#0090a8',

  deepBlue:   '#0e0a30',
  shadedBlue: '#252080',
  shadedCyan: '#20b0c0',
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
