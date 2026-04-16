--[[
    GameLoop — the orchestrator.
    Port of legacy/src/core/GameLoop.js
]]

local BALANCE, getQuota = (function() local b = require('src.data.balance'); return b.BALANCE, b.getQuota end)()
local StateMod = require('src.state')
local PHASE    = StateMod.PHASE

local RNG     = require('src.rng')
local EventBus = require('src.event_bus')

local Scoring = require('src.systems.scoring')
local WheelS  = require('src.systems.wheel')
local Shop    = require('src.systems.shop')
local ChoiceS = require('src.systems.choice')
local MetaMod = require('src.systems.meta')
local Meta    = MetaMod.Meta
local Effect  = require('src.systems.effect')

local GL = {}
GL.__index = GL

function GL.new(opts)
    opts = opts or {}
    local self = setmetatable({}, GL)
    self.events = EventBus.new()
    self.rng    = RNG.new(opts.seed)

    self.scoring = Scoring.new(self.events)
    self.wheel   = WheelS.new(self.events)
    self.shop    = Shop.new(self.events)
    self.choice  = ChoiceS.new(self.events)
    self.meta    = Meta.new(self.events)

    self.state = StateMod.createGameState(opts.seed)
    if opts.meta then self.state.meta = opts.meta end
    return self
end

function GL:_setPhase(p)
    self.state.phase = p
    self.events:emit('phase:changed', { phase = p })
end

function GL:_error(msg)
    self.events:emit('error', { message = msg })
    return false
end

-- ─── Lifecycle ────────────────────────────────────────────────
function GL:startRun()
    StateMod.resetUid()
    self.state.run = StateMod.createRunState()
    self.state.run.ballsLeft = self.state.run.ballsLeft + Effect.getExtraBalls(self.state.run)
    self:_setPhase(PHASE.SPINNING)
    self.events:emit('run:started', { run = self.state.run })
    return self.state.run
end

-- ─── Spin ────────────────────────────────────────────────────
function GL:spin()
    -- RNG-driven bulk resolve used by tests
    if self.state.phase ~= PHASE.SPINNING then return self:_error('Not in SPINNING') end
    local run = self.state.run
    while run.ballsLeft > 0 do
        local pick = self.wheel:pickSegment(run.wheel, self.rng)
        self:_resolveSegment(pick.index)
    end
    self:_endRound()
    return true
end

function GL:resolveBallAt(segIndex)
    if self.state.phase ~= PHASE.SPINNING then return self:_error('Not in SPINNING') end
    local run = self.state.run
    if run.ballsLeft <= 0 then return self:_error('No balls left') end
    self:_resolveSegment(segIndex)
    if run.ballsLeft <= 0 then self:_endRound() end
    return true
end

function GL:_resolveSegment(segIndex)
    local run = self.state.run

    -- Determine special ball in use (if any)
    local ballType
    if run._specialBallsFired < #run.specialBalls then
        ballType = run.specialBalls[run._specialBallsFired + 1]
        run._specialBallsFired = run._specialBallsFired + 1
    end

    local segment = run.wheel[segIndex + 1]
    if not segment then return end

    -- Base value: segmentIndex + 1 + amplifier stacks
    local ampStacks = self.wheel:countUpgrade(run, 'amplifier')
    local baseValue = (segIndex + 1) + (ampStacks * 2)

    -- Gold pocket?
    local isGold = false
    for _, gp in ipairs(BALANCE.GOLD_POCKETS) do
        if gp == segIndex then isGold = true; break end
    end

    local value = baseValue
    if isGold then value = value * Effect.getGoldPocketMult(run) end

    -- Relic flat bonus
    value = value + Effect.getScoreFlatBonus(run)

    local tickets = 0

    -- Special ball effects
    if ballType == 'golden' then
        value = value * 2
    elseif ballType == 'splash' then
        local total = value
        for _, d in ipairs({ -1, 1 }) do
            local idx = segIndex + d
            local adj = run.wheel[idx + 1]
            if adj then total = total + (idx + 1) + ampStacks * 2 end
        end
        value = total
    elseif ballType == 'critical' then
        if self.rng:random() < 0.5 then value = value * 3 end
    elseif ballType == 'ticket' then
        value = 0
        tickets = segIndex + 1
    end

    run.score = run.score + value
    run.ballsLeft = run.ballsLeft - 1
    run.corruption = math.min(1, run.corruption + BALANCE.CORRUPTION_PER_SPIN)

    table.insert(run.spinResults, {
        segmentIndex = segIndex,
        segment = segment,
        symbol = segment.symbolId,
        value = value,
        ballType = ballType,
        tickets = tickets,
        isGold = isGold,
    })

    if tickets > 0 then
        self.meta:addTickets(self.state.meta, tickets)
    end

    self.events:emit('ball:resolved', {
        segmentIndex = segIndex,
        segment = segment,
        value = value,
        ballType = ballType,
        tickets = tickets,
        isGold = isGold,
        ballsLeft = run.ballsLeft,
        score = run.score,
    })
end

function GL:_endRound()
    local run = self.state.run
    local result = self.scoring:evaluateRound(run)

    run.lastRoundResult = result

    -- Gold rewards (with relic multiplier)
    local goldMult = Effect.getGoldMultiplier(run)
    -- Perfect play bonus
    if result.totalWon >= result.quota * Effect.getPerfectMult(run) then
        goldMult = goldMult * 1.5
    end
    local shopCoins = math.floor(result.shopCoins * goldMult)
    run.shopCurrency = run.shopCurrency + shopCoins

    if not result.passed then
        self.meta:recordRunComplete(self.state.meta, run.round)
        self:_setPhase(PHASE.GAME_OVER)
        self.events:emit('run:ended', { reason = 'failed', round = run.round, result = result })
        return
    end

    -- Tickets reward
    local tickets = BALANCE.TICKETS_PER_ROUND + Effect.getBonusTickets(run)
    self.meta:addTickets(self.state.meta, tickets)

    if run.round >= BALANCE.ROUNDS_PER_RUN then
        self.meta:addTickets(self.state.meta, BALANCE.TICKETS_BONUS_WIN)
        self.meta:recordRunComplete(self.state.meta, run.round)
        self:_setPhase(PHASE.VICTORY)
        self.events:emit('run:ended', { reason = 'victory', round = run.round, result = result })
        return
    end

    self:_setPhase(PHASE.RESULTS)
    self.events:emit('round:ended', { result = result, round = run.round })
end

function GL:continueFromResults()
    if self.state.phase ~= PHASE.RESULTS then return self:_error('Not in RESULTS') end
    local run = self.state.run
    -- Every 3 rounds → shop, else choice
    if run.round % 3 == 0 then
        self:_openShop()
    else
        run.currentChoices = self.choice:generate(run, self.rng, 3)
        self:_setPhase(PHASE.CHOICE)
        self.events:emit('choice:offered', { choices = run.currentChoices })
    end
    return true
end

function GL:makeChoice(index)
    if self.state.phase ~= PHASE.CHOICE then return self:_error('Not in CHOICE') end
    local run = self.state.run
    local choice = run.currentChoices[index]
    if not choice then return self:_error('Invalid choice') end
    self.choice:apply(run, choice, self.wheel)
    self:_nextRound()
    return true
end

function GL:skipChoice()
    if self.state.phase ~= PHASE.CHOICE then return self:_error('Not in CHOICE') end
    self:_nextRound()
    return true
end

-- ─── Shop ─────────────────────────────────────────────────────
function GL:_openShop()
    local run = self.state.run
    run.shopOfferings = self.shop:generateOfferings(run, self.rng)
    run.rerollCount = 0
    self:_setPhase(PHASE.SHOP)
    self.events:emit('shop:opened', { tickets = self.state.meta.tickets, offerings = run.shopOfferings })
end

function GL:shopBuy(slot)
    if self.state.phase ~= PHASE.SHOP then return self:_error('Not in SHOP') end
    return self.shop:buyItem(self.state.run, self.state.meta, slot, self.wheel)
end

function GL:shopReroll()
    if self.state.phase ~= PHASE.SHOP then return self:_error('Not in SHOP') end
    return self.shop:reroll(self.state.run, self.state.meta, self.rng)
end

function GL:endShop()
    if self.state.phase ~= PHASE.SHOP then return false end
    self:_nextRound()
    return true
end

function GL:_nextRound()
    local run = self.state.run
    run.round = run.round + 1
    run.score = 0
    run.ballsLeft = BALANCE.BALLS_PER_ROUND + Effect.getExtraBalls(run)
        + (run.genericBallsBought or 0)
    run.spinResults = {}
    run.shopDiscount = 0
    run._specialBallsFired = 0
    self:_setPhase(PHASE.SPINNING)
    self.events:emit('round:started', { round = run.round })
end

return GL
