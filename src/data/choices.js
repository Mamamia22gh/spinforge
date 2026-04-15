/**
 * Between-round upgrade choices. Player picks 1 of 3.
 */
export const CHOICES = [
  // ── Wheel manipulation ──
  { id: 'add_segment',    name: 'Segment',          emoji: '⚪', description: 'Ajoute un pocket générique',        type: 'add_symbol',    weight: 8,  minRound: 1, requiresUnlock: null, payload: { symbolId: null } },
  { id: 'add_cherry',     name: 'Cerise',           emoji: '🍒', description: 'Ajoute une Cerise (double payout)', type: 'add_symbol',    weight: 4,  minRound: 4, requiresUnlock: 'unlock_cherry', payload: { symbolId: 'cherry' } },
  { id: 'remove_segment', name: 'Retirer Segment',  emoji: '✂️', description: 'Retire un segment (au choix)',       type: 'remove_symbol', weight: 6,  minRound: 2, requiresUnlock: null, payload: {} },
  { id: 'boost_weight',   name: 'Lester',           emoji: '⚖️', description: '+1 poids à un segment',             type: 'boost_weight',  weight: 7,  minRound: 2, requiresUnlock: null, payload: {} },

  // ── Chip / spin upgrades ──
  { id: 'chips_10',       name: '+10 Chips',        emoji: '🪙', description: '+10 chips de base',                  type: 'upgrade',       weight: 8,  minRound: 1, requiresUnlock: null, payload: { chipsMax: 10 },   rarity: 'common',    cost: 20 },
  { id: 'chips_25',       name: '+25 Chips',        emoji: '🪙', description: '+25 chips de base',                  type: 'upgrade',       weight: 4,  minRound: 4, requiresUnlock: null, payload: { chipsMax: 25 },   rarity: 'uncommon',  cost: 45 },
  { id: 'extra_spin',     name: '+1 Spin',          emoji: '🔄', description: '+1 spin par round',                  type: 'upgrade',       weight: 5,  minRound: 3, requiresUnlock: null, payload: { extraSpins: 1 },  rarity: 'rare',      cost: 70 },
  { id: 'payout_10',      name: '+10% Payouts',     emoji: '📈', description: '+10% tous les payouts',              type: 'upgrade',       weight: 6,  minRound: 2, requiresUnlock: null, payload: { payoutPercent: 10 }, rarity: 'common',  cost: 25 },
  { id: 'payout_25',      name: '+25% Payouts',     emoji: '📈', description: '+25% tous les payouts',              type: 'upgrade',       weight: 3,  minRound: 5, requiresUnlock: null, payload: { payoutPercent: 25 }, rarity: 'rare',    cost: 80 },
];

export const CHOICE_MAP = new Map(CHOICES.map(c => [c.id, c]));
