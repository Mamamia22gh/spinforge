import { BALANCE } from '../data/balance.js';

/**
 * @typedef {object} MetaUnlock
 * @property {string} id
 * @property {string} name
 * @property {string} description
 * @property {number} cost
 * @property {string} category
 */

/** @type {MetaUnlock[]} */
export const META_UNLOCKS = [
  // Symbols
  { id: 'unlock_green',    name: 'Symbole Vert',      description: 'Segments Vert dans les choix',       cost: 3,  category: 'symbol' },
  { id: 'unlock_purple',   name: 'Symbole Violet',    description: 'Segments Violet dans les choix',     cost: 3,  category: 'symbol' },
  { id: 'unlock_cherry',   name: 'Cerise',            description: 'Cerise (double payout) dans choix',  cost: 5,  category: 'symbol' },
  { id: 'unlock_bell',     name: 'Cloche',            description: 'Cloche (+chips) dans les choix',     cost: 5,  category: 'symbol' },
  { id: 'unlock_diamond',  name: 'Diamant',           description: 'Diamant (multi all) dans les choix', cost: 10, category: 'symbol' },
  { id: 'unlock_seven',    name: 'Sept',              description: 'Sept (jackpot) dans les choix',      cost: 10, category: 'symbol' },
  { id: 'unlock_void',     name: 'Void',              description: 'Void (burst) dans les choix',        cost: 15, category: 'symbol' },
  { id: 'unlock_joker',    name: 'Joker',             description: 'Joker (wildcard) dans les choix',    cost: 12, category: 'symbol' },
  { id: 'unlock_phoenix',  name: 'Phénix',            description: 'Phénix (resurrect) dans les choix',  cost: 20, category: 'symbol' },

  // Bet types
  { id: 'unlock_chain_bet',name: 'Pari Chaîne',       description: 'Débloque le pari Chaîne',            cost: 6,  category: 'bet' },
  { id: 'unlock_void_bet', name: 'Pari Void',         description: 'Débloque le pari Void',              cost: 8,  category: 'bet' },
  { id: 'unlock_coin_flip',name: 'Quitte ou Double',   description: 'Débloque Quitte ou Double',          cost: 7,  category: 'bet' },

  // General
  { id: 'unlock_extra_bet',name: 'Pari Bonus',        description: '+1 pari max par spin',               cost: 8,  category: 'upgrade' },
  { id: 'unlock_16_seg',   name: 'Grande Roue',       description: 'Roue extensible à 16 segments',      cost: 12, category: 'upgrade' },
];

export const UNLOCK_MAP = new Map(META_UNLOCKS.map(u => [u.id, u]));

/**
 * Meta-progression system.
 */
export class MetaSystem {
  #events;

  constructor(events) {
    this.#events = events;
  }

  calculateStars(run, won = false) {
    let stars = run.round * BALANCE.STARS_PER_ROUND;
    if (won) stars += BALANCE.STARS_BONUS_WIN;
    return stars;
  }

  unlock(meta, unlockId) {
    const def = UNLOCK_MAP.get(unlockId);
    if (!def) {
      this.#events.emit('meta:unknown_unlock', { unlockId });
      return false;
    }
    if (meta.unlocks.includes(unlockId)) {
      this.#events.emit('meta:already_unlocked', { unlockId });
      return false;
    }
    if (meta.stars < def.cost) {
      this.#events.emit('meta:insufficient_stars', { unlockId, cost: def.cost, available: meta.stars });
      return false;
    }

    meta.stars -= def.cost;
    meta.unlocks.push(unlockId);
    this.#events.emit('meta:unlocked', { unlockId, name: def.name, remainingStars: meta.stars });
    return true;
  }

  isUnlocked(meta, unlockId) {
    return meta.unlocks.includes(unlockId);
  }

  getAvailableUnlocks(meta) {
    return META_UNLOCKS.map(u => ({
      ...u,
      unlocked: meta.unlocks.includes(u.id),
      affordable: meta.stars >= u.cost,
    }));
  }
}
