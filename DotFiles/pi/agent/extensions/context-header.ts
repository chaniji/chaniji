/**
 * TRIAL: "Context Usage" panel pinned to the top of the screen. It shows every
 * category in 2 columns, with numbers from pi-context-view, and updates after
 * each answer. Remove this file to turn it off.
 *
 * /context: pick a category in the panel (↑↓), Enter opens its detail popup
 * (pi-context-view's preview), Esc goes back.
 *
 *   Context Usage                      sonnet-5 · 20.5k/1M (2%)
 *     ● System Prompt ...... 2.4k      ● Messages ........... 9.5k
 *     ● Skills .............. 485      ○ Free Space ......... 979k
 */

import { existsSync, readFileSync, statSync } from "node:fs";
import { homedir } from "node:os";
import { basename, dirname, join } from "node:path";
import type { ExtensionAPI, ExtensionContext, Theme } from "@earendil-works/pi-coding-agent";
import { Key, matchesKey } from "@earendil-works/pi-tui";

const SRC = join(homedir(), ".pi/agent/npm/node_modules/pi-context-view/src");
const GRID_ROWS = 3;
// Same context files Pi itself loads from a folder
const AGENT_FILES = ["AGENTS.override.md", "AGENTS.md", "AGENTS.MD", "CLAUDE.md", "CLAUDE.MD"];

// Set by book.ts: full screen on, the panel hides so the page gets its rows
const book = globalThis as { __piBookFull?: boolean };

// biome-ignore lint: loaded at runtime from pi-context-view
type Mod = any;

function visibleWidth(text: string): number {
	return text.replace(/\x1b\[[0-9;]*m/g, "").length;
}

function shortenPath(path: string): string {
	const home = homedir();
	return path.startsWith(home) ? `~${path.slice(home.length)}` : path;
}

// Current git branch from .git/HEAD, looking up from the folder; short hash when detached
function gitBranch(cwd: string): string | undefined {
	for (let dir = cwd; ; dir = dirname(dir)) {
		const git = join(dir, ".git");
		try {
			// A worktree or submodule has a ".git" file pointing at the real git folder
			const gitDir = statSync(git).isFile()
				? readFileSync(git, "utf8").replace(/^gitdir:\s*/, "").trim()
				: git;
			const head = readFileSync(join(gitDir.startsWith("/") ? gitDir : join(dir, gitDir), "HEAD"), "utf8").trim();
			return head.startsWith("ref: refs/heads/") ? head.slice(16) : head.slice(0, 7);
		} catch {
			// no git here: try the parent folder
		}
		if (dirname(dir) === dir) return undefined;
	}
}

function percent(tokens: number, total: number): string {
	if (!total) return "";
	const p = (tokens / total) * 100;
	return p < 10 ? `${p.toFixed(1)}%` : `${Math.round(p)}%`;
}

export default function (pi: ExtensionAPI) {
	let lines: string[] = [];
	let requestRender: (() => void) | undefined;
	let mod: Mod;
	// Command-only API in pi; captured from before_agent_start instead
	let promptOptions: unknown;
	// /context picking state; ids are the selectable categories (not buffer/free)
	let selecting = false;
	let selected = 0;
	let selectableIds: string[] = [];
	let rebuild: () => void = () => {};

	async function load() {
		const parts = await Promise.all(
			["projection", "replay", "prompt-additions", "usage", "settings", "config", "ui/color", "ui/usage-view", "ui/usage-map"].map(
				(name) => import(join(SRC, `${name}.ts`)),
			),
		);
		mod = Object.assign({}, ...parts);
	}

	function computeUsage(ctx: ExtensionContext) {
		const { messages, systemChanges, forcedPrompt } = mod.applyRequestSnapshot({
			snapshot: undefined,
			entries: ctx.sessionManager.getEntries(),
			leafId: ctx.sessionManager.getLeafId(),
			filterMessages: (m: unknown) => m,
		});
		const snapshot = mod.buildUsageSnapshot({
			messages,
			systemChanges,
			forcedPrompt,
			systemPrompt: ctx.getSystemPrompt(),
			options: (ctx as { getSystemPromptOptions?: () => unknown }).getSystemPromptOptions?.() ?? promptOptions ?? { cwd: ctx.cwd },
			allTools: pi.getAllTools(),
			activeToolNames: pi.getActiveTools(),
			promptSources: mod.collectPromptSources(pi.getAllTools(), pi.getCommands()),
		});
		return mod.computeUsage({
			snapshot,
			messages,
			reported: mod.toReportedUsage(ctx.getContextUsage()),
			modelLabel: ctx.model?.id,
			autoCompactReserveTokens: mod.readAutoCompactReserveTokens(pi, ctx.model),
		});
	}

	function render(ctx: ExtensionContext, theme: Theme, width: number): string[] {
		const usage = computeUsage(ctx);
		const colors = new mod.ConfigStore().load().config.categoryColors;
		const window: number = usage.reported?.contextWindow ?? 0;
		const used: number = usage.reported?.tokens ?? usage.estimatedTokens;
		const fmt: (n: number) => string = mod.formatTokens;

		// One box around title, list and grid, same edges as the book page:
		// border at column 0 and width - 1, content from column 2 to width - 3
		const border = (text: string) => theme.fg("border", text);
		const content = Math.max(28, width - 4);
		const side = (line: string) => `${border("│")} ${line}${" ".repeat(Math.max(0, content - visibleWidth(line)))} ${border("│")}`;

		// Top border holds the title on the left, model and total on the right
		// Context files in this folder show in the bottom-right corner: "◈ AGENTS.md · CLAUDE.md"
		const found = AGENT_FILES.filter((name) => existsSync(join(ctx.cwd, name)));
		const name = `${border("─ ")}${theme.fg("accent", theme.bold("Context Usage"))}${border(" ")}`;
		const model = (ctx.model?.id ?? "").replace(/^claude-/, "");
		const amount = `${fmt(used)}/${fmt(window)} (${percent(used, window)})`;
		// Narrow terminal: drop pieces until the top border fits on one line, so it never wraps into the box
		const totalChoices = [
			` ${theme.fg("muted", model)}${theme.fg("dim", " · ")}${theme.fg("text", amount)}${border(" ─")}`,
			` ${theme.fg("text", amount)}${border(" ─")}`,
			` ${theme.fg("text", percent(used, window))}${border(" ─")}`,
			"",
		];
		const title = name;
		const total = totalChoices.find((t) => visibleWidth(title) + visibleWidth(t) + 1 <= content + 2) ?? "";
		const fill = Math.max(0, content + 2 - visibleWidth(title) - visibleWidth(total));
		// Empty first row: keeps the panel off the tmux status bar
		const out = ["", border("╭") + title + border("─".repeat(fill)) + total + border("╮")];

		// Every category, plus buffer and free space
		const items: { id: string; label: string; tokens: number; dot: string }[] = usage.categories.map(
			(c: { id: string; label: string; tokens: number }) => ({ ...c, dot: "●" }),
		);
		selectableIds = items.map((item) => item.id);
		selected = Math.min(selected, Math.max(0, selectableIds.length - 1));
		const buffer: number = usage.autoCompactReserveTokens ?? 0;
		if (buffer > 0) items.push({ id: mod.AUTO_COMPACT_BUFFER_CATEGORY_ID, label: "Auto-Compact Buffer", tokens: buffer, dot: "◌" });
		if (window > 0) {
			const free = Math.max(0, window - usage.estimatedTokens - buffer);
			items.push({ id: mod.FREE_SPACE_CATEGORY_ID, label: "Free Space", tokens: free, dot: "○" });
		}

		// 2 columns, filled top to bottom; the right column ends at the content edge
		const columnWidth = Math.floor((content - 2) / 2);
		const gutter = content - columnWidth * 2;
		const marker = selecting ? 2 : 0;
		const showPct = columnWidth >= 30;
		const cell = (item: (typeof items)[number], index: number) => {
			const isSelected = selecting && index === selected && index < selectableIds.length;
			const prefix = !selecting ? "" : isSelected ? theme.fg("accent", "→ ") : "  ";
			const color = mod.resolveCategoryColor(colors, item.id);
			const value = `${fmt(item.tokens)}`.padStart(6);
			const pct = showPct ? percent(item.tokens, window).padStart(6) : "";
			// Room for label plus leader dots: everything else in the cell is fixed width
			const room = Math.max(6, columnWidth - marker - 2 - value.length - pct.length);
			const label = item.label.length > room - 3 ? `${item.label.slice(0, room - 4)}…` : item.label;
			const dots = ` ${".".repeat(Math.max(1, room - label.length - 2))} `;
			return `${prefix}${mod.colorize(theme, color, item.dot)} ${theme.fg(isSelected ? "accent" : "text", label)}${theme.fg("dim", dots)}${theme.fg("text", value)}${theme.fg("dim", pct)}`;
		};
		const half = Math.ceil(items.length / 2);
		for (let row = 0; row < half; row++) {
			const left = cell(items[row], row);
			const right = items[row + half] ? cell(items[row + half], row + half) : "";
			const pad = " ".repeat(Math.max(0, columnWidth - visibleWidth(left)) + gutter);
			out.push(side(`${left}${right ? pad + right : ""}`));
		}

		// Grid under the list, in the same box after a divider: 3 rows of circles in category colors
		const gridColumns = Math.max(4, Math.floor((content + 1) / 2));
		const map = mod.buildUsageMap(usage, gridColumns, GRID_ROWS);
		if (map) {
			const glyph: Record<string, string> = { full: "●", partial: "◐", buffer: "◌", free: "○" };
			const fallbackId: Record<string, string> = {
				buffer: mod.AUTO_COMPACT_BUFFER_CATEGORY_ID,
				free: mod.FREE_SPACE_CATEGORY_ID,
			};
			out.push(border(`├${"─".repeat(content + 2)}┤`));
			for (let row = 0; row < map.rows; row++) {
				const cells = map.cells.slice(row * map.columns, (row + 1) * map.columns);
				const drawn = cells.map((c: { categoryId?: string; fill: string }) => {
					const color = mod.resolveCategoryColor(colors, c.categoryId ?? fallbackId[c.fill]);
					return mod.colorize(theme, color, glyph[c.fill] ?? "○");
				});
				out.push(side(drawn.join(" ")));
			}
		}
		// Bottom border: folder and git branch on the left, context files on the right.
		// Narrow terminal: shorten the folder, then drop pieces until it fits on one line
		const branch = gitBranch(ctx.cwd);
		const fullPath = shortenPath(ctx.cwd);
		const placeChoices = [
			`${fullPath}${branch ? ` · ⎇ ${branch}` : ""}`,
			`${basename(ctx.cwd) || fullPath}${branch ? ` · ⎇ ${branch}` : ""}`,
			branch ? `⎇ ${branch}` : "",
			"",
		];
		const fileChoices = found.length > 0 ? [`◈ ${found.join(" · ")}`, "◈", ""] : [""];
		let place = "";
		let corner = "";
		search: for (const f of fileChoices) {
			for (const p of placeChoices) {
				const left = p ? `${border("─ ")}${theme.fg("muted", p)}${border(" ")}` : "";
				const right = f ? ` ${theme.fg("success", f)}${border(" ─")}` : "";
				if (visibleWidth(left) + visibleWidth(right) + 1 <= content + 2) {
					place = left;
					corner = right;
					break search;
				}
			}
		}
		const bottomFill = Math.max(0, content + 2 - visibleWidth(place) - visibleWidth(corner));
		out.push(border("╰") + place + border("─".repeat(bottomFill)) + corner + border("╯"));
		return out;
	}

	pi.on("session_start", async (_event, ctx) => {
		if (ctx.mode !== "tui") return;
		try {
			await load();
		} catch {
			return; // pi-context-view missing: show nothing
		}

		let width = process.stdout.columns ?? 100;
		let theme: Theme | undefined;
		rebuild = () => {
			if (!theme) return;
			try {
				lines = render(ctx, theme, width);
			} catch {
				lines = [];
			}
			requestRender?.();
		};
		pi.on("agent_end", async () => rebuild());
		pi.on("model_select", async () => rebuild());
		pi.on("session_compact", async () => rebuild());

		// Pinned to the top: a non-capturing overlay never scrolls and never takes input
		const panel = {
			render: (w: number) => {
				if (book.__piBookFull) return [];
				if (w !== width || lines.length === 0) {
					width = w;
					rebuild();
				}
				return lines;
			},
			invalidate() {},
		};
		let shown = false;

		// Blank header of the same height, so the chat starts below the panel
		ctx.ui.setHeader((tui, headerTheme) => {
			theme = headerTheme;
			requestRender = () => tui.requestRender();
			if (!shown) {
				shown = true;
				// biome-ignore lint: showOverlay is not in the public TUI type
				(tui as any).showOverlay(panel, { nonCapturing: true, anchor: "top-left", width: "100%" });
			}
			return {
				render: () => (book.__piBookFull ? [] : lines.map(() => "")),
				invalidate() {},
			};
		});
	});

	// Detail popup for one category: pi-context-view's own preview, without its dashboard
	async function openDetail(ctx: ExtensionContext, categoryId: string) {
		const usage = computeUsage(ctx);
		const { config } = new mod.ConfigStore().load();
		const input = { usage, categoryColors: config.categoryColors, mapSize: config.mapSize };
		await ctx.ui.custom<void>(
			(tui, theme, _keybindings, done) => {
				const view = new mod.UsageView(theme, input, done, () => tui.terminal.rows);
				// Step the view's selection to the category, then open its preview
				const rows = view.legendRows as { type: string; category?: { id: string } }[];
				for (let i = 0; i < rows.length; i++) {
					const row = rows[view.navigator.selected];
					if (row?.type === "category" && row.category?.id === categoryId) break;
					view.handleInput("j");
				}
				view.handleInput("\r");
				return {
					render: (width: number) => view.render(width),
					invalidate: () => view.invalidate(),
					handleInput: (data: string) => {
						view.handleInput(data);
						// Esc from the preview level: close instead of showing the dashboard
						if (view.previewRow === undefined) done();
						tui.requestRender();
					},
				};
			},
			{ overlay: true, overlayOptions: { width: "100%", maxHeight: "100%", margin: 0 } },
		);
	}

	pi.registerCommand("context", {
		description: "Pick a category in the context panel and open its details",
		handler: async (_args, ctx) => {
			if (!mod || ctx.mode !== "tui") {
				ctx.ui.notify("Context panel is not available", "warning");
				return;
			}
			selecting = true;
			rebuild();
			let busy = false;
			try {
				await ctx.ui.custom<void>(
					(tui, theme, _keybindings, done) => ({
						render: () => [theme.fg("dim", " ↑↓/jk pick · Enter open · Esc done ")],
						invalidate() {},
						handleInput: (data: string) => {
							if (busy) return;
							const count = selectableIds.length;
							if (matchesKey(data, Key.escape) || data === "q") {
								done();
							} else if ((matchesKey(data, Key.up) || data === "k") && count > 0) {
								selected = (selected - 1 + count) % count;
								rebuild();
							} else if ((matchesKey(data, Key.down) || data === "j") && count > 0) {
								selected = (selected + 1) % count;
								rebuild();
							} else if (matchesKey(data, Key.enter) && count > 0) {
								busy = true;
								openDetail(ctx, selectableIds[selected])
									.catch(() => ctx.ui.notify("Could not open details", "error"))
									.finally(() => {
										busy = false;
										tui.requestRender();
									});
							}
							tui.requestRender();
						},
					}),
					{ overlay: true, overlayOptions: { anchor: "bottom-center" } },
				);
			} finally {
				selecting = false;
				rebuild();
			}
		},
	});

	pi.on("before_agent_start", async (event) => {
		promptOptions = (event as { systemPromptOptions?: unknown }).systemPromptOptions ?? promptOptions;
	});
}
