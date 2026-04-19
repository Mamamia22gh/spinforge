--[[
    Wheel Upgrades — ISO with legacy JS wheelUpgrades.js.
]]

local WHEEL_UPGRADES = {
    { id = 'upgrade_value_plus2', name = 'Amplificateur', emoji = '🔺',
      description = '+2 à toutes les valeurs pendant le décompte',
      rarity = 'common', cost = 35, effect = 'value_plus_2' },
}

local WHEEL_UPGRADE_MAP = {}
for _, u in ipairs(WHEEL_UPGRADES) do WHEEL_UPGRADE_MAP[u.id] = u end

return { WHEEL_UPGRADES = WHEEL_UPGRADES, WHEEL_UPGRADE_MAP = WHEEL_UPGRADE_MAP }
