local balMod = require('src.data.balance')
local BALANCE = balMod.BALANCE
local Effect = require('src.systems.effect')

return function(Game)

function Game:_syncWheel()
    local run = self.loop.state.run
    if not run then return end
    self.wheel:setWheel(run.wheel)
    self.wheel:setGoldPockets(BALANCE.GOLD_POCKETS)
    self.wheel:setRelics(run.relics)
    self.wheel:setCorruption(run.corruption or 0.5)
    self.wheel:setBonusMode(false)
    self.wheel:setGaugeUnlocks({ true, false, false, true })
    local mods = Effect.compute(run.relics)
    local upgradeCount = 0
    for _, u in ipairs(run.purchasedUpgrades or {}) do
        if u.effect == 'value_plus_2' then upgradeCount = upgradeCount + 1 end
    end
    local goldSet = {}
    for _, gp in ipairs(BALANCE.GOLD_POCKETS) do goldSet[gp] = true end
    local values = {}
    for i = 1, #run.wheel do
        local segment = run.wheel[i]
        local baseVal = (mods.setBaseValue ~= nil) and mods.setBaseValue or i
        if baseVal % 2 == 0 then baseVal = baseVal + mods.addEven
        else baseVal = baseVal + mods.addOdd end
        local v = baseVal * (segment.weight or 1)
        if upgradeCount > 0 then v = v + 2 * upgradeCount end
        if goldSet[i - 1] then v = v * 2 end
        values[i] = v
    end
    self.wheel:setSegmentValues(values)
    local previewBalls = self._inShop
        and (BALANCE.BALLS_PER_ROUND + #run.specialBalls + (run.genericBallsBought or 0))
        or run.ballsLeft
    self.wheel:placeBalls(previewBalls, run.specialBalls)
    self.wheel:setCounters(run.score, self.loop.state.meta.tickets)
    self.wheel:hubSnapScore(run.score)
end

end
