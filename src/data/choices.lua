--[[
    Between-round upgrade choices — ISO with legacy JS choices.js.
    Special balls fire first during the next round.
]]

local CHOICES = {
    -- Wheel manipulation
    { id = 'add_segment',          name = 'Segment',        description = 'Ajoute un pocket générique',                          type = 'add_symbol',    weight = 8, minRound = 1, requiresUnlock = nil, payload = { symbolId = nil } },
    { id = 'upgrade_value_plus2',  name = 'Amplificateur',  description = '+2 à toutes les valeurs pendant le décompte',         type = 'wheel_upgrade', weight = 5, minRound = 3, requiresUnlock = nil, payload = { upgradeId = 'upgrade_value_plus2' } },
    { id = 'remove_segment',      name = 'Retirer Segment', description = 'Retire un segment (au choix)',                        type = 'remove_symbol', weight = 6, minRound = 2, requiresUnlock = nil, payload = {} },
    { id = 'boost_weight',        name = 'Lester',          description = '+1 poids à un segment',                              type = 'boost_weight',  weight = 7, minRound = 2, requiresUnlock = nil, payload = {} },

    -- Special balls
    { id = 'ball_golden',   name = 'Bille Dorée',     description = '×2 la valeur du segment',              type = 'special_ball', weight = 8, minRound = 1, requiresUnlock = nil, effect = 'double',   rarity = 'common',    cost = 20 },
    { id = 'ball_splash',   name = 'Bille Explosive', description = 'Score aussi les 2 segments adjacents', type = 'special_ball', weight = 4, minRound = 4, requiresUnlock = nil, effect = 'splash',   rarity = 'rare',      cost = 70 },
    { id = 'ball_ticket',   name = 'Bille Ticket',    description = '0 coins, mais donne des tickets = n° pocket', type = 'special_ball', weight = 4, minRound = 3, requiresUnlock = nil, effect = 'ticket', rarity = 'rare', cost = 50 },
    { id = 'ball_critical', name = 'Bille Critique',  description = '×5 la valeur du segment',              type = 'special_ball', weight = 2, minRound = 6, requiresUnlock = nil, effect = 'critical', rarity = 'legendary', cost = 120 },
}

local CHOICE_MAP = {}
for _, c in ipairs(CHOICES) do CHOICE_MAP[c.id] = c end

return { CHOICES = CHOICES, CHOICE_MAP = CHOICE_MAP }
