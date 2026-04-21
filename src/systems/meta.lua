--[[
    MetaSystem — ISO with legacy JS MetaSystem.js.
]]

local BALANCE = require('src.data.balance').BALANCE

local META_UNLOCKS = {
    { id = 'unlock_coin_flip', name = 'Quitte ou Double',    description = 'Débloque Quitte ou Double',         cost = 7,  category = 'bet' },
    { id = 'unlock_16_seg',    name = 'Grande Roue',        description = 'Roue extensible à 16 segments',     cost = 12, category = 'upgrade' },
    { id = 'unlock_gauge_2',   name = 'Chargeur Supérieur', description = 'Débloque le 2e chargeur de billes', cost = 8,  category = 'upgrade' },
    { id = 'unlock_gauge_3',   name = 'Chargeur Inférieur', description = 'Débloque le 3e chargeur de billes', cost = 15, category = 'upgrade' },
    { id = 'unlock_gauge_4',   name = 'Chargeur Gauche',    description = 'Débloque le 4e chargeur de billes', cost = 25, category = 'upgrade' },
}

local UNLOCK_MAP = {}
for _, u in ipairs(META_UNLOCKS) do UNLOCK_MAP[u.id] = u end

local Meta = {}
Meta.__index = Meta

function Meta.new(events)
    return setmetatable({ _events = events }, Meta)
end

function Meta:calculateTickets(run, won)
    local tickets = run.round * BALANCE.TICKETS_PER_ROUND
    if won then tickets = tickets + BALANCE.TICKETS_BONUS_WIN end
    return tickets
end

function Meta:unlock(meta, unlockId)
    local def = UNLOCK_MAP[unlockId]
    if not def then
        if self._events then self._events:emit('meta:unknown_unlock', { unlockId = unlockId }) end
        return false
    end
    for _, u in ipairs(meta.unlocks) do
        if u == unlockId then
            if self._events then self._events:emit('meta:already_unlocked', { unlockId = unlockId }) end
            return false
        end
    end
    if meta.tickets < def.cost then
        if self._events then self._events:emit('meta:insufficient_tickets', { unlockId = unlockId, cost = def.cost, available = meta.tickets }) end
        return false
    end

    meta.tickets = meta.tickets - def.cost
    table.insert(meta.unlocks, unlockId)
    if self._events then self._events:emit('meta:unlocked', { unlockId = unlockId, name = def.name, remainingTickets = meta.tickets }) end
    return true
end

function Meta:isUnlocked(meta, unlockId)
    for _, u in ipairs(meta.unlocks) do
        if u == unlockId then return true end
    end
    return false
end

function Meta:getAvailableUnlocks(meta)
    local out = {}
    for _, u in ipairs(META_UNLOCKS) do
        local unlocked = self:isUnlocked(meta, u.id)
        out[#out+1] = {
            id = u.id, name = u.name, description = u.description,
            cost = u.cost, category = u.category,
            unlocked = unlocked,
            affordable = meta.tickets >= u.cost,
        }
    end
    return out
end

function Meta:addTickets(meta, amount)
    meta.tickets = meta.tickets + amount
    meta.totalTickets = (meta.totalTickets or 0) + amount
    if self._events then self._events:emit('meta:tickets_added', { amount = amount, total = meta.tickets }) end
end

function Meta:recordRunComplete(meta, round)
    meta.runsCompleted = meta.runsCompleted + 1
    if round > meta.bestRound then meta.bestRound = round end
end

return { META_UNLOCKS = META_UNLOCKS, Meta = Meta }
