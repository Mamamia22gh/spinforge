/**
 * Evaluates relic effects with meta-level pipeline (same as cookielike EffectSystem).
 *
 * Pipeline:
 *   1. Accumulate level-0 (direct) effects
 *   2. Compute level-1 multiplier (meta)
 *   3. Compute level-2 multiplier (meta²)
 *   4. Compute level-3 multiplier (meta³)
 *   5. Apply
 */
export class EffectSystem {
  /**
   * Compute all modifiers from relics.
   * @param {object[]} relics
   * @returns {object}
   */
  compute(relics) {
    if (!relics || relics.length === 0) return { ...DEFAULT_MODS };

    const base = { ...DEFAULT_MODS };

    for (const relic of relics) {
      for (const eff of relic.effects) {
        if (eff.metaLevel !== 0) continue;
        this.#accumulateBase(base, eff);
      }
    }

    return { ...base };
  }

  #accumulateBase(base, eff) {
    switch (eff.type) {
      case 'set_base_value':
        // Last-wins: highest value takes precedence
        base.setBaseValue = base.setBaseValue === null
          ? eff.value
          : Math.max(base.setBaseValue, eff.value);
        break;
      case 'add_even_segments':  base.addEven += eff.value; break;
      case 'add_odd_segments':   base.addOdd += eff.value; break;
    }
  }
}

const DEFAULT_MODS = Object.freeze({
  setBaseValue: null,   // if non-null, replaces (segmentIndex + 1) as base value
  addEven: 0,           // flat bonus added to even-indexed segments (0,2,4,...)
  addOdd: 0,            // flat bonus added to odd-indexed segments (1,3,5,...)
});
