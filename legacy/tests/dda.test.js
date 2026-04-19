import { describe, it, expect, beforeEach } from 'vitest';
import { createGame, PHASE, BALANCE, getQuota } from '../src/index.js';
import { resetUid } from '../src/core/GameState.js';

describe('Miss Pockets', () => {
  let game;

  beforeEach(() => {
    resetUid();
    game = createGame({ seed: 42 });
    game.startRun();
  });

  it('miss pocket gives 0 value', () => {
    const missIdx = BALANCE.MISS_POCKETS[0]; // 3
    const r = game.resolveBallAt(missIdx);
    expect(r.value).toBe(0);
    expect(r.result.isMiss).toBe(true);
  });

  it('non-miss pocket gives positive value', () => {
    const r = game.resolveBallAt(2); // segment 3, not a miss
    expect(r.value).toBeGreaterThan(0);
    expect(r.result.isMiss).toBe(false);
  });

  it('gold pocket still doubles value', () => {
    const goldIdx = BALANCE.GOLD_POCKETS[0]; // 14
    const r = game.resolveBallAt(goldIdx);
    // baseVal = 15, ×2 = 30
    expect(r.value).toBe(30);
    expect(r.result.isMiss).toBe(false);
  });

  it('miss pocket overrides everything (value = 0)', () => {
    const missIdx = BALANCE.MISS_POCKETS[0];
    // Even with weight > 1, miss should be 0
    const run = game.getState().run;
    run.wheel[missIdx].weight = 3;
    const r = game.resolveBallAt(missIdx);
    expect(r.value).toBe(0);
  });
});

describe('Free Spin Offer', () => {
  let game;

  beforeEach(() => {
    resetUid();
    game = createGame({ seed: 42 });
    game.startRun();
  });

  it('offers free spin on first round failure', () => {
    // Drain all balls on miss pockets to guarantee failure
    for (let i = 0; i < BALANCE.BALLS_PER_ROUND; i++) {
      game.resolveBallAt(BALANCE.MISS_POCKETS[i % BALANCE.MISS_POCKETS.length]);
    }
    expect(game.getPhase()).toBe('FREE_SPIN_OFFER');
    expect(game.getState().run.freeSpinUsed).toBe(false);
  });

  it('acceptFreeSpin gives 1 ball and returns to IDLE', () => {
    for (let i = 0; i < BALANCE.BALLS_PER_ROUND; i++) {
      game.resolveBallAt(BALANCE.MISS_POCKETS[0]);
    }
    expect(game.getPhase()).toBe('FREE_SPIN_OFFER');

    const ok = game.acceptFreeSpin();
    expect(ok).toBe(true);
    expect(game.getPhase()).toBe('IDLE');
    expect(game.getState().run.ballsLeft).toBe(1);
    expect(game.getState().run.freeSpinUsed).toBe(true);
  });

  it('declineFreeSpin goes to GAME_OVER', () => {
    for (let i = 0; i < BALANCE.BALLS_PER_ROUND; i++) {
      game.resolveBallAt(BALANCE.MISS_POCKETS[0]);
    }
    expect(game.getPhase()).toBe('FREE_SPIN_OFFER');

    const ok = game.declineFreeSpin();
    expect(ok).toBe(true);
    expect(game.getPhase()).toBe('GAME_OVER');
  });

  it('second failure after free spin goes to GAME_OVER (no second offer)', () => {
    // Fail first round
    for (let i = 0; i < BALANCE.BALLS_PER_ROUND; i++) {
      game.resolveBallAt(BALANCE.MISS_POCKETS[0]);
    }
    game.acceptFreeSpin();

    // Use the free spin on a miss pocket too
    game.resolveBallAt(BALANCE.MISS_POCKETS[1]);
    expect(game.getPhase()).toBe('GAME_OVER');
  });

  it('free spin success continues normal flow', () => {
    // Fail first round
    for (let i = 0; i < BALANCE.BALLS_PER_ROUND; i++) {
      game.resolveBallAt(BALANCE.MISS_POCKETS[0]);
    }
    game.acceptFreeSpin();

    // Force score close to quota so gold pocket pushes us over
    const run = game.getState().run;
    const quota = getQuota(run.round);
    run.score = quota - 1;
    game.resolveBallAt(BALANCE.GOLD_POCKETS[0]);
    expect(game.getPhase()).toBe('RESULTS');
  });

  it('acceptFreeSpin fails outside FREE_SPIN_OFFER phase', () => {
    expect(game.acceptFreeSpin()).toBe(false);
  });

  it('emits free_spin:offered event', () => {
    let offered = false;
    game.on('free_spin:offered', () => { offered = true; });
    for (let i = 0; i < BALANCE.BALLS_PER_ROUND; i++) {
      game.resolveBallAt(BALANCE.MISS_POCKETS[0]);
    }
    expect(offered).toBe(true);
  });
});

describe('Corruption', () => {
  let game;

  beforeEach(() => {
    resetUid();
    game = createGame({ seed: 42 });
    game.startRun();
  });

  it('corruption increases per spin', () => {
    const before = game.getState().run.corruption;
    game.resolveBallAt(0);
    const after = game.getState().run.corruption;
    expect(after).toBeCloseTo(before + BALANCE.CORRUPTION_PER_SPIN, 5);
  });

  it('corruption penalty reduces base value above critical threshold', () => {
    const run = game.getState().run;
    run.corruption = 0.90; // above CORRUPTION_CRITICAL (0.85)
    // Segment 1 → baseVal = 2, corruption penalty → max(1, 2-1) = 1
    const r = game.resolveBallAt(1);
    expect(r.value).toBe(1);
  });

  it('no corruption penalty below critical threshold', () => {
    const run = game.getState().run;
    run.corruption = 0.50; // below critical
    // Segment 1 → baseVal = 2, no penalty → 2
    const r = game.resolveBallAt(1);
    expect(r.value).toBe(2);
  });
});

describe('DDA State Tracking', () => {
  let game;

  beforeEach(() => {
    resetUid();
    game = createGame({ seed: 42 });
    game.startRun();
  });

  it('DDA frustration increases on miss', () => {
    const before = game.getState().run.dda.frustrationScore;
    game.resolveBallAt(BALANCE.MISS_POCKETS[0]);
    const after = game.getState().run.dda.frustrationScore;
    expect(after).toBeGreaterThan(before);
  });

  it('DDA flow increases on hit', () => {
    const before = game.getState().run.dda.flowScore;
    game.resolveBallAt(2); // normal pocket
    const after = game.getState().run.dda.flowScore;
    expect(after).toBeGreaterThan(before);
  });

  it('consecutive misses tracked', () => {
    game.resolveBallAt(BALANCE.MISS_POCKETS[0]);
    game.resolveBallAt(BALANCE.MISS_POCKETS[1]);
    expect(game.getState().run.dda.consecutiveMisses).toBe(2);
    expect(game.getState().run.dda.consecutiveHits).toBe(0);
  });

  it('consecutive hits reset on miss', () => {
    game.resolveBallAt(2); // hit
    game.resolveBallAt(2); // hit
    expect(game.getState().run.dda.consecutiveHits).toBe(2);
    game.resolveBallAt(BALANCE.MISS_POCKETS[0]); // miss
    expect(game.getState().run.dda.consecutiveHits).toBe(0);
  });

  it('DDA state resets per round', () => {
    // Need to pass a round first — force high score
    const run = game.getState().run;
    run.dda.nearMissesThisRound = 1;

    // Complete round with high scores
    for (let i = 0; i < BALANCE.BALLS_PER_ROUND; i++) {
      game.resolveBallAt(BALANCE.GOLD_POCKETS[0]);
    }

    // Advance through results → choice → shop → next round
    if (game.getPhase() === 'RESULTS') {
      game.continueFromResults();
      game.skipChoice();
      game.endShop();
      expect(game.getState().run.dda.nearMissesThisRound).toBe(0);
    }
  });
});
