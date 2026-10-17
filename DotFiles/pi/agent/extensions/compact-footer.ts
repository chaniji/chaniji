/**
 * Short one-line footer that fits small windows:
 *
 *   ~/Works · ⎇ main · ◈ agents · sonnet-5 · 1%   ⟳ 2 subagents
 *
 * "◈ agents" shows when the folder has an AGENTS.md / CLAUDE.md file.
 * Status texts from other extensions (ctx.ui.setStatus) show on the right.
 */

import { existsSync } from "node:fs";
import { join } from "node:path";
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { truncateToWidth } from "@earendil-works/pi-tui";

// false: hide the info line; only other extensions' status texts show (if any)
const SHOW_INFO = false;

// Same context files Pi itself loads from a folder
const AGENT_FILES = ["AGENTS.override.md", "AGENTS.md", "AGENTS.MD", "CLAUDE.md", "CLAUDE.MD"];

function shortenPath(path: string): string {
	const home = process.env.HOME;
	return home && path.startsWith(home) ? `~${path.slice(home.length)}` : path;
}

function hasAgentFile(cwd: string): boolean {
	return AGENT_FILES.some((name) => existsSync(join(cwd, name)));
}

function statusTexts(statuses: unknown): string[] {
	if (statuses instanceof Map) return [...statuses.values()].map(String);
	if (statuses && typeof statuses === "object") return Object.values(statuses).map(String);
	return [];
}

export default function (pi: ExtensionAPI) {
	let requestRender: (() => void) | undefined;
	let cwd = process.cwd();
	let agentFile = false;

	pi.on("session_start", async (_event, ctx) => {
		if (ctx.mode !== "tui") return;

		cwd = ctx.cwd ?? process.cwd();
		agentFile = hasAgentFile(cwd);

		ctx.ui.setFooter((tui, theme, footerData) => {
			requestRender = () => tui.requestRender();
			const unsub = footerData.onBranchChange(() => tui.requestRender());
			const dim = (text: string) => theme.fg("dim", text);

			return {
				dispose: unsub,
				invalidate() {},
				render(width: number): string[] {
					const branch = footerData.getGitBranch();
					const model = ctx.model?.id.replace(/^claude-/, "");
					const percent = ctx.getContextUsage()?.percent;

					const parts = [
						dim(shortenPath(cwd)),
						branch ? dim(`⎇ ${branch}`) : undefined,
						agentFile ? theme.fg("accent", "◈ agents") : undefined,
						model ? dim(model) : undefined,
						percent != null ? dim(`${Math.round(percent)}%`) : undefined,
					].filter(Boolean);

					const statuses = statusTexts(footerData.getExtensionStatuses()).filter(Boolean);
					const right = statuses.length ? `   ${statuses.join("  ")}` : "";

					if (!SHOW_INFO) return statuses.length ? [truncateToWidth(statuses.join("  "), width)] : [];
					return [truncateToWidth(parts.join(dim(" · ")) + right, width)];
				},
			};
		});
	});

	pi.on("model_select", async () => requestRender?.());
	pi.on("agent_end", async () => {
		agentFile = hasAgentFile(cwd);
		requestRender?.();
	});
}
