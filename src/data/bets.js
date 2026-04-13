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
  { id: 'color_red',    name: 'Rouge',       emoji: '🔴', description: 'Symbole rouge tombe',          payout: 2,   condition: 'color',    target: 'red',    startsUnlocked: true,  minRound: 1 },
  { id: 'color_blue',   name: 'Bleu',        emoji: '🔵', description: 'Symbole bleu tombe',           payout: 2,   condition: 'color',    target: 'blue',   startsUnlocked: true,  minRound: 1 },
  { id: 'color_gold',   name: 'Or',          emoji: '🟡', description: 'Symbole or tombe',             payout: 2.5, condition: 'color',    target: 'gold',   startsUnlocked: true,  minRound: 1 },
  { id: 'exact_red',    name: 'Exact Rouge',  emoji: '🎯', description: 'Le symbole Rouge exact',      payout: 5,   condition: 'exact',    target: 'red',    startsUnlocked: true,  minRound: 1 },
  { id: 'exact_blue',   name: 'Exact Bleu',   emoji: '🎯', description: 'Le symbole Bleu exact',       payout: 5,   condition: 'exact',    target: 'blue',   startsUnlocked: true,  minRound: 1 },
  { id: 'exact_gold',   name: 'Exact Or',     emoji: '🎯', description: 'Le symbole Or exact',         payout: 6,   condition: 'exact',    target: 'gold',   startsUnlocked: true,  minRound: 1 },
  { id: 'sector',       name: 'Secteur',      emoji: '🧭', description: 'Tombe dans une zone de 3',    payout: 3,   condition: 'sector',   target: null,     startsUnlocked: true,  minRound: 1 },
  { id: 'wildcard',     name: 'Wildcard',     emoji: '🌟', description: "N'importe quel résultat",     payout: 1.2, condition: 'wildcard', target: null,     startsUnlocked: true,  minRound: 1 },
  { id: 'color_green',  name: 'Vert',         emoji: '🟢', description: 'Symbole vert tombe',          payout: 3,   condition: 'color',    target: 'green',  startsUnlocked: false, minRound: 3 },
  { id: 'color_purple', name: 'Violet',       emoji: '🟣', description: 'Symbole violet tombe',        payout: 3,   condition: 'color',    target: 'purple', startsUnlocked: false, minRound: 3 },
  { id: 'exact_star',   name: 'Exact Étoile', emoji: '⭐', description: 'Le symbole Étoile exact',     payout: 10,  condition: 'exact',    target: 'star',   startsUnlocked: false, minRound: 5 },
  { id: 'exact_seven',  name: 'Exact Sept',   emoji: '7️⃣', description: 'Le symbole Sept exact',       payout: 12,  condition: 'exact',    target: 'seven',  startsUnlocked: false, minRound: 5 },
  { id: 'void_bet',     name: 'Pari Void',    emoji: '🌀', description: 'Le Void tombe',               payout: 15,  condition: 'exact',    target: 'void',   startsUnlocked: false, minRound: 7 },
  { id: 'chain',        name: 'Chaîne',       emoji: '⛓️', description: 'Même couleur 3× de suite',    payout: 8,   condition: 'chain',    target: null,     startsUnlocked: false, minRound: 4 },
  { id: 'double_or_nothing', name: 'Quitte ou Double', emoji: '💀', description: 'x2 ou perd tout', payout: 3, condition: 'coin_flip', target: null, startsUnlocked: false, minRound: 6 },
];

export const BET_TYPE_MAP = new Map(BET_TYPES.map(b => [b.id, b]));

export function getBetType(id) {
  const b = BET_TYPE_MAP.get(id);
  if (!b) throw new Error(`Unknown bet type: ${id}`);
  return b;
}
