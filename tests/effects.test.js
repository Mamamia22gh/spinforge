import { describe, it, expect, beforeEach } from 'vitest';
import { EffectSystem } from '../src/systems/EffectSystem.js';
import { createGame, PHASE, BALANCE } from '../src/index.js';
import { resetUid, createRunState } from '../src/core/GameState.js';

describe('EffectSystem', () => {
  let fx;
  beforeEach(() => { fx = new EffectSystem(); });

  it('returns default mods with no relics', () => {
    const m = fx.compute([]);
    expect(m.setBaseValue).toBe(null);
    expect(m.addEven).toBe(0);
    expect(m.addOdd).toBe(0);
  });

  it('set_base_value picks highest', () => {
    const relics = [
      { effects: [{ type: 'set_base_value', value: 15, metaLevel: 0 }] },
      { effects: [{ type: 'set_base_value', value: 20, metaLevel: 0 }] },
    ];
    const m = fx.compute(relics);
    expect(m.setBaseValue).toBe(20);
  });

  it('add_even_segments accumulates', () => {
    const relics = [
      { effects: [{ type: 'add_even_segments', value: 3, metaLevel: 0 }] },
      { effects: [{ type: 'add_even_segments', value: 5, metaLevel: 0 }] },
    ];
    const m = fx.compute(relics);
    expect(m.addEven).toBe(8);
    expect(m.addOdd).toBe(0);
  });

  it('add_odd_segments accumulates', () => {
    const relics = [
      { effects: [{ type: 'add_odd_segments', value: 10, metaLevel: 0 }] },
    ];
    const m = fx.compute(relics);
    expect(m.addOdd).toBe(10);
  });

  it('ignores metaLevel > 0', () => {
    const relics = [
      { effects: [{ type: 'set_base_value', value: 99, metaLevel: 1 }] },
    ];
    const m = fx.compute(relics);
    expect(m.setBaseValue).toBe(null);
  });

  it('combined relics', () => {
    const relics = [
      { effects: [{ type: 'set_base_value', value: 20, metaLevel: 0 }] },
      { effects: [{ type: 'add_even_segments', value: 1, metaLevel: 0 }] },
      { effects: [{ type: 'add_odd_segments', value: 3, metaLevel: 0 }] },
    ];
    const m = fx.compute(relics);
    expect(m.setBaseValue).toBe(20);
    expect(m.addEven).toBe(1);
    expect(m.addOdd).toBe(3);
  });

  it('null relics returns defaults', () => {
    const m = fx.compute(null);
    expect(m.setBaseValue).toBe(null);
  });
});

describe('Even/Odd bonuses use baseVal parity', () => {
  let game;

  beforeEach(() => {
    resetUid();
    game = createGame({ seed: 42 });
    game.startRun();
  });

  it('addEven applies to even-valued segment (seg 1 → baseVal 2)', () => {
    const run = game.getState().run;
    run.relics.push({ id: 'even_charm', effects: [{ type: 'add_even_segments', value: 10, metaLevel: 0 }] });
    const r = game.resolveBallAt(1); // baseVal = 2 (even)
    expect(r.value).toBe(12); // 2 + 10 = 12
  });

  it('addEven does NOT apply to odd-valued segment (seg 0 → baseVal 1)', () => {
    const run = game.getState().run;
    run.relics.push({ id: 'even_charm', effects: [{ type: 'add_even_segments', value: 10, metaLevel: 0 }] });
    const r = game.resolveBallAt(0); // baseVal = 1 (odd)
    expect(r.value).toBe(1); // no bonus
  });

  it('addOdd applies to odd-valued segment (seg 0 → baseVal 1)', () => {
    const run = game.getState().run;
    run.relics.push({ id: 'odd_charm', effects: [{ type: 'add_odd_segments', value: 5, metaLevel: 0 }] });
    const r = game.resolveBallAt(0); // baseVal = 1 (odd)
    expect(r.value).toBe(6); // 1 + 5 = 6
  });

  it('addOdd does NOT apply to even-valued segment (seg 1 → baseVal 2)', () => {
    const run = game.getState().run;
    run.relics.push({ id: 'odd_charm', effects: [{ type: 'add_odd_segments', value: 5, metaLevel: 0 }] });
    const r = game.resolveBallAt(1); // baseVal = 2 (even)
    expect(r.value).toBe(2); // no bonus
  });

  it('set_base_value=20 makes addEven apply to ALL segments', () => {
    const run = game.getState().run;
    run.relics.push(
      { id: 'tablet_twenty', effects: [{ type: 'set_base_value', value: 20, metaLevel: 0 }] },
      { id: 'even_charm', effects: [{ type: 'add_even_segments', value: 3, metaLevel: 0 }] },
    );
    // Any segment: baseVal = 20 (even) → addEven applies
    const r0 = game.resolveBallAt(0);
    expect(r0.value).toBe(23);
    const r5 = game.resolveBallAt(5);
    expect(r5.value).toBe(23);
  });

  it('set_base_value=19 makes addOdd apply to ALL segments', () => {
    const run = game.getState().run;
    run.relics.push(
      { id: 'tablet_nineteen', effects: [{ type: 'set_base_value', value: 19, metaLevel: 0 }] },
      { id: 'odd_charm', effects: [{ type: 'add_odd_segments', value: 7, metaLevel: 0 }] },
    );
    const r = game.resolveBallAt(10);
    expect(r.value).toBe(26); // 19 + 7 = 26
  });
});

describe('Special Balls', () => {
  let game;

  beforeEach(() => {
    resetUid();
    game = createGame({ seed: 42 });
    game.startRun();
  });

  it('double ball doubles the segment value', () => {
    const state = game.getState();
    const run = state.run;
    // Add a double ball
    run.specialBalls.push({ id: 'ball_golden', name: 'Bille Dorée', effect: 'double', rarity: 'common' });
    run.ballsLeft++;

    // Resolve on segment 0 (value = 1)
    const r = game.resolveBallAt(0);
    expect(r.result.specialBall).toBeDefined();
    expect(r.result.specialBall.effect).toBe('double');
    // Base value = 1, doubled = 2
    expect(r.value).toBe(2);
    // Special ball consumed
    expect(run.specialBalls.length).toBe(1); // persists across rounds
  });

  it('critical ball quintuples the segment value', () => {
    const state = game.getState();
    const run = state.run;
    run.specialBalls.push({ id: 'ball_critical', name: 'Bille Critique', effect: 'critical', rarity: 'legendary' });
    run.ballsLeft++;

    const r = game.resolveBallAt(9); // segment 10, value = 10
    expect(r.value).toBe(50);
  });


  it('ticket ball gives 0 coins and awards tickets equal to pocket number', () => {
    const state = game.getState();
    const run = state.run;
    run.specialBalls.push({ id: 'ball_ticket', name: 'Bille Ticket', effect: 'ticket', rarity: 'rare' });
    run.ballsLeft++;

    const ticketsBefore = state.meta.tickets;
    const segIdx = 4; // pocket number = 5
    const r = game.resolveBallAt(segIdx);
    expect(r.value).toBe(0);
    expect(r.result.ticketsEarned).toBe(5);
    expect(state.meta.tickets).toBe(ticketsBefore + 5);
  });

  it('splash ball scores adjacent segments too', () => {
    const state = game.getState();
    const run = state.run;
    run.specialBalls.push({ id: 'ball_splash', name: 'Bille Explosive', effect: 'splash', rarity: 'rare' });
    run.ballsLeft++;

    const segIdx = 5; // value = 6, adjacent = 5 and 7
    const r = game.resolveBallAt(segIdx);
    // Main: 6, left: 5, right: 7 → total = 18
    expect(r.value).toBe(6 + 5 + 7);
  });

  it('special balls fire first then normal balls follow', () => {
    const state = game.getState();
    const run = state.run;
    run.specialBalls.push({ id: 'ball_golden', name: 'Bille Dorée', effect: 'double', rarity: 'common' });
    run.ballsLeft++;

    // First spin should be special
    const r1 = game.resolveBallAt(0);
    expect(r1.result.specialBall).toBeDefined();

    // Second spin should be normal
    const r2 = game.resolveBallAt(0);
    expect(r2.result.specialBall).toBe(null);
  });

  it('endShop resets ballsLeft including special balls', () => {
    const state = game.getState();
    const run = state.run;

    // Complete round 1
    for (let i = 0; i < BALANCE.BALLS_PER_ROUND; i++) {
      game.spin();
    }

    if (run.lastRoundResult?.passed) {
      game.continueFromResults();
      game.skipChoice();

      // In shop, add a special ball
      run.specialBalls.push({ id: 'ball_golden', effect: 'double', rarity: 'common' });

      game.endShop();
      expect(run.ballsLeft).toBe(BALANCE.BALLS_PER_ROUND + 1);
    }
  });
});
