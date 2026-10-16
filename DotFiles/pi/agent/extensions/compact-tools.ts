/**
 * Compact tool display: no boxes, one short line per tool call.
 *
 *   ▸ $ kill 12248; sleep 1   ✓ 1 line
 *
 * Press ctrl+o to expand and see the full output.
 */

import type { ExtensionAPI, Theme } from "@earendil-works/pi-coding-agent";
import {
	createBashToolDefinition,
	createEditToolDefinition,
	createFindToolDefinition,
	createGrepToolDefinition,
	createLsToolDefinition,
	createReadToolDefinition,
	createWriteToolDefinition,
} from "@earendil-works/pi-coding-agent";
import { Text } from "@earendil-works/pi-tui";
import { homedir } from "node:os";

const MAX_CALL = 70;
const MAX_EXPANDED = 20;

function shortenPath(path: string): string {
	const home = homedir();
	return path.startsWith(home) ? `~${path.slice(home.length)}` : path;
}

function clip(text: string, max = MAX_CALL): string {
	const oneLine = text.replace(/\s*\n\s*/g, " ⏎ ");
	return oneLine.length > max ? `${oneLine.slice(0, max - 1)}…` : oneLine;
}

function getText(result: { content: { type: string; text?: string }[] }): string {
	const content = result.content.find((c) => c.type === "text");
	return content?.text ?? "";
}

function countLines(text: string): number {
	return text.split("\n").filter((line) => line.trim()).length;
}

function plural(count: number, word: string): string {
	return `${count} ${word}${count === 1 ? "" : "s"}`;
}

// "▸ <name> <detail>" in one line
function callLine(theme: Theme, name: string, detail: string): Text {
	return new Text(`${theme.fg("dim", "▸")} ${theme.fg("toolTitle", name)} ${theme.fg("muted", clip(detail))}`, 0, 0);
}

// "  ✓ <summary>" plus the full output when expanded
function resultLine(theme: Theme, text: string, summary: string, expanded: boolean, isError = false): Text {
	let line = isError ? `  ${theme.fg("error", `✗ ${summary}`)}` : `  ${theme.fg("dim", `✓ ${summary}`)}`;
	if (expanded && text.trim()) {
		const lines = text.trim().split("\n");
		for (const l of lines.slice(0, MAX_EXPANDED)) line += `\n  ${theme.fg("toolOutput", l)}`;
		if (lines.length > MAX_EXPANDED) line += `\n  ${theme.fg("muted", `… ${lines.length - MAX_EXPANDED} more lines`)}`;
	}
	return new Text(line, 0, 0);
}

export default function (pi: ExtensionAPI) {
	const cwd = process.cwd();

	const bash = createBashToolDefinition(cwd);
	pi.registerTool({
		...bash,
		renderShell: "self",
		renderCall: (args, theme) => callLine(theme, "$", args.command || "…"),
		renderResult(result, { expanded, isPartial }, theme) {
			if (isPartial) return new Text(`  ${theme.fg("dim", "… running")}`, 0, 0);
			const text = getText(result);
			const exit = text.match(/exit code: (\d+)/);
			const failed = exit !== null && exit[1] !== "0";
			const summary = failed ? `exit ${exit![1]}` : plural(countLines(text), "line");
			return resultLine(theme, text, summary, expanded || failed, failed);
		},
	});

	const read = createReadToolDefinition(cwd);
	pi.registerTool({
		...read,
		renderShell: "self",
		renderCall: (args, theme) => callLine(theme, "read", shortenPath(args.path || "")),
		renderResult(result, { expanded, isPartial }, theme) {
			if (isPartial) return new Text(`  ${theme.fg("dim", "… reading")}`, 0, 0);
			const text = getText(result);
			return resultLine(theme, text, plural(text.replace(/\n$/, "").split("\n").length, "line"), expanded);
		},
	});

	const edit = createEditToolDefinition(cwd);
	pi.registerTool({
		...edit,
		renderShell: "self",
		renderCall: (args, theme) => callLine(theme, "edit", shortenPath(args.path || "")),
		renderResult(result, { expanded, isPartial }, theme) {
			if (isPartial) return new Text(`  ${theme.fg("dim", "… editing")}`, 0, 0);
			const text = getText(result);
			if (text.startsWith("Error")) return resultLine(theme, text, text.split("\n")[0], false, true);
			const diff = (result.details as { diff?: string } | undefined)?.diff ?? "";
			const lines = diff.split("\n");
			const added = lines.filter((l) => l.startsWith("+") && !l.startsWith("+++")).length;
			const removed = lines.filter((l) => l.startsWith("-") && !l.startsWith("---")).length;
			return resultLine(theme, diff, `+${added} -${removed}`, expanded);
		},
	});

	const write = createWriteToolDefinition(cwd);
	pi.registerTool({
		...write,
		renderShell: "self",
		renderCall: (args, theme) => callLine(theme, "write", shortenPath(args.path || "")),
		renderResult(result, { isPartial }, theme) {
			if (isPartial) return new Text(`  ${theme.fg("dim", "… writing")}`, 0, 0);
			const text = getText(result);
			const failed = text.startsWith("Error");
			return resultLine(theme, text, failed ? text.split("\n")[0] : "saved", false, failed);
		},
	});

	for (const [name, tool, unit] of [
		["find", createFindToolDefinition(cwd), "file"],
		["grep", createGrepToolDefinition(cwd), "match"],
		["ls", createLsToolDefinition(cwd), "entry"],
	] as const) {
		pi.registerTool({
			...tool,
			renderShell: "self",
			renderCall: (args: { pattern?: string; path?: string }, theme: Theme) =>
				callLine(theme, name, [args.pattern, shortenPath(args.path || ".")].filter(Boolean).join(" in ")),
			renderResult(result, { expanded, isPartial }, theme) {
				if (isPartial) return new Text(`  ${theme.fg("dim", "… searching")}`, 0, 0);
				const text = getText(result);
				const count = countLines(text);
				return resultLine(theme, text, unit === "entry" && count !== 1 ? `${count} entries` : plural(count, unit), expanded);
			},
		});
	}
}
