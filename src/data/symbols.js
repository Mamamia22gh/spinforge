/**
 * Wheel symbols — what can appear on the roulette.
 *
 * @typedef {object} SymbolDef
 * @property {string} id
 * @property {string} name
 * @property {string} emoji
 * @property {string} color — color group for color bets
 * @property {number} baseValue — innate value when landed on
 * @property {'common'|'uncommon'|'rare'|'legendary'} rarity
 * @property {boolean} startsUnlocked
 * @property {string|null} specialEffect
 */

/** @type {SymbolDef[]} */
export const SYMBOLS = [
  // ── Commons (starters) ──
  { id: 'red',      name: 'Rouge',     emoji: '🔴', color: 'red',    baseValue: 10,  rarity: 'common',    startsUnlocked: true,  specialEffect: null },
  { id: 'blue',     name: 'Bleu',      emoji: '🔵', color: 'blue',   baseValue: 10,  rarity: 'common',    startsUnlocked: true,  specialEffect: null },
  { id: 'gold',     name: 'Or',        emoji: '🟡', color: 'gold',   baseValue: 15,  rarity: 'common',    startsUnlocked: true,  specialEffect: null },

  // ── Uncommons ──
  { id: 'green',    name: 'Vert',      emoji: '🟢', color: 'green',  baseValue: 12,  rarity: 'uncommon',  startsUnlocked: false, specialEffect: null },
  { id: 'purple',   name: 'Violet',    emoji: '🟣', color: 'purple', baseValue: 14,  rarity: 'uncommon',  startsUnlocked: false, specialEffect: null },
  { id: 'cherry',   name: 'Cerise',    emoji: '🍒', color: 'red',    baseValue: 20,  rarity: 'uncommon',  startsUnlocked: false, specialEffect: 'double_payout' },
  { id: 'bell',     name: 'Cloche',    emoji: '🔔', color: 'gold',   baseValue: 22,  rarity: 'uncommon',  startsUnlocked: false, specialEffect: 'extra_chips' },

  // ── Rares ──
  { id: 'diamond',  name: 'Diamant',   emoji: '💎', color: 'white',  baseValue: 30,  rarity: 'rare',      startsUnlocked: false, specialEffect: 'multiply_all' },
  { id: 'seven',    name: 'Sept',      emoji: '7️⃣', color: 'red',    baseValue: 35,  rarity: 'rare',      startsUnlocked: false, specialEffect: 'jackpot' },
  { id: 'star',     name: 'Étoile',    emoji: '⭐', color: 'gold',   baseValue: 25,  rarity: 'rare',      startsUnlocked: false, specialEffect: 'wildcard' },

  // ── Legendaries ──
  { id: 'void',     name: 'Void',      emoji: '🌀', color: 'void',   baseValue: 0,   rarity: 'legendary', startsUnlocked: false, specialEffect: 'void_burst' },
  { id: 'joker',    name: 'Joker',     emoji: '🃏', color: 'wild',   baseValue: 5,   rarity: 'legendary', startsUnlocked: false, specialEffect: 'wildcard' },
  { id: 'phoenix',  name: 'Phénix',    emoji: '🔥', color: 'red',    baseValue: 50,  rarity: 'legendary', startsUnlocked: false, specialEffect: 'resurrect' },
];

export const SYMBOL_MAP = new Map(SYMBOLS.map(s => [s.id, s]));

export function getSymbol(id) {
  const s = SYMBOL_MAP.get(id);
  if (!s) throw new Error(`Unknown symbol: ${id}`);
  return s;
}

export const RARITY_WEIGHTS = { common: 50, uncommon: 30, rare: 15, legendary: 5 };
