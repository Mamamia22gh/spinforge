--[[
    GameLoop — ISO with legacy JS GameLoop.js.

    Flow: startRun→IDLE → spin/resolveBallAt→SPINNING → RESULTS →
          continueFromResults→CHOICE → makeChoice/skipChoice→SHOP →
          endShop→IDLE (next round)

    Scoring: baseVal = setBaseValue or (segIndex+1), even/odd bonuses,
             ×weight, +value_plus_2 stacks, gold×2, special ball effects.
    Score carries over: endShop deducts quota, surplus persists.
]]

local BALANCE, getQuota = (function() local b = require('src.data.balance'); return b.BALANCE, b.getQuota end)()
local StateMod = require('src.state')
local PHASE    = StateMod.PHASE

local RNG      = require('src.rng')
local EventBus = require('src.event_bus')

local Scoring  = require('src.systems.scoring')
local WheelS   = require('src.systems.wheel')
local Shop     = require('src.systems.shop')
local ChoiceS  = require('src.systems.choice')
local MetaMod  = require('src.systems.meta')
local Meta     = MetaMod.Meta
local Effect   = require('src.systems.effect')
local getSymbol = require('src.data.symbols').getSymbol

local GL = {}
GL.__index = GL

function GL.new(opts)
    opts = opts or {}
    local self = setmetatable({}, GL)
    self.events  = EventBus.new()
    self.rng     = RNG.new(opts.seed)

    self.scoring = Scoring.new(self.events)
    self.wheel   = WheelS.new(self.events)
    self.shop    = Shop.new(self.events)
    self.choice  = ChoiceS.new(self.events)
    self.meta    = Meta.new(self.events)

    self.state = StateMod.createGameState(self.rng:getSeed())
    if opts.meta then
        for k, v in pairs(opts.meta) do self.state.meta[k] = v end
    end
    return self
end

function GL:_getMods()
    return Effect.compute(self.state.run and self.state.run.relics or {})
end

function GL:_setPhase(p)
    if self.state.phase == p then return end
    self.state.phase = p
    self.events:emit('phase:changed', { phase = p })
end

function GL:_error(msg)
    self.events:emit('error', { message = msg })
    return false
end

-- ─── Lifecycle ────────────────────────────────────────────────

function GL:startRun()
    local ok = { [PHASE.IDLE] = true, [PHASE.GAME_OVER] = true, [PHASE.VICTORY] = true }
    if not ok[self.state.phase] then
        return self:_error('Cannot start run in phase ' .. self.state.phase)
    end

    StateMod.resetUid()
    self.state.run = StateMod.createRunState()
    self:_setPhase(PHASE.IDLE)
    self:_emitRoundPreview()
    self.events:emit('run:started', { seed = self.rng:getSeed() })
    return true
end

-- ─── Spin (RNG-based, for tests / headless) ─────────────────

function GL:spin()
    local ok = { [PHASE.IDLE] = true, [PHASE.SPINNING] = true }
    if not ok[self.state.phase] then
        return self:_error('Cannot spin in phase ' .. self.state.phase)
    end

    local run = self.state.run
    if not run then return self:_error('No active run') end
    if run.ballsLeft <= 0 then
        self.events:emit('error', { message = 'Plus de billes' })
        return nil
    end

    self:_setPhase(PHASE.SPINNING)
    local result = self.wheel:spin(run, self.rng)
    return self:_recordBall(run, result.segmentIndex)
end

-- ─── Resolve ball at specific segment (physics-driven) ──────

function GL:resolveBallAt(segmentIndex)
    local ok = { [PHASE.IDLE] = true, [PHASE.SPINNING] = true }
    if not ok[self.state.phase] then
        return self:_error('Cannot resolve ball in phase ' .. self.state.phase)
    end

    local run = self.state.run
    if not run then return self:_error('No active run') end
    if run.ballsLeft <= 0 then return nil end

    local segment = run.wheel[segmentIndex + 1]  -- 0-based → 1-based
    if not segment then return self:_error('Invalid segment index: ' .. segmentIndex) end

    self:_setPhase(PHASE.SPINNING)
    return self:_recordBall(run, segmentIndex)
end

-- ─── Shared ball resolution ─────────────────────────────────

function GL:_recordBall(run, segmentIndex)
    -- Check special ball
    local specialBall = nil
    if not run._specialBallsFired then run._specialBallsFired = 0 end
    if run._specialBallsFired < #run.specialBalls then
        specialBall = run.specialBalls[run._specialBallsFired + 1]
        run._specialBallsFired = run._specialBallsFired + 1
    end

    local seg, symbol, value = self:_resolveSegment(run, segmentIndex, specialBall)

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

    -- Ticket ball: award tickets equal to pocket number
    if specialBall and specialBall.effect == 'ticket' then
        local ticketsEarned = segmentIndex + 1
        self.state.meta.tickets = self.state.meta.tickets + ticketsEarned
        self.state.meta.totalTickets = (self.state.meta.totalTickets or 0) + ticketsEarned
        spinResult.ticketsEarned = ticketsEarned
        self.events:emit('tickets:earned', { amount = ticketsEarned, total = self.state.meta.tickets })
    end

    -- Splash ball: also score adjacent segments
    if specialBall and specialBall.effect == 'splash' then
        local len = #run.wheel
        local left = ((segmentIndex - 1) + len) % len
        local right = (segmentIndex + 1) % len
        local _, _, vL = self:_resolveSegment(run, left, nil)
        local _, _, vR = self:_resolveSegment(run, right, nil)
        run.score = run.score + vL + vR
        spinResult.splashValue = vL + vR
        spinResult.value = spinResult.value + vL + vR
    end

    local isGold = false
    for _, gp in ipairs(BALANCE.GOLD_POCKETS) do
        if gp == segmentIndex then isGold = true; break end
    end

    self.events:emit('ball:resolved', {
        result = spinResult,
        value = spinResult.value,
        ballsLeft = run.ballsLeft,
        specialBall = specialBall,
        isGold = isGold,
        segmentIndex = segmentIndex,
        score = run.score,
    })

    -- Round end is now driven by Spin scene after full reveal+quota anim
    -- (see Spin:_resolveAll → loop:finishSpinRound)

    return { result = spinResult, value = spinResult.value }
end

-- Called by the Spin scene once reveal sequence + quota deduction anim are done.
function GL:finishSpinRound()
    if self.state.phase ~= PHASE.SPINNING then return false end
    local run = self.state.run
    if not run or run.ballsLeft > 0 then return false end
    self:_endRound()
    return true
end

function GL:_resolveSegment(run, segmentIndex, specialBall)
    local segment = run.wheel[segmentIndex + 1]
    local symbol = segment.symbolId and getSymbol(segment.symbolId) or nil
    local mods = self:_getMods()

    -- Base value: relic override or pocket number (1-indexed)
    local baseVal
    if mods.setBaseValue ~= nil then
        baseVal = mods.setBaseValue
    else
        baseVal = segmentIndex + 1
    end

    -- Even/odd value bonuses from relics
    if baseVal % 2 == 0 then
        baseVal = baseVal + mods.addEven
    else
        baseVal = baseVal + mods.addOdd
    end

    local value = baseVal * segment.weight

    -- Wheel upgrade: value_plus_2
    local upgradeCount = 0
    for _, u in ipairs(run.purchasedUpgrades or {}) do
        if u.effect == 'value_plus_2' then upgradeCount = upgradeCount + 1 end
    end
    if upgradeCount > 0 then value = value + 2 * upgradeCount end

    -- Gold pocket: ×2
    local isGold = false
    for _, gp in ipairs(BALANCE.GOLD_POCKETS) do
        if gp == segmentIndex then isGold = true; break end
    end
    if isGold then value = value * 2 end

    -- Special ball effects
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

function GL:getSegmentDisplayValues()
    local run = self.state.run
    if not run then return {} end
    local mods = self:_getMods()
    local values = {}
    for i, seg in ipairs(run.wheel) do
        local v
        if mods.setBaseValue ~= nil then
            v = mods.setBaseValue
        else
            v = i  -- 1-indexed = segmentIndex+1
        end
        if v % 2 == 0 then v = v + mods.addEven
        else v = v + mods.addOdd end
        values[i] = v
    end
    return values
end

-- ─── End of round → Results ──────────────────────────────────

function GL:_endRound()
    local run = self.state.run
    run._spinInProgress = false

    local result = self.scoring:evaluateRound(run)

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

    -- Award tickets for passing the round
    if result.passed then
        local earned = BALANCE.TICKETS_PER_ROUND
        self.state.meta.tickets = self.state.meta.tickets + earned
        self.state.meta.totalTickets = (self.state.meta.totalTickets or 0) + earned
        run.lastRoundResult.ticketsEarned = earned
        self.events:emit('tickets:earned', { amount = earned, total = self.state.meta.tickets })
    end

    self:_setPhase(PHASE.RESULTS)
    self.events:emit('round:ended', run.lastRoundResult)

    if not result.passed then
        self:_gameOver()
    end
end

-- ─── Results → Choice ────────────────────────────────────────

function GL:continueFromResults()
    if self.state.phase ~= PHASE.RESULTS then return false end

    local run = self.state.run
    if not run.lastRoundResult.passed then return false end

    if run.round >= BALANCE.ROUNDS_PER_RUN then
        self:_victory()
        return true
    end

    local choices = self.choice:generate(run, self.state.meta, self.rng)
    run.currentChoices = choices

    self:_setPhase(PHASE.CHOICE)
    self.events:emit('choice:presented', { choices = choices })
    return true
end

-- ─── Choice → Shop ───────────────────────────────────────────

function GL:makeChoice(index, targetIndex)
    if self.state.phase ~= PHASE.CHOICE then
        return self:_error('Not in CHOICE phase')
    end

    local run = self.state.run
    local choice = run.currentChoices[index]
    if not choice then
        return self:_error('Invalid choice index')
    end

    local ok = self.choice:apply(run, choice, targetIndex, self.wheel)
    if not ok then return false end

    self.events:emit('choice:made', { choice = choice, index = index })
    self:_openShop()
    return true
end

function GL:skipChoice()
    if self.state.phase ~= PHASE.CHOICE then return false end
    self:_openShop()
    return true
end

function GL:_openShop()
    local run = self.state.run
    run.shopOfferings = self.shop:generateOfferings(run, self.rng)
    run.rerollCount = 0

    self:_setPhase(PHASE.SHOP)
    self.events:emit('shop:opened', { tickets = self.state.meta.tickets, offerings = run.shopOfferings })
end

-- ─── Shop ─────────────────────────────────────────────────────

function GL:shopBuy(slotIndex)
    if self.state.phase ~= PHASE.SHOP then return self:_error('Not in SHOP') end
    return self.shop:buyItem(self.state.run, self.state.meta, slotIndex, self.wheel)
end

function GL:shopReroll()
    if self.state.phase ~= PHASE.SHOP then return self:_error('Not in SHOP') end
    return self.shop:reroll(self.state.run, self.state.meta, self.rng)
end

function GL:endShop()
    if self.state.phase ~= PHASE.SHOP then return false end

    local run = self.state.run
    run.round = run.round + 1

    if run.round > BALANCE.ROUNDS_PER_RUN then
        self:_victory()
        return true
    end

    -- Deduct quota from accumulated score (surplus carries over)
    if run.lastRoundResult and run.lastRoundResult.passed then
        run.score = run.score - run.lastRoundResult.quota
    end

    -- Reset for next round
    run._spinInProgress = false
    run._specialBallsFired = 0
    run.ballsLeft = BALANCE.BALLS_PER_ROUND + #run.specialBalls + (run.genericBallsBought or 0)
    run.spinResults = {}
    run.shopDiscount = 0

    self:_setPhase(PHASE.IDLE)
    self:_emitRoundPreview()
    return true
end

-- ─── End states ───────────────────────────────────────────────

function GL:_gameOver()
    local run = self.state.run
    self:_applyRunStats(run)

    self:_setPhase(PHASE.GAME_OVER)
    self.events:emit('game:over', {
        round = run.round,
        score = run.score,
        quota = getQuota(run.round),
        totalWon = run.lastRoundResult and run.lastRoundResult.totalWon or 0,
    })
end

function GL:_victory()
    local run = self.state.run
    local bonus = BALANCE.TICKETS_BONUS_WIN
    self.state.meta.tickets = self.state.meta.tickets + bonus
    self.state.meta.totalTickets = (self.state.meta.totalTickets or 0) + bonus
    self:_applyRunStats(run)

    self:_setPhase(PHASE.VICTORY)
    self.events:emit('game:won', { round = run.round, tickets = bonus, score = run.score })
end

function GL:_applyRunStats(run)
    self.state.meta.runsCompleted = self.state.meta.runsCompleted + 1
    self.state.meta.bestRound = math.max(self.state.meta.bestRound, run.round)
end

-- ─── Public phase trigger (for UI: IDLE → SPINNING) ─────────

function GL:beginSpinning()
    if self.state.phase ~= PHASE.IDLE then return false end
    if not self.state.run or self.state.run.ballsLeft <= 0 then return false end
    if self.state.run._spinInProgress then return false end
    self.state.run._spinInProgress = true
    self:_setPhase(PHASE.SPINNING)
    return true
end

-- ─── Helpers ──────────────────────────────────────────────────

function GL:_emitRoundPreview()
    local run = self.state.run
    self.events:emit('round:preview', {
        round = run.round,
        quota = getQuota(run.round),
        ballsLeft = run.ballsLeft,
        wheel = run.wheel,
        probabilities = self.wheel:getProbabilities(run.wheel),
        relics = run.relics,
    })
end

return GL
