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
  // ═══ COMMON ═══
  { id: 'tablet_twenty',  name: 'Tablette du XX',     emoji: '📜', description: 'Tous les segments valent 20',         rarity: 'common',    cost: 30,  minRound: 1, effects: [{ type: 'set_base_value', value: 20, metaLevel: 0 }] },
  { id: 'tablet_nineteen',name: 'Tablette du XIX',    emoji: '📜', description: 'Tous les segments valent 19',         rarity: 'common',    cost: 25,  minRound: 1, effects: [{ type: 'set_base_value', value: 19, metaLevel: 0 }] },

  // ═══ UNCOMMON ═══
  { id: 'even_charm',     name: 'Charme Pair',        emoji: '✨', description: '+1 aux cases de valeur paire',                rarity: 'uncommon',  cost: 45,  minRound: 2, effects: [{ type: 'add_even_segments', value: 1, metaLevel: 0 }] },
  { id: 'odd_charm',      name: 'Charme Impair',      emoji: '✨', description: '+3 aux cases de valeur impaire',              rarity: 'uncommon',  cost: 50,  minRound: 2, effects: [{ type: 'add_odd_segments', value: 3, metaLevel: 0 }] },

  // ═══ RARE ═══
  { id: 'even_totem',     name: 'Totem Pair',         emoji: '🗿', description: '+5 aux cases de valeur paire',                rarity: 'rare',      cost: 80,  minRound: 4, effects: [{ type: 'add_even_segments', value: 5, metaLevel: 0 }] },
  { id: 'odd_totem',      name: 'Totem Impair',       emoji: '🗿', description: '+10 aux cases de valeur impaire',             rarity: 'rare',      cost: 90,  minRound: 4, effects: [{ type: 'add_odd_segments', value: 10, metaLevel: 0 }] },

  // ═══ LEGENDARY ═══
  { id: 'celestial_crown',name: 'Couronne Céleste',   emoji: '👑', description: '+25 valeurs paires, +50 valeurs impaires',             rarity: 'legendary', cost: 200, minRound: 7, effects: [{ type: 'add_even_segments', value: 25, metaLevel: 0 }, { type: 'add_odd_segments', value: 50, metaLevel: 0 }] },
];

export const RELIC_MAP = new Map(RELICS.map(r => [r.id, r]));

export function getRelic(id) {
  const r = RELIC_MAP.get(id);
  if (!r) throw new Error(`Unknown relic: ${id}`);
  return r;
}

export const RELIC_RARITY_WEIGHTS = { common: 50, uncommon: 30, rare: 15, legendary: 5 };

/**
 * Dynamic rarity weights based on current round.
 * Higher rounds → more rare/legendary.
 */
export function getRarityWeights(round) {
  const t = Math.min(1, (round - 1) / 11); // 0 at round 1, 1 at round 12
  return {
    common:    Math.round(50 - 30 * t),   // 50 → 20
    uncommon:  Math.round(30 + 5 * t),     // 30 → 35
    rare:      Math.round(15 + 20 * t),    // 15 → 35
    legendary: Math.round(5 + 15 * t),     // 5  → 20
  };
}
