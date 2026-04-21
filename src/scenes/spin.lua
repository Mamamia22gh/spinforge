-- scenes/spin.lua — SPINNING phase: drives wheel spin + ball ejection, event-driven.

local C = require('src.game.constants')
local EV = C.EVENT

local Spin = {}
Spin.__index = Spin
function Spin.new() return setmetatable({}, Spin) end

function Spin:enter(game)
    self.game = game
    self._revealIdx = 0
    local w = game.wheel
    local ballCount = game.engine:ballCount()
    w:placeBalls(ballCount, {})

    w.onBallEject = function()
        game._kernel:emit('audio.tone', { freq = 1400 + math.random() * 200, duration = 0.04, wave = 'sine', vol = 0.05 })
        game._kernel:emit('audio.tone', { freq = 900 + math.random() * 200, duration = 0.03, wave = 'square', vol = 0.03 })
    end

    game.engine:clearEvents()

    w:spinAndEject(function(results)
        self:_resolveAll(results)
    end)
    game._kernel:emit('audio.sfx', { name = 'spin' })
    game:_shakeStart(3, 0.5)
end

function Spin:_resolveAll(results)
    local game = self.game

    for i, _wheelIdx in ipairs(results) do
        game:_queueEvent({ delay = (i == 1) and 0.15 or 0.45, blocking = true, func = function()
            if game._phase ~= 'SPINNING' then return true end
            local bi = i - 1
            local segIdx = _wheelIdx
            game.engine:resolveBall(bi, segIdx)
            self._revealIdx = (self._revealIdx or 0) + 1

            local events = game.engine:pollEvents()
            local gained = 0
            local gold = game.engine:gold()
            local quota = game.engine:quota()

            for _, ev in ipairs(events) do
                if ev.kind == EV.BALL_LANDED then
                elseif ev.kind == EV.SEGMENT_SCORED then
                    gained = gained + ev.c
                elseif ev.kind == EV.GOLD_CHANGED then
                    gold = ev.b
                elseif ev.kind == EV.TICKETS_CHANGED then
                    game.wheel:setCounters(gold, ev.b)
                end
            end

            game._kernel:emit('audio.sfx', { name = 'coin' })
            local revNotes = { 523, 587, 659, 784, 880, 1047 }
            local f = revNotes[math.min(self._revealIdx, #revNotes)]
            game._kernel:emit('audio.tone', { freq = f, duration = 0.2, wave = 'square', vol = 0.08 })

            game.wheel:hubSetScore(gold)
            local px, py = game.wheel:getPocketPosition(segIdx, C.WHEEL_CX, C.WHEEL_CY)
            if px then
                game.wheel:highlight(segIdx)
                game.wheel:startGoldFly('+' .. gained, gained, px, py - 15, C.WHEEL_CX, C.WHEEL_CY)
            end
            game:_pop('+' .. gained, px, py and py - 15)
            game:_shakeStart(1.5, 0.2)

            if gold >= quota and (gold - gained) < quota then
                game._flash = 0.3
                game:_shakeStart(5, 0.5)
                game.wheel:setBonusMode(true)
            end
            return true
        end })
    end

    game:_queueEvent({ delay = 0.1, blocking = true, func = function()
        if game.wheel and (#game.wheel._goldAnims > 0 or #game.wheel._ticketFlyAnims > 0) then return false end
        return true
    end })

    game:_queueEvent({ blocking = true, func = function(ev)
        if not ev._started then
            ev._started = true
            game.engine:finishRound()
            local finishEvents = game.engine:pollEvents()
            for _, fe in ipairs(finishEvents) do
                if fe.kind == EV.ROUND_ENDED then
                    ev._won = fe.c == 1
                    ev._quota = fe.b
                end
            end
            local quota = game.engine:quota()
            if quota > 0 then
                game.wheel:startGoldQuotaAnim(quota)
                game:_shakeStart(3, 0.4)
            end
            return false
        end
        if not game.wheel:isGoldQuotaAnimDone() then return false end
        return true
    end })

    game:_queueEvent({ delay = 0.3, blocking = true, func = function()
        if game._phase ~= 'SPINNING' then return true end
        local won = game.engine:wonRound()
        if won then
            game:_playSongForPhase('RESULTS')
            game:_switchScene('RESULTS')
        else
            game:_playSongForPhase('GAME_OVER')
            game:_switchScene('GAME_OVER')
        end
        return true
    end })
end

function Spin:leave() self.game.wheel.onBallEject = nil end
function Spin:update(dt) end
function Spin:mouse(x, y) end
function Spin:click(x, y) end
function Spin:key(k) end
function Spin:draw(g, font, atlas) end

return Spin
