--[[
    Game — root state manager
]]

local Game = {}
Game.__index = Game

setmetatable(Game, {
    __call = function(cls, ...)
        local self = setmetatable({}, cls)
        self:new(...)
        return self
    end,
})

function Game:new()
    self.state = "hub"       -- hub | spin | shop | bonus | gameover | victory
    self.round = 1
    self.score = 0
    self.golds = 0
    self.tickets = 0

    -- canvas for pixel-perfect scaling
    self.canvas = love.graphics.newCanvas(480, 640)
    self.scale = 1
    self.offsetX = 0
    self.offsetY = 0
end

function Game:load()
    self:resize(love.graphics.getDimensions())
end

function Game:update(dt)
end

function Game:draw()
    -- draw game to internal canvas
    love.graphics.setCanvas(self.canvas)
    love.graphics.clear(0.05, 0.05, 0.1, 1)

    love.graphics.setColor(1, 1, 1)
    love.graphics.printf("SPINFORGE", 0, 280, 480, "center")
    love.graphics.printf("State: " .. self.state, 0, 310, 480, "center")

    love.graphics.setCanvas()

    -- render scaled canvas to screen
    love.graphics.setColor(1, 1, 1)
    love.graphics.draw(self.canvas, self.offsetX, self.offsetY, 0, self.scale, self.scale)
end

function Game:keypressed(key)
end

function Game:mousepressed(x, y, button)
end

function Game:mousereleased(x, y, button)
end

function Game:resize(w, h)
    local scaleX = w / 480
    local scaleY = h / 640
    self.scale = math.min(scaleX, scaleY)
    self.offsetX = (w - 480 * self.scale) / 2
    self.offsetY = (h - 640 * self.scale) / 2
end

return Game
