--[[
    Kernel — central event bus (Symfony-inspired)
    All bundles communicate exclusively through events.
]]

local Kernel = {}
Kernel.__index = Kernel

function Kernel.new()
    local self = setmetatable({}, Kernel)
    self._listeners = {}  -- event_name → { {callback, priority}, ... }
    self._bundles = {}
    self._sorted = {}     -- cache: event_name → sorted list
    self._configs = {}    -- bundle_name → config table
    return self
end

--- Load a config table for a bundle by name.
--- @param name string  bundle identifier (e.g. "display")
--- @param config table
function Kernel:configure(name, config)
    self._configs[name] = config
end

--- Get config for a bundle. Returns empty table if none set.
function Kernel:config(name)
    return self._configs[name] or {}
end

--- Register a bundle. Calls bundle:register(kernel) if available.
function Kernel:addBundle(bundle)
    table.insert(self._bundles, bundle)
    if bundle.register then
        bundle:register(self)
    end
end

--- Subscribe to an event.
--- @param event string
--- @param callback function(data) → data or nil
--- @param priority number (lower = earlier, default 0)
function Kernel:on(event, callback, priority)
    priority = priority or 0
    if not self._listeners[event] then
        self._listeners[event] = {}
    end
    table.insert(self._listeners[event], { fn = callback, pri = priority })
    self._sorted[event] = nil -- invalidate cache
end

--- Emit an event. Listeners are called in priority order (ascending).
--- Returns the (possibly mutated) data table.
function Kernel:emit(event, data)
    data = data or {}
    local list = self._sorted[event]
    if not list then
        local raw = self._listeners[event]
        if not raw then return data end
        -- sort by priority ascending
        list = {}
        for i = 1, #raw do list[i] = raw[i] end
        table.sort(list, function(a, b) return a.pri < b.pri end)
        self._sorted[event] = list
    end
    for i = 1, #list do
        local result = list[i].fn(data)
        if result ~= nil then data = result end
    end
    return data
end

--- Boot all bundles. Calls bundle:boot(kernel, config) if available.
--- Config is looked up by bundle.name or falls back to empty table.
function Kernel:boot()
    for _, bundle in ipairs(self._bundles) do
        if bundle.boot then
            local cfg = self._configs[bundle.name] or {}
            bundle:boot(self, cfg)
        end
    end
    self:emit('kernel.boot')
end

--- Forward Love2D lifecycle events
function Kernel:update(dt)
    self:emit('kernel.update', { dt = dt })
end

function Kernel:draw()
    self:emit('kernel.draw')
end

function Kernel:keypressed(key)
    self:emit('input.keypressed', { key = key })
end

function Kernel:mousepressed(x, y, button)
    self:emit('input.mousepressed', { x = x, y = y, button = button })
end

function Kernel:mousereleased(x, y, button)
    self:emit('input.mousereleased', { x = x, y = y, button = button })
end

function Kernel:resize(w, h)
    self:emit('kernel.resize', { w = w, h = h })
end

return Kernel
