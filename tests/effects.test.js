import { describe, it, expect, beforeEach } from 'vitest';
import { EffectSystem } from '../src/systems/EffectSystem.js';

describe('EffectSystem', () => {
  let fx;

  beforeEach(() => {
    fx = new EffectSystem();
  });

  it('returns default mods with no relics', () => {
    const mods = fx.compute([]);
    expect(mods.allPayoutPercent).toBe(0);
    expect(mods.extraSpins).toBe(0);
    expect(mods.shopDiscount).toBe(0);
  });

  it('accumulates level-0 effects', () => {
    const relics = [
      { effects: [{ type: 'all_payout_percent', value: 10, metaLevel: 0 }] },
      { effects: [{ type: 'all_payout_percent', value: 15, metaLevel: 0 }] },
    ];
    const mods = fx.compute(relics);
    expect(mods.allPayoutPercent).toBe(25);
  });

  it('applies level-1 percent multiplier', () => {
    const relics = [
      { effects: [{ type: 'all_payout_percent', value: 10, metaLevel: 0 }] },
      { effects: [{ type: 'percent_multiplier', value: 1.5, metaLevel: 1 }] },
    ];
    const mods = fx.compute(relics);
    // 10 * 1.5 = 15
    expect(mods.allPayoutPercent).toBe(15);
  });

  it('applies level-2 meta boost', () => {
    const relics = [
      { effects: [{ type: 'all_payout_percent', value: 10, metaLevel: 0 }] },
      { effects: [{ type: 'percent_multiplier', value: 2, metaLevel: 1 }] },
      { effects: [{ type: 'meta_boost', value: 50, metaLevel: 2 }] },
    ];
    const mods = fx.compute(relics);
    // percentMulti starts at 2, metaBoost = 1.5
    // percentMulti = 1 + (2-1) * 1.5 = 2.5
    // allPayoutPercent = 10 * 2.5 = 25
    expect(mods.allPayoutPercent).toBe(25);
  });

  it('applies level-3 global boost', () => {
    const relics = [
      { effects: [{ type: 'color_payout_percent', value: 20, metaLevel: 0 }] },
      { effects: [{ type: 'global_boost', value: 25, metaLevel: 3 }] },
    ];
    const mods = fx.compute(relics);
    // percentMulti = 1 * 1.25 (global) = 1.25
    // colorPayout = 20 * 1.25 = 25
    expect(mods.colorPayoutPercent).toBe(25);
  });

  it('caps shop discount at 80%', () => {
    const relics = [
      { effects: [{ type: 'shop_discount', value: 50, metaLevel: 0 }] },
      { effects: [{ type: 'shop_discount', value: 50, metaLevel: 0 }] },
    ];
    const mods = fx.compute(relics);
    expect(mods.shopDiscount).toBe(80);
  });

  it('computes extra spins', () => {
    const relics = [
      { effects: [{ type: 'extra_spins', value: 1, metaLevel: 0 }] },
      { effects: [{ type: 'extra_spins', value: 2, metaLevel: 0 }] },
    ];
    const mods = fx.compute(relics);
    expect(mods.extraSpins).toBe(3);
  });
});
