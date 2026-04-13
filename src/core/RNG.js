/**
 * Seedable PRNG — mulberry32.
 */
export class RNG {
  #state;
  #initialSeed;

  constructor(seed) {
    this.#initialSeed = seed >>> 0;
    this.#state = this.#initialSeed;
  }

  get seed() { return this.#initialSeed; }

  next() {
    let t = (this.#state += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }

  nextInt(min, max) {
    return Math.floor(this.next() * (max - min + 1)) + min;
  }

  nextFloat(min, max) {
    return this.next() * (max - min) + min;
  }

  chance(p) { return this.next() < p; }

  pick(arr) {
    if (!arr.length) throw new RangeError('Cannot pick from empty array');
    return arr[this.nextInt(0, arr.length - 1)];
  }

  pickWeighted(items, weights) {
    if (!items.length) throw new RangeError('Cannot pick from empty array');
    const total = weights.reduce((s, w) => s + w, 0);
    if (total <= 0) throw new RangeError('Total weight must be positive');
    let roll = this.next() * total;
    for (let i = 0; i < items.length; i++) {
      roll -= weights[i];
      if (roll <= 0) return items[i];
    }
    return items[items.length - 1];
  }

  shuffle(arr) {
    for (let i = arr.length - 1; i > 0; i--) {
      const j = this.nextInt(0, i);
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
  }

  pickN(arr, n) {
    if (n > arr.length) throw new RangeError(`Cannot pick ${n} from ${arr.length}`);
    return this.shuffle([...arr]).slice(0, n);
  }

  fork() {
    return new RNG((this.next() * 4294967296) >>> 0);
  }
}
