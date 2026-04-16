--[[
    MetaSystem — persistent unlocks & ticket economy.
    Port of legacy/src/systems/MetaSystem.js
]]

local META_UNLOCKS = {
    { id = 'unlock_relic_pool_1', name = 'Reliques +', cost = 50, desc = 'Débloque plus de reliques' },
    { id = 'unlock_starting_gold', name = 'Départ Riche', cost = 30, desc = '+5 gold au démarrage' },
    { id = 'unlock_extra_reroll', name = 'Reroll Bonus', cost = 40, desc = '+1 reroll gratuit par shop' },
}

local Meta = {}
Meta.__index = Meta

function Meta.new(events)
    return setmetatable({ _events = events }, Meta)
end

function Meta:addTickets(meta, amount)
    meta.tickets = meta.tickets + amount
    meta.totalTickets = meta.totalTickets + amount
    if self._events then self._events:emit('meta:tickets_added', { amount = amount, total = meta.tickets }) end
    return meta.tickets
end

function Meta:spendTickets(meta, amount)
    if meta.tickets < amount then return false end
    meta.tickets = meta.tickets - amount
    return true
end

function Meta:unlock(meta, unlockId)
    for _, u in ipairs(meta.unlocks) do
        if u == unlockId then return false end
    end
    local def
    for _, d in ipairs(META_UNLOCKS) do
        if d.id == unlockId then def = d; break end
    end
    if not def then return false end
    if meta.tickets < def.cost then return false end
    meta.tickets = meta.tickets - def.cost
    table.insert(meta.unlocks, unlockId)
    if self._events then self._events:emit('meta:unlocked', { unlockId = unlockId }) end
    return true
end

function Meta:hasUnlock(meta, unlockId)
    for _, u in ipairs(meta.unlocks) do
        if u == unlockId then return true end
    end
    return false
end

function Meta:getAvailableUnlocks(meta)
    local out = {}
    for _, d in ipairs(META_UNLOCKS) do
        local owned = self:hasUnlock(meta, d.id)
        out[#out+1] = {
            id = d.id, name = d.name, cost = d.cost, desc = d.desc,
            owned = owned, affordable = meta.tickets >= d.cost,
        }
    end
    return out
end

function Meta:recordRunComplete(meta, round)
    meta.runsCompleted = meta.runsCompleted + 1
    if round > meta.bestRound then meta.bestRound = round end
end

return setmetatable({ META_UNLOCKS = META_UNLOCKS, Meta = Meta }, {
    __call = function(_, ...) return Meta.new(...) end,
    __index = Meta,
})
