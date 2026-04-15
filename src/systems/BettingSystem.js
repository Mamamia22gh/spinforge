import { getBetType } from '../data/bets.js';
import { getSymbol } from '../data/symbols.js';
import { BALANCE } from '../data/balance.js';

/**
 * Manages bet placement and resolution.
 */
export class BettingSystem {
  #events;

  constructor(events) {
    this.#events = events;
  }

  /**
   * Place a bet.
   * @param {object} run
   * @param {string} betTypeId
   * @param {number} wager — chips to bet
   * @param {object} [options] — extra data (e.g. sectorStart for sector bets)
   * @returns {boolean}
   */
  placeBet(run, betTypeId, wager, options = {}) {
    const betType = getBetType(betTypeId);

    if (wager < BALANCE.MIN_BET) {
      this.#events.emit('bet:too_small', { min: BALANCE.MIN_BET });
      return false;
    }

    if (wager > run.chips) {
      this.#events.emit('bet:insufficient_chips', { wager, available: run.chips });
      return false;
    }

    if (run.bets.length >= BALANCE.MAX_BETS_PER_SPIN) {
      this.#events.emit('bet:max_bets', { max: BALANCE.MAX_BETS_PER_SPIN });
      return false;
    }

    run.chips -= wager;
    const bet = {
      betTypeId,
      wager,
      payout: betType.payout,
      condition: betType.condition,
      target: options.target ?? betType.target,
      sectorStart: options.sectorStart ?? null,
    };

    run.bets.push(bet);
    this.#events.emit('bet:placed', { bet, chipsRemaining: run.chips });
    return true;
  }

  /**
   * Remove a bet (return chips).
   * @param {object} run
   * @param {number} index
   * @returns {boolean}
   */
  removeBet(run, index) {
    if (index < 0 || index >= run.bets.length) return false;
    const bet = run.bets.splice(index, 1)[0];
    run.chips += bet.wager;
    this.#events.emit('bet:removed', { bet, chipsRemaining: run.chips });
    return true;
  }

  /**
   * Resolve all active bets against a spin result.
   * @param {object} run
   * @param {{ segmentIndex: number, segment: object, symbol: object }} result
   * @param {object} mods — computed relic modifiers
   * @param {import('../core/RNG.js').RNG} rng
   * @returns {{ totalWon: number, results: object[] }}
   */
  resolve(run, result, mods, rng) {
    const { segmentIndex, segment, symbol } = result;
    const results = [];
    let totalWon = 0;

    for (const bet of run.bets) {
      const won = this.#evaluateBet(bet, run, segmentIndex, segment, symbol, rng);
      let winnings = 0;

      if (won) {
        let payout = bet.payout;

        // Apply relic modifiers
        payout = this.#applyPayoutMods(payout, bet, mods);

        // Color streak bonus
        if (bet.condition === 'color' && run.colorStreak > 0) {
          const streakBonus = Math.min(run.colorStreak, BALANCE.COLOR_STREAK_MAX) * BALANCE.COLOR_STREAK_BONUS;
          payout *= (1 + streakBonus);
        }

        // Fever bonus
        if (run.fever.active) {
          payout *= BALANCE.FEVER_MULTIPLIER;
        }

        winnings = Math.floor(bet.wager * payout);

        // Symbol special effects
        if (symbol.specialEffect === 'double_payout') {
          winnings *= 2;
        }

        totalWon += winnings;
        run.consecutiveWins++;
      } else {
        // Loss
        if (mods.lossReduction > 0) {
          // Insurance: return partial wager
          const returned = Math.floor(bet.wager * mods.lossReduction / 100);
          run.chips += returned;
        }

        if (bet.condition !== 'chain') {
          run.consecutiveWins = 0;
        }
      }

      results.push({ bet, won, winnings });
    }

    // Return winnings as chips
    run.chips += totalWon;

    // Track color streak
    if (symbol.color === run.lastColor) {
      run.colorStreak = Math.min(run.colorStreak + 1, BALANCE.COLOR_STREAK_MAX + 1);
    } else {
      run.colorStreak = 1;
    }
    run.lastColor = symbol.color;

    // Clear bets after resolution
    run.bets = [];

    this.#events.emit('bets:resolved', { totalWon, results, symbol, segmentIndex });

    return { totalWon, results };
  }

  #evaluateBet(bet, run, segmentIndex, segment, symbol, rng) {
    switch (bet.condition) {
      case 'color':
        return symbol.color === bet.target;
      case 'exact':
        return segment.symbolId === bet.target;
      case 'sector':
        if (bet.sectorStart == null) return false;
        return this.#inSector(segmentIndex, bet.sectorStart, 3, run.wheel.length);
      case 'wildcard':
        return true;
      case 'chain':
        return run.colorStreak >= 3;
      case 'coin_flip':
        return rng.chance(0.5);
      default:
        return false;
    }
  }

  #inSector(index, sectorStart, sectorSize, wheelLength) {
    for (let i = 0; i < sectorSize; i++) {
      if ((sectorStart + i) % wheelLength === index) return true;
    }
    return false;
  }

  #applyPayoutMods(payout, bet, mods) {
    // Flat percentage bonuses
    payout *= (1 + (mods.allPayoutPercent || 0) / 100);

    if (bet.condition === 'color') {
      payout *= (1 + (mods.colorPayoutPercent || 0) / 100);
    }
    if (bet.condition === 'exact') {
      payout *= (1 + (mods.exactPayoutPercent || 0) / 100);
    }
    if (bet.condition === 'chain') {
      payout *= (1 + (mods.chainPayoutPercent || 0) / 100);
    }

    return payout;
  }
}
