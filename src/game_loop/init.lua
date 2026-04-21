--[[
    GameLoop facade — delegates scoring to scoring.lua, phase transitions to phases.lua.
]]

local BALANCE = require('src.data.balance').BALANCE
local StateMod = require('src.state')
local PHASE    = StateMod.PHASE
local EventBus = require('src.event_bus')
local RNG      = require('src.rng')
local Scoring  = require('src.systems.scoring')
local WheelS   = require('src.systems.wheel')
local Shop     = require('src.systems.shop')
local ChoiceS  = require('src.systems.choice')
local MetaMod  = require('src.systems.meta')
local Meta     = MetaMod.Meta

local ScoringL = require('src.game_loop.scoring')
local Phases   = require('src.game_loop.phases')

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

function GL:_setPhase(p)
    if self.state.phase == p then return end
    self.state.phase = p
    self.events:emit('phase:changed', { phase = p })
end

function GL:_error(msg)
    self.events:emit('error', { message = msg })
    return false
end

function GL:_emitRoundPreview()
    local run = self.state.run
    self.events:emit('round:preview', {
        round = run.round,
        quota = require('src.data.balance').getQuota(run.round),
        ballsLeft = run.ballsLeft,
        wheel = run.wheel,
        probabilities = self.wheel:getProbabilities(run.wheel),
        relics = run.relics,
    })
end

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
    return ScoringL.recordBall(self, run, result.segmentIndex)
end

function GL:resolveBallAt(segmentIndex)
    local ok = { [PHASE.IDLE] = true, [PHASE.SPINNING] = true }
    if not ok[self.state.phase] then
        return self:_error('Cannot resolve ball in phase ' .. self.state.phase)
    end
    local run = self.state.run
    if not run then return self:_error('No active run') end
    if run.ballsLeft <= 0 then return nil end
    local segment = run.wheel[segmentIndex + 1]
    if not segment then return self:_error('Invalid segment index: ' .. segmentIndex) end
    self:_setPhase(PHASE.SPINNING)
    return ScoringL.recordBall(self, run, segmentIndex)
end

function GL:finishSpinRound()
    if self.state.phase ~= PHASE.SPINNING then return false end
    local run = self.state.run
    if not run or run.ballsLeft > 0 then return false end
    Phases.endRound(self)
    return true
end

function GL:beginSpinning()
    if self.state.phase ~= PHASE.IDLE then return false end
    if not self.state.run or self.state.run.ballsLeft <= 0 then return false end
    if self.state.run._spinInProgress then return false end
    self.state.run._spinInProgress = true
    self:_setPhase(PHASE.SPINNING)
    return true
end

function GL:continueFromResults() return Phases.continueFromResults(self) end
function GL:makeChoice(index, targetIndex) return Phases.makeChoice(self, index, targetIndex) end
function GL:skipChoice() return Phases.skipChoice(self) end
function GL:shopBuy(slotIndex) return Phases.shopBuy(self, slotIndex) end
function GL:shopReroll() return Phases.shopReroll(self) end
function GL:endShop() return Phases.endShop(self) end

function GL:_getMods() return ScoringL.getMods(self.state) end
function GL:_resolveSegment(run, si, sb) return ScoringL.resolveSegment(self.state, run, si, sb) end
function GL:getSegmentDisplayValues() return ScoringL.getSegmentDisplayValues(self.state) end

return GL
