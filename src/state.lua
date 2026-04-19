--[[
    Game state — ISO with legacy JS GameState.js.
    PHASE enum and state factories.
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
        settings       = { masterVol = 0.5, bgmVol = 0.6, sfxVol = 0.8, fullscreen = true },
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
            symbolId  = nil,
            weight    = 1,
            modifiers = {},
        }
    end

    return {
        round = 1,
        score = 0,

        wheel = wheel,

        ballsLeft   = BALANCE.BALLS_PER_ROUND,
        spinResults = {},

        -- Economy
        shopCurrency   = 0,
        shopOfferings  = {},
        rerollCount    = 0,
        shopDiscount   = 0,

        -- Relics (full objects, not just IDs)
        relics = {},

        -- Purchased upgrades (full objects for display in orbit slots)
        purchasedUpgrades = {},

        -- Special balls queue
        specialBalls       = {},
        _specialBallsFired = 0,

        -- Generic balls bought in shop
        genericBallsBought = 0,

        -- Between-round
        currentChoices  = {},
        lastRoundResult = nil,

        -- Corruption
        corruption = BALANCE.CORRUPTION_START,
    }
end

return M
