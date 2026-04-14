import { BALANCE } from '../data/balance.js';
import { RELICS, RELIC_RARITY_WEIGHTS } from '../data/relics.js';

/**
 * Forge (shop) — buy relics and wheel manipulations between rounds.
 */
export class ShopSystem {
  #events;

  constructor(events) {
    this.#events = events;
  }

  /**
   * Generate random relic offerings.
   * @param {object} run
   * @param {import('../core/RNG.js').RNG} rng
   * @returns {object[]}
   */
  generateOfferings(run, rng) {
    const round = run.round;
    const count = round >= 9 ? 4 : round >= 5 ? 3 : 2;

    const available = RELICS.filter(r => {
      if (r.minRound > round) return false;
      if (run.relics.some(owned => owned.id === r.id)) return false;
      return true;
    });

    if (available.length === 0) return [];

    const offerings = [];
    const usedIds = new Set();

    for (let i = 0; i < count && available.length > usedIds.size; i++) {
      const pool = available.filter(r => !usedIds.has(r.id));
      if (pool.length === 0) break;

      const weights = pool.map(r => RELIC_RARITY_WEIGHTS[r.rarity] || 1);
      const pick = rng.pickWeighted(pool, weights);

      const discount = run.shopDiscount || 0;
      const cost = Math.max(1, Math.ceil(pick.cost * (1 - discount / 100)));

      offerings.push({ ...pick, finalCost: cost });
      usedIds.add(pick.id);
    }

    return offerings;
  }

  /**
   * Buy a relic from offerings.
   * @param {object} run
   * @param {number} offeringIndex
   * @returns {boolean}
   */
  buyRelic(run, meta, offeringIndex) {
    const offering = run.shopOfferings[offeringIndex];
    if (!offering) {
      this.#events.emit('shop:invalid_offering', { offeringIndex });
      return false;
    }

    if (meta.tickets < offering.finalCost) {
      this.#events.emit('shop:insufficient_funds', { cost: offering.finalCost, available: meta.tickets });
      return false;
    }

    meta.tickets -= offering.finalCost;
    run.relics.push(offering);
    run.shopOfferings.splice(offeringIndex, 1);

    this.#events.emit('shop:relic_bought', {
      relic: offering,
      cost: offering.finalCost,
      remaining: meta.tickets,
    });
    return true;
  }

  /**
   * Reroll shop offerings.
   * @param {object} run
   * @param {import('../core/RNG.js').RNG} rng
   * @returns {boolean}
   */
  reroll(run, meta, rng) {
    const cost = BALANCE.SHOP_REROLL_BASE + run.rerollCount * BALANCE.SHOP_REROLL_INCREMENT;

    if (meta.tickets < cost) {
      this.#events.emit('shop:insufficient_funds', { cost, available: meta.tickets });
      return false;
    }

    meta.tickets -= cost;
    run.rerollCount++;
    run.shopOfferings = this.generateOfferings(run, rng);

    this.#events.emit('shop:rerolled', { cost, offerings: run.shopOfferings });
    return true;
  }
}
