local C = require('src.game.constants')

return function(Game)

function Game:_bindInput(kernel)
    kernel:on('display.click', function(d)
        if d._handled then return end
        if self._themeMenuOpen and self:_themeMenuClick(d.x, d.y) then return end
        if self._debugSpritesOpen then self._debugSpritesOpen = false; return end
        if self._catalogueOpen then self:_catalogueClick(d.x, d.y); return end

        if self._inSettings then
            if self.wheel._flip then return end
            local hit = self.wheel:settingsHitTest(d.x, d.y, C.WHEEL_CX, C.WHEEL_CY)
            if not hit then return end
            if hit.type == 'close' then
                self._kernel:emit('audio.sfx', { name = 'select' })
                self:_closeSettings()
            elseif hit.type == 'toggle' then
                self._kernel:emit('audio.sfx', { name = 'select' })
                self.wheel:settingsToggleFullscreen()
                self:_applySettings(false)
            elseif hit.type == 'slider' then
                self._kernel:emit('audio.tone', { freq = 1400, duration = 0.04, wave = 'square', vol = 0.05 })
                self._settingsDrag = hit.id
                self.wheel:settingsSetDragging(hit.id)
                self.wheel:settingsSetSlider(hit.id, hit.value)
                self:_applySettings(false)
            end
            return
        end

        local menu = self.bg:hitTest(d.x, d.y)
        if menu then
            self._kernel:emit('audio.sfx', { name = 'select' })
            if menu == 'exit' then love.event.quit()
            elseif menu == 'retry' then self:restart()
            elseif menu == 'catalogue' then self:_openCatalogue()
            elseif menu == 'settings' then self:_openSettings()
            elseif menu == 'theme' then self:_toggleThemeMenu() end
            return
        end
        if self.scene and self.scene.click then self.scene:click(d.x, d.y) end
    end)

    kernel:on('display.release', function(d)
        if self._settingsDrag then
            self._settingsDrag = nil
            self.wheel:settingsSetDragging(nil)
            self:_applySettings(true)
        end
    end)

    kernel:on('display.mouse', function(d)
        self._mx, self._my = d.x, d.y
        self._mnx = (d.x - C.W / 2) / (C.W / 2)
        self._mny = (d.y - C.H / 2) / (C.H / 2)
        if self._mnx < -1 then self._mnx = -1 elseif self._mnx > 1 then self._mnx = 1 end
        if self._mny < -1 then self._mny = -1 elseif self._mny > 1 then self._mny = 1 end
        if self._themeMenuOpen then self:_themeMenuUpdateHover(d.x, d.y) end
    end)

    kernel:on('input.keypressed', function(d)
        if d.key == 'escape' then
            if self._debugSpritesOpen then self._debugSpritesOpen = false; return end
            if self._themeMenuOpen then self:_closeThemeMenu(); return end
            if self._catalogueOpen then self:_closeCatalogue(); return end
            if self._inSettings then self:_closeSettings(); return end
            love.event.quit()
            return
        end
        if self._catalogueOpen or self._themeMenuOpen or self._debugSpritesOpen or self._inSettings then return end
        if self.scene and self.scene.key then self.scene:key(d.key) end
    end)

    kernel:on('input.wheelmoved', function(d)
        local dir = (d.y and d.y < 0) and 1 or ((d.y and d.y > 0) and -1 or 0)
        if self._debugSpritesOpen then self._debugScroll = math.max(0, self._debugScroll + dir); return end
        if self._catalogueOpen then self._catalogueScroll = math.max(0, self._catalogueScroll + dir); return end
    end)
end

function Game:_updateHoverState(dt)
    if self._flash > 0 then
        self._flash = self._flash - dt
        if self._flash < 0 then self._flash = 0 end
    end

    if self._shake.intensity > 0 then
        self._shake.time = self._shake.time + dt
        local t = math.min(1, self._shake.time / self._shake.decay)
        local amp = self._shake.intensity * (1 - t)
        self._shake.x = (math.random() - 0.5) * 2 * amp
        self._shake.y = (math.random() - 0.5) * 2 * amp
        if t >= 1 then self._shake.intensity = 0; self._shake.x, self._shake.y = 0, 0 end
    end

    for i = #self._pops, 1, -1 do
        self._pops[i].age = self._pops[i].age + dt
        self._pops[i].y = self._pops[i].y - dt * 25
        if self._pops[i].age > 1.5 then table.remove(self._pops, i) end
    end

    local busy = (self.loop.state.phase ~= 'IDLE') or (self.wheel._flip ~= nil) or self._inSettings
    local tilt = self.wheel:getTilt()
    local dx = self._mx - C.WHEEL_CX
    local dy = (self._my - C.WHEEL_CY) / math.max(0.05, tilt)
    local r = self.wheel:getHubRadius()
    local wasHover = self._hubHover
    self._hubHover = not busy and (dx*dx + dy*dy) <= r*r and not self.wheel:isFlipped()
    if self._hubHover and not wasHover then
        self._sweepTrigger = self._time
        self._kernel:emit('audio.tone', { freq = 1100, duration = 0.03, wave = 'sine', vol = 0.03 })
    end

    local oldBgHover = self.bg._hover
    if self._catalogueOpen or self._debugSpritesOpen then self.bg:setHover(nil)
    else self.bg:setHover(self.bg:hitTest(self._mx, self._my)) end
    if self.bg._hover and self.bg._hover ~= oldBgHover then
        self._kernel:emit('audio.tone', { freq = 1100, duration = 0.03, wave = 'sine', vol = 0.03 })
    end

    local oldRelicHover = self._relicHoverRarity
    if busy or self._catalogueOpen or self._debugSpritesOpen or self._inShop then
        self._relicHoverRarity = nil
    else self._relicHoverRarity = self:_relicBarHitTest(self._mx, self._my) end
    if self._relicHoverRarity and self._relicHoverRarity ~= oldRelicHover then
        self._kernel:emit('audio.tone', { freq = 1100, duration = 0.03, wave = 'sine', vol = 0.03 })
    end

    if self._inSettings and self.wheel:isFlipped() and not self.wheel._flip then
        local hit = self.wheel:settingsHitTest(self._mx, self._my, C.WHEEL_CX, C.WHEEL_CY)
        local hoverId = hit and (hit.id or hit.type) or nil
        if hoverId ~= self._settingsHover then
            if hoverId then
                self._kernel:emit('audio.tone', { freq = 1100, duration = 0.03, wave = 'sine', vol = 0.03 })
            end
            self._settingsHover = hoverId
            self.wheel:settingsSetHover(hoverId)
        end
        if self._settingsDrag and hit and hit.type == 'slider' and hit.id == self._settingsDrag then
            self.wheel:settingsSetSlider(self._settingsDrag, hit.value)
            self:_applySettings(false)
        elseif self._settingsDrag then
            local TILT_Y = math.abs(self.wheel:getTilt())
            if TILT_Y >= 0.05 then
                local dx2 = self._mx - C.WHEEL_CX
                local dy2 = (self._my - C.WHEEL_CY) / TILT_Y
                local a = math.atan2(dy2, dx2)
                local sMap = { master = 1, bgm = 2, sfx = 3 }
                local sIdx = sMap[self._settingsDrag]
                if sIdx then
                    local TWO_PI = math.pi * 2
                    local GAP = 0.10
                    local COUNT = 5
                    local SPAN = (TWO_PI / COUNT) - GAP
                    local a0 = -math.pi/2 + (sIdx - 1) * (TWO_PI / COUNT) + GAP / 2
                    local rel = a - a0
                    if rel < -math.pi then rel = rel + TWO_PI end
                    if rel > math.pi then rel = rel - TWO_PI end
                    self.wheel:settingsSetSlider(self._settingsDrag, math.max(0, math.min(1, rel / SPAN)))
                    self:_applySettings(false)
                end
            end
        end
    end

    self._cursorHover = false
    if self._hubHover then self._cursorHover = true
    elseif self.bg._hover then self._cursorHover = true
    elseif self._relicHoverRarity then self._cursorHover = true
    elseif self._inSettings and self._settingsHover then self._cursorHover = true
    elseif self._inShop and self.wheel._shop and self.wheel._shop.hoverIdx ~= -1 then self._cursorHover = true
    elseif self.loop.state.phase == 'RESULTS' then self._cursorHover = true end
end

end
