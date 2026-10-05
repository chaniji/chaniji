-- Canvas board experiment: 3x3 grid of workspaces 1-9.
--   1 2 3
--   4 5 6
--   7 8 9
-- Remove require("hypr.canvas") in hyprland.lua to turn it off.

-- Was: grouped window focus prev/next.
hl.unbind("SUPER + CTRL + LEFT")
hl.unbind("SUPER + CTRL + RIGHT")

o.bind("SUPER + CTRL + LEFT", "Board: move left", "canvas-move left")
o.bind("SUPER + CTRL + RIGHT", "Board: move right", "canvas-move right")
o.bind("SUPER + CTRL + UP", "Board: move up", "canvas-move up")
o.bind("SUPER + CTRL + DOWN", "Board: move down", "canvas-move down")

o.bind("SUPER + CTRL + SHIFT + LEFT", "Board: carry window left", "canvas-move left carry")
o.bind("SUPER + CTRL + SHIFT + RIGHT", "Board: carry window right", "canvas-move right carry")
o.bind("SUPER + CTRL + SHIFT + UP", "Board: carry window up", "canvas-move up carry")
o.bind("SUPER + CTRL + SHIFT + DOWN", "Board: carry window down", "canvas-move down carry")

-- Start in the middle of the board.
hl.workspace_rule({ workspace = "5", monitor = "eDP-1", default = true })
