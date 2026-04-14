import { BALANCE } from '../data/balance.js';

export const PHASE = Object.freeze({
  IDLE:       'IDLE',
  SPINNING:   'SPINNING',
  RESULTS:    'RESULTS',
  CHOICE:     'CHOICE',
  SHOP:       'SHOP',
  GAME_OVER:  'GAME_OVER',
  VICTORY:    'VICTORY',
});

let _nextId = 0;
export function uid(prefix = 'id') { return `${prefix}_${++_nextId}`; }
export function resetUid() { _nextId = 0; }

export function createGameState(seed) {
  return {
    phase: PHASE.IDLE,
    seed,
    run: null,
    meta: createMetaState(),
  };
}

export function createMetaState() {
  return {
    tickets: 0,
    totalTickets: 0,
    runsCompleted: 0,
    bestRound: 0,
    unlocks: [],
  };
}

export function createRunState() {
  const wheel = BALANCE.INITIAL_WHEEL.map((symbolId) => ({
    id: uid('seg'),
    symbolId,
    weight: 1,
    modifiers: [],
  }));

  return {
    round: 1,
    score: 0,

    wheel,

    ballsLeft: BALANCE.BALLS_PER_ROUND,
    spinResults: [],    // { segmentIndex, segment, symbol, value }

    // Streak tracking
    lastColor: null,
    colorStreak: 0,
    consecutiveHigh: 0,

    // Fever
    fever: { active: false, remaining: 0 },

    // Economy
    shopCurrency: 0,
    shopOfferings: [],
    rerollCount: 0,
    shopDiscount: 0,

    // Relics (permanent run items)
    relics: [],

    // Between-round
    currentChoices: [],
    lastRoundResult: null,

    // Upgrades accumulated
    _payoutBonus: 0,
    _echoUsedThisRound: false,
  };
}
