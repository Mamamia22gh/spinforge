import { describe, it, expect, beforeEach } from 'vitest';
import { createGame, PHASE, BALANCE } from '../src/index.js';
import { resetUid } from '../src/core/GameState.js';

describe('Integration — Full game flow (balls only, no betting)', () => {
  let game;

  beforeEach(() => {
    resetUid();
    game = createGame({ seed: 42 });
  });

  it('starts in IDLE phase', () => {
    expect(game.getPhase()).toBe('IDLE');
  });

  it('starts a run → stays IDLE (ready for spin)', () => {
    const ok = game.startRun();
    expect(ok).toBe(true);
    expect(game.getPhase()).toBe('IDLE');
  });

  it('can spin (launch a ball)', () => {
    game.startRun();
    const state = game.getState();

    const result = game.spin();
    expect(result).not.toBeNull();
    expect(result.result.segment).toBeDefined();
    expect(result.value).toBeGreaterThanOrEqual(0);
    expect(state.run.ballsLeft).toBe(BALANCE.BALLS_PER_ROUND - 1);
  });

  it('can play through multiple spins and end round', () => {
    game.startRun();
    const state = game.getState();

    for (let i = 0; i < BALANCE.BALLS_PER_ROUND; i++) {
      game.spin();
    }

    expect(state.run.ballsLeft).toBe(0);
    expect(['RESULTS', 'GAME_OVER']).toContain(state.phase);
  });

  it('full run: results → choice → shop → next round', () => {
    game.startRun();
    const state = game.getState();

    // Play through round 1
    for (let i = 0; i < BALANCE.BALLS_PER_ROUND; i++) {
      game.spin();
    }

    if (state.run.lastRoundResult.passed) {
      game.continueFromResults();
      expect(state.phase).toBe('CHOICE');

      // Pick first choice or skip
      if (state.run.currentChoices.length > 0) {
        const addChoice = state.run.currentChoices.findIndex(c => c.type === 'add_symbol' || c.type === 'upgrade');
        if (addChoice >= 0) {
          game.makeChoice(addChoice);
        } else {
          game.skipChoice();
        }
      } else {
        game.skipChoice();
      }

      expect(state.phase).toBe('SHOP');

      game.endShop();
      expect(state.phase).toBe('IDLE');
      expect(state.run.round).toBe(2);
    }
  });

  it('score accumulates across spins', () => {
    game.startRun();
    const state = game.getState();

    let totalValue = 0;
    for (let i = 0; i < BALANCE.BALLS_PER_ROUND; i++) {
      const r = game.spin();
      if (r) totalValue += r.value;
    }

    expect(state.run.score).toBe(totalValue);
  });

  it('meta system: tickets are earned per round passed', () => {
    game.startRun();
    const state = game.getState();
    const initialTickets = state.meta.totalTickets;

    for (let i = 0; i < BALANCE.BALLS_PER_ROUND; i++) {
      game.spin();
    }

    if (state.run.lastRoundResult?.passed) {
      expect(state.meta.totalTickets).toBe(initialTickets + BALANCE.TICKETS_PER_ROUND);
    } else {
      expect(state.phase).toBe('GAME_OVER');
      // No tickets awarded for failed round
      expect(state.meta.totalTickets).toBe(initialTickets);
    }
  });

  it('events are emitted correctly', () => {
    const events = [];
    game.on('run:started', (e) => events.push({ type: 'run:started', ...e }));
    game.on('spin:resolved', (e) => events.push({ type: 'spin:resolved', ...e }));

    game.startRun();
    game.spin();

    expect(events.some(e => e.type === 'run:started')).toBe(true);
    expect(events.some(e => e.type === 'spin:resolved')).toBe(true);
  });
});
