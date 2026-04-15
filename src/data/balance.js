/**
 * Master balance file. Tune numbers here — no code changes needed.
 */
export const BALANCE = Object.freeze({
  // Run structure
  ROUNDS_PER_RUN: 12,
  BALLS_PER_ROUND: 5,

  // Starting wheel — 40 generic pockets (no symbol, scored by pocket number)
  INITIAL_SEGMENTS: 40,

  // Quota scaling — quota(round) = BASE × GROWTH^(round-1)
  QUOTA_BASE: 69,
  QUOTA_GROWTH: 1.2,

  // Economy
  SURPLUS_CONVERSION_RATE: 20,   // surplus ÷ 20 = 💵

  // Wheel limits
  MAX_SEGMENTS: 48,
  MIN_SEGMENTS: 20,
  MAX_WEIGHT_PER_SEGMENT: 5,

  // Shop
  SHOP_REROLL_BASE: 5,
  SHOP_PRICE_SCALING: 0.5,

  // Tickets (meta-progression currency)
  TICKETS_PER_ROUND: 15,
  TICKETS_BONUS_WIN: 10,
  TICKETS_BONUS_PERFECT: 5,

  // Corruption
  CORRUPTION_START: 0.5,          // 50% at run start
  CORRUPTION_PER_SPIN: 0.02,      // +2% per spin
  CORRUPTION_CRITICAL: 0.85,      // above this = danger zone

  // Coins visual
  MAX_COIN_DROP: 40,
  COINS_PER_SURPLUS: 5,
});

export function getQuota(round) {
  return Math.floor(BALANCE.QUOTA_BASE * Math.pow(BALANCE.QUOTA_GROWTH, round - 1));
}
