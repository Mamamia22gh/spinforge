-- scenes/results.lua — RESULTS phase: brief banner, then advance to shop.

local C = require('src.game.constants')
local PAL = C.PAL

local R = {}
R.__index = R
function R.new() return setmetatable({ _t = 0 }, R) end

function R:enter(game)
    self.game = game
    self._t = 0
    self._gold = game.engine:gold()
    self._quota = game.engine:quota()
    self._won = game.engine:wonRound()

    if self._won then
        game._kernel:emit('audio.tone', { freq = 660, duration = 0.12, wave = 'square', vol = 0.06 })
        game._kernel:emit('audio.tone', { freq = 880, duration = 0.12, wave = 'square', vol = 0.06 })
        game._kernel:emit('audio.tone', { freq = 1100, duration = 0.15, wave = 'sine', vol = 0.08 })
        game:_shakeStart(3, 0.4)
    end

    game:_queueEvent({ delay = 1.6, func = function()
        self:_advance()
        return true
    end })
end

function R:_advance()
    local game = self.game
    if not self._won then return end
    local round = game.engine:round()
    if round >= game.engine:roundsPerRun() then
        game:_playSongForPhase('VICTORY')
        game:_switchScene('VICTORY')
    else
        game.engine:advanceRound()
        game.engine:shopGenerate()
        game:_syncWheel()
        game:_playSongForPhase('SHOP')
        game:_switchScene('SHOP')
    end
end

function R:leave() end
function R:update(dt) self._t = self._t + dt end
function R:mouse(x, y) end
function R:click(x, y) self:_advance() end
function R:key(k) if k == 'space' or k == 'return' then self:_advance() end end

function R:draw(g, font, atlas)
    local banner = self._won and 'ROUND CLEARED' or 'ROUND FAILED'
    local col = self._won and { 0.83, 0.65, 0.13, 1 } or { 0.80, 0.13, 0.20, 1 }
    local a = math.min(1, self._t * 4)
    font:drawCentered(banner, 240, 240, { col[1], col[2], col[3], a }, 2)
    local surplus = self._gold - self._quota
    if surplus > 0 then
        font:drawCentered('SURPLUS +' .. surplus, 240, 256, { 0.91, 0.88, 0.82, a }, 1)
    end
end

return R
