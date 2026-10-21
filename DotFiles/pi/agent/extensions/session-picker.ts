/**
 * /sessions: Pi's session commands in one list, grouped, instead of a dozen
 * entries in the "/" menu (extension-picker.ts hides them there).
 *
 *   ╭─ Sessions ────────────────────────────────╮
 *   │ > _                                       │
 *   │   eStock-mantra · 42 msgs · 2.7%          │
 *   │   Move                                    │
 *   │ › /new        start a new session         │
 *   │   This session                            │
 *   │   /name       rename                      │
 *   ╰───────────────────────────────────────────╯
 *
 * Enter runs a command at once; commands that take input (/name, /export,
 * /import, /share) fill the input instead so the rest can be typed. Esc closes.
 * Drawn inside book.ts's page frame like /tree, /model and /skill.
 */

import { basename } from "node:path";
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { Key, matchesKey, truncateToWidth } from "@earendil-works/pi-tui";

type BookPanel = { title: string; render: (width: number) => string[] };
const book = globalThis as { __piBookActive?: boolean; __piBookPanel?: BookPanel };

type SessionCommand = { name: string; description: string; group: string; needsArgs?: boolean };

// Pi's built-in session commands; extension-picker.ts hides these from the "/" menu
export const SESSION_COMMANDS: SessionCommand[] = [
	{ group: "Move", name: "new", description: "start a new session" },
	{ group: "Move", name: "resume", description: "open another session" },
	{ group: "Move", name: "tree", description: "jump to a branch" },
	{ group: "Move", name: "fork", description: "branch from an earlier message" },
	{ group: "Move", name: "clone", description: "copy this session at this point" },
	{ group: "This session", name: "name", description: "rename", needsArgs: true },
	{ group: "This session", name: "compact", description: "shrink context" },
	{ group: "This session", name: "copy", description: "copy last answer" },
	{ group: "This session", name: "session", description: "info and stats" },
	{ group: "Save", name: "export", description: "save as HTML / JSONL", needsArgs: true },
	{ group: "Save", name: "share", description: "share as gist / artifact", needsArgs: true },
	{ group: "Save", name: "import", description: "open a JSONL file", needsArgs: true },
];

type Focusable = { handleInput?: (data: string) => void };
type Tui = { requestRender: () => void; getFocusedComponent?: () => Focusable | undefined };

export default function (pi: ExtensionAPI) {
	pi.registerCommand("sessions", {
		description: "Session commands: new, resume, tree, fork, name, compact, export...",
		handler: async (_args, ctx) => {
			if (ctx.mode !== "tui") return;

			// Card line: folder, session name, message count, context use
			const sessionName = (ctx.sessionManager as { getSessionName?: () => string | undefined }).getSessionName?.();
			const messages = ctx.sessionManager.getEntries().filter((e: { type?: string }) => e.type === "message").length;
			const percent = ctx.getContextUsage()?.percent;
			const card = [
				basename(ctx.cwd),
				sessionName ? `"${sessionName}"` : undefined,
				`${messages} msgs`,
				percent != null ? `${percent.toFixed(1)}%` : undefined,
			]
				.filter(Boolean)
				.join(" · ");

			let tuiRef: Tui | undefined;
			const picked = await ctx.ui.custom<SessionCommand | undefined>((tui, theme, _keybindings, done) => {
				tuiRef = tui as unknown as Tui;
				let query = "";
				let selected = 0;
				const matches = () => {
					const q = query.toLowerCase();
					const byName = SESSION_COMMANDS.filter((c) => c.name.includes(q));
					return [...byName, ...SESSION_COMMANDS.filter((c) => !byName.includes(c) && c.description.includes(q))];
				};

				const lines = (width: number): string[] => {
					const list = matches();
					selected = Math.min(selected, Math.max(0, list.length - 1));
					const rows: string[] = [];
					let group = "";
					list.forEach((c, i) => {
						// Group headings only while not searching: a search result list stays flat
						if (!query && c.group !== group) {
							group = c.group;
							rows.push(theme.fg("muted", `  ${group}`));
						}
						const cursor = i === selected ? theme.fg("accent", "› ") : "  ";
						const label = `/${c.name}`.padEnd(11);
						const name = i === selected ? theme.fg("accent", label) : label;
						const hint = c.needsArgs ? theme.fg("dim", " …") : "";
						rows.push(truncateToWidth(`${cursor}${name}${theme.fg("dim", c.description)}${hint}`, width));
					});
					// Search, card and keys on top: a long list never pushes them out of the frame
					return [
						`${theme.fg("accent", "> ")}${query}`,
						theme.fg("text", `  ${card}`),
						theme.fg("dim", "  type to search · ↑↓ move · Enter run (… fills input) · Esc close"),
						"",
						...(rows.length ? rows : [theme.fg("dim", "  no match")]),
					];
				};

				const panel: BookPanel = { title: "Sessions", render: lines };
				const close = (value: SessionCommand | undefined) => {
					if (book.__piBookPanel === panel) book.__piBookPanel = undefined;
					done(value);
				};
				const inBook = book.__piBookActive === true;
				if (inBook) book.__piBookPanel = panel;

				return {
					render: (width: number) => (inBook ? [] : lines(width)),
					invalidate() {},
					handleInput: (data: string) => {
						const list = matches();
						if (matchesKey(data, Key.escape)) return close(undefined);
						if (matchesKey(data, Key.enter)) return close(list[selected]);
						if (matchesKey(data, Key.up)) selected = (selected - 1 + list.length) % Math.max(1, list.length);
						else if (matchesKey(data, Key.down)) selected = (selected + 1) % Math.max(1, list.length);
						else if (matchesKey(data, Key.backspace)) {
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

			if (!picked) return;
			if (picked.needsArgs) {
				ctx.ui.setEditorText(`/${picked.name} `);
				return;
			}
			// Run it: put the command in the input, then press Enter on the editor once it has focus again
			ctx.ui.setEditorText(`/${picked.name}`);
			setTimeout(() => tuiRef?.getFocusedComponent?.()?.handleInput?.("\r"), 0);
		},
	});
}
