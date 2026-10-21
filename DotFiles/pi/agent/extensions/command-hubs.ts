/**
 * Command hubs: Pi's built-in commands grouped into three lists instead of
 * two dozen entries in the "/" menu (extension-picker.ts hides them there).
 *
 * - /sessions: new, resume, tree, fork, clone, name, compact, copy, export...
 * - /models: model, thinking, scoped-models, login, logout
 * - /app: settings, hotkeys, reload, trust, changelog, bug, quit
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
 * /import, /share, /bug) fill the input instead so the rest can be typed. Esc
 * closes.
 * Drawn inside book.ts's page frame like /tree, /model and /skill.
 */

import { readFileSync } from "node:fs";
import { basename, dirname, join } from "node:path";
import type { ExtensionAPI, ExtensionContext } from "@earendil-works/pi-coding-agent";
import { Key, matchesKey, truncateToWidth } from "@earendil-works/pi-tui";

type BookPanel = { title: string; render: (width: number) => string[] };
const book = globalThis as { __piBookActive?: boolean; __piBookPanel?: BookPanel };

type SessionCommand = { name: string; description: string; group: string; needsArgs?: boolean };

type Hub = {
	name: string;
	title: string;
	description: string;
	card: (pi: ExtensionAPI, ctx: ExtensionContext) => string;
	commands: SessionCommand[];
};

// pi's version from the package.json next to the pi binary; empty when not found
function piVersion(): string {
	try {
		return JSON.parse(readFileSync(join(dirname(process.execPath), "package.json"), "utf8")).version ?? "";
	} catch {
		return "";
	}
}

// Every hub; extension-picker.ts hides all these commands from the "/" menu
export const HUBS: Hub[] = [
	{
		name: "sessions",
		title: "Sessions",
		description: "Session commands: new, resume, tree, fork, name, compact, export...",
		// Folder, session name, message count, context use
		card: (pi, ctx) => {
			const messages = ctx.sessionManager.getEntries().filter((e: { type?: string }) => e.type === "message").length;
			const sessionName = pi.getSessionName?.();
			const percent = ctx.getContextUsage()?.percent;
			return [
				basename(ctx.cwd),
				sessionName ? `"${sessionName}"` : undefined,
				`${messages} msgs`,
				percent != null ? `${percent.toFixed(1)}%` : undefined,
			]
				.filter(Boolean)
				.join(" · ");
		},
		commands: [
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
		],
	},
	{
		name: "models",
		title: "Models",
		description: "Model commands: model, thinking, cycling, login",
		// Model, provider, thinking level
		card: (pi, ctx) => {
			const thinking = pi.getThinkingLevel?.();
			return [
				ctx.model?.id.replace(/^claude-/, ""),
				ctx.model?.provider,
				thinking ? `thinking ${thinking}` : undefined,
			]
				.filter(Boolean)
				.join(" · ");
		},
		commands: [
			{ group: "Pick", name: "model", description: "choose model" },
			{ group: "Pick", name: "thinking", description: "thinking level" },
			{ group: "Pick", name: "scoped-models", description: "models for Ctrl+P cycling" },
			{ group: "Account", name: "login", description: "add a provider" },
			{ group: "Account", name: "logout", description: "remove a provider" },
		],
	},
	{
		name: "app",
		title: "App",
		description: "App commands: settings, hotkeys, reload, quit...",
		// Pi version, skill count, extension command count
		card: (pi) => {
			const commands = pi.getCommands();
			const version = piVersion();
			return [
				version ? `pi ${version}` : "pi",
				`${commands.filter((c) => c.source === "skill").length} skills`,
				`${commands.filter((c) => c.source === "extension").length} extension commands`,
			].join(" · ");
		},
		commands: [
			{ group: "Setup", name: "settings", description: "settings menu" },
			{ group: "Setup", name: "hotkeys", description: "keyboard shortcuts" },
			{ group: "Setup", name: "reload", description: "reload extensions, skills, themes" },
			{ group: "Setup", name: "trust", description: "trust this folder" },
			{ group: "Info", name: "changelog", description: "what's new" },
			{ group: "Info", name: "bug", description: "report a bug", needsArgs: true },
			{ group: "Exit", name: "quit", description: "quit pi" },
		],
	},
];

type Focusable = { handleInput?: (data: string) => void };
type Tui = { requestRender: () => void; getFocusedComponent?: () => Focusable | undefined };

export default function (pi: ExtensionAPI) {
	for (const hub of HUBS) registerHub(pi, hub);
}

function registerHub(pi: ExtensionAPI, hub: Hub) {
	const COMMANDS = hub.commands;
	pi.registerCommand(hub.name, {
		description: hub.description,
		handler: async (_args, ctx) => {
			if (ctx.mode !== "tui") return;
			let card = "";
			try {
				card = hub.card(pi, ctx);
			} catch {
				// card is a nicety; the list works without it
			}

			let tuiRef: Tui | undefined;
			const picked = await ctx.ui.custom<SessionCommand | undefined>((tui, theme, _keybindings, done) => {
				tuiRef = tui as unknown as Tui;
				let query = "";
				let selected = 0;
				const matches = () => {
					const q = query.toLowerCase();
					const byName = COMMANDS.filter((c) => c.name.includes(q));
					return [...byName, ...COMMANDS.filter((c) => !byName.includes(c) && c.description.includes(q))];
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
						const label = `/${c.name}`.padEnd(Math.max(...COMMANDS.map((x) => x.name.length)) + 3);
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

				const panel: BookPanel = { title: hub.title, render: lines };
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
