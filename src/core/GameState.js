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
  const wheel = Array.from({ length: BALANCE.INITIAL_SEGMENTS }, () => ({
    id: uid('seg'),
    symbolId: null,
    weight: 1,
    modifiers: [],
  }));

  return {
    round: 1,
    score: 0,

    wheel,

    ballsLeft: BALANCE.BALLS_PER_ROUND,
    spinResults: [],    // { segmentIndex, segment, symbol, value }

    // Economy
    shopCurrency: 0,
    shopOfferings: [],
    rerollCount: 0,
    shopDiscount: 0,

    // Relics (permanent run items)
    relics: [],

    // Purchased upgrades (for display in orbit slots)
    purchasedUpgrades: [],

    // Between-round
    currentChoices: [],
    lastRoundResult: null,

    // Corruption
    corruption: BALANCE.CORRUPTION_START,

    // Upgrades accumulated
    _payoutBonus: 0,
  };
}
