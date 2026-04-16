--[[
    Bets definitions — port of legacy/src/data/bets.js
]]

local BET_TYPES = {
    { id = 'color_red',    name = 'Rouge',       cost = 1, payout = 2, desc = 'Gagne si un symbole rouge sort' },
    { id = 'color_blue',   name = 'Bleu',        cost = 1, payout = 2, desc = 'Gagne si un symbole bleu sort' },
    { id = 'parity_even',  name = 'Pair',        cost = 1, payout = 2, desc = "Gagne si l'index de pocket est pair" },
    { id = 'parity_odd',   name = 'Impair',      cost = 1, payout = 2, desc = "Gagne si l'index de pocket est impair" },
    { id = 'gold_pocket',  name = 'Poche d’or',  cost = 2, payout = 5, desc = 'Gagne sur une poche dorée' },
}

return { BET_TYPES = BET_TYPES }
