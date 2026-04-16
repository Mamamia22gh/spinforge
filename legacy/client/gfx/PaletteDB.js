/**
 * Spinforge master palette — 16 colors, casino-dark PICO-8 vibe.
 * Every pixel in the game uses ONLY these colors.
 */

// Hex strings for canvas fillStyle
export const PAL = {
  black:      '#0a0a0a',
  darkGray:   '#1a1a2e',
  midGray:    '#333346',
  lightGray:  '#6a6a7a',
  white:      '#e8e0d0',

  red:        '#cc2233',
  darkRed:    '#6e1127',
  blue:       '#2b4ccc',
  darkBlue:   '#162266',
  gold:       '#d4a520',
  darkGold:   '#7a5e10',
  green:      '#22aa44',
  darkGreen:  '#105522',
  purple:     '#8833cc',
  darkPurple: '#441a66',

  neonPink:   '#ff44aa',
  cyan:       '#44aadd',
  darkCyan:   '#0088bb',

  // Diamond shadow tones
  deepBlue:   '#0e1144',
  shadedBlue: '#1a2e88',
  shadedCyan: '#337799',
};

// Same palette as uint32 ABGR (for ImageData manipulation)
export const PAL32 = {};
for (const [k, hex] of Object.entries(PAL)) {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  PAL32[k] = (255 << 24) | (b << 16) | (g << 8) | r; // ABGR
}

// Symbol color → palette mapping
export const SYM_COLORS = {};

// Segment alternation (casino red/black → dark/darker)
export const SEG_A = PAL.darkGray;
export const SEG_B = PAL.black;
export const DIVIDER_COLOR = PAL.black;
export const HUB_BG = PAL.black;
export const HUB_BORDER = PAL.midGray;
export const RIM_COLOR = PAL.darkGray;
