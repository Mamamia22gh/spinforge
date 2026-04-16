--[[
    Wheel Upgrades — replace the old symbols category in the shop.
    Port of legacy/src/data/wheelUpgrades.js
]]

local WHEEL_UPGRADES = {
    {
        id = 'amplifier',
        name = 'Amplificateur',
        desc = '+2 à toutes les valeurs de la roue',
        cost = 6,
        rarity = 'common',
        stackable = true,
    },
}

local function getWheelUpgrade(id)
    for _, u in ipairs(WHEEL_UPGRADES) do
        if u.id == id then return u end
    end
    return nil
end

return { WHEEL_UPGRADES = WHEEL_UPGRADES, getWheelUpgrade = getWheelUpgrade }
