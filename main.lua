--[[
    SpinForge — Mystic roulette roguelike
    Love2D rewrite
]]

local Game = require("src.game")

local game

function love.load()
    -- pixel-perfect rendering
    love.graphics.setDefaultFilter("nearest", "nearest")
    love.graphics.setLineStyle("rough")

    game = Game()
    game:load()
end

function love.update(dt)
    game:update(dt)
end

function love.draw()
    game:draw()
end

function love.keypressed(key)
    if key == "escape" then
        love.event.quit()
    end
    game:keypressed(key)
end

function love.mousepressed(x, y, button)
    game:mousepressed(x, y, button)
end

function love.mousereleased(x, y, button)
    game:mousereleased(x, y, button)
end

function love.resize(w, h)
    game:resize(w, h)
end
