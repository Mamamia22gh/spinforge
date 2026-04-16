--[[
    Lightweight EventBus for game logic (distinct from the kernel bundle bus).
]]
local EB = {}
EB.__index = EB

function EB.new()
    return setmetatable({ _l = {} }, EB)
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

function EB:emit(event, data)
    local list = self._l[event]; if not list then return end
    for _, fn in ipairs(list) do fn(data) end
end

function EB:once(event, fn)
    local wrap
    wrap = function(d) self:off(event, wrap); fn(d) end
    self:on(event, wrap)
end

return EB
