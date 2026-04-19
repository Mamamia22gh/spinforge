--[[
    Meta save/load — uses love.filesystem (replaces localStorage).
]]

local SAVE_FILE = 'meta.save'

local function serialize(t, indent)
    indent = indent or ''
    local parts = {}
    local ni = indent .. '  '
    if #t > 0 or next(t) == nil then
        -- array-like
        for i, v in ipairs(t) do
            parts[#parts+1] = ni .. (type(v) == 'table' and serialize(v, ni)
                or (type(v) == 'string' and string.format('%q', v) or tostring(v)))
        end
        return '{\n' .. table.concat(parts, ',\n') .. '\n' .. indent .. '}'
    end
    for k, v in pairs(t) do
        local key = type(k) == 'string' and ('[' .. string.format('%q', k) .. ']') or '[' .. tostring(k) .. ']'
        local val
        if type(v) == 'table' then val = serialize(v, ni)
        elseif type(v) == 'string' then val = string.format('%q', v)
        else val = tostring(v) end
        parts[#parts+1] = ni .. key .. ' = ' .. val
    end
    return '{\n' .. table.concat(parts, ',\n') .. '\n' .. indent .. '}'
end

local Save = {}

function Save.save(meta)
    local content = 'return ' .. serialize(meta)
    love.filesystem.write(SAVE_FILE, content)
    return true
end

function Save.load()
    if not love.filesystem.getInfo(SAVE_FILE) then return nil end
    local content = love.filesystem.read(SAVE_FILE)
    local ok, data = pcall(function() return loadstring(content)() end)
    if ok and data then
        data.settings = data.settings or { masterVol = 0.5, bgmVol = 0.6, sfxVol = 0.8, fullscreen = true }
        return data
    end
    return nil
end

function Save.clear()
    if love.filesystem.getInfo(SAVE_FILE) then
        love.filesystem.remove(SAVE_FILE)
    end
end

return Save
