/**
 * Relic definitions — permanent run items bought in the Forge (shop).
 *
 * @typedef {object} RelicDef
 * @property {string} id
 * @property {string} name
 * @property {string} emoji
 * @property {string} description
 * @property {'common'|'uncommon'|'rare'|'legendary'} rarity
 * @property {number} cost
 * @property {number} minRound
 * @property {Array<{type: string, value: number, metaLevel: number}>} effects
 */

/** @type {RelicDef[]} */
export const RELICS = [
  // ═══ COMMON (15-35💵) ═══
  { id: 'lucky_coin',     name: 'Pièce Porte-Bonheur', emoji: '🪙', description: '+10 chips par round',   rarity: 'common',    cost: 30,  minRound: 1, effects: [{ type: 'chips_per_round', value: 10, metaLevel: 0 }] },
  { id: 'horseshoe',      name: 'Fer à Cheval',   emoji: '🧲', description: '+20% payout exact',            rarity: 'common',    cost: 30,  minRound: 1, effects: [{ type: 'exact_payout_percent', value: 20, metaLevel: 0 }] },
  { id: 'rabbits_foot',   name: 'Patte de Lapin', emoji: '🐾', description: '+10% tous les payouts',        rarity: 'common',    cost: 35,  minRound: 1, effects: [{ type: 'all_payout_percent', value: 10, metaLevel: 0 }] },
  { id: 'piggy_bank',     name: 'Tirelire',       emoji: '🐷', description: '+8💵 par fin de round',        rarity: 'common',    cost: 20,  minRound: 1, effects: [{ type: 'money_round_end', value: 8, metaLevel: 0 }] },
  { id: 'magnet',         name: 'Aimant',         emoji: '🧲', description: '+5 chips de départ',            rarity: 'common',    cost: 25,  minRound: 1, effects: [{ type: 'starting_chips', value: 5, metaLevel: 0 }] },
  { id: 'double_down',    name: 'Double Down',    emoji: '✌️', description: '+1 spin par round',            rarity: 'common',    cost: 35,  minRound: 2, effects: [{ type: 'extra_spins', value: 1, metaLevel: 0 }] },

  // ═══ UNCOMMON (40-60💵) ═══
  { id: 'crystal_ball',   name: 'Boule de Cristal', emoji: '🔮', description: 'Vois le prochain résultat',  rarity: 'uncommon',  cost: 50,  minRound: 3, effects: [{ type: 'preview_next', value: 1, metaLevel: 0 }] },
  { id: 'weighted_wheel', name: 'Roue Lestée',    emoji: '⚖️', description: '+25% poids symbole favori',    rarity: 'uncommon',  cost: 45,  minRound: 4, effects: [{ type: 'weight_boost_percent', value: 25, metaLevel: 0 }] },
  { id: 'insurance',      name: 'Assurance',       emoji: '🛡️', description: 'Perd 50% au lieu de 100%',    rarity: 'uncommon',  cost: 55,  minRound: 3, effects: [{ type: 'loss_reduction', value: 50, metaLevel: 0 }] },
  { id: 'combo_hunter',   name: 'Chasseur Combo', emoji: '🎯', description: '+50% payout chaîne',           rarity: 'uncommon',  cost: 50,  minRound: 4, effects: [{ type: 'chain_payout_percent', value: 50, metaLevel: 0 }] },
  { id: 'bargain',        name: 'Négociateur',    emoji: '🤝', description: '-20% prix du shop',             rarity: 'uncommon',  cost: 40,  minRound: 2, effects: [{ type: 'shop_discount', value: 20, metaLevel: 0 }] },

  // ═══ RARE — Meta Level 1 (70-110💵) ═══
  { id: 'amplifier',      name: 'Amplificateur',  emoji: '📡', description: 'META: Tous les bonus % ×1.5',  rarity: 'rare',      cost: 100, minRound: 6, effects: [{ type: 'percent_multiplier', value: 1.5, metaLevel: 1 }] },
  { id: 'echo_spin',      name: 'Écho du Spin',   emoji: '🪞', description: 'META: Gains doublés 1×/round', rarity: 'rare',      cost: 90,  minRound: 7, effects: [{ type: 'echo_spin', value: 1, metaLevel: 1 }] },
  { id: 'catalyst',       name: 'Catalyseur',     emoji: '⚗️', description: 'META: Bonus 💵 ×2',            rarity: 'rare',      cost: 80,  minRound: 5, effects: [{ type: 'money_multiplier', value: 2, metaLevel: 1 }] },
  { id: 'synergy',        name: 'Synergie',       emoji: '🔗', description: 'META: +3% per relic owned',     rarity: 'rare',      cost: 95,  minRound: 7, effects: [{ type: 'value_per_relic', value: 3, metaLevel: 1 }] },

  // ═══ LEGENDARY — Meta Level 2 (130-200💵) ═══
  { id: 'singularity',    name: 'Singularité',    emoji: '🌀', description: 'META²: Effets meta +25%',      rarity: 'legendary', cost: 180, minRound: 9,  effects: [{ type: 'meta_boost', value: 25, metaLevel: 2 }] },
  { id: 'crown',          name: 'Couronne',       emoji: '👑', description: 'META²: +50% tous payouts',     rarity: 'legendary', cost: 200, minRound: 10, effects: [{ type: 'all_payout_percent', value: 50, metaLevel: 0 }, { type: 'final_multiplier', value: 25, metaLevel: 2 }] },
  { id: 'infinity',       name: 'Infini',         emoji: '♾️', description: 'META²: +2 spins, payouts +20%', rarity: 'legendary', cost: 220, minRound: 10, effects: [{ type: 'extra_spins', value: 2, metaLevel: 0 }, { type: 'all_payout_percent', value: 20, metaLevel: 2 }] },
  { id: 'transcendence',  name: 'Transcendance',  emoji: '💎', description: 'META³: +25% sur TOUT',         rarity: 'legendary', cost: 280, minRound: 11, effects: [{ type: 'global_boost', value: 25, metaLevel: 3 }] },
];

export const RELIC_MAP = new Map(RELICS.map(r => [r.id, r]));

export function getRelic(id) {
  const r = RELIC_MAP.get(id);
  if (!r) throw new Error(`Unknown relic: ${id}`);
  return r;
}

export const RELIC_RARITY_WEIGHTS = { common: 50, uncommon: 30, rare: 15, legendary: 5 };
