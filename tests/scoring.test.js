import { describe, it, expect, beforeEach } from 'vitest';
import { ScoringSystem } from '../src/systems/ScoringSystem.js';
import { createRunState, resetUid } from '../src/core/GameState.js';
import { getQuota } from '../src/data/balance.js';
import { getSymbol } from '../src/data/symbols.js';

describe('ScoringSystem', () => {
  let scoring;

  beforeEach(() => {
    resetUid();
    scoring = new ScoringSystem();
  });

  it('should pass round when totalWon >= quota', () => {
    const run = createRunState();
    const quota = getQuota(1);

    // Simulate spin results with .value
    run.spinResults = [
      { segmentIndex: 0, segment: run.wheel[0], symbol: getSymbol('red'), value: quota + 100 },
    ];

    const result = scoring.evaluateRound(run);
    expect(result.passed).toBe(true);
    expect(result.totalWon).toBe(quota + 100);
    expect(result.surplus).toBe(100);
  });

  it('should fail round when totalWon < quota', () => {
    const run = createRunState();
    run.spinResults = [
      { segmentIndex: 0, segment: run.wheel[0], symbol: getSymbol('red'), value: 10 },
    ];

    const result = scoring.evaluateRound(run);
    expect(result.passed).toBe(false);
    expect(result.surplus).toBe(0);
  });

  it('should convert surplus to shop coins', () => {
    const run = createRunState();
    const quota = getQuota(1);

    run.spinResults = [
      { segmentIndex: 0, segment: run.wheel[0], symbol: getSymbol('red'), value: quota + 300 },
    ];

    const result = scoring.evaluateRound(run);
    expect(result.shopCoins).toBe(Math.floor(300 / 20)); // SURPLUS_CONVERSION_RATE = 20
  });

  it('quota should scale with round', () => {
    const q1 = getQuota(1);
    const q5 = getQuota(5);
    const q12 = getQuota(12);
    expect(q5).toBeGreaterThan(q1);
    expect(q12).toBeGreaterThan(q5);
  });
});
