import { describe, it, expect, beforeEach } from 'vitest';
import { ScoringSystem } from '../src/systems/ScoringSystem.js';
import { createRunState, resetUid } from '../src/core/GameState.js';
import { getQuota } from '../src/data/balance.js';

describe('ScoringSystem', () => {
  let scoring;

  beforeEach(() => {
    resetUid();
    scoring = new ScoringSystem();
  });

  it('calculates correct total from spin results', () => {
    const run = createRunState();
    // Simulate 3 spins on pockets 0, 9, 19 (values 1, 10, 20)
    run.spinResults = [
      { segmentIndex: 0, segment: run.wheel[0], symbol: null, value: 1 },
      { segmentIndex: 9, segment: run.wheel[9], symbol: null, value: 10 },
      { segmentIndex: 19, segment: run.wheel[19], symbol: null, value: 20 },
    ];

    const result = scoring.evaluateRound(run);
    expect(result.totalWon).toBe(31);
    expect(result.quota).toBe(getQuota(1));
  });

  it('calculates surplus correctly', () => {
    const run = createRunState();
    const quota = getQuota(1);
    const over = quota + 40;

    run.spinResults = [
      { segmentIndex: 0, segment: run.wheel[0], symbol: null, value: over },
    ];

    const result = scoring.evaluateRound(run);
    expect(result.totalWon).toBe(over);
    expect(result.surplus).toBe(40);
    expect(result.passed).toBe(true);
  });

  it('fails when below quota', () => {
    const run = createRunState();
    run.spinResults = [
      { segmentIndex: 0, segment: run.wheel[0], symbol: null, value: 1 },
    ];

    const result = scoring.evaluateRound(run);
    expect(result.passed).toBe(false);
    expect(result.surplus).toBe(0);
  });
});
