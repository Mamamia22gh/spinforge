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

    // ── Step 1: Accumulate level-0 ──
    const base = { ...DEFAULT_MODS };

    for (const relic of relics) {
      for (const eff of relic.effects) {
        if (eff.metaLevel !== 0) continue;
        this.#accumulateBase(base, eff);
      }
    }

    // ── Step 2: Level-1 multipliers ──
    let percentMulti = 1;
    let moneyMulti = 1;
    let echoSpins = 0;

    for (const relic of relics) {
      for (const eff of relic.effects) {
        if (eff.metaLevel !== 1) continue;
        switch (eff.type) {
          case 'percent_multiplier': percentMulti *= eff.value; break;
          case 'money_multiplier':   moneyMulti *= eff.value; break;
          case 'echo_spin':          echoSpins += eff.value; break;
          case 'value_per_relic':    base.allPayoutPercent += eff.value * relics.length; break;
        }
      }
    }

    // ── Step 3: Level-2 multipliers ──
    let metaBoost = 1;

    for (const relic of relics) {
      for (const eff of relic.effects) {
        if (eff.metaLevel !== 2) continue;
        switch (eff.type) {
          case 'meta_boost':
            metaBoost *= (1 + eff.value / 100);
            break;
          case 'final_multiplier':
            percentMulti *= (1 + eff.value / 100);
            break;
          case 'all_payout_percent':
            base.allPayoutPercent += eff.value;
            break;
        }
      }
    }

    percentMulti = 1 + (percentMulti - 1) * metaBoost;
    moneyMulti = 1 + (moneyMulti - 1) * metaBoost;

    // ── Step 4: Level-3 ──
    let globalBoost = 1;

    for (const relic of relics) {
      for (const eff of relic.effects) {
        if (eff.metaLevel !== 3) continue;
        if (eff.type === 'global_boost') globalBoost *= (1 + eff.value / 100);
      }
    }

    percentMulti *= globalBoost;
    moneyMulti *= globalBoost;

    // ── Step 5: Apply ──
    return {
      allPayoutPercent:     base.allPayoutPercent * percentMulti,
      exactPayoutPercent:   base.exactPayoutPercent * percentMulti,
      chainPayoutPercent:   base.chainPayoutPercent * percentMulti,
      chipsPerRound:        base.chipsPerRound,
      startingChips:        base.startingChips,
      extraSpins:           base.extraSpins,
      moneyBonus:           Math.floor(base.moneyBonus * moneyMulti),
      shopDiscount:         Math.min(80, base.shopDiscount),
      lossReduction:        base.lossReduction,
      previewNext:          base.previewNext > 0,
      echoSpins,
    };
  }

  #accumulateBase(base, eff) {
    switch (eff.type) {
      case 'all_payout_percent':    base.allPayoutPercent += eff.value; break;
      case 'exact_payout_percent':  base.exactPayoutPercent += eff.value; break;
      case 'chain_payout_percent':  base.chainPayoutPercent += eff.value; break;
      case 'chips_per_round':       base.chipsPerRound += eff.value; break;
      case 'starting_chips':        base.startingChips += eff.value; break;
      case 'extra_spins':           base.extraSpins += eff.value; break;
      case 'money_round_end':       base.moneyBonus += eff.value; break;
      case 'shop_discount':         base.shopDiscount += eff.value; break;
      case 'loss_reduction':        base.lossReduction = Math.max(base.lossReduction, eff.value); break;
      case 'preview_next':          base.previewNext += eff.value; break;
    }
  }
}

const DEFAULT_MODS = Object.freeze({
  allPayoutPercent: 0,
  exactPayoutPercent: 0,
  chainPayoutPercent: 0,
  chipsPerRound: 0,
  startingChips: 0,
  extraSpins: 0,
  moneyBonus: 0,
  shopDiscount: 0,
  lossReduction: 0,
  previewNext: 0,
  echoSpins: 0,
});
