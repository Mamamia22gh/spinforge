/**
 * Bet type definitions.
 *
 * @typedef {object} BetTypeDef
 * @property {string} id
 * @property {string} name
 * @property {string} emoji
 * @property {string} description
 * @property {number} payout — multiplier on wager
 * @property {string} condition — evaluation type
 * @property {boolean} startsUnlocked
 * @property {number} minRound
 */

/** @type {BetTypeDef[]} */
export const BET_TYPES = [
  { id: 'sector',       name: 'Secteur',      emoji: '🧭', description: 'Tombe dans une zone de 3',    payout: 3,   condition: 'sector',   target: null,     startsUnlocked: true,  minRound: 1 },
  { id: 'wildcard',     name: 'Wildcard',     emoji: '🌟', description: "N'importe quel résultat",     payout: 1.2, condition: 'wildcard', target: null,     startsUnlocked: true,  minRound: 1 },
  { id: 'double_or_nothing', name: 'Quitte ou Double', emoji: '💀', description: 'x2 ou perd tout', payout: 3, condition: 'coin_flip', target: null, startsUnlocked: false, minRound: 6 },
];

export const BET_TYPE_MAP = new Map(BET_TYPES.map(b => [b.id, b]));

export function getBetType(id) {
  const b = BET_TYPE_MAP.get(id);
  if (!b) throw new Error(`Unknown bet type: ${id}`);
  return b;
}
