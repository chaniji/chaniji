/**
 * Prompt Rogue: a roguelike inside Pi.
 *
 * Each level: a random coding task, a random prompt budget (1-10) and a random
 * difficulty. Get the agent to finish the task within the budget. Win: pick a
 * perk (3 slots max). Out of prompts: run over.
 *
 * Perks (150) and difficulties (150) are built by the engine from small
 * building blocks; tasks are templates with random parameters and an automatic
 * check. Everything happens in ~/.pi/rogue/, never in your real files.
 *
 *   /rogue          start a run (or show status during a run)
 *   /rogue quit     end the run
 *   /rogue reroll   swap the task (needs a reroll perk)
 */

import { spawn, spawnSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { isAbsolute, join, relative, resolve } from "node:path";
import type { ExtensionAPI, ExtensionContext, Theme } from "@earendil-works/pi-coding-agent";
import { Key, matchesKey } from "@earendil-works/pi-tui";

const ROOT = join(homedir(), ".pi/rogue");
const SLOTS = 3;
const BASE_TOOLS = ["read", "write", "ls"];
const ALL_GAME_TOOLS = ["read", "write", "edit", "ls", "bash", "grep", "find"];

// ── random helpers ─────────────────────────────────────────────────────────
const rnd = (n: number) => Math.floor(Math.random() * n);
const pick = <T>(list: readonly T[]): T => list[rnd(list.length)];
const between = (a: number, b: number) => a + rnd(b - a + 1);
function sample<T>(list: readonly T[], n: number): T[] {
	const copy = [...list];
	const out: T[] = [];
	while (out.length < n && copy.length) out.push(copy.splice(rnd(copy.length), 1)[0]);
	return out;
}

// All unordered pairs, and an even spread of n items from a list
function allPairs<T>(list: readonly T[]): [T, T][] {
	const out: [T, T][] = [];
	for (let i = 0; i < list.length; i++) for (let j = i + 1; j < list.length; j++) out.push([list[i], list[j]]);
	return out;
}
function spread<T>(list: readonly T[], n: number): T[] {
	if (n <= 0) return [];
	const step = list.length / n;
	return Array.from({ length: Math.min(n, list.length) }, (_, i) => list[Math.floor(i * step)]);
}

// Name generator: adjective + noun, unique per index (20×20 = 400 names per salt)
const ADJ = ["Echo", "Silent", "Golden", "Rusty", "Lucky", "Hollow", "Crimson", "Swift", "Ancient", "Frozen", "Wild", "Velvet", "Iron", "Paper", "Neon", "Ghost", "Ember", "Quiet", "Brave", "Cursed"];
const NOUN = ["Quill", "Forge", "Lantern", "Compass", "Spoon", "Crown", "Anchor", "Mirror", "Feather", "Key", "Drum", "Scroll", "Pebble", "Thread", "Bell", "Mask", "Rune", "Candle", "Coin", "Gate"];
const nameFor = (i: number, salt: number) => `${ADJ[(i + salt) % ADJ.length]} ${NOUN[(Math.floor(i / ADJ.length) + salt * 3) % NOUN.length]}`;

// ── perks: effect building blocks ──────────────────────────────────────────
type Mods = {
	budgetAdd: number;
	minBudget: number;
	bestOf: number;
	freePrompts: number;
	charBonus: number;
	charMult: number;
	wordBonus: number;
	unlock: string[];
	ignore: string[];
	unbanVowels: boolean;
	unbanLetter: boolean;
	shields: number;
	carry: number;
	rerolls: number;
	toolCallBonus: number;
	hint: boolean;
};
const emptyMods = (): Mods => ({
	budgetAdd: 0, minBudget: 0, bestOf: 1, freePrompts: 0, charBonus: 0, charMult: 1, wordBonus: 0, unlock: [],
	ignore: [], unbanVowels: false, unbanLetter: false, shields: 0, carry: 0, rerolls: 0, toolCallBonus: 0, hint: false,
});

type Effect = { text: string; apply: (m: Mods) => void };
type Perk = { id: number; name: string; icon: string; desc: string; once: boolean; effects: Effect[] };

const RULE_KINDS = ["chars", "words", "tool", "letter", "include", "case", "spaces", "digits", "start", "punct", "repeat", "calls"];

function perkEffects(): { effect: Effect; once?: boolean }[] {
	const out: { effect: Effect; once?: boolean }[] = [];
	for (const n of [1, 2, 3]) out.push({ effect: { text: `+${n} prompt${n > 1 ? "s" : ""} every level`, apply: (m) => (m.budgetAdd += n) } });
	for (const n of [2, 4, 6]) out.push({ effect: { text: `+${n} prompts next level`, apply: (m) => (m.budgetAdd += n) }, once: true });
	for (const n of [10, 20, 30, 50]) out.push({ effect: { text: `+${n} chars to char limits`, apply: (m) => (m.charBonus += n) } });
	for (const x of [1.5, 2]) out.push({ effect: { text: `char limits ×${x}`, apply: (m) => (m.charMult *= x) } });
	for (const n of [2, 4]) out.push({ effect: { text: `+${n} words to word limits`, apply: (m) => (m.wordBonus += n) } });
	for (const n of [1, 2]) out.push({ effect: { text: `first ${n === 1 ? "prompt" : "2 prompts"} each level free`, apply: (m) => (m.freePrompts += n) } });
	for (const t of ["bash", "edit", "grep", "find"]) out.push({ effect: { text: `unlock ${t}`, apply: (m) => m.unlock.push(t) } });
	for (const n of [1, 2]) out.push({ effect: { text: `shield ×${n} (survive a loss)`, apply: (m) => (m.shields += n) } });
	for (const n of [2, 4]) out.push({ effect: { text: `min budget ${n}`, apply: (m) => (m.minBudget = Math.max(m.minBudget, n)) } });
	out.push({ effect: { text: "budget: best of 2 rolls", apply: (m) => (m.bestOf = Math.max(m.bestOf, 2)) } });
	out.push({ effect: { text: "budget: best of 3 rolls", apply: (m) => (m.bestOf = Math.max(m.bestOf, 3)) } });
	for (const n of [1, 3]) out.push({ effect: { text: `carry up to ${n} unused prompt${n > 1 ? "s" : ""}`, apply: (m) => (m.carry += n) } });
	for (const n of [1, 2]) out.push({ effect: { text: `${n} task reroll${n > 1 ? "s" : ""} per level`, apply: (m) => (m.rerolls += n) } });
	for (const n of [2, 5]) out.push({ effect: { text: `+${n} tool calls per prompt`, apply: (m) => (m.toolCallBonus += n) } });
	out.push({ effect: { text: "vowels allowed again", apply: (m) => (m.unbanVowels = true) } });
	out.push({ effect: { text: "banned letter allowed again", apply: (m) => (m.unbanLetter = true) } });
	out.push({ effect: { text: "agent sees the exact check", apply: (m) => (m.hint = true) } });
	for (const k of ["chars", "words", "tool", "letter", "include", "case", "start"]) {
		out.push({ effect: { text: `ignore "${k}" rules`, apply: (m) => m.ignore.push(k) } });
	}
	return out;
}

const ICONS = ["✨", "🪶", "🔮", "🍀", "🗝", "🛡", "⚡", "🎯", "🧭", "🕯", "💎", "🪙"];

function buildPerks(): Perk[] {
	const base = perkEffects();
	const perks: Perk[] = base.map((b, i) => ({
		id: i, name: nameFor(i, 0), icon: ICONS[i % ICONS.length], desc: b.effect.text, once: !!b.once, effects: [b.effect],
	}));
	// Fill to 150 with combos of two blocks (never two "once" blocks), spread over all pairs
	const pairs = allPairs(base).filter(([a, b]) => !(a.once && b.once));
	for (const [a, b] of spread(pairs, 150 - perks.length)) {
		const id = perks.length;
		perks.push({ id, name: nameFor(id, 0), icon: ICONS[id % ICONS.length], desc: `${a.effect.text} · ${b.effect.text}`, once: !!(a.once || b.once), effects: [a.effect, b.effect] });
	}
	return perks.slice(0, 150);
}

// ── difficulties: rule building blocks ─────────────────────────────────────
type Ctx = { mods: Mods; promptIndex: number };
type Rule = {
	kind: string;
	text: string;
	check?: (prompt: string, c: Ctx) => string | undefined; // returns a reason when broken
	banTool?: string;
	hideFirst?: boolean;
	budgetMinus?: number;
	maxCalls?: number;
};
type Difficulty = { id: number; name: string; tier: number; rules: Rule[] };

const VOWELS = /[aeiou]/i;
function singleRules(): { rule: Rule; tier: number }[] {
	const out: { rule: Rule; tier: number }[] = [];
	for (let n = 20; n <= 100; n += 5) {
		out.push({
			tier: n >= 70 ? 1 : n >= 40 ? 2 : 3,
			rule: { kind: "chars", text: `max ${n} chars`, check: (p, c) => { const lim = Math.round(n * c.mods.charMult + c.mods.charBonus); return p.length > lim ? `max ${lim} chars (you used ${p.length})` : undefined; } },
		});
	}
	for (let n = 3; n <= 12; n++) {
		out.push({
			tier: n >= 9 ? 1 : n >= 6 ? 2 : 3,
			rule: { kind: "words", text: `max ${n} words`, check: (p, c) => { const lim = n + c.mods.wordBonus; const w = p.trim().split(/\s+/).length; return w > lim ? `max ${lim} words (you used ${w})` : undefined; } },
		});
	}
	for (const t of ["write", "edit", "bash", "read", "ls"]) out.push({ tier: t === "write" || t === "read" ? 3 : 1, rule: { kind: "tool", text: `no ${t} tool`, banTool: t } });
	for (const l of ["e", "a", "o", "i", "s", "t", "n", "r"]) {
		out.push({ tier: l === "e" ? 3 : 2, rule: { kind: "letter", text: `no letter "${l}"`, check: (p, c) => (!c.mods.unbanLetter && p.toLowerCase().includes(l) ? `no letter "${l}"` : undefined) } });
	}
	out.push({ tier: 4, rule: { kind: "letter", text: "no vowels", check: (p, c) => (!c.mods.unbanVowels && VOWELS.test(p) ? "no vowels allowed" : undefined) } });
	for (const w of ["please", "banana", "pi", "now"]) out.push({ tier: 1, rule: { kind: "include", text: `must say "${w}"`, check: (p) => (new RegExp(`\\b${w}\\b`, "i").test(p) ? undefined : `must include "${w}"`) } });
	out.push({ tier: 1, rule: { kind: "case", text: "lowercase only", check: (p) => (p !== p.toLowerCase() ? "lowercase only" : undefined) } });
	out.push({ tier: 2, rule: { kind: "case", text: "UPPERCASE only", check: (p) => (p !== p.toUpperCase() ? "UPPERCASE only" : undefined) } });
	out.push({ tier: 3, rule: { kind: "spaces", text: "no spaces", check: (p) => (/\s/.test(p) ? "no spaces allowed" : undefined) } });
	out.push({ tier: 2, rule: { kind: "digits", text: "no digits", check: (p) => (/\d/.test(p) ? "no digits allowed" : undefined) } });
	out.push({ tier: 2, rule: { kind: "punct", text: "no punctuation", check: (p) => (/[.,!?;:'"()\[\]{}\/\\-]/.test(p) ? "no punctuation allowed" : undefined) } });
	out.push({ tier: 2, rule: { kind: "hidden", text: "agent can't see your 1st prompt", hideFirst: true } });
	for (const n of [3, 5]) out.push({ tier: 1, rule: { kind: "words", text: `at least ${n} words`, check: (p) => (p.trim().split(/\s+/).length < n ? `at least ${n} words` : undefined) } });
	for (const l of ["a", "b", "c", "m", "w"]) out.push({ tier: 1, rule: { kind: "start", text: `start with "${l}"`, check: (p) => (p.trim().toLowerCase().startsWith(l) ? undefined : `must start with "${l}"`) } });
	for (const n of [1, 2]) out.push({ tier: 2, rule: { kind: "budget", text: `-${n} prompt${n > 1 ? "s" : ""}`, budgetMinus: n } });
	for (const n of [2, 3, 5, 8]) out.push({ tier: n <= 3 ? 3 : 2, rule: { kind: "calls", text: `max ${n} tool calls per prompt`, maxCalls: n } });
	out.push({ tier: 2, rule: { kind: "repeat", text: "no repeated words", check: (p) => { const w = p.toLowerCase().split(/\s+/).filter(Boolean); return new Set(w).size !== w.length ? "no repeated words" : undefined; } } });
	return out;
}

function buildDifficulties(): Difficulty[] {
	const singles = singleRules();
	const list: Difficulty[] = singles.map((s, i) => ({ id: i, name: nameFor(i, 7), tier: s.tier, rules: [s.rule] }));
	// Fill to 150 with pairs of different kinds, spread over all pairs
	const pairs = allPairs(singles).filter(([a, b]) => a.rule.kind !== b.rule.kind);
	for (const [a, b] of spread(pairs, 150 - list.length)) {
		const id = list.length;
		list.push({ id, name: nameFor(id, 7), tier: Math.min(5, a.tier + b.tier), rules: [a.rule, b.rule] });
	}
	return list.slice(0, 150);
}

const PERKS = buildPerks();
const DIFFICULTIES = buildDifficulties();

function difficultyFor(level: number): Difficulty {
	const maxTier = level <= 1 ? 1 : level <= 2 ? 2 : level <= 4 ? 3 : level <= 6 ? 4 : 5;
	const pool = DIFFICULTIES.filter((d) => d.tier <= maxTier && d.tier >= Math.max(1, maxTier - 2));
	const base = pick(pool.length ? pool : DIFFICULTIES);
	if (level < 7) return base;
	// Level 7+: stack one extra rule of a new kind
	const extra = pick(DIFFICULTIES.filter((d) => d.rules.length === 1 && !base.rules.some((r) => r.kind === d.rules[0].kind)));
	return { id: base.id, name: `${base.name} +`, tier: 5, rules: [...base.rules, ...extra.rules] };
}

// ── tasks: templates + random parameters + automatic check ─────────────────
type Task = { text: string; hint: string; seed?: Record<string, string>; check: (dir: string) => Promise<boolean> };

const WORDS = ["mango", "tiger", "cloud", "rocket", "pixel", "lemon", "orbit", "maple", "comet", "otter"];
const KEYS = ["msg", "color", "name", "status", "value", "fruit", "mood"];
const VALUES = ["yellow", "ok", "hi", "blue", "happy", "fast", "42"];

function runNode(dir: string, file: string, args: string[]): string | undefined {
	if (!existsSync(join(dir, file))) return undefined;
	const r = spawnSync("node", [file, ...args], { cwd: dir, encoding: "utf8", timeout: 4000 });
	return r.status === 0 ? r.stdout.trim() : undefined;
}

async function httpGet(port: number, path: string): Promise<{ status: number; body: string } | undefined> {
	try {
		const res = await fetch(`http://127.0.0.1:${port}${path}`, { signal: AbortSignal.timeout(800) });
		return { status: res.status, body: await res.text() };
	} catch {
		return undefined;
	}
}

async function withServer(dir: string, file: string, port: number, test: () => Promise<boolean>): Promise<boolean> {
	if (!existsSync(join(dir, file))) return false;
	const child = spawn("node", [file], { cwd: dir, stdio: "ignore", env: { ...process.env, PORT: String(port) } });
	try {
		for (let i = 0; i < 15; i++) {
			await new Promise((r) => setTimeout(r, 200));
			if (await httpGet(port, "/__ping__")) break;
		}
		return await test();
	} finally {
		child.kill();
	}
}

const sameJson = (body: string, want: unknown) => {
	try {
		return JSON.stringify(JSON.parse(body)) === JSON.stringify(want);
	} catch {
		return false;
	}
};

function makeTask(level: number): Task {
	const port = between(4100, 4900);
	const w = pick(WORDS);
	const k = pick(KEYS);
	const v = pick(VALUES);
	const templates: (() => Task)[] = [
		() => ({
			text: `API: server.js (Node http) on port ${port}, GET /${w} → {"${k}":"${v}"}`,
			hint: `node server.js must listen on ${port}; GET /${w} returns JSON {"${k}":"${v}"}`,
			check: (d) => withServer(d, "server.js", port, async () => { const r = await httpGet(port, `/${w}`); return !!r && sameJson(r.body, { [k]: v }); }),
		}),
		() => {
			const t = pick(["upper", "reverse", "count", "sum"] as const);
			const desc = { upper: "prints its arguments in UPPERCASE", reverse: "prints its argument reversed", count: "prints how many arguments it got", sum: "prints the sum of its number arguments" }[t];
			return {
				text: `CLI: ${w}.js ${desc}`,
				hint: `run as: node ${w}.js <args>; output only the result`,
				check: async (d) => {
					if (t === "upper") return runNode(d, `${w}.js`, ["hi", "pi"]) === "HI PI";
					if (t === "reverse") return runNode(d, `${w}.js`, ["rogue"]) === "eugor";
					if (t === "count") return runNode(d, `${w}.js`, ["a", "b", "c"]) === "3";
					return runNode(d, `${w}.js`, ["2", "5", "10"]) === "17";
				},
			};
		},
		() => {
			const n = between(4, 12);
			const lines = Array.from({ length: n }, (_, i) => `line ${i + 1} ${pick(WORDS)}`).join("\n");
			return { text: `File: write the number of lines in notes.txt into count.txt`, hint: "count.txt contains only the number", seed: { "notes.txt": `${lines}\n` }, check: async (d) => existsSync(join(d, "count.txt")) && readFileSync(join(d, "count.txt"), "utf8").trim() === String(n) };
		},
		() => {
			const rows = Array.from({ length: between(3, 6) }, () => [pick(WORDS), between(1, 50)]);
			const sum = rows.reduce((s, r) => s + (r[1] as number), 0);
			return { text: `File: sum column 2 of data.csv, write it to sum.txt`, hint: "sum.txt contains only the number", seed: { "data.csv": `name,amount\n${rows.map((r) => r.join(",")).join("\n")}\n` }, check: async (d) => existsSync(join(d, "sum.txt")) && readFileSync(join(d, "sum.txt"), "utf8").trim() === String(sum) };
		},
		() => {
			const items = Array.from({ length: 6 }, (_, i) => `${i % 2 ? "done" : "todo"}: ${WORDS[i]}`);
			const keep = items.filter((l) => !l.startsWith("done")).join("\n");
			return { text: `File: copy todo.txt to open.txt without the "done" lines`, hint: "same order, one item per line", seed: { "todo.txt": `${items.join("\n")}\n` }, check: async (d) => existsSync(join(d, "open.txt")) && readFileSync(join(d, "open.txt"), "utf8").trim() === keep };
		},
	];
	if (level >= 3) {
		templates.push(() => {
			const w2 = pick(WORDS.filter((x) => x !== w));
			return {
				text: `API: server.js on port ${port}, GET /${w} → {"${k}":"${v}"} and GET /${w2} → 404`,
				hint: `node server.js on ${port}; /${w} JSON {"${k}":"${v}"}; /${w2} status 404`,
				check: (d) => withServer(d, "server.js", port, async () => { const a = await httpGet(port, `/${w}`); const b = await httpGet(port, `/${w2}`); return !!a && sameJson(a.body, { [k]: v }) && b?.status === 404; }),
			};
		});
		templates.push(() => ({
			text: `API: server.js on port ${port}, GET /echo?${k}=X → {"${k}":"X"}`,
			hint: `node server.js on ${port}; return the query param as JSON`,
			check: (d) => withServer(d, "server.js", port, async () => { const r = await httpGet(port, `/echo?${k}=${w}`); return !!r && sameJson(r.body, { [k]: w }); }),
		}));
	}
	return pick(templates)();
}

// ── game state ─────────────────────────────────────────────────────────────
type Run = {
	id: string;
	level: number;
	budget: number;
	used: number;
	free: number;
	difficulty: Difficulty;
	perks: Perk[];
	oncePerks: Perk[];
	shieldsUsed: number;
	carried: number;
	rerollsLeft: number;
	task: Task;
	dir: string;
	savedTools: string[];
	callsThisPrompt: number;
	promptsThisLevel: number;
	busy: boolean;
};

export default function (pi: ExtensionAPI) {
	let run: Run | undefined;
	let requestRender: (() => void) | undefined;

	const mods = (): Mods => {
		const m = emptyMods();
		for (const p of [...(run?.perks ?? []), ...(run?.oncePerks ?? [])]) for (const e of p.effects) e.apply(m);
		return m;
	};

	const activeRules = (): Rule[] => {
		const m = mods();
		return (run?.difficulty.rules ?? []).filter((r) => !m.ignore.includes(r.kind));
	};

	function applyTools() {
		if (!run) return;
		const m = mods();
		const banned = activeRules().map((r) => r.banTool).filter(Boolean) as string[];
		const tools = [...new Set([...BASE_TOOLS, ...m.unlock])].filter((t) => !banned.includes(t));
		pi.setActiveTools(tools);
	}

	function startLevel(level: number, ctx: ExtensionContext) {
		if (!run) return;
		run.level = level;
		run.difficulty = difficultyFor(level);
		run.task = makeTask(level);
		run.dir = join(ROOT, run.id, `level-${level}`);
		mkdirSync(run.dir, { recursive: true });
		for (const [file, content] of Object.entries(run.task.seed ?? {})) writeFileSync(join(run.dir, file), content);
		const m = mods();
		let roll = between(1, 10);
		for (let i = 1; i < m.bestOf; i++) roll = Math.max(roll, between(1, 10));
		const minus = activeRules().reduce((s, r) => s + (r.budgetMinus ?? 0), 0);
		run.budget = Math.max(1, Math.max(m.minBudget, roll) + m.budgetAdd + run.carried - minus);
		run.carried = 0;
		run.used = 0;
		run.free = m.freePrompts;
		run.rerollsLeft = m.rerolls;
		run.promptsThisLevel = 0;
		applyTools();
		showWidget(ctx);
	}

	// ── UI ──
	function showWidget(ctx: ExtensionContext) {
		if (!run) {
			ctx.ui.setWidget("rogue", undefined);
			return;
		}
		ctx.ui.setWidget("rogue", (tui: { requestRender: () => void }, theme: Theme) => {
			requestRender = () => tui.requestRender();
			return { render: (width: number) => box(theme, width), invalidate() {} };
		});
	}

	function box(theme: Theme, width: number): string[] {
		if (!run) return [];
		const inner = Math.max(20, width - 4);
		const fit = (s: string) => {
			const plain = s.replace(/\x1b\[[0-9;]*m/g, "");
			return plain.length > inner ? plain.slice(0, inner - 1) + "…" : s + " ".repeat(inner - plain.length);
		};
		const fr = (s: string) => theme.fg("borderAccent", s);
		const left = run.budget - run.used;
		const envelopes = "✉ ".repeat(Math.max(0, left)).trim() + (run.used ? theme.fg("dim", ` ${"·".repeat(run.used)}`) : "");
		const rules = activeRules().map((r) => r.text).join(" · ") || "none";
		const slots = Array.from({ length: SLOTS }, (_, i) => (run!.perks[i] ? `[${run!.perks[i].icon} ${run!.perks[i].name}]` : theme.fg("dim", "[ · ]"))).join(" ");
		const title = ` 🎲 Prompt Rogue · Level ${run.level} `;
		return [
			fr(`╭─${title}${"─".repeat(Math.max(0, inner - title.length))}─╮`),
			`${fr("│")} ${fit(`${theme.fg("muted", "Task:")}       ${run.task.text}`)} ${fr("│")}`,
			`${fr("│")} ${fit(`${theme.fg("muted", "Prompts:")}    ${theme.fg("accent", envelopes)}  ${theme.fg("dim", `(${left}/${run.budget})${run.free ? ` · ${run.free} free` : ""}`)}`)} ${fr("│")}`,
			`${fr("│")} ${fit(`${theme.fg("muted", "Difficulty:")} 💀 ${run.difficulty.name} · ${rules}`)} ${fr("│")}`,
			`${fr("│")} ${fit(`${theme.fg("muted", "Perks:")}      ${slots}`)} ${fr("│")}`,
			fr(`╰${"─".repeat(inner + 2)}╯`),
		];
	}

	// Simple ↑↓/Enter picker overlay; resolves the chosen index (or -1)
	function choose(ctx: ExtensionContext, title: string, options: string[]): Promise<number> {
		return new Promise((resolveChoice) => {
			let sel = 0;
			void ctx.ui.custom<void>(
				(tui, theme, _kb, done) => ({
					render: (width: number) => {
						const inner = Math.max(20, Math.min(width - 4, 70));
						const fr = (s: string) => theme.fg("borderAccent", s);
						const rows = options.map((o, i) => {
							const t = `${i === sel ? theme.fg("accent", "▸ ") : "  "}${o}`;
							const plain = t.replace(/\x1b\[[0-9;]*m/g, "");
							const cut = plain.length > inner ? plain.slice(0, inner - 1) + "…" : t + " ".repeat(inner - plain.length);
							return `${fr("│")} ${cut} ${fr("│")}`;
						});
						const head = ` ${title} `;
						return [fr(`╭─${head}${"─".repeat(Math.max(0, inner - head.length))}─╮`), ...rows, fr(`╰${"─".repeat(inner + 2)}╯`)];
					},
					invalidate() {},
					handleInput: (data: string) => {
						if (matchesKey(data, Key.up) || data === "k") sel = (sel - 1 + options.length) % options.length;
						else if (matchesKey(data, Key.down) || data === "j") sel = (sel + 1) % options.length;
						else if (matchesKey(data, Key.enter)) {
							done();
							resolveChoice(sel);
							return;
						} else if (matchesKey(data, Key.escape)) {
							done();
							resolveChoice(-1);
							return;
						}
						tui.requestRender();
					},
				}),
				{ overlay: true, overlayOptions: { anchor: "center" } },
			);
		});
	}

	function endRun(ctx: ExtensionContext, message?: string) {
		if (!run) return;
		pi.setActiveTools(run.savedTools);
		run = undefined;
		ctx.ui.setWidget("rogue", undefined);
		if (message) ctx.ui.notify(message, "info");
	}

	async function win(ctx: ExtensionContext) {
		if (!run) return;
		run.busy = true;
		const left = run.budget - run.used;
		run.carried = Math.min(left, mods().carry);
		run.oncePerks = [];
		ctx.ui.notify(`✓ TASK DONE · Level ${run.level} cleared with ${left} prompt${left === 1 ? "" : "s"} left`, "info");
		const offers = sample(PERKS.filter((p) => !run!.perks.some((q) => q.id === p.id)), 3);
		const choice = await choose(ctx, "✨ Pick a perk", [...offers.map((p) => `${p.icon} ${p.name} — ${p.desc}${p.once ? " (once)" : ""}`), "⏭ Skip"]);
		if (run && choice >= 0 && choice < offers.length) {
			const perk = offers[choice];
			if (perk.once) run.oncePerks.push(perk);
			else if (run.perks.length < SLOTS) run.perks.push(perk);
			else {
				const r = await choose(ctx, "Slots full · replace which?", [...run.perks.map((p) => `${p.icon} ${p.name} — ${p.desc}`), "Keep all (skip new perk)"]);
				if (run && r >= 0 && r < run.perks.length) run.perks[r] = perk;
			}
		}
		if (!run) return;
		run.busy = false;
		startLevel(run.level + 1, ctx);
	}

	async function lose(ctx: ExtensionContext) {
		if (!run) return;
		const m = mods();
		if (run.shieldsUsed < m.shields) {
			run.shieldsUsed++;
			ctx.ui.notify("🛡 Shield used! Same level, new budget.", "warning");
			const task = run.task;
			startLevel(run.level, ctx);
			run.task = task;
			requestRender?.();
			return;
		}
		const level = run.level;
		const perks = run.perks.map((p) => `${p.icon} ${p.name}`).join(", ") || "none";
		run.busy = true;
		await choose(ctx, `💀 Run over · reached level ${level}`, [`Perks: ${perks}`, "Press Enter"]);
		endRun(ctx);
	}

	// ── commands ──
	pi.registerCommand("rogue", {
		description: "Prompt Rogue: start a run · /rogue quit · /rogue reroll",
		handler: async (args, ctx) => {
			const arg = (args ?? "").trim();
			if (arg === "quit") return endRun(ctx, "Run ended.");
			if (arg === "reroll") {
				if (!run) return ctx.ui.notify("No run active. Type /rogue to start.", "warning");
				if (run.rerollsLeft <= 0) return ctx.ui.notify("No rerolls left (needs a reroll perk).", "warning");
				run.rerollsLeft--;
				run.task = makeTask(run.level);
				for (const [file, content] of Object.entries(run.task.seed ?? {})) writeFileSync(join(run.dir, file), content);
				requestRender?.();
				return ctx.ui.notify("🎲 New task!", "info");
			}
			if (run) return ctx.ui.notify(`Level ${run.level} · ${run.budget - run.used}/${run.budget} prompts left`, "info");
			if (ctx.mode !== "tui") return ctx.ui.notify("Prompt Rogue needs the interactive TUI.", "warning");
			run = {
				id: `run-${Date.now()}`, level: 1, budget: 0, used: 0, free: 0, difficulty: DIFFICULTIES[0], perks: [], oncePerks: [],
				shieldsUsed: 0, carried: 0, rerollsLeft: 0, task: makeTask(1), dir: "", savedTools: pi.getActiveTools(), callsThisPrompt: 0, promptsThisLevel: 0, busy: false,
			};
			startLevel(1, ctx);
			ctx.ui.notify("🎲 Prompt Rogue started! Get the agent to finish the task.", "info");
		},
	});

	// ── prompt rules ──
	pi.on("input", async (event, ctx) => {
		if (!run || run.busy) return;
		const text = String((event as { text?: string }).text ?? "");
		if (text.trim().startsWith("/") || text.trim().startsWith("!")) return;
		if (run.used >= run.budget) {
			ctx.ui.notify("No prompts left.", "warning");
			return { action: "handled" };
		}
		const c: Ctx = { mods: mods(), promptIndex: run.used };
		for (const rule of activeRules()) {
			const reason = rule.check?.(text, c);
			if (reason) {
				ctx.ui.notify(`✗ Blocked: ${reason}. (No prompt used.)`, "warning");
				return { action: "handled" };
			}
		}
		if (run.free > 0) run.free--;
		else run.used++;
		run.callsThisPrompt = 0;
		run.promptsThisLevel++;
		requestRender?.();
		if (run.promptsThisLevel === 1 && activeRules().some((r) => r.hideFirst)) {
			return { action: "transform", text: "…" };
		}
		return;
	});

	pi.on("before_agent_start", async (event) => {
		if (!run) return;
		const task = run.task;
		const note = [
			"",
			"## Prompt Rogue (game mode)",
			`You are playing a game. Work ONLY inside this folder: ${run.dir}`,
			"Use paths inside that folder. Never touch files outside it.",
			`Current task: ${task.text}`,
			mods().hint ? `Exact check: ${task.hint}` : "",
			"Do the task with as few steps as possible.",
		].filter(Boolean).join("\n");
		return { systemPrompt: `${(event as { systemPrompt: string }).systemPrompt}\n${note}` };
	});

	// ── sandbox: keep every tool inside the level folder ──
	pi.on("tool_call", async (event) => {
		if (!run) return;
		const e = event as { toolName: string; input: Record<string, unknown> };
		const maxCalls = Math.min(...activeRules().map((r) => r.maxCalls ?? Infinity));
		if (Number.isFinite(maxCalls) && ++run.callsThisPrompt > maxCalls + mods().toolCallBonus) {
			return { block: true, reason: `Difficulty: max ${maxCalls} tool calls per prompt.` };
		}
		if (e.toolName === "bash") {
			e.input.command = `cd ${JSON.stringify(run.dir)} && ${String(e.input.command ?? "")}`;
			return;
		}
		if (typeof e.input.path === "string" || e.toolName === "ls" || e.toolName === "find" || e.toolName === "grep") {
			const raw = typeof e.input.path === "string" && e.input.path ? e.input.path.replace(/^~/, homedir()) : ".";
			const full = isAbsolute(raw) ? resolve(raw) : resolve(run.dir, raw);
			const rel = relative(run.dir, full);
			if (rel.startsWith("..") || isAbsolute(rel)) return { block: true, reason: `Game mode: only files inside ${run.dir}` };
			e.input.path = full;
		}
	});

	pi.on("agent_end", async (_event, ctx) => {
		if (!run || run.busy) return;
		run.busy = true;
		let ok = false;
		try {
			ok = await run.task.check(run.dir);
		} catch {
			ok = false;
		}
		if (!run) return;
		run.busy = false;
		if (ok) return win(ctx);
		if (run.used >= run.budget && run.free <= 0) return lose(ctx);
		ctx.ui.notify(`Not done yet · ${run.budget - run.used} prompt${run.budget - run.used === 1 ? "" : "s"} left`, "info");
	});

	pi.on("session_shutdown", async (_event, ctx) => {
		if (run) endRun(ctx);
	});
}
