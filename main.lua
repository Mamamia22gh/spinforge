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

function love.errorhandler(msg)
    local trace = debug.traceback(tostring(msg), 2)
    pcall(function() love.filesystem.write('error.log', trace) end)
    love.graphics.setColor(1, 1, 1, 1)
    love.graphics.print(trace, 10, 10)
    return function() if love.event then love.event.pump() end end
end

function love.load()
    love.graphics.setDefaultFilter("nearest", "nearest")
    love.graphics.setLineStyle("rough")

    kernel = Kernel.new()
    kernel:configure("display", require("config.display"))
    kernel:configure("audio",   require("config.audio"))
    kernel:configure("sprite",  require("config.sprite"))

    kernel:addBundle(DisplayBundle.new())
    kernel:addBundle(AudioBundle.new())
    kernel:addBundle(SpriteBundle.new())
    kernel:addBundle(Game.new())
    kernel:boot()
end

function love.update(dt)           kernel:update(dt)            end
function love.draw()               kernel:draw()                end
function love.keypressed(k)        if k == "escape" then love.event.quit() end; kernel:keypressed(k) end
function love.mousepressed(x,y,b)  kernel:mousepressed(x,y,b)   end
function love.mousereleased(x,y,b) kernel:mousereleased(x,y,b)  end
function love.resize(w,h)          kernel:resize(w,h)           end
