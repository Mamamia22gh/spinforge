import { describe, it, expect } from 'vitest';
import { EffectSystem } from '../src/systems/EffectSystem.js';

describe('EffectSystem', () => {
  const fx = new EffectSystem();

  it('returns default mods with no relics', () => {
    const m = fx.compute([]);
    expect(m.setBaseValue).toBeNull();
    expect(m.addEven).toBe(0);
    expect(m.addOdd).toBe(0);
  });

  it('sets base value from a single relic', () => {
    const relics = [
      { effects: [{ type: 'set_base_value', value: 20, metaLevel: 0 }] },
    ];
    const m = fx.compute(relics);
    expect(m.setBaseValue).toBe(20);
  });

  it('takes max when multiple set_base_value relics stack', () => {
    const relics = [
      { effects: [{ type: 'set_base_value', value: 19, metaLevel: 0 }] },
      { effects: [{ type: 'set_base_value', value: 20, metaLevel: 0 }] },
    ];
    const m = fx.compute(relics);
    expect(m.setBaseValue).toBe(20);
  });

  it('accumulates add_even_segments', () => {
    const relics = [
      { effects: [{ type: 'add_even_segments', value: 1, metaLevel: 0 }] },
      { effects: [{ type: 'add_even_segments', value: 5, metaLevel: 0 }] },
    ];
    const m = fx.compute(relics);
    expect(m.addEven).toBe(6);
    expect(m.addOdd).toBe(0);
  });

  it('accumulates add_odd_segments', () => {
    const relics = [
      { effects: [{ type: 'add_odd_segments', value: 3, metaLevel: 0 }] },
      { effects: [{ type: 'add_odd_segments', value: 10, metaLevel: 0 }] },
    ];
    const m = fx.compute(relics);
    expect(m.addOdd).toBe(13);
    expect(m.addEven).toBe(0);
  });

  it('handles legendary with both even and odd effects', () => {
    const relics = [
      { effects: [
        { type: 'add_even_segments', value: 25, metaLevel: 0 },
        { type: 'add_odd_segments', value: 50, metaLevel: 0 },
      ] },
    ];
    const m = fx.compute(relics);
    expect(m.addEven).toBe(25);
    expect(m.addOdd).toBe(50);
  });

  it('combines set_base_value with additive bonuses', () => {
    const relics = [
      { effects: [{ type: 'set_base_value', value: 20, metaLevel: 0 }] },
      { effects: [{ type: 'add_even_segments', value: 5, metaLevel: 0 }] },
      { effects: [{ type: 'add_odd_segments', value: 10, metaLevel: 0 }] },
    ];
    const m = fx.compute(relics);
    expect(m.setBaseValue).toBe(20);
    expect(m.addEven).toBe(5);
    expect(m.addOdd).toBe(10);
  });
});
