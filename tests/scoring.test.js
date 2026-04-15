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

  it('calculates correct total from accumulated score', () => {
    const run = createRunState();
    run.score = 31; // accumulated from spins

    const result = scoring.evaluateRound(run);
    expect(result.totalWon).toBe(31);
    expect(result.quota).toBe(getQuota(1));
  });

  it('calculates surplus correctly', () => {
    const run = createRunState();
    const quota = getQuota(1);
    run.score = quota + 40;

    const result = scoring.evaluateRound(run);
    expect(result.totalWon).toBe(quota + 40);
    expect(result.surplus).toBe(40);
    expect(result.passed).toBe(true);
  });

  it('fails when below quota', () => {
    const run = createRunState();
    run.score = 1;

    const result = scoring.evaluateRound(run);
    expect(result.passed).toBe(false);
    expect(result.surplus).toBe(0);
  });

  it('surplus carries over after quota deduction', () => {
    const run = createRunState();
    const quota = getQuota(1);
    run.score = quota + 25;

    const result = scoring.evaluateRound(run);
    expect(result.passed).toBe(true);
    expect(result.surplus).toBe(25);

    // Simulate endShop deduction
    run.lastRoundResult = result;
    run.score -= result.quota;
    expect(run.score).toBe(25);
  });
});
