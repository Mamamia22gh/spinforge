-- game/overlays/catalogue.lua — catalogue overlay (simplified, no data deps).

local C = require('src.game.constants')
local PAL = C.PAL

return function(Game)

function Game:_openCatalogue()
    if self._themeMenuOpen then self:_closeThemeMenu() end
    self._catalogueOpen = true
    self._catalogueTab = 0
    self._catalogueScroll = 0
end

function Game:_closeCatalogue()
    self._catalogueOpen = false
end

function Game:_drawCatalogue(g)
    if not self._catalogueOpen then return end
    local font = self._font
    if not font then return end

    local PW, PH = 320, 200
    local PX0 = math.floor((C.W - PW) / 2)
    local PY0 = math.floor((C.H - PH) / 2)

    g:setColor(0, 0, 0, 0.82)
    g:rect('fill', PX0 - 2, PY0 - 2, PW + 4, PH + 4)
    g:setColor(PAL.black[1], PAL.black[2], PAL.black[3], 1)
    g:rect('fill', PX0, PY0, PW, PH)
    g:setColor(PAL.darkGold[1], PAL.darkGold[2], PAL.darkGold[3], 1)
    g:rect('line', PX0, PY0, PW, PH)

    font:drawCentered('CATALOGUE', PX0 + math.floor(PW / 2), PY0 + 8, PAL.gold, 2)
    font:drawCentered('COMING SOON', PX0 + math.floor(PW / 2), PY0 + 90, PAL.midGray, 1)
    font:drawCentered('[ESC] FERMER', PX0 + math.floor(PW / 2), PY0 + PH - 9, PAL.darkGold, 1)
end

function Game:_catalogueClick(x, y)
    local PW, PH = 320, 200
    local PX0 = math.floor((C.W - PW) / 2)
    local PY0 = math.floor((C.H - PH) / 2)
    if x < PX0 or x > PX0 + PW or y < PY0 or y > PY0 + PH then
        self:_closeCatalogue()
    end
end

end
