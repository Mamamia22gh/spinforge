function love.conf(t)
    t.identity = "spinforge"
    t.version  = "11.5"

    t.window.title  = "SpinForge"
    t.window.width  = 480
    t.window.height = 640
    t.window.vsync  = 1
    t.window.resizable = true
    t.window.minwidth  = 480
    t.window.minheight = 640

    t.modules.joystick = false
    t.modules.physics  = false
    t.modules.video    = false
end
