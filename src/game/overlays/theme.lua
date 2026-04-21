local C = require('src.game.constants')
local PAL = C.PAL

return function(Game)

function Game:_toggleThemeMenu()
    if self._themeMenuOpen then self:_closeThemeMenu()
    else self:_openThemeMenu() end
end

function Game:_openThemeMenu()
    if self._catalogueOpen then self:_closeCatalogue() end
    self._themeMenuOpen = true
    self._themeMenuHover = nil
end

function Game:_closeThemeMenu()
    self._themeMenuOpen = false
    self._themeMenuHover = nil
end

function Game:_drawThemeMenu(g)
    if not self._themeMenuOpen then return end
    local themes = PAL.getThemeList()
    local curTheme = PAL.getTheme()
    local font = self._font
    local t = self._time or 0

    local cx, cy = C.WHEEL_CX, C.WHEEL_CY
    local menuW, itemH = 100, 14
    local menuH = #themes * itemH + 20
    local mx = math.floor(cx - menuW / 2)
    local my = math.floor(cy - menuH / 2)

    g:setColor(0, 0, 0, 0.7)
    g:rect('fill', mx - 2, my - 2, menuW + 4, menuH + 4)
    g:setColor(PAL.black[1], PAL.black[2], PAL.black[3], 0.95)
    g:rect('fill', mx, my, menuW, menuH)
    g:setColor(PAL.gold[1], PAL.gold[2], PAL.gold[3], 0.8)
    g:rect('line', mx, my, menuW, menuH)

    local cL = 6
    g:setColor(PAL.gold[1], PAL.gold[2], PAL.gold[3], 1)
    g:line(mx, my, mx + cL, my); g:line(mx, my, mx, my + cL)
    g:line(mx + menuW, my, mx + menuW - cL, my); g:line(mx + menuW, my, mx + menuW, my + cL)
    g:line(mx, my + menuH, mx + cL, my + menuH); g:line(mx, my + menuH, mx, my + menuH - cL)
    g:line(mx + menuW, my + menuH, mx + menuW - cL, my + menuH); g:line(mx + menuW, my + menuH, mx + menuW, my + menuH - cL)

    font:drawCentered('THEME', cx, my + 4, PAL.gold, 1)
    local sepY = my + 14
    g:setColor(PAL.darkGold[1], PAL.darkGold[2], PAL.darkGold[3], 0.6)
    g:line(mx + 6, sepY, mx + menuW - 6, sepY)

    local startY = sepY + 3
    for i, th in ipairs(themes) do
        local iy = startY + (i - 1) * itemH
        local isActive = th.id == curTheme
        local isHover = self._themeMenuHover == i
        if isHover then
            g:setColor(PAL.gold[1], PAL.gold[2], PAL.gold[3], 0.12)
            g:rect('fill', mx + 2, iy, menuW - 4, itemH)
        end
        if isActive then
            g:setColor(PAL.gold[1], PAL.gold[2], PAL.gold[3], 0.9 + 0.1 * math.sin(t * 4))
            local dx = mx + 8
            local dcy = iy + itemH / 2
            g:polygon('fill', dx, dcy - 2, dx + 2, dcy, dx, dcy + 2, dx - 2, dcy)
        end
        local col = isActive and PAL.gold or (isHover and PAL.white or PAL.lightGray)
        local label = th.label or th.id
        if #label > 14 then label = label:sub(1, 13) .. '.' end
        font:drawCentered(label, cx, iy + 2, col, 1)
    end
end

function Game:_themeMenuClick(x, y)
    if not self._themeMenuOpen then return false end
    local themes = PAL.getThemeList()
    local cx, cy = C.WHEEL_CX, C.WHEEL_CY
    local menuW, itemH = 100, 14
    local menuH = #themes * itemH + 20
    local mx = math.floor(cx - menuW / 2)
    local my = math.floor(cy - menuH / 2)

    if x < mx or x > mx + menuW or y < my or y > my + menuH then
        self:_closeThemeMenu()
        return true
    end
    local startY = my + 17
    for i, th in ipairs(themes) do
        local iy = startY + (i - 1) * itemH
        if y >= iy and y < iy + itemH then
            PAL.setTheme(th.id)
            self.bg:rebuild()
            self:_applySettings(true)
            self._kernel:emit('audio.sfx', { name = 'select' })
            self:_closeThemeMenu()
            return true
        end
    end
    return true
end

function Game:_themeMenuUpdateHover(x, y)
    if not self._themeMenuOpen then return end
    local themes = PAL.getThemeList()
    local cx, cy = C.WHEEL_CX, C.WHEEL_CY
    local menuW, itemH = 100, 14
    local menuH = #themes * itemH + 20
    local mx = math.floor(cx - menuW / 2)
    local my = math.floor(cy - menuH / 2)
    self._themeMenuHover = nil
    if x < mx or x > mx + menuW or y < my or y > my + menuH then return end
    local startY = my + 17
    for i = 1, #themes do
        local iy = startY + (i - 1) * itemH
        if y >= iy and y < iy + itemH then
            self._themeMenuHover = i
            return
        end
    end
end

end
