--[[
    Choice / shop item definitions.
]]

local CHOICES = {
    -- ── Wheel upgrades ──
    { id = 'wheel_amplifier', type = 'wheel_upgrade', upgradeId = 'amplifier',
      name = 'Amplificateur', desc = '+2 à toutes les valeurs', cost = 6, rarity = 'common' },

    -- ── Special balls ──
    { id = 'ball_golden',   type = 'special_ball', ballType = 'golden',
      name = 'Bille Dorée', desc = 'Double les gains de la pocket', cost = 40, rarity = 'rare' },
    { id = 'ball_splash',   type = 'special_ball', ballType = 'splash',
      name = 'Bille Splash', desc = 'Scores 3 pockets adjacentes', cost = 30, rarity = 'uncommon' },
    { id = 'ball_critical', type = 'special_ball', ballType = 'critical',
      name = 'Bille Critique', desc = '50% chance de triple score', cost = 25, rarity = 'uncommon' },
    { id = 'ball_ticket',   type = 'special_ball', ballType = 'ticket',
      name = 'Bille Ticket', desc = '0 coins mais donne (index+1) tickets', cost = 50, rarity = 'rare' },
    { id = 'ball_generic',  type = 'special_ball', ballType = 'generic',
      name = 'Bille Standard', desc = '+1 bille au round courant', cost = 15, rarity = 'common' },
}

local function getChoice(id)
    for _, c in ipairs(CHOICES) do
        if c.id == id then return c end
    end
    return nil
end

return { CHOICES = CHOICES, getChoice = getChoice }
