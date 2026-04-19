--[[
    Lightweight EventBus for game logic (distinct from the kernel bundle bus).

    ISO with legacy EventBus.js: re-entrant safe via dispatch flag + FIFO queue.
    Events emitted INSIDE a listener are queued and dispatched AFTER current
    dispatch completes — preserves emission order and prevents listeners from
    seeing stale state.
]]
local EB = {}
EB.__index = EB

function EB.new()
    return setmetatable({
        _l = {},
        _dispatching = false,
        _queue = {},
    }, EB)
end

function EB:on(event, fn)
    self._l[event] = self._l[event] or {}
    table.insert(self._l[event], fn)
    return fn
end

function EB:off(event, fn)
    local list = self._l[event]; if not list then return end
    for i = #list, 1, -1 do
        if list[i] == fn then table.remove(list, i) end
    end
end

function EB:_dispatch(event, data)
    local list = self._l[event]; if not list then return end
    -- snapshot to allow off() during dispatch
    local snap = {}
    for i = 1, #list do snap[i] = list[i] end
    for i = 1, #snap do snap[i](data) end
end

function EB:emit(event, data)
    if self._dispatching then
        self._queue[#self._queue + 1] = { event = event, data = data }
        return
    end
    self._dispatching = true
    local ok, err = pcall(self._dispatch, self, event, data)
    while #self._queue > 0 do
        local q = table.remove(self._queue, 1)
        local ok2, err2 = pcall(self._dispatch, self, q.event, q.data)
        if not ok2 then
            self._dispatching = false
            error(err2)
        end
    end
    self._dispatching = false
    if not ok then error(err) end
end

function EB:once(event, fn)
    local wrap
    wrap = function(d) self:off(event, wrap); fn(d) end
    self:on(event, wrap)
end

function EB:removeAll(event)
    if event then self._l[event] = nil else self._l = {} end
end

function EB:listenerCount(event)
    local list = self._l[event]
    return list and #list or 0
end

return EB
