/**
 * Master balance file. Tune numbers here — no code changes needed.
 */
export const BALANCE = Object.freeze({
  // Run structure
  ROUNDS_PER_RUN: 12,
  BALLS_PER_ROUND: 5,

  // Starting wheel — 40 segments
  INITIAL_WHEEL: [
    'red', 'blue', 'gold', 'red', 'blue', 'red', 'gold', 'blue',
    'red', 'blue', 'red', 'gold', 'blue', 'red', 'blue', 'gold',
    'red', 'blue', 'red', 'gold', 'blue', 'red', 'blue', 'gold',
    'red', 'blue', 'gold', 'red', 'blue', 'red', 'gold', 'blue',
    'red', 'gold', 'blue', 'red', 'blue', 'gold', 'red', 'blue',
  ],

  // Quota scaling — quota(round) = BASE × GROWTH^(round-1)
  QUOTA_BASE: 30,
  QUOTA_GROWTH: 1.2,

  // Economy
  SURPLUS_CONVERSION_RATE: 20,   // surplus ÷ 20 = 💵

  // Fever — consecutive high-value hits
  FEVER_THRESHOLD: 3,
  FEVER_DURATION_BALLS: 3,
  FEVER_MULTIPLIER: 2.0,

  // Streak
  COLOR_STREAK_BONUS: 0.3,      // +30% per streak level
  COLOR_STREAK_MAX: 3,

  // Wheel limits
  MAX_SEGMENTS: 48,
  MIN_SEGMENTS: 20,
  MAX_WEIGHT_PER_SEGMENT: 5,

  // Shop
  SHOP_REROLL_BASE: 15,
  SHOP_REROLL_INCREMENT: 10,
  SHOP_PRICE_SCALING: 0.5,

  // Stars
  STARS_PER_ROUND: 1,
  STARS_BONUS_WIN: 10,
  STARS_BONUS_PERFECT: 5,

  // Coins visual
  MAX_COIN_DROP: 40,
  COINS_PER_SURPLUS: 5,
});

export function getQuota(round) {
  return Math.floor(BALANCE.QUOTA_BASE * Math.pow(BALANCE.QUOTA_GROWTH, round - 1));
}
