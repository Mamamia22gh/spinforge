--[[
    EventManager — Balatro-style timed event queue.
    
    Separate from the kernel event bus:
      - Kernel = pub/sub between bundles (synchronous)
      - EventManager = timed async queue (delays, blocking, ordering)
    
    Usage:
        em:add({ trigger = 'after', delay = 0.5, func = function()
            -- do thing, return true when complete
            return true
        end })
    
    trigger:
        'immediate' — runs next update
        'after'     — waits `delay` seconds BEFORE running
        'before'    — runs first, blocks its queue until done
    
    blocking (default true): if true, the queue waits for func() → true
    before processing the next event.
    
    Queues: named strings ('base', 'tutorial', ...). Queues run in parallel.
]]

local EM = {}
EM.__index = EM

function EM.new()
    return setmetatable({
        _queues = {},   -- name → list of events
        _time   = 0,
    }, EM)
end

function EM:add(ev, queueName)
    queueName = queueName or 'base'
    ev.trigger   = ev.trigger or 'immediate'
    ev.delay     = ev.delay or 0
    if ev.blocking == nil then ev.blocking = true end
    ev._elapsed  = 0
    ev._started  = false
    ev._done     = false

    local q = self._queues[queueName]
    if not q then
        q = {}
        self._queues[queueName] = q
    end

    if ev.trigger == 'before' then
        table.insert(q, 1, ev)
    else
        table.insert(q, ev)
    end
    return ev
end

function EM:clear(queueName)
    if queueName then
        self._queues[queueName] = {}
    else
        self._queues = {}
    end
end

function EM:update(dt)
    self._time = self._time + dt
    for _, q in pairs(self._queues) do
        local i = 1
        while i <= #q do
            local ev = q[i]
            ev._elapsed = ev._elapsed + dt

            if ev.trigger == 'after' and ev._elapsed < ev.delay then
                if ev.blocking then break end
                i = i + 1
            else
                if not ev._started then
                    ev._started = true
                    if ev.onStart then ev.onStart() end
                end

                local result = true
                if ev.func then
                    result = ev.func(ev, dt)
                end

                if result == true then
                    ev._done = true
                    if ev.onEnd then ev.onEnd() end
                    table.remove(q, i)
                    -- do not increment i; next event now at same position
                else
                    if ev.blocking then break end
                    i = i + 1
                end
            end
        end
    end
end

function EM:busy(queueName)
    local q = self._queues[queueName or 'base']
    return q and #q > 0
end

return EM
