/**
 * Between-round upgrade choices. Player picks 1 of 3.
 *
 * Special balls: one-time use balls with unique effects.
 * When purchased/chosen, they are added to run.specialBalls
 * and fire first during the next round.
 */
export const CHOICES = [
  // ── Wheel manipulation ──
  { id: 'add_segment',    name: 'Segment',          emoji: '⚪', description: 'Ajoute un pocket générique',        type: 'add_symbol',    weight: 8,  minRound: 1, requiresUnlock: null, payload: { symbolId: null } },
  { id: 'upgrade_value_plus2', name: 'Amplificateur', emoji: '🔺', description: '+2 à toutes les valeurs pendant le décompte', type: 'wheel_upgrade', weight: 5, minRound: 3, requiresUnlock: null, payload: { upgradeId: 'upgrade_value_plus2' } },
  { id: 'remove_segment', name: 'Retirer Segment',  emoji: '✂️', description: 'Retire un segment (au choix)',       type: 'remove_symbol', weight: 6,  minRound: 2, requiresUnlock: null, payload: {} },
  { id: 'boost_weight',   name: 'Lester',           emoji: '⚖️', description: '+1 poids à un segment',             type: 'boost_weight',  weight: 7,  minRound: 2, requiresUnlock: null, payload: {} },
  { id: 'purify',          name: 'Purification',     emoji: '💧', description: 'Réduit la corruption de 15%',       type: 'purify',        weight: 5,  minRound: 3, requiresUnlock: null, payload: {} },

  // ── Special balls (purchasable in shop & offered as choices) ──
  { id: 'ball_golden',   name: 'Bille Dorée',     emoji: '🟡', description: '×2 la valeur du segment',             type: 'special_ball', weight: 8,  minRound: 1, requiresUnlock: null, effect: 'double',       rarity: 'common',    cost: 20 },
  { id: 'ball_splash',   name: 'Bille Explosive', emoji: '💥', description: 'Score aussi les 2 segments adjacents',type: 'special_ball', weight: 4,  minRound: 4, requiresUnlock: null, effect: 'splash',       rarity: 'rare',      cost: 70 },
  { id: 'ball_ticket',   name: 'Bille Ticket',   emoji: '🎟️', description: '0 coins, mais donne des tickets = n° pocket', type: 'special_ball', weight: 4, minRound: 3, requiresUnlock: null, effect: 'ticket',      rarity: 'rare',      cost: 50 },
  { id: 'ball_critical', name: 'Bille Critique',  emoji: '⚡', description: '×5 la valeur du segment',             type: 'special_ball', weight: 2,  minRound: 6, requiresUnlock: null, effect: 'critical',     rarity: 'legendary', cost: 120 },
];

export const CHOICE_MAP = new Map(CHOICES.map(c => [c.id, c]));
