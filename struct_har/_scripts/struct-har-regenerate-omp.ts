/**
 * Regenerate struct_har/omp_origin/<band>/ (01, 02_code_facts, 02_logic_changes, 03).
 * Run: bun struct_har/_scripts/struct-har-regenerate-omp.ts
 */
import * as fs from "node:fs";
import * as path from "node:path";
import { resolveForkHead, resolveGjcHead, resolveOmpHead } from "./resolve-heads.ts";

const ROOT = path.resolve(import.meta.dir, "../..");
const OMP_CLONE = path.join(ROOT, "devlog/_upstream_omp");
const STRUCT = path.join(ROOT, "struct_har/omp_origin");
const PLAN = path.join(ROOT, "devlog/_plan/260612_jawcode_fork");

const OMP_HEAD = resolveOmpHead();
const GJC_HEAD = resolveGjcHead();
const FORK_HEAD = resolveForkHead();

const OMP_ABS = "/Users/jun/Developer/new/700_projects/jawcode/devlog/_upstream_omp";

type OmpBand = {
	id: string;
	moc: string;
	title: string;
	ompBehavior: string;
	anchors: string[];
	jwcContrast: string;
	logicBullets: string[];
};

const BANDS: OmpBand[] = [
	{
		id: "010_shell",
		moc: "010_moc_shell_rename.md",
		title: "CLI · 브랜드 · 패키지",
		ompBehavior: `- bin **\`omp\`** (\`@oh-my-pi/pi-coding-agent\`).
- npm scope **\`@oh-my-pi/*\`** — gjc의 \`@gajae-code/*\`와 별계열.
- 런타임 확장 경로 **\`.omp/\`** (skills, commands) — jaw는 **\`.jwc/\`** + cli-jaw.`,
		anchors: [
			"package.json",
			"packages/coding-agent/package.json",
			"packages/coding-agent/bin",
		],
		jwcContrast: "jwc: `packages/jwc` only bin; `gajae-code` shell removed; APP_NAME=jwc.",
		logicBullets: [
			"단일 제품 CLI = omp (stats 등 서브커맨드는 omp 패키지 내)",
			"브랜딩·config는 pi/omp 관례 — gjc fork 시 gjc/jwc로 표면만 치환",
		],
	},
	{
		id: "020_prompt",
		moc: "020_moc_prompting.md",
		title: "시스템 프롬프트 · 정체성",
		ompBehavior: `- \`packages/coding-agent/src/prompts/\` — omp/Gajae 아닌 **Pi/omp** 정체성.
- **4 workflow 스킬 XML 고정 없음** — 범용 에이전트 + skills 디스커버리.
- \`docs/ttsr-injection.md\` 등 내부 설계 문서 다수.`,
		anchors: [
			"packages/coding-agent/src/prompts/system/system-prompt.md",
			"packages/coding-agent/src/system-prompt.ts",
			"docs/ttsr-injection.md",
		],
		jwcContrast: "jwc: Jaw 하드화, jaw-interview/ralplan 4종 routing, 99.02 orchestrate discovery.",
		logicBullets: [
			"세션 시작 system prompt 조립 + TTSR/훅 레일 (gjc 계열과 형태 유사)",
			"jaw fork는 HARD-EDIT system-prompt + agent-identity",
		],
	},
	{
		id: "030_skills",
		moc: "030_moc_skills_discovery.md",
		title: "스킬 · 명령 디스커버리",
		ompBehavior: `- **\`.omp/skills/\`**, **\`.omp/commands/\`** repo·user 확장.
- 번들 **deep-interview/ralplan/ultragoal/team 4종 없음**.
- 스킬 생태계 + slash — README 32 tools 문화.`,
		anchors: [
			"packages/coding-agent/src/extensibility/skills.ts",
			".omp/skills",
			".omp/commands",
			"docs/skills.md",
		],
		jwcContrast: "jwc: bundled 4종 + cli-jaw global substitution (D5).",
		logicBullets: [
			"3계층: embedded / project / user — omp는 `.omp` 루트",
			"jaw M1: `~/.cli-jaw/skills` 우선 (030 jwc_patched)",
		],
	},
	{
		id: "040_interview",
		moc: "040_moc_interview_merge.md",
		title: "요구사항 인터뷰",
		ompBehavior: `- gjc식 **\`deep-interview\` 번들 스킬 없음**.
- 요구사항 명확화는 일반 세션 + 사용자 스킬/프롬프트에 위임.`,
		anchors: ["packages/coding-agent/src/defaults", "docs/"],
		jwcContrast: "jwc: `jaw-interview` native + gate + structured ask (040 fork).",
		logicBullets: ["omp: 워크플로 I단계 엔진 미번들", "jwc: IPABCD I = jaw-interview"],
	},
	{
		id: "050_plan",
		moc: "050_moc_plan_pabcd.md",
		title: "계획 · 오케스트레이션",
		ompBehavior: `- **ralplan / orchestrate / PABCD 네이티브 없음** (gjc fork 산출물).
- 계획·실행은 범용 agent + tools; cli-jaw 쪽 IPABCD는 **별 제품**.`,
		anchors: ["packages/coding-agent/src/commands", "docs/slash-command.md"],
		jwcContrast: "jwc: orchestrate-state/runtime, `/orchestrate`, 99.02 discovery gap.",
		logicBullets: [
			"omp 자체는 단일 에이전트 루프 중심",
			"jwc 050: full IPABCD state machine (fork only)",
		],
	},
	{
		id: "060_goal",
		moc: "060_moc_goal_merge.md",
		title: "Goal · 장기 실행",
		ompBehavior: `- **ultragoal 번들 없음**.
- 장기 목표는 스킬/사용자 워크플로 또는 외부 도구.`,
		anchors: ["packages/coding-agent/src/prompts/goals"],
		jwcContrast: "jwc: `jwc goal` + ultragoal engine + `.jwc/ultragoal`.",
		logicBullets: ["omp: goal-mode 프롬프트 파일은 있을 수 있으나 jaw goal CLI 없음"],
	},
	{
		id: "070_memory",
		moc: "99.01.00_moc_memory.md",
		title: "메모리 · mnemopi",
		ompBehavior: `- **\`packages/mnemopi/\`** — omp 전용 메모리 축 (gjc/jaw 트리에 패키지 없음).
- gjc식 stage1/phase2 \`memories/\` 엔진과 **다른 설계** 가능 — 실측은 클론 기준.`,
		anchors: [
			"packages/mnemopi",
			"packages/coding-agent/src/memories",
		],
		jwcContrast: "jwc: agent.db memories + summary 주입; 99.01 CLI; cli-jaw FTS 참고.",
		logicBullets: [
			"mnemopi = omp 차별 패키지 — jaw는 이식 안 함 (99.01은 gjc 엔진 확장)",
			"참고: cli-jaw memory FTS/BM25 (struct_har jwc 070/99)",
		],
	},
	{
		id: "080_tui",
		moc: "080_moc_tui.md",
		title: "TUI · 테마",
		ompBehavior: `- \`packages/tui/\` — omp TUI 스택.
- \`docs/tui-runtime.md\` 등 — gjc/jwc TUI hotfix(081–083)와 독립 진화.`,
		anchors: [
			"packages/tui",
			"docs/tui-runtime.md",
			"packages/coding-agent/src/modes/interactive-mode.ts",
		],
		jwcContrast: "jwc: abyss-bite, /quota, /effort, workflow HUD 99.03.",
		logicBullets: ["Bun TUI 유지 (D8); M2 Node는 coding-agent 비TUI 위주"],
	},
	{
		id: "081_cursor",
		moc: "081_moc_cursor_tools.md",
		title: "Cursor · IDE 도구",
		ompBehavior: `- \`packages/ai/src/providers/cursor.ts\` 등 — IDE 연동 강조 (README).
- LSP/DAP 도구 깊이 — omp 벤치 포인트.`,
		anchors: [
			"packages/ai/src/providers/cursor.ts",
			"packages/coding-agent/src/cursor.ts",
		],
		jwcContrast: "jwc: host model pin, tool-call execute fix (081 fork).",
		logicBullets: ["omp README: IDE wired in — jaw 081은 포크 핫픽스 추적"],
	},
	{
		id: "082_input",
		moc: "082_moc_tui_input.md",
		title: "TUI 입력 · IME",
		ompBehavior: `- \`packages/tui/\` 키·IME·에디터 — upstream omp 동작.`,
		anchors: ["packages/tui/src"],
		jwcContrast: "jwc: Ctrl-chord 한글, caret fix (082 fork).",
		logicBullets: ["리베이스 시 tui 패키지 충돌 — gjc 우선, omp는 참고만"],
	},
	{
		id: "083_output",
		moc: "083_moc_tui_output.md",
		title: "TUI 출력 · 도구 블록",
		ompBehavior: `- 도구 트랜스크립트·collapse — omp/gjc 공통 계열.`,
		anchors: ["packages/coding-agent/src/modes/components"],
		jwcContrast: "jwc: auto-minimize, segment split (083; PR #520–523).",
		logicBullets: ["출력 UX는 gjc 리베이스 면적 — omp diff는 벤치만"],
	},
	{
		id: "090_auth",
		moc: "090_moc_auth_release_gate.md",
		title: "인증 · 프로바이더",
		ompBehavior: `- \`packages/ai/\` auth-storage, OAuth — **catalog**과 결합.
- README 40+ providers — \`packages/catalog/\` 정본.`,
		anchors: [
			"packages/ai/src/auth-storage.ts",
			"packages/catalog",
		],
		jwcContrast: "jwc: local-token-detect, kiro WIP (090 fork).",
		logicBullets: [
			"모델·프로바이더 메타는 catalog 패키지 (gjc는 ai/models.json)",
		],
	},
	{
		id: "100_node",
		moc: "100_moc_node_porting.md",
		title: "런타임 · Worker · Node",
		ompBehavior: `- **Bun 1.3.14** 명시; \`cli.ts\` **workerHostEntry** dispatch.
- M2 jaw: Node 셰임 참고 — \`stream.test.ts\` 등 베이스라인.`,
		anchors: [
			"packages/coding-agent/src/cli.ts",
			"packages/agent",
			"packages/ai",
		],
		jwcContrast: "jwc M2: 100 셰임 → 111 jwc/sdk attach; omp worker 패턴 참고.",
		logicBullets: [
			"`declareWorkerHostEntry` / `__omp_*_worker` — gjc hybrid worker와 대조",
			"natives: crates/pi-natives",
		],
	},
];

function exists(rel: string): boolean {
	return fs.existsSync(path.join(OMP_CLONE, rel));
}

function anchorRows(anchors: string[]): string {
	return anchors
		.map((rel, i) => {
			const st = exists(rel) ? "present" : "missing (verify clone)";
			return `| ${i + 1} | \`${rel}\` | ${st} |`;
		})
		.join("\n");
}

function writeBand(b: OmpBand): void {
	const dir = path.join(STRUCT, b.id);
	fs.mkdirSync(dir, { recursive: true });

	const cite = `${OMP_ABS}/<path>:<line>`;

	fs.writeFileSync(
		path.join(dir, "01_overview.md"),
		`# ${b.id} — 01 overview (omp_origin)

> omp @ \`${OMP_HEAD}\` · 클론 [\`devlog/_upstream_omp/\`](../../../devlog/_upstream_omp/)
> MOC (jaw 밴드 정렬): [\`${b.moc}\`](../../../devlog/_plan/260612_jawcode_fork/${b.moc})

## ${b.title}

${b.ompBehavior}

## jawcode 대조

${b.jwcContrast}

| 문서 | |
|---|---|
| [02_code_facts.md](./02_code_facts.md) | omp 경로 앵커 |
| [02_logic_changes.md](./02_logic_changes.md) | omp 동작 요약 (fork 아님) |
| [03_devlog_refs.md](./03_devlog_refs.md) | 플랜 링크 |

횡단: [../README.md](../README.md) · [../architecture/](../architecture/) · [structure/40_fork-delta.md](../../../structure/40_fork-delta.md)
`,
		"utf8",
	);

	fs.writeFileSync(
		path.join(dir, "02_code_facts.md"),
		`# ${b.id} — 02 code facts (omp_origin)

> 클론 @ \`${OMP_HEAD}\` · cite: \`${cite}\`
> gjc @ \`${GJC_HEAD}\` · jwc @ \`${FORK_HEAD}\` (대조만)

## 앵커

| # | path | status |
|---:|---|---|
${anchorRows(b.anchors)}

## diff (예)

\`\`\`bash
diff -u devlog/_upstream_omp/${b.anchors[0] ?? "packages/coding-agent"} devlog/_upstream_gjc/${b.anchors[0] ?? "packages/coding-agent"} | head
\`\`\`

## 정본

- [02_logic_changes.md](./02_logic_changes.md)
- [../03_jwc_relationship.md](../03_jwc_relationship.md) (이식표)
`,
		"utf8",
	);

	const logic = b.logicBullets.map(x => `- ${x}`).join("\n");
	fs.writeFileSync(
		path.join(dir, "02_logic_changes.md"),
		`# ${b.id} — 02 logic changes (omp_origin)

> **omp 자체 런타임** (gjc/jwc fork changelog 아님).
> fork 로직: [structure/40_fork-delta.md](../../../structure/40_fork-delta.md) · jaw 갭: [structure/50_status.md](../../../structure/50_status.md)

## 동작 (omp)

${logic}

## 대조

${b.jwcContrast}

## 정본

- [01_overview.md](./01_overview.md)
- [02_code_facts.md](./02_code_facts.md)
`,
		"utf8",
	);

	const prefix = b.id.split("_")[0];
	let refs = "—";
	if (fs.existsSync(PLAN)) {
		const files = fs
			.readdirSync(PLAN)
			.filter(f => f.endsWith(".md") && f.startsWith(prefix))
			.sort()
			.slice(0, 12)
			.map(f => `- [${f}](../../../devlog/_plan/260612_jawcode_fork/${f})`)
			.join("\n");
		if (files) refs = files;
	}

	fs.writeFileSync(
		path.join(dir, "03_devlog_refs.md"),
		`# ${b.id} — 03 devlog refs (omp_origin)

> jaw MOC: \`${b.moc}\` — omp는 **참조축**이므로 플랜은 jaw 착수/대조용.

## 플랜 (prefix ${prefix})

${refs}

## 공통

- [000_roadmap.md](../../../devlog/_plan/260612_jawcode_fork/000_roadmap.md)
- [05_interview_conclusions.md](../../../devlog/_plan/260612_jawcode_fork/05_interview_conclusions.md)
- [structure/40_fork-delta.md](../../../structure/40_fork-delta.md)
`,
		"utf8",
	);
}

for (const b of BANDS) writeBand(b);

// architecture (both sides pattern — omp only one side)
const archDir = path.join(STRUCT, "architecture");
fs.mkdirSync(archDir, { recursive: true });
fs.writeFileSync(
	path.join(archDir, "01_overview.md"),
	`# architecture — 01 overview (omp_origin)

> omp 모노레포 토폴로지 요약. jaw SoT: [structure/10_architecture.md](../../../structure/10_architecture.md).

## 패키지 방향

\`\`\`text
packages/ai  ←→  packages/catalog (모델 메타 — gjc에 없음)
packages/agent, coding-agent, tui, utils
packages/mnemopi, hashline, snapcompact, wire (omp 전용)
crates/pi-natives
\`\`\`

## vs gjc/jwc

| | omp | gjc/jwc |
|---|---|---|
| CLI | omp | jwc |
| Workflow 4종 | 없음 | jaw-interview, ralplan, ultragoal, team |
| Config | .omp | .jwc |

HEAD omp \`${OMP_HEAD}\`
`,
	"utf8",
);

// Root hub (replace flat 01)
fs.writeFileSync(
	path.join(STRUCT, "01_overview.md"),
	`# omp_origin — 01 overview (hub)

> **전수 밴드**: gjc/jwc와 동일 id (\`010_shell\` … \`100_node\`) — 각 폴더에 01/02/03/02_logic_changes.
> 클론 @ \`${OMP_HEAD}\` · 재생성: \`bun struct_har/_scripts/struct-har-regenerate-omp.ts\`

## 밴드 인덱스

${BANDS.map(b => `- [${b.id}](./${b.id}/01_overview.md) — ${b.title}`).join("\n")}

## 레거시 횡단 (요약)

- [02_code_facts.md](./02_code_facts.md) — 루트 경로 인벤토리 (클론 전역)
- [03_jwc_relationship.md](./03_jwc_relationship.md) — 이식·비이식표
- [architecture/01_overview.md](./architecture/01_overview.md)

상세 패키지 맵·AGENTS 차이는 위 밴드 + README.
`,
	"utf8",
);

console.log(`struct_har/omp_origin: ${BANDS.length} bands × 4 docs + architecture`);