import { GameLoop } from './core/GameLoop.js';
import { SaveSystem } from './core/SaveSystem.js';

/**
 * Create a new Spinforge game instance.
 *
 * @param {object} [options]
 * @param {number} [options.seed]
 * @param {object} [options.meta]
 * @returns {object} Game API
 */
export function createGame(options = {}) {
  const loop = new GameLoop(options);

  return {
    // ─── Lifecycle ───
    startRun:            ()                     => loop.startRun(),

    // ─── Spinning ───
    spin:                ()                      => loop.spin(),               // RNG-based (tests)
    resolveBallAt:       (segIdx)                => loop.resolveBallAt(segIdx), // physics-driven

    // ─── Between rounds ───
    continueFromResults: ()                      => loop.continueFromResults(),
    makeChoice:          (index, target)         => loop.makeChoice(index, target),
    skipChoice:          ()                      => loop.skipChoice(),
    shopBuyRelic:        (index)                 => loop.shopBuy(index),
    shopBuy:             (index)                 => loop.shopBuy(index),
    shopReroll:          ()                      => loop.shopReroll(),
    endShop:             ()                      => loop.endShop(),

    // ─── Events ───
    on:                  (event, fn)             => loop.events.on(event, fn),
    off:                 (event, fn)             => loop.events.off(event, fn),
    once:                (event, fn)             => loop.events.once(event, fn),

    // ─── State ───
    getState:            ()                      => loop.state,
    getPhase:            ()                      => loop.state.phase,
    getSegmentDisplayValues: ()                    => loop.getSegmentDisplayValues(),

    // ─── Meta ───
    getMeta:             ()                      => loop.state.meta,
    metaUnlock:          (unlockId)              => loop.meta.unlock(loop.state.meta, unlockId),
    getUnlocks:          ()                      => loop.meta.getAvailableUnlocks(loop.state.meta),

    // ─── Save/Load ───
    saveMeta:            ()                      => SaveSystem.save(loop.state.meta),
    loadMeta:            ()                      => { const m = SaveSystem.load(); if (m) loop.state.meta = m; return !!m; },
    exportDebug:         ()                      => SaveSystem.exportFull(loop.state),
  };
}

// Re-export key types
export { PHASE } from './core/GameState.js';
export { BALANCE, getQuota } from './data/balance.js';
export { SYMBOLS, getSymbol } from './data/symbols.js';
export { RELICS, getRelic } from './data/relics.js';
export { CHOICES } from './data/choices.js';
export { META_UNLOCKS } from './systems/MetaSystem.js';
