-- Adds a genuinely distinct accent (Turbonite's own unused wine/rose
-- cursor hue, #8E3A59) for keywords/conditionals. Omarchy's generated
-- neovim.lua (theme.lua) has no real purple in its palette, so aether.nvim
-- falls back to aliasing purple from magenta -- landing on the same muted
-- sage used everywhere else. This merges on top via lazy's opts function
-- chaining, so it survives `omarchy theme set turbonite` regenerating
-- theme.lua.
return {
	{
		"aether",
		opts = function(_, opts)
			opts.colors = opts.colors or {}
			opts.colors.purple = "#8E3A59"
			opts.colors.bright_purple = "#B5567A"
			return opts
		end,
	},
}
