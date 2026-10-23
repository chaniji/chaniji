/**
 * Book mode: the chat shows one page at a time, one input and its output,
 * in a border. Older turns are hidden; flip pages instead of scrolling.
 *
 *   ╭─ 3/3 ──────────────────────────────────╮
 *   │ ❯ how fix port in use                  │
 *   │ └─ π Run `lsof -i :3001`               │
 *   │      1. Find PID                       │
 *   │      ▶ Next: run step 1                │
 *   ╰────────────────────────────────────────╯
 *
 * - Mouse wheel: scroll inside the page, when it is
 *   taller than the screen. The frame stays fixed, only the text moves
 * - /book nav: arrows move through pages (← →) and scroll (↑ ↓), Esc closes
 * - /book: toggle book mode; /book <n>, /book prev, /book next: go to a page
 * - /book full: full screen on/off (on by default); hides the Context Usage panel so the page gets its rows
 * - Answers follow the i-have-adhd and caveman (ultra) skills on every turn
 */

import { readFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { AssistantMessageComponent, type ExtensionAPI, UserMessageComponent } from "@earendil-works/pi-coding-agent";
import { Container, Key, matchesKey, truncateToWidth, visibleWidth } from "@earendil-works/pi-tui";

const SKILLS_DIR = join(homedir(), "Works/chaniji/Skills");
const STYLE_SKILLS = ["i-have-adhd", "caveman"];
const STYLE_NOTE = "Caveman level: ultra. ADHD mode always on.";

const SPINNER = ["⠋", "⠙", "⠹", "⠸", "⠼", "⠴", "⠦", "⠧", "⠇", "⠏"];

// Shell-integration marks (OSC 133) and color codes, removed to read the plain text
const OSC = /\x1b\][^\x07]*\x07/g;
const SGR = /\x1b\[[0-9;]*m/g;

function plain(line: string): string {
	return line.replace(OSC, "").replace(SGR, "");
}

// Skill body without the frontmatter; empty when the file is missing
function skillBody(name: string): string {
	try {
		return readFileSync(join(SKILLS_DIR, name, "SKILL.md"), "utf8").replace(/^---\n[\s\S]*?\n---\n/, "").trim();
	} catch {
		return "";
	}
}

type Renderable = { render: (width: number) => string[] };
// Pi's chat scroll area (fullscreen mode): its height and the document it shows
type Viewport = { viewportHeight: number; isFollowingEnd: boolean; scrollToEnd: () => void; child?: { children: Renderable[] } };
// Set by tree-style.ts: a selector (/tree, /resume) drawn inside the page frame
type BookPanel = { title: string; render: (width: number) => string[] };
// __piBookFull: full screen on; context-header.ts hides its panel then
// __piBookBadge: text on the right of the top border (prompt-wait.ts time left)
const shared = globalThis as { __piBookActive?: boolean; __piBookPanel?: BookPanel; __piBookFull?: boolean; __piBookBadge?: string };

type Theme = { fg: (color: string, text: string) => string; bold: (text: string) => string };

let patched = false;

export default function (pi: ExtensionAPI) {
	if (patched) return;
	patched = true;

	let enabled = true;
	// Tells tree-style.ts a page frame is on screen to draw selectors in
	shared.__piBookActive = false;
	// True while /book nav has the keys: the frame is highlighted
	let navigating = false;
	// Page being viewed; 0 means "follow the newest page"
	let page = 0;
	let pageCount = 0;
	// Lines scrolled up from the end of the page; 0 means "follow the end"
	let scroll = 0;
	let maxScroll = 0;
	let room = 10;
	let requestRender = () => {};
	let viewport = (): Viewport | undefined => undefined;
	// Spinner frame while an answer runs; shown in the page border instead of Pi's
	// status line, which would make the input area taller and move the page
	let working = false;
	let frame = 0;
	let spinTimer: ReturnType<typeof setInterval> | undefined;
	let minHeight = Number.POSITIVE_INFINITY;
	let heightKey = "";
	// Pi sets the chat area height after drawing it; draw again when it shrinks
	const watched = new WeakSet<object>();
	function watchLayout(view: Viewport & { updateLayout?: (...args: unknown[]) => void }) {
		if (watched.has(view) || typeof view.updateLayout !== "function") return;
		watched.add(view);
		const updateLayout = view.updateLayout;
		view.updateLayout = function (this: Viewport, ...args: unknown[]) {
			updateLayout.apply(this, args);
			if (enabled && this.viewportHeight > 0 && this.viewportHeight < minHeight) queueMicrotask(requestRender);
		};
	}
	let theme: Theme = { fg: (_color, text) => text, bold: (text) => text };

	function go(target: number) {
		if (pageCount === 0) return;
		const next = Math.min(Math.max(1, target), pageCount);
		page = next === pageCount ? 0 : next;
		scroll = 0;
		requestRender();
	}

	function scrollBy(lines: number) {
		scroll = Math.min(Math.max(0, scroll + lines), maxScroll);
		requestRender();
	}

	pi.on("session_start", async (_event, ctx) => {
		page = 0;
		shared.__piBookActive = false;
		// Full screen is the default
		shared.__piBookFull = true;
		if (ctx.mode !== "tui") return;
		theme = ctx.ui.theme as unknown as Theme;
		ctx.ui.setWorkingVisible(false);
		// Empty widget, only to get the TUI handle for redraws after a page flip
		ctx.ui.setWidget("book", (tui) => {
			requestRender = () => tui.requestRender();
			// biome-ignore lint: getPrimaryScrollView is not in the public TUI type
			viewport = () => (tui as any).getPrimaryScrollView?.();
			return { render: () => [], invalidate() {} };
		});
	});

	pi.on("agent_start", async () => {
		working = true;
		clearInterval(spinTimer);
		spinTimer = setInterval(() => {
			frame = (frame + 1) % SPINNER.length;
			requestRender();
		}, 80);
	});
	pi.on("agent_end", async () => {
		working = false;
		clearInterval(spinTimer);
		requestRender();
	});
	pi.on("session_shutdown", async () => clearInterval(spinTimer));

	// Answer style: i-have-adhd + caveman ultra on every turn
	pi.on("before_agent_start", async (event) => {
		page = 0;
		scroll = 0;

		const bodies = STYLE_SKILLS.map(skillBody).filter(Boolean);
		if (bodies.length === 0) return;
		const style = [...bodies, STYLE_NOTE].join("\n\n");

		const options = event.systemPromptOptions;
		if (options && "sections" in options) {
			options.appendSystemPrompt = [options.appendSystemPrompt, style].filter(Boolean).join("\n\n");
			return;
		}
		return { systemPrompt: `${event.systemPrompt}\n\n${style}` };
	});


	pi.registerCommand("book", {
		description: "Toggle book mode, or move through pages: /book nav | full | <n> | prev | next",
		handler: async (args, ctx) => {
			const arg = args?.trim() ?? "";
			if (arg === "nav") {
				if (!enabled || ctx.mode !== "tui") return;
				navigating = true;
				requestRender();
				try {
					await ctx.ui.custom<void>(
						(tui, theme, _keybindings, done) => ({
							render: () => [theme.fg("dim", " ←→ page · ↑↓ scroll · Esc close ")],
							invalidate() {},
							handleInput: (data: string) => {
								const half = Math.max(1, room >> 1);
								if (matchesKey(data, Key.escape) || data === "q") done();
								else if (matchesKey(data, Key.left) || data === "h") go((page || pageCount) - 1);
								else if (matchesKey(data, Key.right) || data === "l") go((page || pageCount) + 1);
								else if (matchesKey(data, Key.up) || data === "k") scrollBy(1);
								else if (matchesKey(data, Key.down) || data === "j") scrollBy(-1);
								else if (matchesKey(data, Key.pageUp)) scrollBy(half);
								else if (matchesKey(data, Key.pageDown)) scrollBy(-half);
								else if (matchesKey(data, Key.home)) go(1);
								else if (matchesKey(data, Key.end)) go(pageCount);
								tui.requestRender();
							},
						}),
						{ overlay: true, overlayOptions: { anchor: "bottom-center" } },
					);
				} finally {
					navigating = false;
					requestRender();
				}
				return;
			}
			if (arg === "full") {
				enabled = true;
				shared.__piBookFull = !shared.__piBookFull;
				// The chat area changes height: measure it again
				heightKey = "";
				scroll = 0;
				requestRender();
				return;
			}
			if (arg === "prev") return go((page || pageCount) - 1);
			if (arg === "next") return go((page || pageCount) + 1);
			if (/^\d+$/.test(arg)) return go(Number(arg));
			enabled = !enabled;
			// Book mode on starts in full screen; off brings the context panel back
			shared.__piBookFull = enabled;
			if (!enabled) shared.__piBookActive = false;
			page = 0;
			ctx.ui.notify(enabled ? "Book mode on" : "Book mode off", "info");
			requestRender();
		},
	});

	// Highlights in answers: bold first line, colored step numbers, "▶ Next:" in green
	const assistant = AssistantMessageComponent.prototype as Renderable;
	const assistantRender = assistant.render;
	assistant.render = function (this: unknown, width: number): string[] {
		const lines = assistantRender.call(this, width);
		if (!enabled) return lines;
		let first = true;
		return lines.map((line) => {
			const text = plain(line).trim();
			if (text === "") return line;
			if (/^(└─ π\s+)?Next:/.test(text)) return line.replace("Next:", theme.fg("success", theme.bold("▶ Next:")));
			if (first && !/^(└─ π\s*)?$/.test(text)) {
				first = false;
				return theme.bold(line);
			}
			if (/^(└─ π\s+)?\d+\.\s/.test(text)) return line.replace(/(\d+\.)/, theme.fg("accent", theme.bold("$1")));
			return line;
		});
	};

	// The chat container is the one Container that holds user messages: show only one turn of it
	type MouseEvent = { type: string; wheelDelta?: number };
	type MouseResult = { handled: boolean; render: boolean } | undefined;
	const container = Container.prototype as unknown as Renderable & {
		children: Renderable[];
		mouseLayout?: unknown;
		handleMouse: (event: MouseEvent) => MouseResult;
	};
	const isChat = (c: typeof container) => c.children.some((child) => child instanceof UserMessageComponent);

	// Mouse wheel over the chat scrolls the text inside the page; Pi's own scroll has nothing to move
	const containerMouse = container.handleMouse;
	container.handleMouse = function (this: typeof container, event: MouseEvent): MouseResult {
		if (enabled && event.type === "wheel" && event.wheelDelta && isChat(this)) {
			scrollBy(-event.wheelDelta);
			return { handled: true, render: true };
		}
		return containerMouse.call(this, event);
	};
	const containerRender = container.render;
	container.render = function (this: typeof container, width: number): string[] {
		if (!enabled || !isChat(this)) {
			return containerRender.call(this, width);
		}

		// Split children into turns: each user message starts a new turn
		const turns: Renderable[][] = [];
		for (const child of this.children) {
			if (child instanceof UserMessageComponent) turns.push([]);
			if (turns.length > 0) turns[turns.length - 1].push(child);
		}
		pageCount = turns.length;
		shared.__piBookActive = true;
		if (page > pageCount) page = 0;
		const current = page || pageCount;

		const inner = Math.max(1, width - 4);
		const panel = shared.__piBookPanel;
		const body: string[] = [];
		if (panel) body.push(...panel.render(inner));
		else for (const child of turns[current - 1]) body.push(...child.render(inner));
		while (body.length > 0 && plain(body[0]).trim() === "") body.shift();
		while (body.length > 0 && plain(body[body.length - 1]).trim() === "") body.pop();

		// Child heights no longer match the drawn lines; let mouse handling measure again
		this.mouseLayout = undefined;

		const border = (text: string) => theme.fg(navigating || panel ? "accent" : "border", text);
		// Border line: title on the left, optional text on the right, corners at both edges
		const rule = (left: string, title: string, right: string, end = "") => {
			const fill = Math.max(0, width - 2 - visibleWidth(title) - visibleWidth(end));
			return border(left) + title + border("─".repeat(fill)) + end + border(right);
		};

		// The frame fills the chat area exactly: its height minus
		// the rows above the chat (blank header under the context panel, notices)
		const view = viewport();
		let above = 0;
		for (const child of view?.child?.children ?? []) {
			if (child === this) break;
			above += child.render(width).length;
		}
		// Pi's input area is taller while an answer runs (status line), so the chat area
		// shrinks then. Use the smallest height seen for this terminal size: the page
		// keeps one size and one place, and never slides under the context panel
		const size = `${process.stdout.rows}x${width}x${shared.__piBookFull === true}`;
		if (size !== heightKey) {
			heightKey = size;
			minHeight = Number.POSITIVE_INFINITY;
		}
		if (view?.viewportHeight) minHeight = Math.min(minHeight, view.viewportHeight);
		const height = Number.isFinite(minHeight) ? minHeight : (process.stdout.rows ?? 40) - 6;
		if (view) watchLayout(view);
		room = Math.max(3, height - above - 2);
		// The page never needs scrolling; keep the view pinned so Pi shows no scrollbar or "Jump" hint
		if (view && !view.isFollowingEnd) queueMicrotask(() => view.scrollToEnd());
		// Window of `room` lines into the page, scrolled up `scroll` lines from the end
		maxScroll = Math.max(0, body.length - room);
		scroll = Math.min(scroll, maxScroll);
		let start = body.length - room - scroll;
		// A selector shows from its top, scrolled only to keep the selected row ("›" or "→") on screen
		if (panel) {
			const selected = body.findIndex((line) => /^\s*[›→]/.test(plain(line)));
			start = selected >= room ? selected - room + 1 : 0;
		}
		const shown = body.slice(Math.max(0, start), Math.max(0, start) + room);
		// Full height every time: the frame stays in one place, only the text moves
		while (shown.length < room) shown.push("");

		// Only text on the frame: the page number, plus a spinner while Pi works
		const spin = working ? ` ${SPINNER[frame]}` : "";
		const label = panel ? panel.title : navigating ? `◀ ${current}/${pageCount} ▶` : `${current}/${pageCount}`;
		const badge = shared.__piBookBadge ? ` ${shared.__piBookBadge}${border(" ─")}` : "";
		const top = rule("╭", `${border("─ ")}${theme.fg("accent", `${label}${spin}`)}${border(" ")}`, "╮", badge);
		const bottom = rule("╰", "", "╯");
		const side = (line: string) => {
			const clipped = truncateToWidth(line, inner);
			return `${border("│")} ${clipped}${" ".repeat(Math.max(0, inner - visibleWidth(clipped)))} ${border("│")}`;
		};

		return [top, ...shown.map(side), bottom];
	};
}
