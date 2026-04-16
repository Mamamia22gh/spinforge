--[[
    Wheel Upgrades — stackable multipliers applied across the whole wheel.
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
