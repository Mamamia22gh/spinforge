--[[ Betting system — port of legacy/src/systems/BettingSystem.js ]]

local Bets    = require("src.data.bets")
local Symbols = require("src.data.symbols")
local BAL     = require("src.data.balance")

local M = {}
M.__index = M

function M.new(events)
    return setmetatable({ events = events }, M)
end

function M:placeBet(run, betTypeId, wager, options)
    options = options or {}
    local betType = Bets.getBetType(betTypeId)

    if wager < BAL.MIN_BET then
        self.events:emit("bet:too_small", { min = BAL.MIN_BET })
        return false
    end
    if wager > run.chips then
        self.events:emit("bet:insufficient_chips", { wager = wager, available = run.chips })
        return false
    end

    run.chips = run.chips - wager

    run.activeBet = {
        typeId      = betTypeId,
        wager       = wager,
        payoutMult  = betType.payout,
        condition   = betType.condition,
        target      = options.target,
        sectorStart = options.sectorStart,
        placedRound = run.round,
    }

    self.events:emit("bet:placed", {
        bet   = run.activeBet,
        chips = run.chips,
    })
    return true
end

function M:cancelBet(run)
    if not run.activeBet then return false end
    run.chips = run.chips + run.activeBet.wager
    local cancelled = run.activeBet
    run.activeBet = nil
    self.events:emit("bet:cancelled", { bet = cancelled, chips = run.chips })
    return true
end

--- Resolve the active bet against the landed segment.
--- @param run table
--- @param segmentIndex number
--- @param rng table (supports :chance(p))
--- @param mods table? optional payout modifier bag
--- @return table? payoutInfo
function M:resolveBet(run, segmentIndex, rng, mods)
    if not run.activeBet then return nil end
    mods = mods or {}
    local bet = run.activeBet
    local won = self:_evaluate(bet, segmentIndex, run, rng)

    local payout = 0
    if won then
        payout = bet.wager * bet.payoutMult
        payout = self:_applyPayoutMods(payout, bet, mods)
        payout = math.floor(payout)
        run.chips = run.chips + payout
    end

    local info = {
        bet      = bet,
        won      = won,
        payout   = payout,
        segment  = segmentIndex,
        chips    = run.chips,
    }
    run.activeBet = nil
    self.events:emit("bet:resolved", info)
    return info
end

function M:_evaluate(bet, segmentIndex, run, rng)
    local landed = run.wheel[segmentIndex + 1] -- wheel is 1-indexed in Lua
    if not landed then return false end

    if bet.condition == "exact" then
        return landed == bet.target
    elseif bet.condition == "color" then
        local sym = Symbols.getSymbol(landed)
        return sym and sym.color == bet.target
    elseif bet.condition == "category" then
        local sym = Symbols.getSymbol(landed)
        return sym and sym.category == bet.target
    elseif bet.condition == "sector" then
        return self:_inSector(segmentIndex, bet.sectorStart, 3, #run.wheel)
    elseif bet.condition == "wildcard" then
        return true
    elseif bet.condition == "chain" then
        return false
    elseif bet.condition == "coin_flip" then
        return rng:chance(0.5)
    end
    return false
end

function M:_inSector(index, start, size, len)
    for i = 0, size - 1 do
        if (start + i) % len == index then return true end
    end
    return false
end

function M:_applyPayoutMods(payout, bet, mods)
    payout = payout * (1 + (mods.allPayoutPercent or 0) / 100)
    if bet.condition == "exact" then
        payout = payout * (1 + (mods.exactPayoutPercent or 0) / 100)
    end
    if bet.condition == "chain" then
        payout = payout * (1 + (mods.chainPayoutPercent or 0) / 100)
    end
    return payout
end

return M
