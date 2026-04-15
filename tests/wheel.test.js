import { describe, it, expect, beforeEach } from 'vitest';
import { WheelSystem } from '../src/systems/WheelSystem.js';
import { EventBus } from '../src/core/EventBus.js';
import { RNG } from '../src/core/RNG.js';
import { createRunState, resetUid } from '../src/core/GameState.js';

describe('WheelSystem', () => {
  let events, wheel, rng;

  beforeEach(() => {
    resetUid();
    events = new EventBus();
    wheel = new WheelSystem(events);
    rng = new RNG(42);
  });

  it('should spin and return a valid segment', () => {
    const run = createRunState();
    const result = wheel.spin(run, rng);
    expect(result.segmentIndex).toBeGreaterThanOrEqual(0);
    expect(result.segmentIndex).toBeLessThan(run.wheel.length);
    expect(result.segment).toBeDefined();
    expect(result.symbol).toBeDefined();
    expect(result.symbol.id).toBe(result.segment.symbolId);
  });

  it('should produce deterministic results with same seed', () => {
    const run1 = createRunState();
    resetUid();
    const run2 = createRunState();
    const rng1 = new RNG(123);
    const rng2 = new RNG(123);

    const r1 = wheel.spin(run1, rng1);
    const r2 = wheel.spin(run2, rng2);
    expect(r1.segmentIndex).toBe(r2.segmentIndex);
  });

  it('should get probabilities aggregated by symbol', () => {
    const run = createRunState();
    const probs = wheel.getProbabilities(run.wheel);
    expect(probs.length).toBeGreaterThan(0);

    const totalProb = probs.reduce((s, p) => s + p.probability, 0);
    expect(totalProb).toBeCloseTo(1, 5);
  });

  it('should add a segment', () => {
    const run = createRunState();
    const before = run.wheel.length;
    const ok = wheel.addSegment(run, 'blue');
    expect(ok).toBe(true);
    expect(run.wheel.length).toBe(before + 1);
    expect(run.wheel[run.wheel.length - 1].symbolId).toBe('blue');
  });

  it('should not exceed max segments', () => {
    const run = createRunState();
    // Fill to max
    while (run.wheel.length < 48) {
      wheel.addSegment(run, 'red');
    }
    const ok = wheel.addSegment(run, 'blue');
    expect(ok).toBe(false);
    expect(run.wheel.length).toBe(48);
  });

  it('should remove a segment', () => {
    const run = createRunState();
    const before = run.wheel.length;
    const ok = wheel.removeSegment(run, 0);
    expect(ok).toBe(true);
    expect(run.wheel.length).toBe(before - 1);
  });

  it('should not go below min segments', () => {
    const run = createRunState();
    // Remove down to 20
    while (run.wheel.length > 20) {
      wheel.removeSegment(run, 0);
    }
    const ok = wheel.removeSegment(run, 0);
    expect(ok).toBe(false);
    expect(run.wheel.length).toBe(20);
  });

  it('should boost weight', () => {
    const run = createRunState();
    expect(run.wheel[0].weight).toBe(1);
    wheel.boostWeight(run, 0);
    expect(run.wheel[0].weight).toBe(2);
  });

  it('should not exceed max weight', () => {
    const run = createRunState();
    for (let i = 0; i < 10; i++) wheel.boostWeight(run, 0);
    expect(run.wheel[0].weight).toBe(5); // MAX_WEIGHT_PER_SEGMENT
  });
});
