local BALANCE, getQuota = (function() local b = require('src.data.balance'); return b.BALANCE, b.getQuota end)()
local PHASE = require('src.state').PHASE

local M = {}

function M.endRound(gl)
    local run = gl.state.run
    run._spinInProgress = false

    local result = gl.scoring:evaluateRound(run)

    run.lastRoundResult = {
        round = run.round,
        totalWon = result.totalWon,
        quota = result.quota,
        passed = result.passed,
        surplus = result.surplus,
        shopCoins = result.shopCoins,
        ticketsEarned = 0,
    }

    run.shopCurrency = run.shopCurrency + result.shopCoins

    if result.passed then
        local earned = BALANCE.TICKETS_PER_ROUND
        gl.state.meta.tickets = gl.state.meta.tickets + earned
        gl.state.meta.totalTickets = (gl.state.meta.totalTickets or 0) + earned
        run.lastRoundResult.ticketsEarned = earned
        gl.events:emit('tickets:earned', { amount = earned, total = gl.state.meta.tickets })
    end

    gl:_setPhase(PHASE.RESULTS)
    gl.events:emit('round:ended', run.lastRoundResult)

    if not result.passed then
        M.gameOver(gl)
    end
end

function M.continueFromResults(gl)
    if gl.state.phase ~= PHASE.RESULTS then return false end
    local run = gl.state.run
    if not run.lastRoundResult.passed then return false end

    if run.round >= BALANCE.ROUNDS_PER_RUN then
        M.victory(gl)
        return true
    end

    local choices = gl.choice:generate(run, gl.state.meta, gl.rng)
    run.currentChoices = choices

    gl:_setPhase(PHASE.CHOICE)
    gl.events:emit('choice:presented', { choices = choices })
    return true
end

function M.makeChoice(gl, index, targetIndex)
    if gl.state.phase ~= PHASE.CHOICE then
        return gl:_error('Not in CHOICE phase')
    end
    local run = gl.state.run
    local choice = run.currentChoices[index]
    if not choice then return gl:_error('Invalid choice index') end

    local ok = gl.choice:apply(run, choice, targetIndex, gl.wheel)
    if not ok then return false end

    gl.events:emit('choice:made', { choice = choice, index = index })
    M.openShop(gl)
    return true
end

function M.skipChoice(gl)
    if gl.state.phase ~= PHASE.CHOICE then return false end
    M.openShop(gl)
    return true
end

function M.openShop(gl)
    local run = gl.state.run
    run.shopOfferings = gl.shop:generateOfferings(run, gl.rng)
    run.rerollCount = 0
    gl:_setPhase(PHASE.SHOP)
    gl.events:emit('shop:opened', { tickets = gl.state.meta.tickets, offerings = run.shopOfferings })
end

function M.shopBuy(gl, slotIndex)
    if gl.state.phase ~= PHASE.SHOP then return gl:_error('Not in SHOP') end
    return gl.shop:buyItem(gl.state.run, gl.state.meta, slotIndex, gl.wheel)
end

function M.shopReroll(gl)
    if gl.state.phase ~= PHASE.SHOP then return gl:_error('Not in SHOP') end
    return gl.shop:reroll(gl.state.run, gl.state.meta, gl.rng)
end

function M.endShop(gl)
    if gl.state.phase ~= PHASE.SHOP then return false end
    local run = gl.state.run
    run.round = run.round + 1

    if run.round > BALANCE.ROUNDS_PER_RUN then
        M.victory(gl)
        return true
    end

    if run.lastRoundResult and run.lastRoundResult.passed then
        run.score = run.score - run.lastRoundResult.quota
    end

    run._spinInProgress = false
    run._specialBallsFired = 0
    run.ballsLeft = BALANCE.BALLS_PER_ROUND + #run.specialBalls + (run.genericBallsBought or 0)
    run.spinResults = {}
    run.shopDiscount = 0

    gl:_setPhase(PHASE.IDLE)
    gl:_emitRoundPreview()
    return true
end

function M.gameOver(gl)
    local run = gl.state.run
    M._applyRunStats(gl, run)
    gl:_setPhase(PHASE.GAME_OVER)
    gl.events:emit('game:over', {
        round = run.round, score = run.score,
        quota = getQuota(run.round),
        totalWon = run.lastRoundResult and run.lastRoundResult.totalWon or 0,
    })
end

function M.victory(gl)
    local run = gl.state.run
    local bonus = BALANCE.TICKETS_BONUS_WIN
    gl.state.meta.tickets = gl.state.meta.tickets + bonus
    gl.state.meta.totalTickets = (gl.state.meta.totalTickets or 0) + bonus
    M._applyRunStats(gl, run)
    gl:_setPhase(PHASE.VICTORY)
    gl.events:emit('game:won', { round = run.round, tickets = bonus, score = run.score })
end

function M._applyRunStats(gl, run)
    gl.state.meta.runsCompleted = gl.state.meta.runsCompleted + 1
    gl.state.meta.bestRound = math.max(gl.state.meta.bestRound, run.round)
end

return M
