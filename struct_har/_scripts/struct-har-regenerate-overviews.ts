/**
 * Regenerate struct_har 01_overview and 03_devlog_refs per band.
 */
import * as fs from "node:fs";
import * as path from "node:path";
import { resolveForkHead, resolveGjcHead } from "./resolve-heads.ts";

const ROOT = path.resolve(import.meta.dir, "../..");
const STRUCT = path.join(ROOT, "struct_har");
const PLAN = path.join(ROOT, "devlog/_plan/260612_jawcode_fork");

const FORK_HEAD = resolveForkHead();
const GJC_HEAD = resolveGjcHead();

const BANDS: { id: string; moc: string; title: string }[] = [
	{ id: "010_shell", moc: "010_moc_shell_rename.md", title: "jwc 셸 + 표면 리네이밍" },
	{ id: "020_prompt", moc: "020_moc_prompting.md", title: "프롬프팅 / 시스템 프롬프트" },
	{ id: "030_skills", moc: "030_moc_skills_discovery.md", title: "스킬 디스커버리 3계층" },
	{ id: "040_interview", moc: "040_moc_interview_merge.md", title: "Interview 병합 (jaw-interview)" },
	{ id: "050_plan", moc: "050_moc_plan_pabcd.md", title: "Plan + PABCD" },
	{ id: "060_goal", moc: "060_moc_goal_merge.md", title: "Goal / ultragoal" },
	{ id: "070_memory", moc: "99.01.00_moc_memory.md", title: "메모리 (99.01 이관)" },
	{ id: "080_tui", moc: "080_moc_tui.md", title: "TUI / jaw 브랜딩" },
	{ id: "081_cursor", moc: "081_moc_cursor_tools.md", title: "cursor 도구군" },
	{ id: "082_input", moc: "082_moc_tui_input.md", title: "TUI 입력" },
	{ id: "083_output", moc: "083_moc_tui_output.md", title: "TUI 출력" },
	{ id: "090_auth", moc: "090_moc_auth_release_gate.md", title: "인증 + M1 게이트" },
	{ id: "100_node", moc: "100_moc_node_porting.md", title: "Node 포팅 (M2)" },
];

function listDevlogRefs(prefix: string): string[] {
	if (!fs.existsSync(PLAN)) return [];
	return fs
		.readdirSync(PLAN)
		.filter(f => f.endsWith(".md") && f.startsWith(prefix))
		.sort()
		.slice(0, 20);
}

for (const band of BANDS) {
	const prefix = band.id.split("_")[0];
	const refs = listDevlogRefs(prefix);
	for (const side of ["gjc_origin", "jwc_patched"] as const) {
		const dir = path.join(STRUCT, side, band.id);
		fs.mkdirSync(dir, { recursive: true });
		const isGjc = side === "gjc_origin";
		fs.writeFileSync(
			path.join(dir, "01_overview.md"),
			`# ${band.id} — 01 overview (${side})

> ${isGjc ? `upstream \`devlog/_upstream_gjc/\` @ \`${GJC_HEAD}\`` : `worktree @ \`${FORK_HEAD}\` · gjc @ \`${GJC_HEAD}\``}
> MOC: [\`${band.moc}\`](../../../devlog/_plan/260612_jawcode_fork/${band.moc})

## ${band.title}

| 문서 | 내용 |
|---|---|
| [02_code_facts.md](./02_code_facts.md) | 경로 앵커·fork-delta |
| [02_logic_changes.md](./02_logic_changes.md) | **동작·런타임 변경** (git 히스토리 기반) |
| [03_devlog_refs.md](./03_devlog_refs.md) | 플랜 링크 |

횡단 정본: [structure/40_fork-delta.md](../../../structure/40_fork-delta.md)

## 부록

- struct_har · 밴드 \`${band.id}\` · \`${side}\` · 갱신 2026-06-13
`,
			"utf8",
		);
		const refLines = refs.length
			? refs.map(r => `- [${r}](../../../devlog/_plan/260612_jawcode_fork/${r})`).join("\n")
			: `- (prefix \`${prefix}\` — see MOC)`;
		fs.writeFileSync(
			path.join(dir, "03_devlog_refs.md"),
			`# ${band.id} — 03 devlog refs (${side})

> MOC: \`${band.moc}\`

## 플랜

${refLines}

## 공통

- [000_roadmap.md](../../../devlog/_plan/260612_jawcode_fork/000_roadmap.md)
- [fork_logic_changelog.md](../../../structure/40_fork-delta.md)
- [fork-delta.md](../../../structure/40_fork-delta.md)
`,
			"utf8",
		);
	}
}

console.log(`struct_har: overviews for ${BANDS.length} bands × 2`);