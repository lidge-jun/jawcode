/**
 * Write struct_har band 02_logic_changes.md from fork_logic_changelog.
 * Run: bun struct_har/_scripts/struct-har-regenerate-logic.ts
 */
import * as fs from "node:fs";
import * as path from "node:path";
import { resolveForkHead, resolveGjcHead } from "./resolve-heads.ts";

const ROOT = path.resolve(import.meta.dir, "../..");
const STRUCT = path.join(ROOT, "struct_har");
const CHANGELOG = path.join(ROOT, "structure/40_fork-delta.md");

const FORK_HEAD = resolveForkHead();
const GJC_HEAD = resolveGjcHead();

type BandLogic = { id: string; jwcSection: string; gjcBaseline: string };


const BANDS: BandLogic[] = [
	{
		id: "010_shell",
		gjcBaseline: `- 사용자 CLI: \`gjc\` (\`packages/gajae-code\` npm wrapper).
- 설정·캐시: \`~/.gjc/\`, 프로젝트 \`.gjc/\` (표면).
- \`APP_NAME\` 기본 gjc 계열.`,
		jwcSection: `## 런타임·표면

- **단일 진입**: \`packages/jwc\` bin \`jwc\`; \`packages/gajae-code\` **제거**.
- \`APP_NAME\` 기본 \`jwc\`; \`ENGINE_NAME\` 내부 식별자 보존.
- 가드·릴리스: jwc 기준 \`rebrand-inventory\`, \`packages/jwc\` bundle publish.

## upstream 대비

| 동작 | gjc | jwc |
|---|---|---|
| CLI | \`gjc\` | **\`jwc\` only** |
| wrapper | \`packages/gajae-code\` | **삭제** |

## 커밋

\`7d55513b\`, \`59d10c66\`, \`bb6571a0\`, \`6c9b3c53\``,
	},
	{
		id: "020_prompt",
		gjcBaseline: `- \`system-prompt.md\`: GJC/gjc 워크플로·\`deep-interview\`·\`gjc\` CLI 예시.
- Role agents: bash allowlist **gjc** 접두.
- 런타임 경로 문구: \`.gjc/\`.`,
		jwcSection: `## 런타임·표면

- \`system-prompt.md\`: Jaw/jwc, \`jaw-interview\`, \`jwc\` 네이티브 CLI (HARD-EDIT).
- \`agent-identity.ts\` + \`identity.*\` settings.
- Role agents: **jwc** bash prefix; ralplan state 쓰기만.
- 도구 프롬프트: \`.jwc/\`·jwc 어휘.

## 검증

\`agent-identity-leak.test.ts\`, \`system-prompt-identity.test.ts\`

## 커밋

\`da701492\`–\`ff11c848\`, \`59043f77\`, \`db31d4bd\``,
	},
	{
		id: "030_skills",
		gjcBaseline: `- 번들 인터뷰 slug: \`deep-interview\`.
- 스킬 디스커버리: bundled + project + user; cli-jaw 글로벌 치환 **없음** (fork에서 추가).`,
		jwcSection: `## 런타임·표면

- \`discovery/cli-jaw.ts\` 글로벌 스킬 루트.
- jaw-brand substitution (\`skills.ts\`).
- \`cli-jaw-vocab.ts\` dev 스킬 어휘.
- 번들: \`jaw-interview\`.

## 커밋

\`49da5846\`, \`02ca8ba2\`, \`af7523f9\``,
	},
	{
		id: "040_interview",
		gjcBaseline: `- 워크플로 slug \`deep-interview\`; runtime/gate/guard upstream 명명.
- 설정 \`gjc.*\` / jawInterview 혼재(포크 전).
- 인터뷰 중 mutation guard: upstream gjc 기준.`,
		jwcSection: `## 런타임·표면

- **jaw-interview** rename (SKILL, runtime, gate, guards, tests).
- structured ask + \`structured-renderer\` (D041).
- \`jaw-interview-mutation-guard\`: interview 중 \`.jwc/\`·**jwc** CLI (INVERTED-GUARD).
- 설정 \`jwc.interview.*\`; read-compat \`deep-interview\`.

## 커밋

\`eb4273c2\`, \`1be32975\`, \`8ced9eb2\`, \`063114c9\`, \`c7c748ec\``,
	},
	{
		id: "050_plan",
		gjcBaseline: `- \`ralplan\` SKILL + bridge/plan 경로; upstream orchestrate/PABCD 네이티브는 포크 전 부재 또는 제한적.`,
		jwcSection: `## 런타임·표면

- \`orchestrate-state.ts\` + \`orchestrate-runtime.ts\` (I/P/A/B/C/D).
- \`commands/orchestrate.ts\`, \`/orchestrate\`, jaw-only brand gate.
- \`prompts/jaw/orchestrate-*.md\`; ralplan pending approval → ultragoal.

## 커밋

\`595350bf\`–\`09c76c23\``,
	},
	{
		id: "060_goal",
		gjcBaseline: `- \`ultragoal\` SKILL/엔진; standalone \`goal\` CLI surface는 포크 전 제한.`,
		jwcSection: `## 런타임·표면

- \`commands/goal.ts\` (NEW).
- \`goal-runtime.ts\` → ultragoal + \`.jwc/ultragoal\`.
- \`goal-mode-request.ts\` sessionId 스코프.

## 커밋

\`0207d326\``,
	},
	{
		id: "070_memory",
		gjcBaseline: `- gjc memories: startup·\`memory_summary.md\` 주입 (upstream과 동일 계열).`,
		jwcSection: `## jwc 현재

- stage1→phase2; \`memory_summary.md\` 1파일 주입; **FTS 매턴 주입 없음**.
- 계획 99.01: \`local-query.ts\` cli-jaw 패리티.`,
	},
	{
		id: "080_tui",
		gjcBaseline: `- upstream TUI 테마·HUD·slash (gjc 브랜딩).`,
		jwcSection: `## 런타임·표면

- abyss-bite 테마·Jaw 배너; B2-lite ViewportFill; /quota, /effort; provider 탭; workflow HUD (일부 WIP).

## gjc 대비·앵커

- theme.ts:1800-1802; welcome.ts:394-397; interactive-mode.ts:555-575; packages/tui viewport-fill/insert-history/tui.ts
- [31_scroll.md](../../../structure/31_scroll.md)

## 커밋

\`3bc79781\`, \`89800b67\`, \`7259a7c6\`, \`33fbee4d\``,
	},
	{
		id: "081_cursor",
		gjcBaseline: `- cursor provider·tool-call upstream 동작 (pin/execute 이슈 포크에서 수정).`,
		jwcSection: `## 런타임·표면

- host model pin; tool-call render+execute; autocompact estimate 폴백.

## worktree 앵커\n\n- cursor.ts (ai+coding-agent); agent-session.ts:6758-6763; tokenizer-routing.ts + tokenizer-encoding.ts\n- [30_providers.md](../../../structure/30_providers.md) §2b\n\n## 커밋

\`e12e03d4\`, \`02b50ad9\`, \`16ce10d7\``,
	},
	{
		id: "082_input",
		gjcBaseline: `- TUI 입력·IME upstream.`,
		jwcSection: `## 런타임·표면

- Ctrl-chord 한글 힌트; 첫 글자 캐럿; ESC 2연타.

## gjc 대비\n\n- B2-lite pin; compact @ input-controller.ts:457; [31_scroll.md](../../../structure/31_scroll.md)\n\n## 커밋

\`cc61d506\`, \`d14ed4e2\``,
	},
	{
		id: "083_output",
		gjcBaseline: `- 도구 블록·spacing upstream (PR #520–523 대상).`,
		jwcSection: `## 런타임·표면

- auto-minimize; 1줄 spacing; segment split interleave; alt+t overlay; /effort.

## gjc 대비\n\n- commit renderMode + commit lane; event-controller.ts:116-119; ui-helpers.ts:52-55\n\n## 커밋

\`3a858246\`, \`a590aea9\`, \`b06d48c7\``,
	},
	{
		id: "090_auth",
		gjcBaseline: `- OAuth·auth-storage upstream; local-token autodetect는 포크 추가.`,
		jwcSection: `## 런타임·표면

- local-token-detect/import; stale credential; kiro WIP.

## 커밋

\`a17d5ac0\`, \`4d7733c2\``,
	},
	{
		id: "100_node",
		gjcBaseline: `- Bun 런타임 (gjc·jwc 공통 M1). Node 포팅은 M2.`,
		jwcSection: `## 상태 (260612)

- M2 **미착수** — Bun 1.3.14; M1 마감은 **99 밴드** ([jwc_readiness](../../../structure/50_status.md)).
- [100_moc_node_porting.md](../../../devlog/_plan/260612_jawcode_fork/100_moc_node_porting.md) — 셰임·esbuild·sqlite.
- [111_design_runtime_attach.md](../../../devlog/_plan/260612_jawcode_fork/111_design_runtime_attach.md) — cli-jaw \`jwc/sdk\` 부착; 100→110→120→130.
- 100/111 **실측 보강** 조사 진행 (M2 진입 준비).`,
	},
];

function writeLogic(side: "gjc_origin" | "jwc_patched", band: BandLogic): void {
	const dir = path.join(STRUCT, side, band.id);
	fs.mkdirSync(dir, { recursive: true });
	const isGjc = side === "gjc_origin";
	const intro = isGjc
		? `> gjc_origin: upstream **기준 동작** (변경 전). 클론 @ \`${GJC_HEAD}\`.\n`
		: `> jwc_patched: fork **실제 로직**. git \`upstream/main..HEAD\` + [fork_logic_changelog.md](../../../structure/40_fork-delta.md).\n> worktree @ \`${FORK_HEAD}\`.\n`;

	const main = isGjc
		? `## upstream 기준 동작

${band.gjcBaseline}

## fork에서 바뀐 점

→ [jwc_patched/${band.id}/02_logic_changes.md](../../jwc_patched/${band.id}/02_logic_changes.md)

## diff

\`diff -u devlog/_upstream_gjc/packages/... packages/...\` — 경로: [02_code_facts.md](./02_code_facts.md)
`
		: band.jwcSection;

	const body = `# ${band.id} — 02 logic changes (${side})

${intro}
${main}
## 정본

- 횡단: [structure/40_fork-delta.md](../../../structure/40_fork-delta.md)
- 파일 단위: [structure/40_fork-delta.md](../../../structure/40_fork-delta.md)
- 앵커 경로: [02_code_facts.md](./02_code_facts.md)
`;

	fs.writeFileSync(path.join(dir, "02_logic_changes.md"), `${body}\n`, "utf8");
}

for (const band of BANDS) {
	writeLogic("gjc_origin", band);
	writeLogic("jwc_patched", band);
}

// 099 cross-cutting
const stab = `# 099_stabilization — 02 logic changes (jwc_patched)

> 8기 감사 스냅샷: 프롬프트 주입 레일, PABCD push, memory 갭, workflow re-facing, slash 패리티.

## 횡단 로직 (fork 이후)

- 시스템 프롬프트: 매 턴 주입 레일 7종 (\`structure/20_prompt_flow.md\`)
- PABCD: cli-jaw 4층 push vs jwc pull 스킬 (\`099_stabilization/01_overview.md\`)
- Memory: jwc 검색 없음 → 99.01 local-query 예정
- Workflow 명칭: ralplan hard rename 대신 **IPABCD 우산** re-facing

## 정본

[fork_logic_changelog.md](../../../structure/40_fork-delta.md)
`;
fs.writeFileSync(path.join(STRUCT, "jwc_patched", "099_stabilization", "02_logic_changes.md"), `${stab}\n`, "utf8");

console.log(`struct_har: wrote ${BANDS.length * 2 + 1} logic change docs`);