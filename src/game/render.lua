-- game/render.lua — main draw pipeline.

local C = require('src.game.constants')
local PAL = C.PAL

return function(Game)

function Game:_bindRender(kernel)
    kernel:on('display.draw.main', function(d)
        if not self.scene or not self._font then return end
        local g = d.g

        g:push()
        g:translate(self._shake.x, self._shake.y)

        local px, py = self._mnx, self._mny
        local wheelOx, wheelOy = px * 1.5, py * 1.0
        local periOx, periOy = px * 2.0, py * 2.0
        local bgOx, bgOy = px * 3.0, py * 2.5
        local uiOx, uiOy = px * 3.0, py * 2.5
        local hudOx, hudOy = px * 4.5, py * 3.0
        local hubBtnOx, hubBtnOy = px * 1.7, py * 1.1

        self.bg:draw(g, self._font, self._atlas, bgOx, bgOy)
        if self.scene.drawUnder then self.scene:drawUnder(g, self._font, self._atlas) end

        local drawWheel = self.scene.drawWheel
        if drawWheel == nil then drawWheel = true end
        if drawWheel then
            self.wheel:draw(g, self._font, self._atlas,
                C.WHEEL_CX + wheelOx, C.WHEEL_CY + wheelOy,
                periOx - wheelOx, periOy - wheelOy)
            g:setColor(PAL.midGray[1], PAL.midGray[2], PAL.midGray[3], 0.9)
            g:circle('line', C.WHEEL_CX + uiOx, C.WHEEL_CY + uiOy, C.UI_RING_R)
        end

        self:_drawTitle(g, hudOx, hudOy)
        self._font:draw('v0', C.W - 14, C.H - 8, PAL.lightGray, 1)

        if drawWheel then
            self.wheel:drawGoldAnims(g, self._font, self._atlas, C.WHEEL_CX + wheelOx, C.WHEEL_CY + wheelOy)
            self.wheel:drawTicketFlyAnims(g, self._font, self._atlas, C.WHEEL_CX + wheelOx, C.WHEEL_CY + wheelOy)
        end
        self:_drawPops(g)

        if drawWheel and not self.wheel:isFlipped() then
            if self._phase == 'GAME_OVER' then self:_drawGameOverHub(g, hubBtnOx, hubBtnOy)
            else self:_drawHubPrompt(g, hubBtnOx, hubBtnOy) end
        end

        if drawWheel then
            self.wheel:drawGoldQuotaAnim(g, self._font, self._atlas, C.WHEEL_CX + wheelOx, C.WHEEL_CY + wheelOy)
            self.wheel:drawTicketAnim(g, self._font, self._atlas, C.WHEEL_CX + wheelOx, C.WHEEL_CY + wheelOy)
        end

        self.scene:draw(g, self._font, self._atlas)
        g:pop()

        if self._flash > 0 then
            local a = math.min(1, self._flash / 0.15)
            if not self._invertShader then
                self._invertShader = love.graphics.newShader[[
                    vec4 effect(vec4 color, Image tex, vec2 tc, vec2 sc) {
                        vec4 pixel = Texel(tex, tc);
                        return vec4(vec3(1.0) - pixel.rgb, pixel.a) * color;
                    }
                ]]
            end
            local canvas = love.graphics.getCanvas()
            if canvas then
                local cw, ch = canvas:getDimensions()
                if not self._invertSnap or self._invertSnap:getWidth() ~= cw or self._invertSnap:getHeight() ~= ch then
                    if self._invertSnap then self._invertSnap:release() end
                    self._invertSnap = love.graphics.newCanvas(cw, ch)
                end
                love.graphics.push('all')
                love.graphics.origin()
                love.graphics.setCanvas(self._invertSnap)
                love.graphics.clear(0, 0, 0, 0)
                love.graphics.setColor(1, 1, 1, 1)
                love.graphics.setBlendMode('alpha')
                love.graphics.draw(canvas, 0, 0)
                love.graphics.setCanvas(canvas)
                love.graphics.setShader(self._invertShader)
                love.graphics.setColor(1, 1, 1, a)
                love.graphics.draw(self._invertSnap, 0, 0)
                love.graphics.pop()
            end
        end
    end, 0)

    kernel:on('display.draw.ui', function(d)
        if not self._font then return end
        local g = d.g
        local drawWheel = not self.scene or self.scene.drawWheel
        if drawWheel == nil then drawWheel = true end
        if drawWheel and self._introDone then
            local px, py = self._mnx, self._mny
            local wheelOx, wheelOy = px * 1.5, py * 1.0
            local periOx, periOy = px * 2.0, py * 2.0
            g:push()
            g:translate(self._shake.x, self._shake.y)
            self.wheel:drawBalls(g, self._atlas, C.WHEEL_CX + wheelOx, C.WHEEL_CY + wheelOy,
                periOx - wheelOx, periOy - wheelOy)
            self.wheel:drawLabels(g, self._font, C.WHEEL_CX + wheelOx, C.WHEEL_CY + wheelOy)
            g:pop()
        end
        self:_drawCatalogue(g)
        self:_drawThemeMenu(g)
        self:_drawCursor(g)
    end, 0)

    kernel:on('display.draw.lights', function(d)
        local L = d.g
        if self._phase == 'IDLE' then
            local raw = math.sin(self._time * 3)
            local stepped = math.floor(raw * 4) / 4
            local pulse = 0.12 + 0.08 * stepped
            L:glow(C.WHEEL_CX, C.WHEEL_CY, 65, 0.83, 0.65, 0.13, pulse)
        end
        L:glow(self._mx, self._my, 60, 0.83, 0.65, 0.13, 0.05)
        for _, l in ipairs(self.wheel._frameLights or {}) do
            local c = l.color or {1,1,1,1}
            L:glow(l.x + C.WHEEL_CX, l.y + C.WHEEL_CY, l.r or 8, c[1], c[2], c[3], l.a or 0.2)
        end
    end, 0)
end

end
