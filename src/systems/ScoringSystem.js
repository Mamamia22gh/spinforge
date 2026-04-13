import { BALANCE, getQuota } from '../data/balance.js';

/**
 * Scoring system — evaluates round results vs quota.
 * Each spin result now has a `.value` (no bets).
 */
export class ScoringSystem {
  /**
   * Calculate round totals.
   * @param {object} run
   * @returns {{ totalWon: number, quota: number, passed: boolean, surplus: number, shopCoins: number }}
   */
  evaluateRound(run) {
    const totalWon = run.spinResults.reduce((sum, r) => sum + r.value, 0);
    const quota = getQuota(run.round);
    const passed = totalWon >= quota;
    const surplus = Math.max(0, totalWon - quota);
    const shopCoins = Math.floor(surplus / BALANCE.SURPLUS_CONVERSION_RATE);

    return { totalWon, quota, passed, surplus, shopCoins };
  }
}
