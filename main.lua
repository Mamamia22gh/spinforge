--[[
    SpinForge — Mystic roulette roguelike
    Love2D rewrite — event-driven architecture
]]

local Kernel         = require("src.kernel")
local DisplayBundle  = require("bundles.display")
local AudioBundle    = require("bundles.audio")
local SpriteBundle   = require("bundles.sprite")
local IntroBundle    = require("bundles.intro")
local Game           = require("src.game")

local kernel

function love.errorhandler(msg)
    local trace = debug.traceback(tostring(msg), 2)
    pcall(function() love.filesystem.write('error.log', trace) end)

    return function()
        if love.event then
            love.event.pump()
            for name in love.event.poll() do
                if name == "quit" then return 1 end
            end
        end
        if love.graphics and love.graphics.isActive() then
            love.graphics.origin()
            love.graphics.clear(0.06, 0.06, 0.06, 1)
            love.graphics.setColor(1, 1, 1, 1)
            local safe = trace:gsub('[\x80-\xff]+', '?')
            love.graphics.printf(safe, 10, 10, love.graphics.getWidth() - 20)
            love.graphics.present()
        end
        if love.timer then love.timer.sleep(0.1) end
    end
end

function love.load()
    love.graphics.setDefaultFilter("nearest", "nearest")
    love.graphics.setLineStyle("rough")

    love.mouse.setVisible(false)

    kernel = Kernel.new()
    kernel:configure("display", require("config.display"))
    kernel:configure("audio",   require("config.audio"))
    kernel:configure("sprite",  require("config.sprite"))

    kernel:addBundle(DisplayBundle.new())
    kernel:addBundle(AudioBundle.new())
    kernel:addBundle(SpriteBundle.new())
    kernel:addBundle(Game.new())
    kernel:addBundle(IntroBundle.new())
    kernel:boot()
end

function love.update(dt)           kernel:update(dt)            end
function love.draw()               kernel:draw()                end
function love.keypressed(k)        kernel:keypressed(k) end
function love.mousepressed(x,y,b)  kernel:mousepressed(x,y,b)   end
function love.mousereleased(x,y,b) kernel:mousereleased(x,y,b)  end
function love.wheelmoved(x,y)      kernel:wheelmoved(x,y)       end
function love.resize(w,h)          kernel:resize(w,h)           end
