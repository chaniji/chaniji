/**
 * /tools: turn the model's tools on or off from one list.
 *
 *   ╭─ Tools ───────────────────────────────────╮
 *   │ > we                                      │
 *   │                                           │
 *   │ › ✓ web_search    search the web          │
 *   │   ○ memory        save memory             │
 *   │   (1/2) · 9 of 14 on                      │
 *   ╰───────────────────────────────────────────╯
 *
 * Type to search, ↑↓ to move, Space turns the selected tool on/off, Enter
 * saves, Esc cancels. Drawn inside book.ts's page frame like /tree, /model and
 * /skill; inline in the input area when book mode is off.
 */

import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { Key, matchesKey, truncateToWidth } from "@earendil-works/pi-tui";

type BookPanel = { title: string; render: (width: number) => string[] };
const book = globalThis as { __piBookActive?: boolean; __piBookPanel?: BookPanel };

const TITLE = "Tools";

export default function (pi: ExtensionAPI) {
	pi.registerCommand("tools", {
		description: "Turn the model's tools on or off",
		handler: async (_args, ctx) => {
			const tools = pi
				.getAllTools()
				.map((tool) => ({ name: tool.name, description: (tool.description ?? "").split("\n")[0].trim() }))
				.sort((a, b) => a.name.localeCompare(b.name));
			if (tools.length === 0) {
				ctx.ui.notify("No tools found", "info");
				return;
			}
			if (ctx.mode !== "tui") return;

			const active = new Set(pi.getActiveTools());
			const saved = await ctx.ui.custom<boolean>((tui, theme, _keybindings, done) => {
				let query = "";
				let selected = 0;
				const matches = () => {
					const q = query.toLowerCase();
					// Name matches first, then description matches
					const byName = tools.filter((t) => t.name.toLowerCase().includes(q));
					return [...byName, ...tools.filter((t) => !byName.includes(t) && t.description.toLowerCase().includes(q))];
				};

				const lines = (width: number): string[] => {
					const list = matches();
					selected = Math.min(selected, Math.max(0, list.length - 1));
					const nameWidth = Math.max(...tools.map((t) => t.name.length)) + 2;
					const rows = list.map((t, i) => {
						const cursor = i === selected ? theme.fg("accent", "› ") : "  ";
						const on = active.has(t.name);
						const mark = on ? theme.fg("success", "✓ ") : theme.fg("dim", "○ ");
						const label = t.name.padEnd(nameWidth);
						const name = i === selected ? theme.fg("accent", label) : on ? label : theme.fg("dim", label);
						return truncateToWidth(`${cursor}${mark}${name}${theme.fg("dim", t.description)}`, width);
					});
					const count = theme.fg(
						"dim",
						`  (${list.length === 0 ? 0 : selected + 1}/${list.length}) · ${active.size} of ${tools.length} on`,
					);
					// Search, count and keys on top: a long list never pushes them out of the frame
					return [
						`${theme.fg("accent", "> ")}${query}`,
						count,
						theme.fg("dim", "  type to search · ↑↓ move · Space on/off · Enter save · Esc cancel"),
						"",
						...(rows.length ? rows : [theme.fg("dim", "  no match")]),
					];
				};

				const close = (value: boolean) => {
					if (book.__piBookPanel === panel) book.__piBookPanel = undefined;
					done(value);
				};

				const panel: BookPanel = { title: TITLE, render: lines };
				const inBook = book.__piBookActive === true;
				if (inBook) book.__piBookPanel = panel;

				return {
					render: (width: number) => (inBook ? [] : lines(width)),
					invalidate() {},
					handleInput: (data: string) => {
						const list = matches();
						if (matchesKey(data, Key.escape)) return close(false);
						if (matchesKey(data, Key.enter)) return close(true);
						if (matchesKey(data, Key.up)) selected = (selected - 1 + list.length) % Math.max(1, list.length);
						else if (matchesKey(data, Key.down)) selected = (selected + 1) % Math.max(1, list.length);
						else if (matchesKey(data, Key.space)) {
							const tool = list[selected];
							if (tool) active.has(tool.name) ? active.delete(tool.name) : active.add(tool.name);
						} else if (matchesKey(data, Key.backspace)) {
							query = query.slice(0, -1);
							selected = 0;
						} else if (data.length === 1 && data > " " && data !== "\x7f") {
							query += data;
							selected = 0;
						}
						tui.requestRender();
					},
				};
			});

			if (!saved) return;
			pi.setActiveTools([...active]);
			ctx.ui.notify(`${active.size} of ${tools.length} tools on`, "info");
		},
	});
}
