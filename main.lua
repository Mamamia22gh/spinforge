--[[
    SpinForge — Mystic roulette roguelike
    Love2D rewrite — event-driven architecture
]]

local Kernel         = require("src.kernel")
local DisplayBundle  = require("bundles.display")
local AudioBundle    = require("bundles.audio")
local SpriteBundle   = require("bundles.sprite")
local Game           = require("src.game")

local kernel

function love.load()
    love.graphics.setDefaultFilter("nearest", "nearest")
    love.graphics.setLineStyle("rough")

    kernel = Kernel.new()

    -- Load bundle configurations
    kernel:configure("display", require("config.display"))
    kernel:configure("audio",   require("config.audio"))
    kernel:configure("sprite",  require("config.sprite"))

    kernel:addBundle(DisplayBundle.new())
    kernel:addBundle(AudioBundle.new())
    kernel:addBundle(SpriteBundle.new())
    kernel:addBundle(Game.new())
    kernel:boot()
end

function love.update(dt)
    kernel:update(dt)
end

function love.draw()
    kernel:draw()
end

function love.keypressed(key)
    if key == "escape" then love.event.quit() end
    kernel:keypressed(key)
end

function love.mousepressed(x, y, button)
    kernel:mousepressed(x, y, button)
end

function love.mousereleased(x, y, button)
    kernel:mousereleased(x, y, button)
end

function love.resize(w, h)
    kernel:resize(w, h)
end
