-- scenes/results.lua — RESULTS phase: interaction screen after spin, click/key to proceed.

local C = require('src.game.constants')
local PAL = C.PAL

local R = {}
R.__index = R
function R.new() return setmetatable({ _t = 0, _ready = false }, R) end

local function pickMessage(gold, quota, won)
    if not won then
        local ratio = gold / math.max(1, quota)
        if ratio >= 0.9 then return "SO CLOSE!"
        elseif ratio >= 0.6 then return "NOT BAD..."
        else return "TOUGH ROUND" end
    end
    local surplus = gold - quota
    local ratio = surplus / math.max(1, quota)
    if ratio >= 1.0 then return "INCREDIBLE!"
    elseif ratio >= 0.5 then return "AMAZING!"
    elseif ratio >= 0.2 then return "WELL DONE!"
    elseif surplus > 0 then return "CLOSE ONE!"
    else return "JUST ENOUGH!" end
end

function R:enter(game)
    self.game = game
    self._t = 0
    self._ready = false
    self._gold = game.engine:gold()
    self._quota = game.engine:quota()
    self._won = game.engine:wonRound()
    self._msg = pickMessage(self._gold, self._quota, self._won)

    if self._won then
        game._kernel:emit('audio.tone', { freq = 660, duration = 0.12, wave = 'square', vol = 0.06 })
        game._kernel:emit('audio.tone', { freq = 880, duration = 0.12, wave = 'square', vol = 0.06 })
        game._kernel:emit('audio.tone', { freq = 1100, duration = 0.15, wave = 'sine', vol = 0.08 })
        game:_shakeStart(3, 0.4)
    end

    game:_queueEvent({ delay = 0.6, func = function()
        self._ready = true
        return true
    end })
end

function R:_advance()
    if not self._ready then return end
    if self._advanced then return end
    self._advanced = true
    local game = self.game

    if not self._won then return end

    local round = game.engine:round()
    if round >= game.engine:roundsPerRun() then
        game:_playSongForPhase('VICTORY')
        game:_switchScene('VICTORY')
        return
    end

    game.engine:advanceRound()
    game.engine:dealApply()
    game.engine:clearEvents()
    game.engine:shopGenerate()
    game:_syncWheel()
    game:_playSongForPhase('SHOP')
    game:_switchScene('SHOP')
end

function R:leave() end
function R:update(dt) self._t = self._t + dt end
function R:mouse(x, y) end

function R:click(x, y) self:_advance() end

function R:key(k)
    if k == 'space' or k == 'return' then self:_advance() end
end

function R:draw(g, font, atlas)
    local a = math.min(1, self._t * 3)

    local col = self._won and { 0.83, 0.65, 0.13, a } or { 0.80, 0.13, 0.20, a }
    font:drawCentered(self._msg, 240, 232, col, 2)

    local surplus = self._gold - self._quota
    if surplus > 0 then
        font:drawCentered('SURPLUS +' .. surplus, 240, 250, { 0.91, 0.88, 0.82, a }, 1)
    elseif self._won then
        font:drawCentered('QUOTA MET', 240, 250, { 0.91, 0.88, 0.82, a }, 1)
    end

    if self._ready then
        local blink = math.floor(self._t * 2.5) % 2 == 0
        if blink then
            font:drawCentered('CLICK TO CONTINUE', 240, 262, { 0.6, 0.6, 0.7, a * 0.8 }, 1)
        end
    end
end

return R
