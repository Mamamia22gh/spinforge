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
export const SYMBOLS = [];

export const SYMBOL_MAP = new Map(SYMBOLS.map(s => [s.id, s]));

export function getSymbol(id) {
  const s = SYMBOL_MAP.get(id);
  if (!s) throw new Error(`Unknown symbol: ${id}`);
  return s;
}

export const RARITY_WEIGHTS = { common: 50, uncommon: 30, rare: 15, legendary: 5 };
