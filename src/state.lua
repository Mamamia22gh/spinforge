--[[
    Game state — PHASE enum and state factories.
]]

local BALANCE = require('src.data.balance').BALANCE

local M = {}

M.PHASE = {
    IDLE      = 'IDLE',
    SPINNING  = 'SPINNING',
    RESULTS   = 'RESULTS',
    CHOICE    = 'CHOICE',
    SHOP      = 'SHOP',
    GAME_OVER = 'GAME_OVER',
    VICTORY   = 'VICTORY',
}

local _nextId = 0
function M.uid(prefix)
    _nextId = _nextId + 1
    return (prefix or 'id') .. '_' .. _nextId
end

function M.resetUid()
    _nextId = 0
end

function M.createMetaState()
    return {
        tickets        = 0,
        totalTickets   = 0,
        runsCompleted  = 0,
        bestRound      = 0,
        unlocks        = {},
    }
end

function M.createGameState(seed)
    return {
        phase = M.PHASE.IDLE,
        seed  = seed,
        run   = nil,
        meta  = M.createMetaState(),
    }
end

function M.createRunState()
    local wheel = {}
    for i = 1, BALANCE.INITIAL_SEGMENTS do
        wheel[i] = {
            id        = M.uid('seg'),
            weight    = 1,
            modifiers = {},
        }
    end

    return {
        round = 1,
        score = 0,

        wheel = wheel,

        ballsLeft   = BALANCE.BALLS_PER_ROUND,
        spinResults = {},   -- entries: { segmentIndex, segment, value, ballType, tickets, isGold }

        -- Economy
        shopCurrency = 0,
        shopOfferings = {},
        rerollCount   = 0,
        shopDiscount  = 0,

        relics = {},
        purchasedUpgrades = {},

        specialBalls       = {},
        _specialBallsFired = 0,

        genericBallsBought = 0,

        currentChoices  = {},
        lastRoundResult = nil,

        corruption = BALANCE.CORRUPTION_START,
    }
end

return M
