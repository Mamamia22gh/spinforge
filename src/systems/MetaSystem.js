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
  { id: 'unlock_cherry',   name: 'Cerise',            description: 'Cerise (double payout) dans choix',  cost: 5,  category: 'symbol' },
  { id: 'unlock_void',     name: 'Void',              description: 'Void (burst) dans les choix',        cost: 15, category: 'symbol' },

  // Bet types
  { id: 'unlock_chain_bet',name: 'Pari Chaîne',       description: 'Débloque le pari Chaîne',            cost: 6,  category: 'bet' },
  { id: 'unlock_void_bet', name: 'Pari Void',         description: 'Débloque le pari Void',              cost: 8,  category: 'bet' },
  { id: 'unlock_coin_flip',name: 'Quitte ou Double',   description: 'Débloque Quitte ou Double',          cost: 7,  category: 'bet' },

  // General
  { id: 'unlock_extra_bet',name: 'Pari Bonus',        description: '+1 pari max par spin',               cost: 8,  category: 'upgrade' },
  { id: 'unlock_16_seg',   name: 'Grande Roue',       description: 'Roue extensible à 16 segments',      cost: 12, category: 'upgrade' },

  // Gauges
  { id: 'unlock_gauge_2',  name: 'Chargeur Supérieur', description: 'Débloque le 2e chargeur de billes',  cost: 8,  category: 'upgrade' },
  { id: 'unlock_gauge_3',  name: 'Chargeur Inférieur', description: 'Débloque le 3e chargeur de billes',  cost: 15, category: 'upgrade' },
  { id: 'unlock_gauge_4',  name: 'Chargeur Gauche',    description: 'Débloque le 4e chargeur de billes',  cost: 25, category: 'upgrade' },
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

  calculateTickets(run, won = false) {
    let tickets = run.round * BALANCE.TICKETS_PER_ROUND;
    if (won) tickets += BALANCE.TICKETS_BONUS_WIN;
    return tickets;
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
    if (meta.tickets < def.cost) {
      this.#events.emit('meta:insufficient_tickets', { unlockId, cost: def.cost, available: meta.tickets });
      return false;
    }

    meta.tickets -= def.cost;
    meta.unlocks.push(unlockId);
    this.#events.emit('meta:unlocked', { unlockId, name: def.name, remainingTickets: meta.tickets });
    return true;
  }

  isUnlocked(meta, unlockId) {
    return meta.unlocks.includes(unlockId);
  }

  getAvailableUnlocks(meta) {
    return META_UNLOCKS.map(u => ({
      ...u,
      unlocked: meta.unlocks.includes(u.id),
      affordable: meta.tickets >= u.cost,
    }));
  }
}
