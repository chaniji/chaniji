# agent.md

## Sync rule: Omarchy configs → this repo

Whenever I make changes to configs under `~/.config/` on this Omarchy system
(via the omarchy skill or direct edits), copy the latest version into this
repo's `DotFiles/` and commit it. This is the user's change history, since
`~/.config/` itself has no git tracking.

### Tracked folders (live path → repo path)

| Live config | Repo path |
|---|---|
| `~/.config/hypr/` | `DotFiles/hypr/` |
| `~/.config/omarchy/` | `DotFiles/omarchy/` |
| `~/.config/nvim/` | `DotFiles/nvim/` |
| `~/.config/kitty/` | `DotFiles/kitty/` |
| `~/.config/tmux/` | `DotFiles/tmux/` |
| `~/.config/git/` | `DotFiles/git/` |
| `~/.zen/<profile>/user.js` | `DotFiles/zen/user.js` |
| `~/.zen/<profile>/chrome/userChrome.css` | `DotFiles/zen/chrome/userChrome.css` |
| `~/.zen/<profile>/chrome/userContent.css` | `DotFiles/zen/chrome/userContent.css` |

Not tracked: `alacritty`, `foot`, `starship`, `lazydocker`, `lazygit`, `btop`,
`bat` — explicitly excluded, don't re-add without being asked.

### What to exclude when copying

- Any `*.bak*` file or folder — only the latest version goes in, never backups.
- Any nested `.git` directory (e.g. cloned theme repos under
  `omarchy/themes/<name>/`) — these are third-party, not the user's own
  customization. Flag instead of copying.
- Anything not explicitly listed above in the tracked folders table.

### Procedure

1. Copy the changed file(s) from the live path to the matching repo path.
2. `git add` the copied path.
3. Commit with a short, direct message describing what changed (match
   existing commit style, e.g. "Update hypr bindings").

Do this automatically after a config change is made — don't wait to be
asked each time.
