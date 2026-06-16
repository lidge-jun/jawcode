# 054 — `jwc orchestrate` 구현 diff 플랜 (M1)

> ⚠️ **[구원칙 폐기 — 인터뷰 260612 02:04]** 본 문서의 'gjc diff-0 / 무수정 추종 / 런타임 치환 / 무회귀' 서술은 폐기된 구원칙 기록이다. 현행 원칙은 **소스 하드 수정**(Jaw/jwc 어휘 직접 기입, 가드 jwc 기준 반전) — [085.5 개정판](./085.5_plan_prompt_rebrand.md) · [095](./095_plan_debt_cleanup.md) 참조.

> 2026-06-12 10:17 초안 (Boss-author). 선행: [051](./051_design_command_port.md) §1–3, [053](./053_decisions_p_boss_author.md) D050-10~21.
> 본 문서는 **D050-19~21 개정 topology 기준** — P = Boss+Critic 1-pass, A = Planner∥Architect 병렬 감사.
> 상태: **v7 — goal A단계 v6델타 감사(F1~F3) 반영, B 착수** (1R 병렬 FAIL → v2 → 결정 3건 → v3 → 2R solo FAIL → v4 → 3R solo PASS → v5 → 클로징 v6 → **goal A 델타: D050-26 PASS·D050-25 F1~F3 반영 v7**).

## 결정 입력 (요약)

| 입력 | 내용 |
|------|------|
| D050-2 | I→P 자동 전환 금지 — spec handoff + 명시 `orchestrate p` |
| D050-13 | 산출물 이중화 — devlog plan(사람) + `ralplan --write --stage final` → pending-approval.md(게이트 정본) |
| D050-14 | `/skill:ralplan` 별도 진입점 유지 — SKILL 본문 통합 안 함 |
| D050-16~18 | D=요약+회고+receipt / C=3스테이지+repo 게이트 / `/orchestrate` 정본+`/pabcd` alias |
| D050-19 | P = Boss 초안 + **Critic 1-pass**(plan 품질) |
| D050-20 | A = **Planner∥Architect 병렬 감사**, read-only, Boss 수정→델타 재감사 ≤3라운드 |
| D050-21 | trivial → A 감사 1명(기본 Architect), `ctx.a_audit_mode: "solo"\|"dual"` |

## 구현 diff (B1–B5)

### B1 — 상태 계층 (pabcd state)

> ⚠️ **A-1라운드 판정(Architect): canonical 5종 확장은 비권장** — `CANONICAL_GJC_WORKFLOW_SKILLS` 확장 시
> `workflow-manifest.ts:144` Record 타입 즉시 컴파일 실패, `state-schema.ts:17` 중복 하드코딩,
> `verify-gjc-skill-docs.ts:88-90`(SKILL.md 필수→크래시), `skill-active-state.test.ts:382` 4종 고정,
> `sdk.ts:1004-1021`·`gjc-dogfood-template.test.ts:17` "4 workflow skills product invariant",
> `check-visible-definitions.ts:5` 등 **10+ 동기화 지점** + 051 R14("스킬 아님")와 설계 충돌.
> rebrand-inventory/G002 자체는 skill **디렉터리** 검사라 배열 추가만으론 직접 FAIL 아님(`rebrand-inventory.ts:32,257` / `verify-g002-gates.ts:15`).
> **[확정 D050-22]: ① 별도 native-state 레지스트리** — canonical 4종 불변, 위 10+ 지점 무접촉.

| 파일 | 변경 |
|------|------|
| 상태 등록 구조 | **[확정 D050-22]** NEW `NATIVE_WORKFLOW_COMMANDS` 레지스트리(가칭) + orchestrate 전용 state 경로 — `CANONICAL_GJC_WORKFLOW_SKILLS`·`state-schema.ts:17`·SKILL.md 검사·dogfood invariant 전부 무접촉 |
| native 초기 단계 | `normalized === "pabcd"` → `"i"` — native 레지스트리 측 등가물(`initial-phase.ts:14-21` 패턴 차용, canonical 파일은 무변경) |
| 전이 모듈 | NEW native manifest — states `["i","p","a","b","c","d","complete"]`, forward-only + `i` 복귀 전이(cli-jaw `canTransition:563` 이식), terminal `["complete"]`, retention/hudFields (`workflow-manifest.ts:116-142` builder 패턴 차용) |
| state 파일 | envelope `.gjc/state/pabcd-state.json` (+ session-scoped) — **052/050 문서의 `pabcd.json`은 논리 계약명, envelope 경로는 runtime 관례 `<skill>-state.json`을 따름** [기본값 수용]. 필드: `current_stage`, `spec_ref`, `plan_ref`, `ctx.a_audit_mode`, `a_round`(≤3), `p_round`(≤2), `p_review_passed` |
| 쓰기 경로 | **[2R 검증 확정] native 전용 writer 분리가 유일 경로** — `state-schema.ts:32-33` `strictSkillEnum = z.enum([...CANONICAL_GJC_WORKFLOW_SKILLS])`이 `RequiredOnWriteEnvelopeSchema`(`:110-118`)에서 skill을 4종으로 강제하므로 `writeWorkflowEnvelopeAtomic()`(`state-writer.ts:391`)은 pabcd를 거부함 |
| NEW native writer 3종 | ① `RequiredOnWriteNativeEnvelopeSchema` — `skill: "pabcd"` 허용, version/updated_at/current_phase/active/receipt 구조는 canonical과 동형 ② `writeNativeWorkflowEnvelopeAtomic()` — fail-closed 검증 + atomic write 게이트 유지 ③ `NativeWorkflowCommand` 타입 — `CanonicalGjcWorkflowSkill`과 분리(receipt 계약 `skill-state/workflow-state-contract.ts:25`·`StateWriterReceiptContext.skill`(`state-writer.ts:41`)·`RequiredWorkflowStateReceiptSchema`(`state-schema.ts:93`)의 native 등가물 포함) |
| 재생성 | **없음** — native manifest는 `workflow-manifest.generated.json` drift gate 대상이 아님(D050-22 무접촉 원칙). ~~generate-gjc-workflow-manifest 재실행~~ ~~generate-json-schemas~~ (2R 모순 정정) |

### B2 — 명령 표면

| 파일 | 변경 |
|------|------|
| NEW `packages/coding-agent/src/commands/orchestrate.ts` | `commands/interview.ts:1-40` 템플릿 — `APP_NAME` 브랜드 안전 설명, positional `i\|p\|a\|b\|c\|d`, `--deliberate` 플래그(ctx 전달), 코어는 `gjc-runtime/orchestrate-runtime.ts` 위임 |
| `packages/coding-agent/src/cli.ts:50` 부근 | `{ name: "orchestrate", aliases: ["pabcd"], load: ... }` — **[확정 D050-24] jaw 전용 등록 게이트 신설**: 조건부 등록 빌더(`isJawBrand()` — `discovery/helpers.ts:32-35` 재사용)로 gjc 브랜드에서 미노출. 명령 등록 게이트의 첫 선례가 됨(interview 소급은 후속 검토) |
| `packages/coding-agent/src/slash-commands/builtin-registry.ts` | `/orchestrate` (+alias `/pabcd`) — subcommands `i..d`, `/goal`(275-295) 패턴, handle/handleTui. **D050-24 동일 적용: `isJawBrand()` 조건부 등록** — gjc TUI에 `/orchestrate` 미노출 (2R 지적 보강) |
| interview 게이트 소급 | **[확정 D050-25]** 같은 조건부 등록 빌더에 `interview`(+`deep-interview` alias) 편입 — gjc 브랜드에서 미노출, 표면 비대칭 제거 |
| `packages/coding-agent/test/cli-command-surface.test.ts:17-36` | **[A-v6델타 F1·高]** `extractRegisteredCommands()`가 정적 `commands` 배열 파싱 + `"interview"` 고정 기대(:33) — 게이트 적용 즉시 FAIL. **브랜드 인지 테스트로 전환**: jaw 전용 배열 분리 후 gjc 케이스에서 interview·orchestrate **부재** assert, jwc 케이스에서 존재 assert. `:55-67`의 `"jaw-interview"` spawn 표기도 `interview`로 정정 |
| `packages/coding-agent/src/hooks/skill-keywords.ts` | **[확정 D050-26] `$orchestrate` keyword 미채택** — 변경 없음 |

### B3 — 단계 프롬프트

| 파일 | 변경 |
|------|------|
| NEW `packages/coding-agent/src/prompts/jaw/orchestrate-{i,p,a,b,c,d}.md` | cli-jaw `state-machine.ts:240 getPrefix`/`:542 getStatePrompt` 사본 + jwc 어휘 손질(보스/직원 → 메인 세션/subagent). 디렉터리 신설. **단계 진입 프롬프트** — spawn용 audit 프롬프트와 별개(아래 행) |
| NEW `packages/coding-agent/src/prompts/jaw/orchestrate-audit-{planner,architect}.md` | **A spawn 전용 audit 프롬프트**(2R 지적 보강) — EMBEDDED `planner.md`/`architect.md`(ralplan 어휘 CLEAR/WATCH/BLOCK·APPROVE/COMMENT) 대신 이 파일을 임베드, 출력 형식을 `PASS\|FAIL` + finding(file:line·심각도·수정안)으로 고정(D050-23) |
| P Critic 프롬프트 | **신설 없음(확정)** — EMBEDDED `critic.md`(OKAY\|ITERATE\|REJECT) 그대로 재사용(D050-23 단계별 소유권) |
| 로딩 | `task/agents.ts:9-19` 패턴 — `import ... with { type: "text" }` 임베드, stage 진입 시 주입 |
| I 프롬프트 | 040 jaw-interview 산출물과 결합 — 엔진 호출만, 질문 정책은 SKILL이 소유 |

### B4 — P/A 런타임

| 파일 | 변경 |
|------|------|
| NEW `packages/coding-agent/src/gjc-runtime/orchestrate-runtime.ts` | 단계 진입·전이·게이트 코어 |
| P 흐름 | Boss 초안(devlog plan + 요약) → **Critic 1-pass** spawn(`task/agents.ts` EMBEDDED critic.md, fresh spawn·read-only·receipt-only) → **`OKAY` 즉시 final / `ITERATE\|REJECT` 시 Boss revise 후 재검 1회만(`p_round ≤2`), 재FAIL이면 pending-approval 작성 금지 + 사용자 에스컬레이션** [기본값] → `ralplan --write --stage critic/final`(`ralplan-runtime.ts` KNOWN_STAGES:37 재사용) → pending-approval ⛔. ※ "1-pass" = 리뷰어 1명, 라운드는 위 규칙 |
| A 흐름 | **trivial 판정은 `orchestrate a` 진입 시** — plan diff 기준 predicate(단일 파일·단일 동작·AC 명시), `--deliberate`/high-risk 지정 시 dual 강제, 결과를 `ctx.a_audit_mode`에 기록 [기본값] → **Planner∥Architect 병렬 spawn**(solo → Architect 단독) → NEW `parseWorkerVerdict`(**[확정 D050-23] 단계별 분리**: A는 `PASS\|FAIL` 신규 파서 + orchestrate 전용 audit 프롬프트, P Critic은 ralplan 어휘 `OKAY\|ITERATE\|REJECT` 유지. ※ architect.md 자체 어휘는 CLEAR/WATCH/BLOCK이라 **A 전용 프롬프트로 출력 형식 고정 필수**) → FAIL이면 Boss 플랜 수정 → 델타 재감사(라운드별 산출물 `round-N.md` + `a_round` 갱신), `a_round ≤3` 초과 시 사용자 에스컬레이션 |
| handoff | `.gjc/specs/jaw-interview-*.md`(`jaw-interview-runtime.ts:408`) → pabcd state `spec_ref` 소비; A 산출물은 `.gjc/plans/pabcd/<run-id>/` + `index.jsonl` 관례. **P 게이트 정본(pending-approval.md)은 ralplan writer 재사용이므로 `.gjc/plans/ralplan/<run-id>/` 경로 유지**(D050-13) |

### B4 스코프 노트 (B-verify 확정, cli-jaw 동형)

> 런타임(CLI)은 **상태머신 + 프롬프트 방출 + verdict 기록**까지만 소유한다. subagent spawn·ralplan 호출·trivial predicate의
> 의미 판정은 **메인 세션(에이전트)** 몫 — cli-jaw 원본도 동일 분담(orchestrate 명령은 프롬프트 주입만, dispatch는 Boss가).
> 런타임이 제공하는 기계 표면: `orchestrate audit-prompt planner|architect`(PASS|FAIL 고정 spawn 프롬프트),
> `orchestrate verdict --worker-output`(stage p=OKAY|ITERATE|REJECT/`p_round≤2`, a=PASS|FAIL/`a_round≤3`, b=DONE|NEEDS_FIX),
> `--audit-mode solo|dual` 진입 기록. "승인 전 mutation 0"은 런타임 자체가 `.gjc/state` 외 무엇도 쓰지 않음으로 충족.

### B6 — B/C/D 런타임 (A-1라운드 Planner 지적 보강)

| 항목 | 변경 |
|------|------|
| `runStageB` | 메인 세션 executor **solo 기본**(D050-5), team 트리거는 Boss 재량 + 사용자 고지(D050-6) — `orchestrate-b.md` 프롬프트에 명시 |
| `runStageC` | **기계 검증→정밀 검토→평결 3스테이지**(D050-9/17) — 기계 검증 = repo 게이트(`bun run check:ts`·대상 테스트·rebrand/G002), 타 repo는 컨벤션 자동 감지 문구. 평결 FAIL → B 복귀 안내 |
| `runStageD` | 변경 파일·충족 기준 요약 + **WONDER/REFLECT 회고** 텍스트(사용자 산출물) + pabcd state에 gjc receipt 관례 종결 기록(D050-16) → 상태 클리어 |
| devlog 번호 | plan 문서 생성 시 050번대 lexicographic 연속 규칙(D050-3) — 자동 번호 충돌 검사 |

### B5 — 검증 게이트

- 단위: `test/workflow-state-command.test.ts:35-70` 패턴 — pabcd state write/receipt + `canTransition` 이식분(전이 표 전수)
- e2e: `orchestrate i→p→a→…→d` 풀사이클 1회 / spec 보유 시 `p` 단독 진입 / 승인 전 mutation 0
- 기계: `bun run check:ts`(root — biome+tsgo+schemas+`check:gjc-ui`=rebrand-inventory `--strict`), `scripts/verify-g002-gates.ts`
- gjc 브랜드 diff-0: **gjc에서 `orchestrate`/`pabcd`/`interview` CLI 미등록 + `/orchestrate` slash 미노출 확인** (D050-24·25 기준) — 구체화: `cli-command-surface.test.ts`를 브랜드 분기(F1)로 갱신하고 gjc 부재/jwc 존재를 양방향 assert

### B7 — 문서 패치 diff (053 속집 2 체크리스트 구체화)

| 문서 | 변경 |
|------|------|
| `050_moc_plan_pabcd.md` §스코프 | "P=Boss+3-reviewer"·`ctx.p_review_mode` → "P=Boss+Critic 1-pass / A=Planner∥Architect / trivial=A solo(Architect) / `ctx.a_audit_mode`" |
| `051_design_command_port.md` §1·§3·§3.1·§4 | P/A행 D050-19~21 갱신, §1 등록 게이팅 표기를 D050-24 결정 결과로 교체, §4 결정 상태 표 갱신 |
| `052_decisions_ipabcd.md` | D050-11/12/15 참조처에 개정 포인터 |
| `structure/workflows.md:21` | **[A-v6델타 F2]** `jwc interview` CLI를 무조건 기술 중 → jaw 전용(`isJawBrand`) 표기 + gjc는 `/skill:jaw-interview` 경로만 명시 (D050-25 정합) |
| (선택) `docs/codebase-overview.md:30`, `docs/environment-variables.md:220,224` | [F3·低] stale `deep-interview` CLI 언급 — upstream 문서라 수정 보류 가능, 건드릴 경우만 분기 기술 |

## A 소규모 1라운드 결과 (260612 10:30 — Planner∥Architect 병렬, D050-20 도그푸딩)

- **두 lens 모두 FAIL** → Boss 수정 반영(본 문서 v2): B1 구조 경고·동기화 지점 보강, P/A 루프 종료 조건·trivial 판정 시점 명시, B6(B/C/D 런타임)·B7(문서 패치) 신설, Acceptance 확장
- **사용자 결정 회수 → 확정**(053 속집 3): D050-22 native 레지스트리, D050-23 verdict 단계별 분리, D050-24 jaw 전용 등록 게이트 — 본 문서 v3에 반영
- **2라운드 델타 재감사**(Architect solo — D050-21 첫 적용): FAIL — ① native writer 3종 명세 공백 ② A audit 프롬프트 B3 누락 ③ slash 무게이트 ④ 재생성/diff-0 stale 문구. **2R가 코드로 확정한 것**: `strictSkillEnum`(`state-schema.ts:32-33`)이 write 게이트에서 4종 강제 → native writer 분리가 유일 경로 / `jwc.js:2`가 cli import 전 `GJC_BRAND_NAME` 설정 → 조건부 등록 빌더 가능 → **v4에 전부 반영**
- **3라운드 델타 재감사**(`a_round=3` — 한도 마지막, Architect solo): **PASS** — 2R 6건 전부 해소 확인, 신규 추측 공백 없음, 코드 앵커 spot-check 정확. 잔여 wording 4건(경로 접두사·앵커 모듈 경로·receipt sub-schema 명시·B3 제목)은 v5에서 정리 → **B 진입 준비 완료**

## Acceptance (M1) — 260612 C 단계 검증 완료

- [x] B1–B7 전체 + 풀사이클 e2e 1회 (D050-7) — 런타임 테스트 i→…→complete + /tmp 실CLI 스모크. ※ 실전 과제 1건 풀사이클(D050-19 Critic 1-pass 첫 실사용)은 후속 도그푸딩
- [x] spec 보유 시 `orchestrate p` 단독 진입 e2e / 승인 전 mutation 0 (런타임은 `.gjc/state` 외 무기록 — B4 스코프 노트)
- [x] subagent stage 파일 receipt-only — plan 본문 복제 금지 (D050-13, 프롬프트 계약)
- [x] `/skill:ralplan` SKILL 본문 diff 없음 (D050-14)
- [x] gjc 브랜드 diff-0 — rebrand-inventory --strict·G002 green, 브랜드 분기 표면 테스트 양방향 assert
- [x] B7 문서 패치 완료 (050·051·052·workflows.md + 053 속집 2 체크리스트)
- [x] devlog 번호 lexicographic 규칙 준수 (D050-3)

게이트 증거: tsgo clean / biome clean(신규 파일) / bun test 433 pass·0 fail(38 파일) / rebrand strict unexpectedLegacyHitCount=0 / G002 passed
