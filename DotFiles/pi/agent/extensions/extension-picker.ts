/**
 * /extension: every extension in one list, each with its own slash commands.
 *
 *   ╭─ Extensions ──────────────────────────────╮
 *   │ › book.ts           book mode     1 cmd   │
 *   │   pi-hermes-memory  memory        9 cmds  │
 *   ╰───────────────────────────────────────────╯
 *   Enter
 *   ╭─ pi-hermes-memory ────────────────────────╮
 *   │ › memory-skills     manage memory         │
 *   ╰───────────────────────────────────────────╯
 *   Enter fills the input with "/memory-skills "; Esc goes back
 *
 * Extension commands are also hidden from the "/" menu, except the few in
 * MENU_COMMANDS. Hidden commands still run when typed in full.
 * Drawn inside book.ts's page frame like /tree, /model and /skill.
 */

import { readdirSync, readFileSync } from "node:fs";
import { homedir } from "node:os";
import { basename, join } from "node:path";
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { Key, matchesKey, truncateToWidth } from "@earendil-works/pi-tui";

type BookPanel = { title: string; render: (width: number) => string[] };
const book = globalThis as { __piBookActive?: boolean; __piBookPanel?: BookPanel };

const AGENT_DIR = join(homedir(), ".pi/agent");
const EXTENSIONS_DIR = join(AGENT_DIR, "extensions");
const NPM_DIR = join(AGENT_DIR, "npm/node_modules");
// Extension commands that stay in the "/" menu; the rest are reached through /extension
const MENU_COMMANDS = new Set(["book", "skill", "tools", "extension", "context"]);

type Command = { name: string; description: string };
type Extension = { name: string; description: string; commands: Command[] };

// npm package name from a path inside node_modules; otherwise the file name
function ownerOf(path: string | undefined): string {
	if (!path) return "other";
	const match = path.match(/node_modules\/((?:@[^/]+\/)?[^/]+)/);
	return match ? match[1] : basename(path);
}

// First sentence of a local file's header comment, or a package's description
function describe(name: string): string {
	try {
		if (name.endsWith(".ts")) {
			const text = readFileSync(join(EXTENSIONS_DIR, name), "utf8");
			const comment = text.match(/\/\*\*([\s\S]*?)\*\//)?.[1] ?? "";
			const line = comment.split("\n").map((l) => l.replace(/^\s*\*\s?/, "").trim()).find(Boolean) ?? "";
			return line.replace(/[.:]$/, "");
		}
		const pkg = JSON.parse(readFileSync(join(NPM_DIR, name, "package.json"), "utf8"));
		return String(pkg.description ?? "").split(/\.\s/)[0];
	} catch {
		return "";
	}
}

// Local extension files and the packages listed in settings.json, with their commands
function collect(pi: ExtensionAPI): Extension[] {
	const byOwner = new Map<string, Command[]>();
	for (const command of pi.getCommands()) {
		if (command.source !== "extension") continue;
		const owner = ownerOf(command.sourceInfo?.path);
		byOwner.set(owner, [...(byOwner.get(owner) ?? []), { name: command.name, description: command.description ?? "" }]);
	}

	const names = new Set<string>(byOwner.keys());
	try {
		for (const file of readdirSync(EXTENSIONS_DIR)) if (file.endsWith(".ts")) names.add(file);
		const settings = JSON.parse(readFileSync(join(AGENT_DIR, "settings.json"), "utf8"));
		for (const entry of settings.packages ?? []) {
			const source = typeof entry === "string" ? entry : entry?.source;
			if (typeof source === "string" && source.startsWith("npm:")) names.add(source.slice(4));
		}
	} catch {
		// unreadable folder or settings: list what has commands
	}

	return [...names]
		.map((name) => ({
			name,
			description: describe(name),
			commands: (byOwner.get(name) ?? []).sort((a, b) => a.name.localeCompare(b.name)),
		}))
		.sort((a, b) => b.commands.length - a.commands.length || a.name.localeCompare(b.name));
}

export default function (pi: ExtensionAPI) {
	// Hide extension commands from the "/" menu, except MENU_COMMANDS
	pi.on("session_start", async (_event, ctx) => {
		if (ctx.mode !== "tui") return;
		ctx.ui.addAutocompleteProvider((current) => ({
			...current,
			async getSuggestions(lines, cursorLine, cursorCol, options) {
				const result = await current.getSuggestions(lines, cursorLine, cursorCol, options);
				const text = lines[cursorLine]?.slice(0, cursorCol) ?? "";
				if (!result || !text.startsWith("/") || text.includes(" ")) return result;
				const hidden = new Set(
					pi
						.getCommands()
						.filter((c) => c.source === "extension" && !MENU_COMMANDS.has(c.name))
						.map((c) => c.name),
				);
				const items = result.items.filter((item) => !hidden.has(item.value));
				return items.length > 0 ? { ...result, items } : null;
			},
			applyCompletion: (...args) => current.applyCompletion(...args),
		}));
	});

	pi.registerCommand("extension", {
		description: "Browse extensions and their slash commands",
		handler: async (_args, ctx) => {
			if (ctx.mode !== "tui") return;
			const extensions = collect(pi);

			const picked = await ctx.ui.custom<string | undefined>((tui, theme, _keybindings, done) => {
				// open: the extension whose commands are shown; undefined: the extension list
				let open: Extension | undefined;
				let query = "";
				let selected = 0;
				let listSelected = 0;

				const matches = <T extends { name: string; description: string }>(items: T[]): T[] => {
					const q = query.toLowerCase();
					const byName = items.filter((i) => i.name.toLowerCase().includes(q));
					return [...byName, ...items.filter((i) => !byName.includes(i) && i.description.toLowerCase().includes(q))];
				};
				const visibleItems = (): (Extension | Command)[] => (open ? matches(open.commands) : matches(extensions));

				const lines = (width: number): string[] => {
					const list = visibleItems();
					selected = Math.min(selected, Math.max(0, list.length - 1));
					const nameWidth = Math.max(8, ...list.map((i) => i.name.length)) + 2;
					const rows = list.map((item, i) => {
						const cursor = i === selected ? theme.fg("accent", "› ") : "  ";
						const label = (open ? `/${item.name}` : item.name).padEnd(nameWidth + (open ? 1 : 0));
						const name = i === selected ? theme.fg("accent", label) : label;
						const count =
							"commands" in item
								? theme.fg("muted", `${item.commands.length} cmd${item.commands.length === 1 ? "" : "s"}  `.padStart(9))
								: "";
						return truncateToWidth(`${cursor}${name}${count}${theme.fg("dim", item.description)}`, width);
					});
					const keys = open
						? "type to search · ↑↓ move · Enter fill input · Esc back"
						: "type to search · ↑↓ move · Enter open · Esc close";
					const empty = open ? "  no slash commands" : "  no match";
					// Search, count and keys on top: a long list never pushes them out of the frame
					return [
						`${theme.fg("accent", "> ")}${query}`,
						theme.fg("dim", `  (${list.length === 0 ? 0 : selected + 1}/${list.length})`),
						theme.fg("dim", `  ${keys}`),
						"",
						...(rows.length ? rows : [theme.fg("dim", empty)]),
					];
				};

				const panel: BookPanel = { title: "Extensions", render: lines };
				const close = (value: string | undefined) => {
					if (book.__piBookPanel === panel) book.__piBookPanel = undefined;
					done(value);
				};
				const inBook = book.__piBookActive === true;
				if (inBook) book.__piBookPanel = panel;

				return {
					render: (width: number) => (inBook ? [] : lines(width)),
					invalidate() {},
					handleInput: (data: string) => {
						const list = visibleItems();
						if (matchesKey(data, Key.escape)) {
							if (!open) return close(undefined);
							open = undefined;
							panel.title = "Extensions";
							query = "";
							selected = listSelected;
						} else if (matchesKey(data, Key.enter)) {
							const item = list[selected];
							if (!item) return;
							if (open) return close(item.name);
							open = item as Extension;
							panel.title = open.name;
							listSelected = selected;
							query = "";
							selected = 0;
						} else if (matchesKey(data, Key.up)) selected = (selected - 1 + list.length) % Math.max(1, list.length);
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

			if (picked) ctx.ui.setEditorText(`/${picked} `);
		},
	});
}
