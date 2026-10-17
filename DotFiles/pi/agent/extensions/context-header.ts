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

import { homedir } from "node:os";
import { join } from "node:path";
import type { ExtensionAPI, ExtensionContext, Theme } from "@earendil-works/pi-coding-agent";
import { Key, matchesKey } from "@earendil-works/pi-tui";

const SRC = join(homedir(), ".pi/agent/npm/node_modules/pi-context-view/src");
const GRID_ROWS = 3;

// biome-ignore lint: loaded at runtime from pi-context-view
type Mod = any;

function visibleWidth(text: string): number {
	return text.replace(/\x1b\[[0-9;]*m/g, "").length;
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

		// Title row: name left, model and total right
		const title = theme.fg("accent", theme.bold("Context Usage"));
		const model = (ctx.model?.id ?? "").replace(/^claude-/, "");
		const total = `${theme.fg("muted", model)}${theme.fg("dim", " · ")}${theme.fg("text", `${fmt(used)}/${fmt(window)} (${percent(used, window)})`)}`;
		const gap = Math.max(1, width - visibleWidth(title) - visibleWidth(total));
		const out = [title + " ".repeat(gap) + total];

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

		// 2 columns, filled top to bottom
		const columnWidth = Math.min(40, Math.max(14, Math.floor((width - 4) / 2)));
		const marker = selecting ? 2 : 0;
		const cell = (item: (typeof items)[number], index: number) => {
			const isSelected = selecting && index === selected && index < selectableIds.length;
			const prefix = !selecting ? "" : isSelected ? theme.fg("accent", "→ ") : "  ";
			const color = mod.resolveCategoryColor(colors, item.id);
			const value = `${fmt(item.tokens)}`.padStart(6);
			const showPct = columnWidth >= 30;
			const pct = showPct ? percent(item.tokens, window).padStart(6) : "";
			const labelRoom = Math.max(4, columnWidth - 2 - marker - value.length - pct.length - 2);
			const label = item.label.length > labelRoom - 2 ? `${item.label.slice(0, labelRoom - 3)}…` : item.label;
			const dots = " " + ".".repeat(Math.max(1, labelRoom - label.length - 1));
			return `${prefix}${mod.colorize(theme, color, item.dot)} ${theme.fg(isSelected ? "accent" : "text", label)}${theme.fg("dim", dots)} ${theme.fg("text", value)}${theme.fg("dim", pct)}`;
		};
		const half = Math.ceil(items.length / 2);
		for (let row = 0; row < half; row++) {
			const left = cell(items[row], row);
			const right = items[row + half] ? cell(items[row + half], row + half) : "";
			const pad = " ".repeat(Math.max(1, columnWidth - visibleWidth(left)));
			out.push(`  ${left}${pad}  ${right}`);
		}

		// Grid under the list: full width, 3 rows of circles in category colors, in a box
		const gridColumns = Math.max(4, Math.floor((width - 5) / 2));
		const map = mod.buildUsageMap(usage, gridColumns, GRID_ROWS);
		if (map) {
			const glyph: Record<string, string> = { full: "●", partial: "◐", buffer: "◌", free: "○" };
			const fallbackId: Record<string, string> = {
				buffer: mod.AUTO_COMPACT_BUFFER_CATEGORY_ID,
				free: mod.FREE_SPACE_CATEGORY_ID,
			};
			const border = (text: string) => theme.fg("borderMuted", text);
			const inner = map.columns * 2 + 1;
			out.push(`  ${border(`╭${"─".repeat(inner)}╮`)}`);
			for (let row = 0; row < map.rows; row++) {
				const cells = map.cells.slice(row * map.columns, (row + 1) * map.columns);
				const drawn = cells.map((c: { categoryId?: string; fill: string }) => {
					const color = mod.resolveCategoryColor(colors, c.categoryId ?? fallbackId[c.fill]);
					return mod.colorize(theme, color, glyph[c.fill] ?? "○");
				});
				out.push(`  ${border("│")} ${drawn.join(" ")} ${border("│")}`);
			}
			out.push(`  ${border(`╰${"─".repeat(inner)}╯`)}`);
		}
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
				if (w !== width || lines.length === 0) {
					width = w;
					rebuild();
				}
				return lines;
			},
			invalidate() {},
		};
		let shown = false;

		// Blank header of the same height, plus one spacer line, so the chat starts below the panel
		ctx.ui.setHeader((tui, headerTheme) => {
			theme = headerTheme;
			requestRender = () => tui.requestRender();
			if (!shown) {
				shown = true;
				// biome-ignore lint: showOverlay is not in the public TUI type
				(tui as any).showOverlay(panel, { nonCapturing: true, anchor: "top-left", width: "100%" });
			}
			return {
				render: () => [...lines.map(() => ""), ""],
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
