-- CRT screen effect: keep it on across reloads (theme change, refresh rate)
-- and across reboots.
-- ~/.local/bin/crt-toggle creates and removes the flag file.
-- Remove require("hypr.crt") in hyprland.lua to turn this off.

local flag = io.open(os.getenv("HOME") .. "/.local/state/crt-effect-on", "r")

if flag then
  flag:close()
  hl.config({
    decoration = { screen_shader = os.getenv("HOME") .. "/.config/hypr/shaders/crt.frag" },
    -- The curve needs a full redraw each frame, or the screen flashes.
    debug = { damage_tracking = 0 },
  })
end
