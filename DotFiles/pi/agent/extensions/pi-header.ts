/**
 * Hides the built-in startup header (logo and keybinding hints),
 * leaving the top of the screen empty.
 */

import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";

export default function (pi: ExtensionAPI) {
	pi.on("session_start", async (_event, ctx) => {
		if (ctx.mode === "tui") {
			ctx.ui.setHeader(() => {
				return {
					render(_width: number): string[] {
						return [];
					},
					invalidate() {},
				};
			});
		}
	});
}
