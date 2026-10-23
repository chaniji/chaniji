/**
 * Wait time between prompts: after a prompt is sent, the next one is locked
 * for 5 minutes, to read the answer and think first.
 *
 *   ╭─ 3/3 ───────────────────────────── 3:40 ─╮
 *   │ ❯ how fix port                            │
 *   │ └─ π Run `lsof -i :3001`                  │
 *   ╰───────────────────────────────────────────╯
 *   ❯ _   (Enter keeps the text and sends nothing until 0:00)
 *
 * - Time left shows in book.ts's page border, or in the footer when book mode is off
 * - "/" commands and "!" shell commands always work
 * - Strict: no command to turn it off or change the time
 */

import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";

const MINUTES = 5;
// How long the label stays orange after a locked prompt
const FLASH_MS = 1000;

// Set for book.ts: text shown on the right of the page border
const book = globalThis as { __piBookActive?: boolean; __piBookBadge?: string };

type Theme = { fg: (color: string, text: string) => string };
type Ui = { setStatus: (key: string, text: string | undefined) => void };

function clock(ms: number): string {
	const seconds = Math.ceil(ms / 1000);
	return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;
}

export default function (pi: ExtensionAPI) {
	// Time the lock ends; 0 means not locked
	let until = 0;
	let flashUntil = 0;
	let timer: ReturnType<typeof setInterval> | undefined;
	let theme: Theme = { fg: (_color, text) => text };
	let ui: Ui | undefined;
	let requestRender = () => {};

	const left = () => Math.max(0, until - Date.now());

	function show() {
		const ms = left();
		if (ms === 0) {
			stop();
			return;
		}
		const color = Date.now() < flashUntil ? "warning" : "muted";
		book.__piBookBadge = theme.fg(color, clock(ms));
		// Footer only when book mode is off: the page border shows it otherwise
		ui?.setStatus("wait", book.__piBookActive ? undefined : theme.fg(color, clock(ms)));
		requestRender();
	}

	function stop() {
		clearInterval(timer);
		timer = undefined;
		until = 0;
		book.__piBookBadge = undefined;
		ui?.setStatus("wait", undefined);
		requestRender();
	}

	function start() {
		until = Date.now() + MINUTES * 60_000;
		clearInterval(timer);
		timer = setInterval(show, 1000);
		show();
	}

	pi.on("session_start", async (_event, ctx) => {
		stop();
		if (ctx.mode !== "tui") return;
		theme = ctx.ui.theme as unknown as Theme;
		ui = ctx.ui as unknown as Ui;
		// Empty widget, only to get the TUI handle for redraws
		ctx.ui.setWidget("prompt-wait", (tui) => {
			requestRender = () => tui.requestRender();
			return { render: () => [], invalidate() {} };
		});
	});
	pi.on("session_shutdown", async () => clearInterval(timer));

	pi.on("input", async (event, ctx) => {
		const text = event.text.trim();
		if (event.source === "extension" || text === "" || text.startsWith("/") || text.startsWith("!")) {
			return { action: "continue" };
		}
		if (left() > 0) {
			// Put the text back once Pi has cleared the input
			setTimeout(() => ctx.ui.setEditorText(event.text), 0);
			flashUntil = Date.now() + FLASH_MS;
			show();
			return { action: "handled" };
		}
		start();
		return { action: "continue" };
	});
}
