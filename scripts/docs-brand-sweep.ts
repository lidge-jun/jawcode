/**
 * Align structure/ + struct_har/ prose with jwc runtime branding (.jwc paths, jwc CLI).
 * Does NOT rename upstream axis (gjc_origin/, chase/10_gjc_*, code paths like defaults/jwc/).
 */
import { readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import * as path from "node:path";

const ROOT = process.cwd();
const TARGET_ROOTS = ["structure", "struct_har"];
const EXTS = new Set([".md"]);
const SKIP_DIR_NAMES = new Set(["node_modules", ".git"]);
/** Upstream snapshot + chase gjc axis — keep gjc labels */
const SKIP_PREFIXES = [
	"struct_har/gjc_origin/",
	"struct_har/chase/",
];

type Repl = [RegExp | string, string];

const REPLACEMENTS: Repl[] = [
	[/GJC\/JWC/g, "jwc"],
	[/jwc\/GJC/g, "jwc"],
	[/GJC has own sessions/g, "jwc has own sessions"],
	[/템플릿 첫 줄은 GJC\/Gajae Code identity/g, "템플릿 첫 줄은 Jaw/jwc identity"],
	[/GJC 비언급/g, "legacy gajae-code 비언급"],
	[/GJC 산문/g, "legacy gajae-code 산문"],
	[/현재 native `\.gjc` skills/g, "현재 native `.jwc` skills"],
	[/repo-visible `\.gjc` defaults/g, "repo-visible `.jwc` defaults"],
	[/runtime user\/project `\.gjc` discovery/g, "runtime user/project `.jwc` discovery"],
	[/handoff `\.gjc\//g, "handoff `.jwc/"],
	[/`\.gjc\/specs/g, "`.jwc/specs"],
	[/`\.gjc\/plans/g, "`.jwc/plans"],
	[/`\.gjc\/ultragoal/g, "`.jwc/ultragoal"],
	[/`\.gjc\/state/g, "`.jwc/state"],
	[/`\.gjc\/prompts/g, "`.jwc/prompts"],
	[/`\.gjc\/agent/g, "`~/.jwc/agent"],
	[/~\/\.gjc\//g, "~/.jwc/"],
	[/<cwd>\/\.gjc`/g, "<cwd>/.jwc`"],
	[/<cwd>\/\.gjc\b/g, "<cwd>/.jwc"],
	[/\| `\.gjc` \|/g, "| `.jwc` |"],
	[/\| `GJC_CONFIG_DIR` 또는 `PI_CONFIG_DIR` 또는 `\.gjc` \|/g,
		"| `JWC_CONFIG_DIR` 또는 `GJC_CONFIG_DIR` 또는 `PI_CONFIG_DIR` 또는 `.jwc` |"],
	[/global skills \| `\.gjc` 2계층/g, "global skills | `.jwc` 2계층"],
	[/\+ `~\/\.cli-jaw\/skills` \(D5 목표\)/g, "+ `~/.cli-jaw/skills` (D5 목표)"],
	[/upstream 문서는 `\.gjc` 표기 잔존 가능/g, "upstream 문서는 legacy `.gjc` 표기 잔존 가능"],
	[/`packages\/coding-agent` \| GJC\/JWC CLI 본체/g, "`packages/coding-agent` | jwc CLI 본체"],
	[/GJC backend bridge/g, "jwc backend bridge"],
	[/`gjc-stats` bin/g, "`jwc-stats` / `gjc-stats` bin"],
	[/npm one-line install wrapper\. `gjc` bin wrapper/g, "npm one-line install wrapper. legacy `gjc` bin wrapper"],
	[/project dir는 `\.gjc`/g, "project dir는 `.jwc`"],
	[/project-level `\.gjc\/skills`/g, "project-level `.jwc/skills`"],
	[/project ancestor `\.gjc\/skills`/g, "project ancestor `.jwc/skills`"],
	[/native `\.gjc` source/g, "native `.jwc` source"],
	[/gjc `\.gjc` 디스커버리/g, "legacy gajae-code `.jwc` 디스커버리"],
	[/jaw\.db vs gjc agent db/g, "jaw.db vs jwc agent db"],
	[/`- \.gjc\/`/g, "- `.jwc/`"],
	[/`\.gjc\/` — 런타임/g, "`.jwc/` — 런타임"],
	[/문서 `\.gjc\/` → `\.jwc\/`/g, "문서 legacy `.gjc/` → `.jwc/`"],
	[/085 `\.gjc\/` 문서/g, "085 legacy `.gjc/` 문서"],
	[/`\.gjc` 경로 정책/g, "`.jwc` 경로 정책"],
	[/bin `jwc`, 브랜딩\/문서\/스킬명만 jaw; `\.gjc\/`와/g, "bin `jwc`, 브랜딩/문서/스킬명만 jaw; `.jwc/`와"],
	[/070_memory \| memory hooks \/ `\.gjc` 규약/g, "070_memory | memory hooks / `.jwc` 규약"],
	[/`GJC_TEAM_\*` env·`\.gjc\/` 경로/g, "`GJC_TEAM_*` env·`.jwc/` 경로"],
	[/CONFLICT-EXPECTED \| `\.gjc\/`·`defaults\/gjc`/g, "CONFLICT-EXPECTED | `.jwc/`·`defaults/gjc`"],
	[/업스트림 계약상 고정 경로/g, "jwc 런타임 표준 경로"],
	[/`\.gjc\/` 경로 계약/g, "`.jwc/` 경로 계약 (upstream AGENTS.md는 legacy `.gjc/` 표기)"],
];

function shouldSkip(rel: string): boolean {
	return SKIP_PREFIXES.some((p) => rel.startsWith(p));
}

function applyReplacements(text: string): string {
	let out = text;
	for (const [from, to] of REPLACEMENTS) {
		if (typeof from === "string") {
			out = out.split(from).join(to);
		} else {
			out = out.replace(from, to);
		}
	}
	return out;
}

let changed = 0;

function sweepFile(abs: string, rel: string): void {
	if (shouldSkip(rel)) return;
	const before = readFileSync(abs, "utf8");
	const after = applyReplacements(before);
	if (after !== before) {
		writeFileSync(abs, after, "utf8");
		changed++;
		console.log(rel);
	}
}

function walk(dir: string, relBase: string): void {
	for (const name of readdirSync(dir)) {
		if (SKIP_DIR_NAMES.has(name)) continue;
		const abs = path.join(dir, name);
		const rel = relBase ? `${relBase}/${name}` : name;
		const st = statSync(abs);
		if (st.isDirectory()) {
			if (shouldSkip(`${rel}/`)) continue;
			walk(abs, rel);
		} else if (EXTS.has(path.extname(name))) {
			sweepFile(abs, rel);
		}
	}
}

for (const root of TARGET_ROOTS) {
	walk(path.join(ROOT, root), root);
}

console.log(`\ndocs-brand-sweep: ${changed} files updated`);