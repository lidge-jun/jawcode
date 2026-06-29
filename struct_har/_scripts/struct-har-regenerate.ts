/**
 * Regenerate struct_har band 02_code_facts.md (gjc_origin + jwc_patched) from band anchors.
 * Run: bun struct_har/_scripts/struct-har-regenerate.ts
 */
import * as fs from "node:fs";
import * as path from "node:path";
import { resolveForkHead, resolveGjcClonePath, resolveGjcHead } from "./resolve-heads.ts";

const ROOT = path.resolve(import.meta.dir, "../..");
const GJC_CLONE = resolveGjcClonePath();
const GJC_CLONE_REL = path.relative(ROOT, GJC_CLONE);
const STRUCT = path.join(ROOT, "struct_har");

const FORK_HEAD = resolveForkHead();
const GJC_HEAD = resolveGjcHead();

type BandDef = {
	id: string;
	moc: string;
	gjcAnchors: string[];
	jwcAnchors: string[];
	forkDelta?: string[];
};

const BANDS: BandDef[] = [
	{
		id: "010_shell",
		moc: "010_moc_shell_rename.md",
		gjcAnchors: [
			"packages/coding-agent/package.json",
			"packages/utils/src/dirs.ts",
			"scripts/rebrand-inventory.ts",
		],
		jwcAnchors: [
			"packages/jwc/package.json",
			"packages/jwc/bin/jwc.js",
			"packages/jwc/src/sdk.ts",
			"scripts/rebrand-inventory.ts",
		],
		forkDelta: ["packages/jwc/** NEW", "gjc bin REMOVED (085.5-M7)"],
	},
	{
		id: "020_prompt",
		moc: "020_moc_prompting.md",
		gjcAnchors: [
			"packages/coding-agent/src/system-prompt.ts",
			"packages/coding-agent/src/prompts/system/system-prompt.md",
			"packages/coding-agent/src/jwc-runtime/agent-identity.ts",
		],
		jwcAnchors: [
			"packages/coding-agent/src/system-prompt.ts",
			"packages/coding-agent/src/prompts/system/system-prompt.md",
			"packages/coding-agent/src/jwc-runtime/agent-identity.ts",
			"structure/20_prompt_flow.md",
		],
		forkDelta: ["system-prompt.md HARD-EDIT", "prompts/tools/*.md HARD-EDIT", "agent-identity.ts NEW"],
	},
	{
		id: "030_skills",
		moc: "030_moc_skills_discovery.md",
		gjcAnchors: [
			"packages/coding-agent/src/defaults/gjc-defaults.ts",
			"packages/coding-agent/src/extensibility/skills.ts",
		],
		jwcAnchors: [
			"packages/coding-agent/src/defaults/jwc-defaults.ts",
			"packages/coding-agent/src/extensibility/skills.ts",
			"packages/coding-agent/src/jwc-runtime/cli-jaw-vocab.ts",
		],
		forkDelta: ["jaw-interview slug", "cli-jaw-vocab.ts NEW (057)"],
	},
	{
		id: "040_interview",
		moc: "040_moc_interview_merge.md",
		gjcAnchors: [
			"packages/coding-agent/src/defaults/gjc/skills/deep-interview/SKILL.md",
			"packages/coding-agent/src/defaults/gjc-defaults.ts",
		],
		jwcAnchors: [
			"packages/coding-agent/src/defaults/jwc/skills/jaw-interview/SKILL.md",
			"packages/coding-agent/src/defaults/jwc-defaults.ts",
			"packages/coding-agent/src/skill-state/jaw-interview-mutation-guard.ts",
		],
		forkDelta: ["deep-interview → jaw-interview HARD-EDIT", "mutation-guard INVERTED-GUARD"],
	},
	{
		id: "050_plan",
		moc: "050_moc_plan_pabcd.md",
		gjcAnchors: [
			"packages/coding-agent/src/defaults/gjc/skills/ralplan/SKILL.md",
			"packages/coding-agent/src/commands/ralplan.ts",
		],
		jwcAnchors: [
			"packages/coding-agent/src/defaults/jwc/skills/plan/SKILL.md",
			"packages/coding-agent/src/jwc-runtime/orchestrate-runtime.ts",
			"packages/coding-agent/src/prompts/jaw/orchestrate-d.md",
			"packages/coding-agent/src/commands/orchestrate.ts",
		],
		forkDelta: ["orchestrate-runtime NEW", "prompts/jaw/orchestrate-* NEW"],
	},
	{
		id: "060_goal",
		moc: "060_moc_goal_merge.md",
		gjcAnchors: [
			"packages/coding-agent/src/defaults/gjc/skills/ultragoal/SKILL.md",
			"packages/coding-agent/src/commands/ultragoal.ts",
		],
		jwcAnchors: [
			"packages/coding-agent/src/defaults/jwc/skills/goal/SKILL.md",
			"packages/coding-agent/src/jwc-runtime/goal-cli.ts",
			"packages/coding-agent/src/jwc-runtime/goal-engine.ts",
			"packages/coding-agent/src/commands/goal.ts",
		],
		forkDelta: ["goal-runtime.ts NEW", "commands/goal.ts NEW"],
	},
	{
		id: "070_memory",
		moc: "99.01.00_moc_memory.md",
		gjcAnchors: ["packages/coding-agent/src/memories/", "packages/utils/src/dirs.ts"],
		jwcAnchors: [
			"packages/coding-agent/src/memories/",
			"structure/22_session_storage.md",
			"devlog/_plan/260612_jawcode_fork/99.01.00_moc_memory.md",
		],
		forkDelta: ["99.01 local-query (planned)", "memory_pipeline.md NEW"],
	},
	{
		id: "080_tui",
		moc: "080_moc_tui.md",
		gjcAnchors: ["packages/tui/", "packages/coding-agent/src/modes/"],
		jwcAnchors: ["packages/tui/", "packages/coding-agent/src/modes/", "packages/coding-agent/src/status-line/"],
		forkDelta: ["TUI jaw branding WIP", "status-line segments 085"],
	},
	{
		id: "081_cursor",
		moc: "081_moc_cursor_tools.md",
		gjcAnchors: ["packages/ai/src/providers/cursor.ts", "packages/coding-agent/src/cursor.ts"],
		jwcAnchors: ["packages/ai/src/providers/cursor.ts", "packages/coding-agent/src/cursor.ts"],
		forkDelta: ["081 hotfixes ✅ (e2e)"],
	},
	{
		id: "082_input",
		moc: "082_moc_tui_input.md",
		gjcAnchors: ["packages/tui/src/"],
		jwcAnchors: ["packages/tui/src/", "packages/coding-agent/src/modes/interactive/"],
		forkDelta: ["082.1 Ctrl/ESC", "082.2 caret jump ✅"],
	},
	{
		id: "083_output",
		moc: "083_moc_tui_output.md",
		gjcAnchors: ["packages/coding-agent/src/tools/renderers/"],
		jwcAnchors: ["packages/coding-agent/src/tools/renderers/", "packages/coding-agent/src/modes/components/"],
		forkDelta: ["083.1 tool collapse ✅", "083.3 reasoning interleave ✅"],
	},
	{
		id: "090_auth",
		moc: "090_moc_auth_release_gate.md",
		gjcAnchors: ["packages/ai/src/auth-storage.ts", "packages/ai/src/utils/oauth/"],
		jwcAnchors: [
			"packages/ai/src/auth-storage.ts",
			"packages/ai/src/utils/oauth/local-token-detect.ts",
			"packages/ai/src/providers/kiro.ts",
		],
		forkDelta: ["local-token-detect NEW", "kiro NEW (091)"],
	},
	{
		id: "100_node",
		moc: "100_moc_node_porting.md",
		gjcAnchors: ["packages/coding-agent/src/cli.ts"],
		jwcAnchors: ["packages/coding-agent/src/cli.ts", "devlog/_plan/260612_jawcode_fork/100_moc_node_porting.md"],
		forkDelta: ["M2 Bun→Node porting — not started in M1"],
	},
];

function exists(base: string, rel: string): boolean {
	const p = path.join(base, rel);
	if (fs.existsSync(p)) return true;
	if (rel.endsWith("/")) return fs.existsSync(p.slice(0, -1));
	return false;
}

function anchorTable(base: string, label: string, anchors: string[]): string {
	const rows = anchors.map((rel, i) => {
		const ok = exists(base, rel.replace(/\/$/, ""));
		const note = ok ? "present" : "missing (verify path)";
		return `| ${i + 1} | \`${rel}\` | ${note} |`;
	});
	return `## 1. ${label} 앵커 경로

| # | path | status |
|---:|---|---|
${rows.join("\n")}
`;
}

function forkSection(notes: string[] | undefined): string {
	if (!notes?.length) return "";
	return `## 2. fork-delta (structure/40_fork-delta.md)

${notes.map(n => `- ${n}`).join("\n")}
`;
}

function body(side: "gjc_origin" | "jwc_patched", band: BandDef): string {
	const isGjc = side === "gjc_origin";
	const title = `# ${band.id} — code facts (${side})`;
	const header = isGjc
		? `> **upstream 클론**: \`${GJC_CLONE_REL}/\` @ \`${GJC_HEAD}\`
> MOC: \`devlog/_plan/260612_jawcode_fork/${band.moc}\``
		: `> **worktree**: jawcode @ \`${FORK_HEAD}\`
> **gjc 대조**: \`${GJC_CLONE_REL}/\` @ \`${GJC_HEAD}\`
> MOC: \`devlog/_plan/260612_jawcode_fork/${band.moc}\``;

	const base = isGjc ? GJC_CLONE : ROOT;
	const anchors = isGjc ? band.gjcAnchors : band.jwcAnchors;
	const label = isGjc ? "upstream" : "patched";

	const parts = [
		title,
		"",
		header,
		"",
		anchorTable(base, label, anchors),
		isGjc ? "" : forkSection(band.forkDelta),
		`## ${isGjc ? "2" : "3"}. 검증

\`\`\`bash
git -C ${GJC_CLONE_REL} rev-parse --short HEAD   # ${GJC_HEAD}
git rev-parse --short HEAD               # ${FORK_HEAD}
diff -u ${GJC_CLONE_REL}/${anchors[0] ?? "packages/coding-agent/package.json"} ${anchors[0] ?? "packages/coding-agent/package.json"} | head
\`\`\`
`,
		`## 부록

- **struct_har** 전수 갱신: \`bun struct_har/_scripts/struct-har-regenerate.ts\` (2026-06-13)
- **로드맵**: \`devlog/_plan/260612_jawcode_fork/000_roadmap.md\`
`,
	];

	return parts.filter(Boolean).join("\n");
}

function writeFacts(side: "gjc_origin" | "jwc_patched", band: BandDef): void {
	const dir = path.join(STRUCT, side, band.id);
	fs.mkdirSync(dir, { recursive: true });
	const out = path.join(dir, "02_code_facts.md");
	fs.writeFileSync(out, `${body(side, band)}\n`, "utf8");
}

for (const band of BANDS) {
	writeFacts("gjc_origin", band);
	writeFacts("jwc_patched", band);
}

// 099 stabilization pointer (jwc only)
const stabDir = path.join(STRUCT, "jwc_patched", "099_stabilization");
fs.mkdirSync(stabDir, { recursive: true });
fs.writeFileSync(
	path.join(stabDir, "02_code_facts.md"),
	`# 099_stabilization — code facts (jwc_patched)

> worktree @ \`${FORK_HEAD}\` · 정본 overview: \`01_overview.md\`
> structure: \`structure/20_prompt_flow.md\`, \`structure/22_session_storage.md\`

## 1. 앵커

| path | role |
|---|---|
| \`struct_har/jwc_patched/099_stabilization/01_overview.md\` | 8기 감사 스냅샷 |
| \`devlog/_plan/260612_jawcode_fork/99.00.00_moc_stabilization.md\` | MOC |

## 2. fork-delta

- 99 밴드: 문서·memory·HUD·workflow surface — β 이후 유지 밴드

## 부록

- struct_har 전수 갱신 2026-06-13
`,
	"utf8",
);

console.log(`struct_har: regenerated ${BANDS.length * 2} band 02_code_facts + 099`);
