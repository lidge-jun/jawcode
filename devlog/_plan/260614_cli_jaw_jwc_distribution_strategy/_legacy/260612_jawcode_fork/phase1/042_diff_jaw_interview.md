# 042 — jaw-interview 병합 diff 플랜 (P 산출물)

> 상태: ✅ 구현 완료 (B1~B5, 커밋 eb4273c~6ae52ac). 입력: [041 결정 14건](./041_plan_jaw_interview_merge.md).
> 조사: sonnet 서브에이전트 3기 병렬 (B1 rename 인벤토리 / B3 ask·렌더러 / B4 settings·명령), 260612 08:55.
> 컨트랙트: AGENTS.md — 번들 워크플로 정확히 4종 유지, `bun check` 사용(tsc 금지), rebrand 게이트 4종 통과 필수.

## 0. 리네임 전략 — 3계층 (조사로 확정된 구조)

조사 결과 "deep-interview" 식별자는 **세 계층**에 존재한다. 일괄 치환은 기존 `.gjc` state 파일
전체 무효화(zod skillEnum fail-closed)와 RPC 와이어 파손을 일으키므로 계층별로 다르게 처리한다:

| 계층 | 식별자 위치 | 처리 |
|------|------------|------|
| L1 표면 | 스킬 디렉토리/slug, 커맨드명, 도움말/프롬프트/문서, spec 경로 | **jaw-interview / interview로 rename** (D040-1/9, D10) |
| L2 영속 상태 | `skill: "deep-interview"` (state JSON·receipt·audit), zod `CANONICAL_GJC_WORKFLOW_SKILLS` | **신규값 기록 + 구값 read-normalize** — 읽기 시 `deep-interview`→`jaw-interview` 정규화 후 검증, 쓰기는 항상 신규값 |
| L3 와이어 | RPC `stage: "deep-interview"` (rpc-types, bridge-client, gate-broker) | **신규값 송신 + 유니언에 구값 유지** — 브릿지 클라이언트가 둘 다 수용 (양단 모두 본 리포라 동시 개정) |

> **경로 표기 규약 (F5)**: 아래 `src/...`는 전부 `packages/coding-agent/src/...`의 약기.
> 예외는 `packages/bridge-client/...`, `scripts/...`, `schemas/...`, `docs/...`처럼 명시된 경우뿐.

## B1 — 기계적 rename + 호환 심 (커밋 1~2개)

### B1-a. 디렉토리·파일 rename (git mv)

```
packages/coding-agent/src/defaults/gjc/skills/deep-interview/   → .../skills/jaw-interview/
packages/coding-agent/src/commands/deep-interview.ts            → commands/interview.ts
packages/coding-agent/src/gjc-runtime/deep-interview-runtime.ts → gjc-runtime/jaw-interview-runtime.ts
packages/coding-agent/src/deep-interview/                       → src/jaw-interview/   (render-middleware.ts 포함, B3에서 개조)
packages/coding-agent/src/modes/shared/agent-wire/deep-interview-gate.ts → .../jaw-interview-gate.ts
packages/coding-agent/src/skill-state/deep-interview-mutation-guard.ts   → .../jaw-interview-mutation-guard.ts
test/deep-interview-*.test.ts (3종) + test/gjc-runtime/deep-interview-runtime.test.ts
  + test/modes/components/deep-interview-render-middleware.test.ts        → jaw-interview-* 로 rename
test/fixtures/gjc-state/v2/deep-interview-valid.json → jaw-interview-valid.json (내부 skill 값도 신규)
test/fixtures/gjc-state/v1/deep-interview-legacy.json → **유지** (레거시 마이그레이션 픽스처 목적)
```

### B1-b. 심볼·리터럴 교체 (조사 인벤토리 기준, file:line)

| 파일 | 변경 |
|------|------|
| `src/cli.ts:50` | `{ name: "interview", aliases: ["deep-interview"], load: () => import("./commands/interview") }` — CommandEntry.aliases 패턴(cli.ts:45 contribute-pr 선례), alias 해석은 `packages/utils/src/cli.ts:363-364` `findEntry` (F4 정정) |
| `src/gjc-runtime/state-schema.ts:17` | `CANONICAL_GJC_WORKFLOW_SKILLS = ["jaw-interview", ...]` + **NEW 공용 `normalizeWorkflowSkillSlug()`** (`deep-interview`→`jaw-interview`, 검증 전 적용) — `readGjcJson`(:175-191)과 `WorkflowStateReceiptSchema.skill` 파싱 전단에 삽입. write(`state-writer.ts:399` `RequiredOnWriteEnvelopeSchema`)는 신규값만 (fail-closed 유지) |
| **(F2) legacy normalize 전파** | `normalizeWorkflowSkillSlug()`를 다음 전부에 적용: `src/skill-state/workflow-state-contract.ts:131-134` `canonicalWorkflowSkill` / `src/skill-state/active-state.ts:284-285` `isCanonicalGjcWorkflowSkill` / `src/gjc-runtime/workflow-command-ref.ts:237-238` **중복 정의된** `isCanonicalGjcWorkflowSkill` / `src/gjc-runtime/state-runtime.ts:330,537,560` 호출 경로 / `src/gjc-runtime/state-migrations.ts:54`. ⚠️ CANONICAL 배열이 `state-schema.ts:17`(private)과 `active-state.ts:12`(exported, scripts가 import) **2곳 독립 정의** — 둘 다 갱신 + 단일 소스로 통합 검토 |
| **(F2-r2) normalize 추가 4건** (재감사 발견) | ① `src/gjc-runtime/state-runtime.ts:74,155,235-238,296,645,1372,1738,1783` — `assertKnownMode`/`KNOWN_MODES`/`manifestFlagNames`가 CANONICAL `.includes(mode)` 직접 비교: normalize 미적용 시 `gjc state deep-interview read`·`--mode deep-interview` 즉시 파손 ② `src/gjc-runtime/state-validation.ts:23` `validateWorkflowStateEnvelope` — `state.skill` 엄격 비교를 normalize 경유로 (호출처 state-runtime.ts:479,1021,1187,1223) ③ `src/hooks/skill-keywords.ts:77-78` `isGjcWorkflowSkill` — canonical 배열 직접 includes ④ `src/skill-state/initial-phase.ts:13-14` — 리터럴 교체가 아니라 **함수 입구에서 normalize** (raw legacy slug 호출처: `injection.ts:47`) |
| `src/skill-state/active-state.ts:12,520` | CANONICAL 갱신 + `PLANNING_PIPELINE_SKILLS` 갱신 + normalize 적용 |
| `src/extensibility/gjc-plugins/types.ts:7` | `GJC_SUBSKILL_PARENT_SKILLS` — active-state 추종 확인 + alias normalize 적용 여부 검증 |
| `src/skill-state/initial-phase.ts:14` | `if (skill === "jaw-interview") return "interviewing";` (normalize 후 비교라 단일값) |
| `src/hooks/skill-state.ts:50,62,362,459` | 노출 문구(:50,62)·threshold 비교 분기(:362-363, 상수 `DEFAULT_DEEP_INTERVIEW_*`→`DEFAULT_JAW_INTERVIEW_*`)·`isHandoffRequiredSkill`의 skill 비교(:459) |
| `src/hooks/skill-keywords.ts` | `$deep-interview`→`$interview` (+구 키워드 alias 항목 유지 4건) |
| `src/gjc-runtime/workflow-manifest.ts:144-172` | 키·skill·`graphLabel: "Jaw Interview"` |
| `src/gjc-runtime/workflow-command-ref.ts` | skill·skillPath 갱신 + **NEW** legacy slug alias 맵(`/skill:deep-interview` 해석용) |
| `src/gjc-runtime/state-runtime.ts` | examples 문자열 `state jaw-interview` |
| `src/defaults/gjc-defaults.ts:3-7,13,76,85-95` | import 경로·`DEFAULT_GJC_DEFINITION_NAMES`·`relativePath`·`parentSkillName` 일괄 신규 |
| `src/modes/rpc/rpc-types.ts:405` | `RpcWorkflowStage = "jaw-interview" \| "deep-interview" \| ...` (구값 유니언 유지, deprecated 주석) |
| `packages/bridge-client/src/workflow-gate.ts:11,57` | 동일 — 유니언·배열에 양값 |
| `src/modes/shared/agent-wire/jaw-interview-gate.ts:134` | `stage: "jaw-interview"` 송신 |
| `src/modes/shared/agent-wire/workflow-gate-broker.ts:28` | **`V1_STAGES` 배열에 양값 명시 추가** (현재 `"deep-interview"`만) |
| `docs/rpc.md:744` | stage 문서 갱신 (신규값 + 구값 deprecated 표기) |
| `src/skill-state/jaw-interview-mutation-guard.ts:15,133-144,360,363` | BLOCK_MESSAGE 명령 힌트 `jwc interview --write --stage final`로, 비교값 normalize 경유, 폴백 반환 신규값 |
| `src/tools/ask.ts:32-35` / `src/tools/ast-edit.ts` / `src/session/agent-session.ts` | import 경로·심볼명 추종 |
| `src/modes/components/assistant-message.ts:5,159` | import 추종 (B3에서 교체) |
| `scripts/rebrand-inventory.ts:32` | `expectedBundledWorkflowSkills = ["jaw-interview", "ralplan", "team", "ultragoal"]` |
| `scripts/check-visible-definitions.ts:5` / `scripts/verify-g002-gates.ts:15,57` / `scripts/verify-gjc-skill-docs.ts:54` | 기대 목록·정규식 신규값 |
| `src/prompts/tools/skill.md` / `src/prompts/system/system-prompt.md` | `/skill:jaw-interview` 표면 + 구명 1회 병기 |
| `skills/team/SKILL.md`·`skills/ultragoal/SKILL.md`·`ultragoal/ai-slop-cleaner.md` | 교차 참조 갱신 |
| `structure/*.md` 5종, `README.md`, `AGENTS.md` 표 | 표면 갱신 |
| `src/gjc-runtime/workflow-manifest.generated.json`·`src/internal-urls/docs-index.generated.ts` | **재생성** (수동 편집 금지) |

런타임 심볼(구 deep-interview-runtime.ts 내부): 클래스/인터페이스/함수 21건 `DeepInterview*`→`JawInterview*`,
영속 JSON `skill:` 값 9곳 신규값, `source: "gjc-deep-interview-native"`→`"jwc-interview-native"`,
spec 경로 `jaw-interview-${slug}.md`(:401), stdout/에러 문구 `jwc interview` 어휘.

### B1-c. 검증 게이트 (AGENTS.md 강제)

`bun run check:ts` + `bun scripts/check-visible-definitions.ts` + `bun scripts/verify-g002-gates.ts` +
`bun scripts/rebrand-inventory.ts --strict` + `bun test packages/coding-agent/test/default-gjc-definitions.test.ts`
+ 기존 인터뷰 테스트 5종 (string assertion 6곳 신규값으로 갱신: runtime.test L91/94/103/124/175/186, workflow-gates L31)

## B2 — SKILL.md 개정 (커밋 1개)

`skills/jaw-interview/SKILL.md` 주요 diff (행번호 = 현 SKILL.md 기준):

1. **frontmatter(:1-11)**: `name: jaw-interview`, handoff `.gjc/specs/jaw-interview-{slug}.md`, pipeline `[jaw-interview, plan]`
2. **D040-2(:42)**: `- Ask ONE question at a time -- never batch` →
   `- Ask 1-3 questions per round. Bundle only INDEPENDENT questions; never batch questions where one answer changes another. Each question targets a named dimension.`
3. **D040-4/5 (Execution_Policy + Step 2c)**: 이중 감사 규칙 삽입 —
   - 내부 감사: 매 라운드 4차원(goal/constraint/criteria/ontology) 자기 재평가 + known/unknown 트래커 누적(source/confidence 메타)
   - **negativity bias 초안(D041-C)**: `- Negativity bias: treat every answer as a claim to pressure-test. If an answer is vague, hedging ("maybe", "아마", "~일 수도"), or lacks concrete detail, DOWNGRADE the affected dimension score and stay on that dimension until one layer deeper, one assumption clearer, or one boundary tighter. Never raise a score to close the interview faster.`
   - ontology 점수 = stability_ratio 매핑(내부 표시 전용), 외부 수식(:343-344)·게이트 **무변경**
4. **D040-6 (Step 2c 교체)**: 매 라운드 opus 스코어링 → **체크포인트 외부 감사**: 내부 트래커가
   전 차원 0.8+ 추정 시, 명시 스킵 직전, Phase 4 결정화 직전에만 호출. **스킵/결정화 직전 외부
   감사 1회는 강제**(R3 해소). 호출 시 fork-context + cacheIdentity 고정(D041-B)
5. **D040-7(:396)**: Round 3+ → **Round 1+** 조기탈출, `BELOW_THRESHOLD_EARLY_EXIT` 유지
6. **D040-9(:107,119,401,424)**: spec 경로·glob — Phase 1 consult glob은 `.gjc/specs/{jaw-interview,deep-interview,deep}-*.md` 양쪽 읽기(과거 아티팩트 호환)
7. **D040-10 (Step 2d 표)**: 점수 표기 `0.82 (xhigh)` 병기 — 양자화: <0.3 low / <0.5 medium / <0.7 high / <0.9 xhigh / ≥0.9 max
8. **D041-A (Step 2b)**: 질문 출력을 ask 도구 구조화 입력(elicitation 호환 필드)으로 — 텍스트 헤더 프로토콜 문구 삭제

## B3 — ask 스키마 확장 + 구조화 렌더러 (커밋 1~2개)

조사 확정 제약: gate 경로(`AskGateQuestion{id,question,options,multi?,recommended?}`)는 기존 5필드 불변
(+옵셔널 meta만 추가), timeout·recommended·Other 동작 보존, render-middleware 소비처는
ask.ts(4 export 사용)·assistant-message.ts(1 export) 단 2곳.

1. **MODIFY `src/tools/ask.ts:49-63`** — 스키마 확장(기존 필드 전부 호환 유지):
   ```ts
   const OptionItem = z.object({
       label: z.string(),
       description: z.string().optional(),          // NEW
   });
   const QuestionItem = z.object({
       id: z.string(), question: z.string(),
       options: z.array(OptionItem),
       multi: z.boolean().optional(), recommended: z.number().optional(),
       meta: z.object({                              // NEW — 구 텍스트 헤더 대체
           kind: z.enum(["round", "topology", "progress"]).optional(),
           round: z.number().optional(), component: z.string().optional(),
           targeting: z.string().optional(), whyNow: z.string().optional(),
           ambiguity: z.number().optional(), mode: z.string().optional(),
       }).optional(),
   });
   ```
   gate 경로(:512-517)는 meta를 `context.stage_state`로 패스스루(스키마 형태 불변).
1.5. **(F1) MODIFY `src/modes/shared/agent-wire/jaw-interview-gate.ts`** — `questionToGate`가 현재
   `deepInterviewQuestionState(question.question)` **정규식으로 stage_state를 채움**(:66,134-157).
   D041-A로 텍스트 헤더가 사라지면 unattended gate의 round/topology/ambiguity 메타가 소실되므로:
   `AskGateQuestion`에 `meta?: QuestionMeta` 옵셔널 추가(기존 5필드 불변) → `questionToGate`는
   **meta 우선으로 stage_state 구성, 정규식 파싱은 meta 부재 시 fallback으로 강등**.
   `gateAnswerToResult`는 무변경. ask.ts:512-517에서 gateQuestion에 meta 전달 1줄 추가.
2. **NEW `src/jaw-interview/structured-renderer.ts`** — `renderInterviewQuestion(q: QuestionItem, theme): Component`
   meta 구조화 필드에서 직접 렌더(정규식 파싱 제거). 기존 `Deep Interview · Round N` 헤더 컴포넌트
   트리 재사용(Container/Text/Markdown/Spacer). 진행 리포트는 `renderInterviewProgress(payload, theme)` —
   어시스턴트 텍스트의 ```jaw-interview-progress``` JSON 펜스를 assistant-message.ts가 파싱해 위임.
3. **MODIFY `src/tools/ask.ts:531-533,760-801,861,907`** — `meta` 존재 시 structured-renderer 경로,
   부재 시 기존 Markdown 폴백. 정규식 3함수 import 제거.
4. **MODIFY `src/modes/components/assistant-message.ts:159`** — 정규식 `renderDeepInterviewAssistantText`
   → 펜스 파서 + `renderInterviewProgress`. 펜스 미존재 텍스트는 기존 Markdown 경로.
5. **DELETE `src/jaw-interview/render-middleware.ts`** — 소비처 2곳 전환 완료 후 제거 (동일 커밋 금지,
   B3 마지막 원자 커밋으로 분리해 bisect 가능하게)

## B4 — settings 키 + 진입 어휘 (커밋 1개)

조사 확정: 임계값은 Settings 싱글턴 미경유 — `jaw-interview-runtime.ts`의 2개 함수가 raw 파일 직독.

1. **MODIFY `src/config/settings-schema.ts:378`**: `"jwc.interview.ambiguityThreshold"` 신설(type number,
   default 0.05, 기존 validate 재사용). 구 키 엔트리는 deprecated 주석으로 유지(설정 UI 노출용)
2. **MODIFY `jaw-interview-runtime.ts` `readSettingsAmbiguityThreshold`(:168-191)·`readModernSettingsAmbiguityThreshold`(:201-213)**:
   `parsed?.jwc?.interview?.ambiguityThreshold` 우선 → `parsed?.gjc?.deepInterview?.ambiguityThreshold` fallback (D041-D)
3. **MODIFY `src/config/settings.ts:624` `#migrateRawSettings`**: `gjc.deepInterview.ambiguityThreshold`→
   `jwc.interview.ambiguityThreshold` 이동 블록 추가. ⚠️ 기존 선례(queueMode→steeringMode :626)는
   **top-level flat key**라 nested(`gjc.deepInterview`) 이동은 중첩 객체 안전 접근/정리 코드가 필요 (F3)
4. **(F3) MODIFY `scripts/generate-json-schemas.ts:100`** — 하드코딩된 구 키를 신 키로 갱신 후
   **`schemas/config.schema.json` 재생성** (:157-165 nested 스키마가 산출물로 갱신됨, 수동 편집 금지)
5. **(F3) MODIFY `test/config-cli.test.ts:84-93`** — 구 키 CLI 테스트를 신 키로 갱신 + 구 키 fallback 케이스 추가
6. 진입 어휘는 B1-b의 cli.ts(`interview` + alias `deep-interview`)·workflow-command-ref legacy slug 맵으로 완결

## B5 — 신규 테스트 + 계약 문서 (커밋 1개)

1. **NEW `test/jaw-interview-structured-question.test.ts`** — 성공 기준 4: meta 포함 한국어 질문이
   structured-renderer 경로로 Component 트리 생성(정규식 미경유), meta 부재 폴백 검증
2. **NEW 케이스 in `test/gjc-runtime/jaw-interview-runtime.test.ts`** — 성공 기준 5: R1 명시 스킵 →
   `BELOW_THRESHOLD_EARLY_EXIT` spec 산출. 성공 기준 6: 스코어링 호출이 체크포인트 조건에서만
   발생(매 라운드 미호출) — SKILL.md 정책 스냅샷 + 게이트 테스트로 검증
3. **NEW 케이스** — L2 호환: v1 legacy 픽스처(`deep-interview` skill 값) read-normalize 통과,
   write 시 신규값 기록. settings 구 키 fallback 동작
4. **NEW `devlog/_plan/260612_jawcode_fork/043_contract_elicitation_schema.md`** — ask `QuestionItem` ↔
   cli-jaw elicitation 펜스(`id/type/question/options{label,description}/visibleWhen`) 필드 매핑 표,
   비대화형·웹 출력용 펜스 직렬화 규칙 (M2 130 입력, D040-8)

## 검증 매트릭스 (C단계)

| 게이트 | 명령 |
|--------|------|
| 타입 | `bun run check:ts` |
| 리브랜드 4종 | `check-visible-definitions` / `verify-g002-gates` / `rebrand-inventory --strict` / `default-gjc-definitions.test` |
| 인터뷰 스위트 | `bun test packages/coding-agent/test/jaw-interview-*.test.ts test/gjc-runtime/jaw-interview-runtime.test.ts test/tools/ask*.test.ts test/workflow-gate*.test.ts` |
| 게이트/브릿지 | `bun test packages/bridge-client` |

## 리스크 매트릭스 (갱신)

| # | 리스크 | 심각도 | 처리 |
|---|--------|--------|------|
| R-1 | zod skillEnum fail-closed — 구 state 즉시 무효화 | **高** | L2 read-normalize + legacy 픽스처 테스트 (B1-b, B5-3) |
| R-2 | RPC stage 와이어 파손 (bridge-client·rpc-types·broker) | **高** | L3 양값 유니언, 신규값 송신 (B1-b) |
| R-3 | 구 settings 키 silent 무시 | 中 | dual-read fallback + migrate 블록 (B4) |
| R-4 | generated 파일 diverge (manifest.json, docs-index) | 中 | 재생성 스크립트 실행, 수동 편집 금지 (B1-b) |
| R-5 | mutation guard 메시지의 명령 힌트 구명 잔존 | 中 | `jwc interview --write` 로 갱신 (B1-b) |
| R-6 | 테스트 string assertion 6곳 파손 | 低 | 인벤토리에 위치 특정 완료, B1-c에서 일괄 갱신 |
| R-7 | 업스트림 리베이스 충돌 면적 — 50+ 파일 | 수용 | 본 문서가 충돌 면적 대장 (횡단 원칙 1) |

## 커밋 플랜

B1-a(git mv) → B1-b(심볼·심) → B2(SKILL.md) → B3-1,2(스키마+렌더러) → B3-5(구 미들웨어 제거) →
B4(settings·어휘) → B5(테스트·계약) — 각 커밋 후 해당 게이트 green 확인, 원자 단위 유지.
