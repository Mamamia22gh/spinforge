import { getSymbol } from '../data/symbols.js';
import { BALANCE } from '../data/balance.js';
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
    const weights = wheel.map(s => s.weight);
    const totalWeight = weights.reduce((s, w) => s + w, 0);

    let roll = rng.next() * totalWeight;
    let segmentIndex = 0;

    for (let i = 0; i < wheel.length; i++) {
      roll -= wheel[i].weight;
      if (roll <= 0) { segmentIndex = i; break; }
    }

    const segment = wheel[segmentIndex];
    const symbol = getSymbol(segment.symbolId);

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
        map.set(seg.symbolId, { symbolId: seg.symbolId, weight: 0, count: 0, symbol: getSymbol(seg.symbolId) });
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

    getSymbol(symbolId); // validate
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
