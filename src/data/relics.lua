--[[
    Relic definitions — ISO with legacy JS relics.js.
    Each relic has an effects array: { {type, value, metaLevel}, ... }
]]

local RELICS = {
    -- COMMON
    { id = 'tablet_twenty',   name = 'Tablette du XX',    description = 'Tous les segments valent 20',                       rarity = 'common',    cost = 30,  minRound = 1, effects = { { type = 'set_base_value', value = 20, metaLevel = 0 } } },
    { id = 'tablet_nineteen', name = 'Tablette du XIX',   description = 'Tous les segments valent 19',                       rarity = 'common',    cost = 25,  minRound = 1, effects = { { type = 'set_base_value', value = 19, metaLevel = 0 } } },

    -- UNCOMMON
    { id = 'even_charm',      name = 'Charme Pair',       description = '+1 aux cases de valeur paire',                      rarity = 'uncommon',  cost = 45,  minRound = 2, effects = { { type = 'add_even_segments', value = 1, metaLevel = 0 } } },
    { id = 'odd_charm',       name = 'Charme Impair',     description = '+3 aux cases de valeur impaire',                    rarity = 'uncommon',  cost = 50,  minRound = 2, effects = { { type = 'add_odd_segments',  value = 3, metaLevel = 0 } } },

    -- RARE
    { id = 'even_totem',      name = 'Totem Pair',        description = '+5 aux cases de valeur paire',                      rarity = 'rare',      cost = 80,  minRound = 4, effects = { { type = 'add_even_segments', value = 5, metaLevel = 0 } } },
    { id = 'odd_totem',       name = 'Totem Impair',      description = '+10 aux cases de valeur impaire',                   rarity = 'rare',      cost = 90,  minRound = 4, effects = { { type = 'add_odd_segments',  value = 10, metaLevel = 0 } } },

    -- LEGENDARY
    { id = 'celestial_crown', name = 'Couronne Céleste',  description = '+25 valeurs paires, +50 valeurs impaires',          rarity = 'legendary', cost = 200, minRound = 7, effects = { { type = 'add_even_segments', value = 25, metaLevel = 0 }, { type = 'add_odd_segments', value = 50, metaLevel = 0 } } },
}

local RELIC_MAP = {}
for _, r in ipairs(RELICS) do RELIC_MAP[r.id] = r end

local RELIC_RARITY_WEIGHTS = { common = 50, uncommon = 30, rare = 15, legendary = 5 }

local function getRelic(id)
    local r = RELIC_MAP[id]
    if not r then error('Unknown relic: ' .. tostring(id)) end
    return r
end

--- Dynamic rarity weights based on current round (ISO with JS).
local function getRarityWeights(round)
    local t = math.min(1, (round - 1) / 11)
    return {
        common    = math.floor(50 - 30 * t + 0.5),
        uncommon  = math.floor(30 + 5 * t + 0.5),
        rare      = math.floor(15 + 20 * t + 0.5),
        legendary = math.floor(5 + 15 * t + 0.5),
    }
end

return {
    RELICS = RELICS,
    RELIC_MAP = RELIC_MAP,
    RELIC_RARITY_WEIGHTS = RELIC_RARITY_WEIGHTS,
    getRelic = getRelic,
    getRarityWeights = getRarityWeights,
}
