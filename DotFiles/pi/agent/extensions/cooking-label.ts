/**
 * "Cooking..." with an orange spinner while the AI works,
 * and "Cooked" as the label for hidden thinking blocks.
 */

import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";

const SPINNER_FRAMES = ["⠋", "⠙", "⠹", "⠸", "⠼", "⠴", "⠦", "⠧", "⠇", "⠏"];

export default function (pi: ExtensionAPI) {
	pi.on("session_start", async (_event, ctx) => {
		if (ctx.mode !== "tui") return;

		const accent = (text: string) => ctx.ui.theme.fg("accent", text);
		ctx.ui.setHiddenThinkingLabel("Cooked");
		ctx.ui.setWorkingMessage("Cooking...");
		ctx.ui.setWorkingIndicator({ frames: SPINNER_FRAMES.map(accent), intervalMs: 80 });
	});
}
