import { describe, it, expect } from 'vitest';
import { EffectSystem } from '../src/systems/EffectSystem.js';

describe('EffectSystem', () => {
  const fx = new EffectSystem();

  it('returns default mods with no relics', () => {
    const m = fx.compute([]);
    expect(m.allPayoutPercent).toBe(0);
    expect(m.echoSpins).toBe(0);
  });

  it('accumulates level-0 effects', () => {
    const relics = [
      { effects: [{ type: 'all_payout_percent', value: 10, metaLevel: 0 }] },
      { effects: [{ type: 'all_payout_percent', value: 20, metaLevel: 0 }] },
    ];
    const m = fx.compute(relics);
    expect(m.allPayoutPercent).toBe(30);
  });

  it('applies level-1 percent multiplier', () => {
    const relics = [
      { effects: [{ type: 'all_payout_percent', value: 10, metaLevel: 0 }] },
      { effects: [{ type: 'percent_multiplier', value: 2, metaLevel: 1 }] },
    ];
    const m = fx.compute(relics);
    expect(m.allPayoutPercent).toBe(20); // 10 * 2
  });

  it('applies level-2 meta boost', () => {
    const relics = [
      { effects: [{ type: 'all_payout_percent', value: 10, metaLevel: 0 }] },
      { effects: [{ type: 'percent_multiplier', value: 1.5, metaLevel: 1 }] },
      { effects: [{ type: 'meta_boost', value: 50, metaLevel: 2 }] },
    ];
    const m = fx.compute(relics);
    // percent_multiplier 1.5, meta_boost 50% boosts the multiplier: 1.5 + 50% of 0.5 = 1.75
    // 10 * 1.75 = 17.5
    expect(m.allPayoutPercent).toBeCloseTo(17.5, 1);
  });

  it('applies level-3 global boost', () => {
    const relics = [
      { effects: [{ type: 'all_payout_percent', value: 20, metaLevel: 0 }] },
      { effects: [{ type: 'global_boost', value: 25, metaLevel: 3 }] },
    ];
    const m = fx.compute(relics);
    expect(m.allPayoutPercent).toBeCloseTo(25, 0); // 20 * 1.25
  });

  it('caps shop discount at 80', () => {
    const relics = [
      { effects: [{ type: 'shop_discount', value: 50, metaLevel: 0 }] },
      { effects: [{ type: 'shop_discount', value: 50, metaLevel: 0 }] },
    ];
    const m = fx.compute(relics);
    expect(m.shopDiscount).toBe(80);
  });

  it('handles echo spins', () => {
    const relics = [
      { effects: [{ type: 'echo_spin', value: 1, metaLevel: 1 }] },
    ];
    const m = fx.compute(relics);
    expect(m.echoSpins).toBe(1);
  });
});
