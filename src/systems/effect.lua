--[[
    EffectSystem — ISO with legacy JS EffectSystem.js.
    Computes {setBaseValue, addEven, addOdd} from relic effects arrays.
    Relics in run.relics are full relic objects (not IDs).
]]

local DEFAULT_MODS = {
    setBaseValue = nil,   -- if non-nil, replaces (segmentIndex + 1) as base value
    addEven = 0,          -- flat bonus added to even-valued segments
    addOdd  = 0,          -- flat bonus added to odd-valued segments
}

local Effect = {}

--- Compute all modifiers from relics array (full objects with .effects).
--- @param relics table[]  array of relic objects
--- @return table mods {setBaseValue, addEven, addOdd}
function Effect.compute(relics)
    if not relics or #relics == 0 then
        return { setBaseValue = nil, addEven = 0, addOdd = 0 }
    end

    local base = { setBaseValue = nil, addEven = 0, addOdd = 0 }

    for _, relic in ipairs(relics) do
        if relic.effects then
            for _, eff in ipairs(relic.effects) do
                if eff.metaLevel == 0 then
                    if eff.type == 'set_base_value' then
                        if base.setBaseValue == nil then
                            base.setBaseValue = eff.value
                        else
                            base.setBaseValue = math.max(base.setBaseValue, eff.value)
                        end
                    elseif eff.type == 'add_even_segments' then
                        base.addEven = base.addEven + eff.value
                    elseif eff.type == 'add_odd_segments' then
                        base.addOdd = base.addOdd + eff.value
                    end
                end
            end
        end
    end

    return base
end

return Effect
