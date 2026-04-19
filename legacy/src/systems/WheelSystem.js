import { getSymbol } from '../data/symbols.js';
import { BALANCE, getQuota } from '../data/balance.js';
import { uid } from '../core/GameState.js';

/**
 * Manages the roulette wheel: segments, weights, spinning.
 */
export class WheelSystem {
  #events;

  constructor(events) {
    this.#events = events;
  }

  /**
   * Spin the wheel — pick a random segment based on weights.
   * @param {object} run
   * @param {import('../core/RNG.js').RNG} rng
   * @returns {{ segmentIndex: number, segment: object, symbol: object }}
   */
  spin(run, rng) {
    const wheel = run.wheel;
    const dda = run.dda;
    const ddaOn = BALANCE.DDA_ENABLED;

    // Build weight array with DDA modulation
    const weights = wheel.map((s, i) => {
      let w = s.weight;
      if (!ddaOn) return w;

      const isGold = BALANCE.GOLD_POCKETS.includes(i);
      const isMiss = BALANCE.MISS_POCKETS.includes(i);

      // Anti-frustration: boost high-value, nerf misses
      if (dda.frustrationScore > BALANCE.DDA_ANTI_FRUSTRATION_THRESHOLD && run.ballsLeft <= 2) {
        if (isGold || s.weight >= 3) w *= 1.4;
        if (isMiss) w *= 0.5;
      }

      // Anti-runaway: nerf gold if way above quota
      const quota = getQuota(run.round);
      if (run.score > quota * 1.5 && run.ballsLeft > 1) {
        if (isGold) w *= 0.6;
      }

      // First-Time Experience: boost non-miss in early rounds
      if (run.round <= BALANCE.DDA_FIRST_TIME_ROUNDS) {
        if (isMiss) w *= 0.6;
        else w *= 1.2;
      }

      return w;
    });

    const totalWeight = weights.reduce((s, w) => s + w, 0);

    let roll = rng.next() * totalWeight;
    let segmentIndex = 0;

    for (let i = 0; i < wheel.length; i++) {
      roll -= weights[i];
      if (roll <= 0) { segmentIndex = i; break; }
    }

    // Near-miss engineering: if NOT gold, chance to land adjacent to gold
    if (ddaOn
      && !BALANCE.GOLD_POCKETS.includes(segmentIndex)
      && run.round <= BALANCE.DDA_NEAR_MISS_MAX_ROUND
      && dda.nearMissesThisRound < 1
      && rng.next() < BALANCE.DDA_NEAR_MISS_CHANCE
    ) {
      const adj = [];
      for (const g of BALANCE.GOLD_POCKETS) {
        if (g >= wheel.length) continue;
        const prev = (g - 1 + wheel.length) % wheel.length;
        const next = (g + 1) % wheel.length;
        if (!BALANCE.GOLD_POCKETS.includes(prev) && !BALANCE.MISS_POCKETS.includes(prev)) adj.push(prev);
        if (!BALANCE.GOLD_POCKETS.includes(next) && !BALANCE.MISS_POCKETS.includes(next)) adj.push(next);
      }
      if (adj.length > 0) {
        segmentIndex = rng.pick(adj);
        dda.nearMissesThisRound++;
      }
    }

    const segment = wheel[segmentIndex];
    const symbol = segment.symbolId ? getSymbol(segment.symbolId) : null;

    this.#events.emit('wheel:spun', { segmentIndex, segment, symbol });

    return { segmentIndex, segment, symbol };
  }

  /**
   * Get the probability breakdown for the current wheel.
   * @param {object[]} wheel
   * @returns {Array<{symbolId: string, weight: number, probability: number, symbol: object}>}
   */
  getProbabilities(wheel) {
    const totalWeight = wheel.reduce((s, seg) => s + seg.weight, 0);
    if (totalWeight === 0) return [];

    // Aggregate by symbol
    const map = new Map();
    for (const seg of wheel) {
      if (!map.has(seg.symbolId)) {
        map.set(seg.symbolId, { symbolId: seg.symbolId, weight: 0, count: 0, symbol: seg.symbolId ? getSymbol(seg.symbolId) : null });
      }
      const entry = map.get(seg.symbolId);
      entry.weight += seg.weight;
      entry.count++;
    }

    return [...map.values()].map(e => ({
      ...e,
      probability: e.weight / totalWeight,
    }));
  }

  /**
   * Add a new segment to the wheel.
   * @param {object} run
   * @param {string} symbolId
   * @returns {boolean}
   */
  addSegment(run, symbolId) {
    if (run.wheel.length >= BALANCE.MAX_SEGMENTS) {
      this.#events.emit('wheel:max_segments');
      return false;
    }

    if (symbolId) getSymbol(symbolId); // validate if not null
    run.wheel.push({ id: uid('seg'), symbolId, weight: 1, modifiers: [] });
    this.#events.emit('wheel:segment_added', { symbolId, totalSegments: run.wheel.length });
    return true;
  }

  /**
   * Remove a segment by index.
   * @param {object} run
   * @param {number} index
   * @returns {boolean}
   */
  removeSegment(run, index) {
    if (run.wheel.length <= BALANCE.MIN_SEGMENTS) {
      this.#events.emit('wheel:min_segments');
      return false;
    }
    if (index < 0 || index >= run.wheel.length) {
      this.#events.emit('wheel:invalid_index', { index });
      return false;
    }

    const removed = run.wheel.splice(index, 1)[0];
    this.#events.emit('wheel:segment_removed', { removed, totalSegments: run.wheel.length });
    return true;
  }

  /**
   * Increase weight of a segment.
   * @param {object} run
   * @param {number} index
   * @returns {boolean}
   */
  boostWeight(run, index) {
    const seg = run.wheel[index];
    if (!seg) return false;
    if (seg.weight >= BALANCE.MAX_WEIGHT_PER_SEGMENT) {
      this.#events.emit('wheel:max_weight', { index });
      return false;
    }
    seg.weight++;
    this.#events.emit('wheel:weight_boosted', { index, newWeight: seg.weight });
    return true;
  }
}
