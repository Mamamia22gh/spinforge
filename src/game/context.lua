local C = require('src.game.constants')

return function(g, kernel)
    local ctx = {
        kernel = kernel, loop = g.loop, em = g.em,
        wheel = g.wheel, bg = g.bg, game = g,
    }
    function ctx:restart() g:restart() end
    function ctx:mouseNorm() return g._mnx, g._mny end
    function ctx:mousePos() return g._mx, g._my end
    function ctx:pop(t, x, y, o) g:_pop(t, x, y, o) end
    function ctx:shake(i, d) g:_shakeStart(i, d) end
    function ctx:triggerSweep() g._sweepTrigger = g._time end
    function ctx:openCatalogue() g:_openCatalogue() end
    function ctx:playSelect() kernel:emit('audio.sfx', { name = 'select' }) end
    function ctx:playHover() kernel:emit('audio.tone', { freq = 1100, duration = 0.03, wave = 'sine', vol = 0.03 }) end
    ctx._startSpin = function() g.loop:beginSpinning() end
    return ctx
end
