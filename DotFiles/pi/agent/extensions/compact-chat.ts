/**
 * Shell-history chat layout (tree style):
 *
 *   ❯ hi
 *   └─ π Hello! How can I assist you today?
 *
 * - Your messages: "❯" in front, and no blank padding lines above/below
 *   (left over from the old gray box).
 * - Agent answers: tree style, "└─ π" in front of the first text line, no
 *   blank lines or "Cooked" label inside the turn:
 *
 *   ❯ hi
 *   └─ π Hello! How can I assist you today?
 */

import { AssistantMessageComponent, type ExtensionAPI, UserMessageComponent } from "@earendil-works/pi-coding-agent";

// Shell-integration marks (OSC 133) that Pi puts on the padding lines; kept when a line is dropped
const OSC = /\x1b\][^\x07]*\x07/g;
// Leading escape codes, then the 1-space left padding Pi draws
const LEAD_PAD = /^((?:\x1b\[[0-9;]*m|\x1b\][^\x07]*\x07)*) /;
// Hidden-thinking label from cooking-label.ts; dropped in the tree layout
const THINKING_LABEL = /^\s*Cooked\s*$/;

function plain(line: string): string {
	return line.replace(OSC, "").replace(/\x1b\[[0-9;]*m/g, "");
}

function isBlank(line: string): boolean {
	return plain(line).trim() === "";
}

function marks(line: string): string {
	return (line.match(OSC) ?? []).join("");
}

// Replace the 1-space left pad with a 2-column prefix (the caller renders 1 column narrower)
function withPrefix(line: string, prefix: string): string {
	return LEAD_PAD.test(line) ? line.replace(LEAD_PAD, `$1${prefix}`) : prefix + line;
}

type Renderable = { render: (width: number) => string[] };
type Themed = { theme?: { fg: (color: string, text: string) => string } };

let patched = false;

export default function (pi: ExtensionAPI) {
	if (patched) return;
	patched = true;

	let accent = (text: string) => text;
	let dim = (text: string) => text;
	pi.on("session_start", async (_event, ctx) => {
		const theme = (ctx.ui as Themed).theme;
		if (theme) {
			accent = (text) => theme.fg("accent", text);
			dim = (text) => theme.fg("dim", text);
		}
	});

	const user = UserMessageComponent.prototype as Renderable;
	const userRender = user.render;
	user.render = function (this: unknown, width: number): string[] {
		let lines = userRender.call(this, Math.max(1, width - 1));
		if (lines.length >= 3 && isBlank(lines[0]) && isBlank(lines[lines.length - 1])) {
			const body = lines.slice(1, -1);
			body[0] = marks(lines[0]) + body[0];
			body[body.length - 1] += marks(lines[lines.length - 1]);
			lines = body;
		}
		return lines.map((line, i) => withPrefix(line, i === 0 ? accent("❯ ") : "  "));
	};

	const assistant = AssistantMessageComponent.prototype as Renderable;
	const assistantRender = assistant.render;
	assistant.render = function (this: unknown, width: number): string[] {
		const lines = assistantRender.call(this, Math.max(1, width - 4));
		// Drop leading blanks and the "Cooked" label with the blank after it; keep OSC marks
		const kept: string[] = [];
		let pending = "";
		let skipBlank = true;
		for (const line of lines) {
			const text = plain(line);
			if (THINKING_LABEL.test(text)) {
				pending += marks(line);
				skipBlank = true;
				continue;
			}
			if (text.trim() === "" && skipBlank) {
				pending += marks(line);
				continue;
			}
			skipBlank = false;
			kept.push(pending + line);
			pending = "";
		}
		if (pending && kept.length > 0) kept[kept.length - 1] += pending;

		let marked = false;
		return kept.map((line) => {
			if (plain(line).trim() === "") return line;
			if (!marked) {
				marked = true;
				return withPrefix(line, dim("└─ ") + accent("π "));
			}
			return withPrefix(line, "     ");
		});
	};
}
