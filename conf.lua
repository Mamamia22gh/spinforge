function love.conf(t)
    t.identity = "spinforge"
    t.version  = "11.5"

    t.window.title  = "SpinForge"
    t.window.width  = 960
    t.window.height = 540
    t.window.vsync  = 1
    t.window.resizable = true
    t.window.fullscreen = true
    t.window.fullscreentype = "desktop"
    t.window.minwidth  = 480
    t.window.minheight = 270

    t.modules.joystick = false
    t.modules.physics  = false
    t.modules.video    = false
end
