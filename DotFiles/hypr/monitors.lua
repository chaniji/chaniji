-- See https://wiki.hypr.land/Configuring/Basics/Monitors/
-- List current monitors and supported resolutions with: hyprctl monitors all

local omarchy_gdk_scale = 2
local omarchy_monitor_scale = 2

hl.env("GDK_SCALE", tostring(omarchy_gdk_scale))
hl.monitor({ output = "eDP-1", mode = "1920x1080@120.21", position = "0x0", scale = omarchy_monitor_scale })

-- Configure a specific monitor.
-- hl.monitor({ output = "DP-2", mode = "1920x1080@120.21", position = "0x0", scale = 1 })

-- Portrait/rotated secondary monitor (transform: 1 = 90°, 3 = 270°).
-- hl.monitor({ output = "DP-2", mode = "1920x1080@120.21", position = "auto", scale = 1, transform = 1 })
