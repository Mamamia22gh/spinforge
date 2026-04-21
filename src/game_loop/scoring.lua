local BALANCE = require('src.data.balance').BALANCE
local getSymbol = require('src.data.symbols').getSymbol
local Effect = require('src.systems.effect')

local M = {}

function M.getMods(state)
    return Effect.compute(state.run and state.run.relics or {})
end

function M.resolveSegment(state, run, segmentIndex, specialBall)
    local segment = run.wheel[segmentIndex + 1]
    local symbol = segment.symbolId and getSymbol(segment.symbolId) or nil
    local mods = M.getMods(state)

    local baseVal
    if mods.setBaseValue ~= nil then
        baseVal = mods.setBaseValue
    else
        baseVal = segmentIndex + 1
    end

    if baseVal % 2 == 0 then
        baseVal = baseVal + mods.addEven
    else
        baseVal = baseVal + mods.addOdd
    end

    local value = baseVal * segment.weight

    local upgradeCount = 0
    for _, u in ipairs(run.purchasedUpgrades or {}) do
        if u.effect == 'value_plus_2' then upgradeCount = upgradeCount + 1 end
    end
    if upgradeCount > 0 then value = value + 2 * upgradeCount end

    local isGold = false
    for _, gp in ipairs(BALANCE.GOLD_POCKETS) do
        if gp == segmentIndex then isGold = true; break end
    end
    if isGold then value = value * 2 end

    if specialBall then
        if specialBall.effect == 'double' then
            value = value * 2
        elseif specialBall.effect == 'critical' then
            value = value * 5
        elseif specialBall.effect == 'ticket' then
            value = 0
        end
    end

    return segment, symbol, value
end

function M.recordBall(gl, run, segmentIndex)
    local specialBall = nil
    if not run._specialBallsFired then run._specialBallsFired = 0 end
    if run._specialBallsFired < #run.specialBalls then
        specialBall = run.specialBalls[run._specialBallsFired + 1]
        run._specialBallsFired = run._specialBallsFired + 1
    end

    local seg, symbol, value = M.resolveSegment(gl.state, run, segmentIndex, specialBall)

    local spinResult = {
        segmentIndex = segmentIndex,
        segment = seg,
        symbol = symbol,
        value = value,
        specialBall = specialBall,
    }
    table.insert(run.spinResults, spinResult)
    run.score = run.score + value
    run.ballsLeft = run.ballsLeft - 1

    if specialBall and specialBall.effect == 'ticket' then
        local ticketsEarned = segmentIndex + 1
        gl.state.meta.tickets = gl.state.meta.tickets + ticketsEarned
        gl.state.meta.totalTickets = (gl.state.meta.totalTickets or 0) + ticketsEarned
        spinResult.ticketsEarned = ticketsEarned
        gl.events:emit('tickets:earned', { amount = ticketsEarned, total = gl.state.meta.tickets })
    end

    if specialBall and specialBall.effect == 'splash' then
        local len = #run.wheel
        local left = ((segmentIndex - 1) + len) % len
        local right = (segmentIndex + 1) % len
        local _, _, vL = M.resolveSegment(gl.state, run, left, nil)
        local _, _, vR = M.resolveSegment(gl.state, run, right, nil)
        run.score = run.score + vL + vR
        spinResult.splashValue = vL + vR
        spinResult.value = spinResult.value + vL + vR
    end

    local isGold = false
    for _, gp in ipairs(BALANCE.GOLD_POCKETS) do
        if gp == segmentIndex then isGold = true; break end
    end

    gl.events:emit('ball:resolved', {
        result = spinResult,
        value = spinResult.value,
        ballsLeft = run.ballsLeft,
        specialBall = specialBall,
        isGold = isGold,
        segmentIndex = segmentIndex,
        score = run.score,
    })

    return { result = spinResult, value = spinResult.value }
end

function M.getSegmentDisplayValues(state)
    local run = state.run
    if not run then return {} end
    local mods = M.getMods(state)
    local values = {}
    for i, seg in ipairs(run.wheel) do
        local v
        if mods.setBaseValue ~= nil then
            v = mods.setBaseValue
        else
            v = i
        end
        if v % 2 == 0 then v = v + mods.addEven
        else v = v + mods.addOdd end
        values[i] = v
    end
    return values
end

return M
