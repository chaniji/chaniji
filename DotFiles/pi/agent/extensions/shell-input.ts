/**
 * Shell-style input: no border lines around the editor, just a "❯" prompt.
 *
 *   ❯ _
 */

import { CustomEditor, type ExtensionAPI, type KeybindingsManager } from "@earendil-works/pi-coding-agent";
import type { EditorTheme, TUI } from "@earendil-works/pi-tui";

// True when a line is only border characters (ANSI codes removed)
function isBorder(line: string): boolean {
	const plain = line.replace(/\x1b\[[0-9;]*m/g, "").trim();
	return plain.length > 0 && /^[─━═]+$/.test(plain);
}

export default function (pi: ExtensionAPI) {
	pi.on("session_start", (_event, ctx) => {
		if (ctx.mode !== "tui") return;

		class ShellEditor extends CustomEditor {
			constructor(tui: TUI, theme: EditorTheme, keybindings: KeybindingsManager) {
				super(tui, theme, keybindings, { paddingX: 0 });
			}

			render(width: number): string[] {
				const lines = super.render(Math.max(1, width - 2));
				if (lines.length < 2 || !isBorder(lines[0])) return lines;

				// Text lines sit between the top border and the next border line
				const bottom = lines.findIndex((line, i) => i > 0 && isBorder(line));
				const end = bottom === -1 ? lines.length : bottom;
				const text = lines.slice(1, end);
				const below = bottom === -1 ? [] : lines.slice(bottom + 1);

				const prompt = ctx.ui.theme.fg("accent", "❯ ");
				return [...text.map((line, i) => (i === 0 ? prompt : "  ") + line), ...below];
			}
		}

		ctx.ui.setEditorComponent((tui, theme, keybindings) => new ShellEditor(tui, theme, keybindings));
	});
}
