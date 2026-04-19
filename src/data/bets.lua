--[[ Bet types — port of legacy/src/data/bets.js ]]

local M = {}

M.BET_TYPES = {
    { id = "sector",            name = "Secteur",        emoji = "🎯",
      description = "Tombe dans une zone de 3",
      payout = 3,   condition = "sector",   target = nil,
      startsUnlocked = true,  minRound = 1 },

    { id = "wildcard",          name = "Wildcard",       emoji = "🃏",
      description = "N'importe quel résultat",
      payout = 1.2, condition = "wildcard", target = nil,
      startsUnlocked = true,  minRound = 1 },

    { id = "double_or_nothing", name = "Quitte ou Double", emoji = "💎",
      description = "x2 ou perd tout",
      payout = 3,   condition = "coin_flip", target = nil,
      startsUnlocked = false, minRound = 6 },
}

local map = {}
for _, b in ipairs(M.BET_TYPES) do map[b.id] = b end
M.BET_TYPE_MAP = map

function M.getBetType(id)
    local b = map[id]
    if not b then error("Unknown bet type: " .. tostring(id)) end
    return b
end

return M
