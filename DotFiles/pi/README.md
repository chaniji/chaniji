# Pi config backup

Restore on a new machine:

```bash
cp -r agent/extensions agent/themes agent/settings.json agent/claude-bridge.json agent/trust.json ~/.pi/agent/
mkdir -p ~/.config/pi && cp config/web-search.json ~/.config/pi/
pi install npm:pi-claude-bridge npm:pi-web-access npm:pi-hermes-memory npm:pi-context-view
```

Packages listed in settings.json are reinstalled by `pi install` (pi-context-view
must stay installed: context-header.ts imports its code).

Not backed up on purpose: auth.json (login), sessions/, npm/, models-store.json,
pi-hermes-memory/ (memory data).

`ideas/` holds parked extensions that are NOT loaded (e.g. prompt-rogue.ts).
To try one: copy it into ~/.pi/agent/extensions/.
