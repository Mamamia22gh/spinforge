--[[
    ScoringSystem — evaluate a round's results.
    Evaluates a completed round against its quota and computes payouts.
]]

local BAL = require('src.data.balance')
local BALANCE, getQuota = BAL.BALANCE, BAL.getQuota

local Scoring = {}
Scoring.__index = Scoring

function Scoring.new(events)
    return setmetatable({ _events = events }, Scoring)
end

function Scoring:evaluateRound(run)
    local totalWon = run.score
    local quota    = getQuota(run.round)
    local passed   = totalWon >= quota
    local surplus  = math.max(0, totalWon - quota)
    local shopCoins = math.floor(surplus / BALANCE.SURPLUS_CONVERSION_RATE)
    return { totalWon = totalWon, quota = quota, passed = passed, surplus = surplus, shopCoins = shopCoins }
end

return Scoring
