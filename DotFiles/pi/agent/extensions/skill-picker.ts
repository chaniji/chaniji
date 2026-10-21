/**
 * /skill: one command for all skills, instead of a /skill:<name> entry per
 * skill in the slash menu (settings.json: "enableSkillCommands": false).
 *
 *   ╭─ Skills ──────────────────────────────╮
 *   │ > cav                                 │
 *   │                                       │
 *   │ › caveman      terse output mode      │
 *   │   teach        teach so it locks in   │
 *   ╰───────────────────────────────────────╯
 *
 * Type to search, ↑↓ to move, Enter fills the input with "/skill:<name> " so
 * arguments can follow, Esc closes. Drawn inside book.ts's page frame like
 * /tree, /resume and /model; inline in the input area when book mode is off.
 */

import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { Key, matchesKey, truncateToWidth } from "@earendil-works/pi-tui";

type BookPanel = { title: string; render: (width: number) => string[] };
const book = globalThis as { __piBookActive?: boolean; __piBookPanel?: BookPanel };

const TITLE = "Skills";

export default function (pi: ExtensionAPI) {
	pi.registerCommand("skill", {
		description: "Pick a skill; fills the input with /skill:<name>",
		handler: async (_args, ctx) => {
			const skills = pi
				.getCommands()
				.filter((command) => command.source === "skill")
				.map((command) => ({ name: command.name.replace(/^skill:/, ""), description: command.description ?? "" }))
				.sort((a, b) => a.name.localeCompare(b.name));
			if (skills.length === 0) {
				ctx.ui.notify("No skills found", "info");
				return;
			}
			if (ctx.mode !== "tui") return;

			const picked = await ctx.ui.custom<string | undefined>((tui, theme, _keybindings, done) => {
				let query = "";
				let selected = 0;
				const matches = () => {
					const q = query.toLowerCase();
					// Name matches first, then description matches
					const byName = skills.filter((s) => s.name.toLowerCase().includes(q));
					return [...byName, ...skills.filter((s) => !byName.includes(s) && s.description.toLowerCase().includes(q))];
				};

				const lines = (width: number): string[] => {
					const list = matches();
					selected = Math.min(selected, Math.max(0, list.length - 1));
					const nameWidth = Math.max(...skills.map((s) => s.name.length)) + 2;
					const rows = list.map((s, i) => {
						const cursor = i === selected ? theme.fg("accent", "› ") : "  ";
						const name = i === selected ? theme.fg("accent", s.name.padEnd(nameWidth)) : s.name.padEnd(nameWidth);
						return truncateToWidth(`${cursor}${name}${theme.fg("dim", s.description)}`, width);
					});
					const count = theme.fg("dim", `  (${list.length === 0 ? 0 : selected + 1}/${list.length})`);
					// Search, count and keys on top: a long list never pushes them out of the frame
					return [
						`${theme.fg("accent", "> ")}${query}`,
						count,
						theme.fg("dim", "  type to search · ↑↓ move · Enter fill input · Esc close"),
						"",
						...(rows.length ? rows : [theme.fg("dim", "  no match")]),
					];
				};

				const close = (value: string | undefined) => {
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
						if (matchesKey(data, Key.escape)) return close(undefined);
						if (matchesKey(data, Key.enter)) return close(list[selected]?.name);
						if (matchesKey(data, Key.up)) selected = (selected - 1 + list.length) % Math.max(1, list.length);
						else if (matchesKey(data, Key.down)) selected = (selected + 1) % Math.max(1, list.length);
						else if (matchesKey(data, Key.backspace)) {
							query = query.slice(0, -1);
							selected = 0;
						} else if (data.length === 1 && data >= " " && data !== "\x7f") {
							query += data;
							selected = 0;
						}
						tui.requestRender();
					},
				};
			});

			if (picked) ctx.ui.setEditorText(`/skill:${picked} `);
		},
	});
}
