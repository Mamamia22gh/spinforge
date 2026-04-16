--[[
    BettingSystem — stub. Side-bets not wired into the main loop yet.
]]
local Betting = {}
Betting.__index = Betting
function Betting.new() return setmetatable({}, Betting) end
function Betting:placeBet() return false end
function Betting:resolveBets() end
return Betting
