/**
 * /tree (Session Tree) rows drawn as a turn tree, like the chat:
 *
 *   ⚙ system
 *   ❯ hio
 *   └─ π Hi! How can I help you today?
 *   ❯ ls
 *   ├─ ▸ ls .
 *   └─ π Here's what's in your current directory...
 *
 * Shown inside book.ts's page frame instead of the input box, when book mode
 * is on. The resume session picker (/resume), the model picker (/model), the
 * thinking level picker (/thinking) and /settings show there too.
 * Only the looks change; moving, search, filters and branching are Pi's own.
 */

import {
	type ExtensionAPI,
	ModelSelectorComponent,
	SessionSelectorComponent,
	SettingsSelectorComponent,
	ThinkingSelectorComponent,
	TreeSelectorComponent,
} from "@earendil-works/pi-coding-agent";

// biome-ignore lint: Pi's internal TreeList shape
type Any = any;

let patchedSelector = false;
let patchedList = false;

export default function (pi: ExtensionAPI) {
	if (patchedSelector) return;
	patchedSelector = true;

	let accent = (text: string) => text;
	let dim = (text: string) => text;
	let muted = (text: string) => text;
	let tui: Any;
	pi.on("session_start", async (_event, ctx) => {
		const theme = (ctx.ui as Any).theme;
		if (theme) {
			accent = (text) => theme.fg("accent", text);
			dim = (text) => theme.fg("dim", text);
			muted = (text) => theme.fg("muted", text);
		}
		if (ctx.mode !== "tui") return;
		// Empty widget, only to get the TUI for redraws
		ctx.ui.setWidget("tree-popup-tui", (t: Any) => {
			tui = t;
			return { render: () => [], invalidate() {} };
		});
	});

	const visible = (line: string) => line.replace(/\x1b\][^\x07]*\x07/g, "").replace(/\x1b\[[0-9;]*m/g, "");
	const isRule = (line: string) => /^─+$/.test(visible(line).trim());

	// A selector's own lines, without its top/bottom rules, blank edges and title line
	function panelLines(selector: Any, width: number, title: string, draw: (w: number) => string[]): string[] {
		let lines: string[] = draw.call(selector, width);
		while (lines.length && (isRule(lines[0]) || visible(lines[0]).trim() === "")) lines = lines.slice(1);
		while (lines.length && (isRule(lines[lines.length - 1]) || visible(lines[lines.length - 1]).trim() === ""))
			lines = lines.slice(0, -1);
		return lines.filter((line) => !isRule(line) && visible(line).trim() !== title);
	}

	// Show the selector inside book.ts's page frame; list: the inner list whose callbacks close it
	type BookPanel = { title: string; render: (width: number) => string[] };
	const book = globalThis as { __piBookActive?: boolean; __piBookPanel?: BookPanel };
	function showInBook(selector: Any, list: Any, title: string, draw: (w: number) => string[]): boolean {
		if (!book.__piBookActive || !list) return false;
		const panel: BookPanel = { title, render: (w) => panelLines(selector, w, title, draw) };
		book.__piBookPanel = panel;
		// Session/tree/thinking/settings lists close through onSelect/onCancel/onExit (thinking also
		// onSelectAsDefault), the model selector through its *Callback fields
		for (const key of [
			"onSelect",
			"onCancel",
			"onExit",
			"onSelectAsDefault",
			"onSelectCallback",
			"onSelectAsDefaultCallback",
			"onCancelCallback",
		]) {
			if (typeof list[key] !== "function") continue;
			const original = list[key];
			list[key] = (...args: unknown[]) => {
				if (book.__piBookPanel === panel) book.__piBookPanel = undefined;
				tui?.requestRender?.();
				return original?.(...args);
			};
		}
		tui?.requestRender?.();
		return true;
	}

	const normalize = (s: string) => s.replace(/[\n\t]/g, " ").trim();
	const roleOf = (node: Any): string | undefined =>
		node?.entry?.type === "message" ? node.entry.message?.role : undefined;

	function patchList(list: Any) {
		if (patchedList || !list) return;
		patchedList = true;
		const proto = Object.getPrototypeOf(list);
		const original = proto.getEntryDisplayText;

		proto.getEntryDisplayText = function (this: Any, node: Any, isSelected: boolean): string {
			const fallback = original.call(this, node, isSelected);
			try {
				const role = roleOf(node);
				if (!role) return fallback;
				const message = node.entry.message;

				// ├─ when the same turn continues below, └─ on its last row
				const connector = () => {
					const nodes: Any[] = this.filteredNodes ?? [];
					const index = nodes.findIndex((flat) => flat.node === node);
					const nextRole = index >= 0 ? roleOf(nodes[index + 1]?.node) : undefined;
					const continues = nextRole === "assistant" || nextRole === "toolResult";
					return dim(continues ? "├─ " : "└─ ");
				};

				if (role === "user") return accent("❯ ") + normalize(this.extractContent(message.content));
				if (role === "system") return dim("⚙ system");
				if (role === "assistant") {
					const text = normalize(this.extractContent(message.content));
					// Aborted/error/empty: keep Pi's text after its "assistant: " label
					const rest = text || fallback.replace(/^.*?assistant: /, "");
					return connector() + accent("π ") + rest;
				}
				if (role === "toolResult") {
					const call = message.toolCallId ? this.toolCallMap?.get(message.toolCallId) : undefined;
					const label = call ? this.formatToolCall(call.name, call.arguments) : `[${message.toolName ?? "tool"}]`;
					return connector() + dim("▸ ") + muted(String(label).replace(/^\[|\]$/g, "").replace(/: /, " "));
				}
				return fallback;
			} catch {
				return fallback;
			}
		};
	}

	// Shown in the book frame: nothing in the input area; otherwise Pi's normal inline selector
	const popups = new WeakMap<object, boolean>();
	function asPopup(proto: Any, title: string, listOf: (selector: Any) => Any, before?: (selector: Any) => void) {
		const draw = proto.render;
		proto.render = function (this: Any, width: number) {
			before?.(this);
			if (!popups.has(this)) {
				let shown = false;
				try {
					shown = showInBook(this, listOf(this), title, draw);
				} catch {
					shown = false;
				}
				popups.set(this, shown);
			}
			return popups.get(this) ? [] : draw.call(this, width);
		};
	}

	asPopup(TreeSelectorComponent.prototype, "Session Tree", (s) => s.treeList, (s) => patchList(s.treeList));
	asPopup(SessionSelectorComponent.prototype, "Resume Session", (s) => s.sessionList);
	asPopup(ModelSelectorComponent.prototype, "Select Model", (s) => s);
	asPopup(ThinkingSelectorComponent.prototype, "Thinking Level", (s) => s);
	asPopup(SettingsSelectorComponent.prototype, "Settings", (s) => s.settingsList);
}
