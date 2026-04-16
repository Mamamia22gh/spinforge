--[[
    Relic definitions — port of legacy/src/data/relics.js
]]

local RELICS = {
    { id = 'lucky_charm',  name = 'Porte-Bonheur',  rarity = 'common',   cost = 8,
      desc = '+1 bille par round', effect = { type = 'extra_ball', value = 1 } },
    { id = 'coin_magnet',  name = 'Aimant à pièces', rarity = 'uncommon', cost = 12,
      desc = '+25% gold à chaque round', effect = { type = 'gold_mult', value = 1.25 } },
    { id = 'score_booster', name = 'Booster',        rarity = 'uncommon', cost = 15,
      desc = '+1 à tous les scores', effect = { type = 'score_flat', value = 1 } },
    { id = 'golden_edge',  name = 'Bord Doré',       rarity = 'rare',     cost = 20,
      desc = 'Les poches dorées donnent x3 au lieu de x2', effect = { type = 'gold_pocket_mult', value = 3 } },
    { id = 'rich_start',   name = 'Départ Riche',    rarity = 'common',   cost = 6,
      desc = '+5 gold immédiatement',  effect = { type = 'instant_gold', value = 5 } },
    { id = 'ticket_hoarder', name = 'Accumulateur', rarity = 'rare',       cost = 25,
      desc = '+5 tickets par round',  effect = { type = 'bonus_tickets', value = 5 } },
    { id = 'reroll_discount', name = 'Négociateur', rarity = 'uncommon',  cost = 10,
      desc = '-2 gold sur les rerolls', effect = { type = 'reroll_discount', value = 2 } },
    { id = 'perfect_seer', name = 'Oracle',          rarity = 'legendary', cost = 50,
      desc = '+50% gold si score > quota * 1.5', effect = { type = 'perfect_mult', value = 1.5 } },
}

local RELIC_RARITY_WEIGHTS = {
    common    = 60,
    uncommon  = 30,
    rare      = 9,
    legendary = 1,
}

local function getRelic(id)
    for _, r in ipairs(RELICS) do
        if r.id == id then return r end
    end
    return nil
end

local function getRarityWeights()
    return RELIC_RARITY_WEIGHTS
end

return {
    RELICS = RELICS,
    RELIC_RARITY_WEIGHTS = RELIC_RARITY_WEIGHTS,
    getRelic = getRelic,
    getRarityWeights = getRarityWeights,
}
