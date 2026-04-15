import { BALANCE } from '../data/balance.js';
import { RELICS, RELIC_RARITY_WEIGHTS, getRarityWeights } from '../data/relics.js';
import { SYMBOLS } from '../data/symbols.js';
import { CHOICES } from '../data/choices.js';

/**
 * Forge (shop) — buy relics, symbols and special balls between rounds.
 *
 * Slot layout (8 slots, 4 quadrants × 2):
 *   0-1  top-right     → relics
 *   2-3  bottom-right  → relics
 *   4    bottom-left/1 → REROLL (hardcoded, not in offerings)
 *   5    bottom-left/2 → SYMBOL (ball)
 *   6    top-left/1    → SPECIAL BALL
 *   7    top-left/2    → relic
 */
export class ShopSystem {
  #events;

  constructor(events) {
    this.#events = events;
  }

  /**
   * Generate shop offerings: 1 symbol + 1 special ball + relics filling the rest.
   * Slot 4 is reroll (not in array). Offerings are indexed by slot number.
   */
  generateOfferings(run, rng) {
    const round = run.round;
    const weights = getRarityWeights(round);
    const discount = run.shopDiscount || 0;
    const applyCost = (baseCost) => Math.max(1, Math.ceil(baseCost * (1 - discount / 100)));

    const offerings = new Array(8).fill(null);
    // Slot 4 = reroll, stays null in the array

    // ── 1. Symbol slot (slot 5) ──
    offerings[5] = this.#pickSymbol(run, rng, weights, applyCost);

    // ── 2. Special ball slot (slot 6) ──
    offerings[6] = this.#pickSpecialBall(run, rng, weights, applyCost);

    // ── 3. Relic slots (0, 1, 2, 3, 7) ──
    const relicSlots = [0, 1, 2, 3, 7];
    const relicPicks = this.#pickRelics(run, rng, weights, applyCost, relicSlots.length);
    for (let i = 0; i < relicSlots.length; i++) {
      offerings[relicSlots[i]] = relicPicks[i] || null;
    }

    return offerings;
  }

  #pickSymbol(run, rng, weights, applyCost) {
    const available = SYMBOLS.filter(s => {
      if (s.requiresUnlock) return false; // skip locked symbols
      return true;
    });
    if (available.length === 0) return this.#makeGenericBall(applyCost);

    // Weight by rarity
    const w = available.map(s => weights[s.rarity] || 1);
    const roll = rng.next();
    // Chance to offer a plain ball (no symbol) vs a special symbol
    // 60% plain ball, 40% special symbol (scales with round)
    const specialChance = Math.min(0.7, 0.3 + (run.round - 1) * 0.04);
    if (roll > specialChance || available.length === 0) {
      return this.#makeGenericBall(applyCost);
    }

    const pick = rng.pickWeighted(available, w);
    return {
      shopType: 'symbol',
      id: pick.id,
      name: pick.name,
      emoji: pick.emoji,
      rarity: pick.rarity,
      description: `Ajoute ${pick.name} à la roue`,
      finalCost: applyCost(pick.cost),
      symbolId: pick.id,
    };
  }

  #makeGenericBall(applyCost) {
    return {
      shopType: 'symbol',
      id: 'generic_ball',
      name: 'Segment',
      emoji: '⚪',
      rarity: 'common',
      description: 'Ajoute un pocket générique',
      finalCost: applyCost(15),
      symbolId: null,
    };
  }

  #pickSpecialBall(run, rng, weights, applyCost) {
    const balls = CHOICES.filter(c => {
      if (c.type !== 'special_ball') return false;
      if (c.minRound && run.round < c.minRound) return false;
      if (c.requiresUnlock) return false;
      return true;
    });
    if (balls.length === 0) {
      // Fallback: cheapest available
      const fb = CHOICES.find(c => c.type === 'special_ball') || CHOICES[CHOICES.length - 1];
      return {
        shopType: 'special_ball',
        id: fb.id,
        name: fb.name,
        emoji: fb.emoji,
        rarity: fb.rarity || 'common',
        description: fb.description,
        finalCost: applyCost(fb.cost || 20),
        effect: fb.effect,
      };
    }

    const w = balls.map(c => (weights[c.rarity] || 1) * c.weight);
    const pick = rng.pickWeighted(balls, w);
    return {
      shopType: 'special_ball',
      id: pick.id,
      name: pick.name,
      emoji: pick.emoji,
      rarity: pick.rarity || 'common',
      description: pick.description,
      finalCost: applyCost(pick.cost || 20),
      effect: pick.effect,
    };
  }

  #pickRelics(run, rng, weights, applyCost, count) {
    const available = RELICS.filter(r => {
      if (r.minRound > run.round) return false;
      if (run.relics.some(owned => owned.id === r.id)) return false;
      return true;
    });

    const picks = [];
    const usedIds = new Set();

    for (let i = 0; i < count; i++) {
      const pool = available.filter(r => !usedIds.has(r.id));
      if (pool.length === 0) {
        picks.push(null);
        continue;
      }

      const w = pool.map(r => weights[r.rarity] || 1);
      const pick = rng.pickWeighted(pool, w);
      picks.push({
        shopType: 'relic',
        ...pick,
        finalCost: applyCost(pick.cost),
      });
      usedIds.add(pick.id);
    }

    return picks;
  }

  /**
   * Buy any item from shop offerings.
   * @param {object} run
   * @param {object} meta
   * @param {number} slotIndex — slot in the 8-slot array
   * @param {import('../systems/WheelSystem.js').WheelSystem} wheelSystem
   * @returns {boolean}
   */
  buyItem(run, meta, slotIndex, wheelSystem) {
    const offering = run.shopOfferings[slotIndex];
    if (!offering) {
      this.#events.emit('shop:invalid_offering', { slotIndex });
      return false;
    }

    if (meta.tickets < offering.finalCost) {
      this.#events.emit('shop:insufficient_funds', { cost: offering.finalCost, available: meta.tickets });
      return false;
    }

    meta.tickets -= offering.finalCost;

    switch (offering.shopType) {
      case 'relic':
        run.relics.push(offering);
        break;

      case 'symbol':
        if (offering.id === 'generic_ball') {
          run.ballsLeft++;
        } else {
          wheelSystem.addSegment(run, offering.symbolId);
        }
        break;

      case 'special_ball':
        run.specialBalls.push({
          id: offering.id,
          name: offering.name,
          effect: offering.effect,
          rarity: offering.rarity,
        });
        run.ballsLeft++;
        this.#events.emit('special_ball:added', {
          ball: offering,
          totalSpecial: run.specialBalls.length,
          ballsLeft: run.ballsLeft,
        });
        break;

      default:
        // Treat as relic for backwards compat
        run.relics.push(offering);
        break;
    }

    run.shopOfferings[slotIndex] = null;

    this.#events.emit('shop:item_bought', {
      item: offering,
      cost: offering.finalCost,
      remaining: meta.tickets,
    });
    return true;
  }

  /**
   * Reroll shop offerings.
   */
  reroll(run, meta, rng) {
    const cost = BALANCE.SHOP_REROLL_BASE * Math.pow(2, run.rerollCount);

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
