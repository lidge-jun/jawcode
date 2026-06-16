# 051 — 설계: cli-jaw 명령 체계의 jwc 이식 (D10 표면 — orchestrate/goal/memory)

> ⚠️ **[구원칙 폐기 — 인터뷰 260612 02:04]** 본 문서의 'gjc diff-0 / 무수정 추종 / 런타임 치환 / 무회귀' 서술은 폐기된 구원칙 기록이다. 현행 원칙은 **소스 하드 수정**(Jaw/jwc 어휘 직접 기입, 가드 jwc 기준 반전) — [085.5 개정판](./085.5_plan_prompt_rebrand.md) · [095](./095_plan_debt_cleanup.md) 참조.

> 050/060/070 밴드 공통 기반 설계 (260612 05:20). **050 정본 = Orchestrate IPABCD** (본 문서 §3).
> P Boss-author 재매핑: [053_decisions_p_boss_author.md](./053_decisions_p_boss_author.md).
> 착수 시 각 밴드 P에서 diff 레벨로 구체화 (P 구현 = 054 plan).
> 원칙: **표면(동사·전이·게이트) = cli-jaw, 엔진 = gjc 네이티브 재사용** (D10). gjc 브랜드 diff-0 유지.

## 1. 명령 아키텍처 — gjc의 기존 2계층 재사용

| 계층 | gjc 메커니즘 | jwc 이식 방식 |
|------|-------------|---------------|
| CLI 서브커맨드 | `commands/*.ts`의 `Command` 클래스 | NEW `commands/orchestrate.ts` (+alias `pabcd`), `commands/interview.ts`(040 — D050-25로 게이트 소급), `commands/goal.ts`, `commands/memory.ts` — **jaw 브랜드에서만 등록** (D050-24: `cli.ts` `jawOnlyCommands` + `isJawBrandEnv()` 조건부 등록, 054 구현) |
| TUI 슬래시커맨드 | `slash-commands/builtin-registry.ts` | `/orchestrate` (+alias `/pabcd`) — `JAW_ONLY_SLASH_COMMANDS` + `isJawBrand()` 필터로 jaw 전용(D050-24). handle()이 CLI 코어 함수 호출 |

**orchestrate 서브커맨드 형태 (cli-jaw 동형, D050-19~21 반영):**

```text
jwc orchestrate i            # IPABCD 1단계 — 040 jaw-interview 엔진
jwc orchestrate p            # Boss(메인 세션) 초안 + Critic 1-pass (D050-19)
jwc orchestrate a            # Planner∥Architect 병렬 감사 + parseWorkerVerdict (D050-20, trivial→solo D050-21)
jwc orchestrate verdict --worker-output <path>   # 감사/검증 평결 기록
jwc orchestrate b|c|d|complete|status
jwc pabcd                    # alias
```

- 설명 문자열: 010 패턴(`${APP_NAME...}`) 브랜드 안전
- rebrand-inventory: 번들 4종 무변경 — **IPABCD는 스킬이 아니라 네이티브 명령+상태머신+프롬프트** (R14)

## 2. 이식할 cli-jaw 자산 (정본 소스)

| cli-jaw 소스 | 내용 | jwc 대응 |
|--------------|------|----------|
| `src/orchestrator/state-machine.ts:240 getPrefix` / `:542 getStatePrompt` | I/P/A/B/C/D 단계별 주입 프롬프트 | `prompts/jaw/orchestrate-{i,p,a,b,c,d}.md` — I는 040 jaw-interview 산출물과 결합 |
| `:563 canTransition` | 전이 (forward-only, I 복귀, 게이트) | `gjc-runtime/orchestrate-state.ts` `canTransitionPabcd` + envelope `.gjc/state/pabcd-state.json`(논리 계약명 `pabcd.json`, D050-22 native 레지스트리 — canonical 4종 무접촉) |
| `:607 parseWorkerVerdict` | A PASS/FAIL | `orchestrate-state.ts` `parseWorkerVerdict` — **orchestrate a** Planner∥Architect 감사 수신(D050-20), verdict 어휘는 단계별 분리(D050-23: A=PASS\|FAIL, P Critic=OKAY\|ITERATE\|REJECT) |
| `cli-jaw orchestrate i\|p\|a\|…` | 단계 진입 커맨드 | `jwc orchestrate <stage>` 1:1 |
| `cli-jaw goal …` | goal 동사 셋 | 060 밴드 — ultragoal 어댑터 |
| `cli-jaw memory …` | memory 동사 셋 | 070 밴드 — memories 어댑터 |

## 3. IPABCD 단계 엔진 매핑 (050 정본 — D3 + 053)

| 단계 | cli-jaw 진입 | jwc 진입 | 엔진 (gjc 네이티브) | 게이팅 |
|------|--------------|----------|---------------------|--------|
| **I** | `orchestrate i` | `jwc orchestrate i` / `jwc interview`(단독) | **040** `jaw-interview` | read-only, spec handoff |
| **P** | `orchestrate p` | `jwc orchestrate p` | **Boss(메인 세션)** devlog plan 초안 + **Critic 1-pass**(품질, `p_round ≤2`) + `ralplan --write` (D050-19) | mutation 금지 (devlog plan + writer CLI만) |
| **A** | `orchestrate a` | `jwc orchestrate a` | **Planner∥Architect 병렬 감사**(read-only) + `parseWorkerVerdict`, Boss 수정→델타 재감사 `a_round ≤3`, trivial→Architect solo (D050-20/21) | audit verdict pass 게이트 |
| **B** | `orchestrate b` | `jwc orchestrate b` | 메인 세션 (executor) | 승인 후 쓰기 |
| **C** | `orchestrate c` | `jwc orchestrate c` | check/테스트 | 기계 검증 [D050-9] |
| **D** | `orchestrate d` | `jwc orchestrate d` | 요약 + 상태 클리어 | — |

### 3.1 P/A 단계 오케스트레이션 (053 속집 2 정본 — D050-19~21)

```
orchestrate p  (prompts/jaw/orchestrate-p.md)
    │
    ├─ Boss: spec → devlog plan 초안 + 사용자 요약
    ├─ task agent=critic — 품질 1-pass, OKAY|ITERATE|REJECT
    │       FAIL → Boss revise → 재검 1회 (p_round ≤2), 재FAIL → 에스컬레이션
    ├─ gjc ralplan --write --stage critic/final → pending-approval.md
    └─ ⛔ STOP (사용자 승인 → orchestrate a)

orchestrate a  (prompts/jaw/orchestrate-a.md)
    │
    ├─ Planner ∥ Architect 병렬 감사 (trivial → Architect solo, ctx.a_audit_mode)
    │       read-only — 발견 + file:line 증거 + 수정안 (orchestrate-audit-*.md, PASS|FAIL 고정)
    ├─ orchestrate verdict --worker-output <보고서> → parseWorkerVerdict
    │       FAIL → Boss 플랜 수정 → 델타 재감사 (a_round ≤3, 초과 시 에스컬레이션)
    └─ ⛔ STOP (사용자 승인 → orchestrate b)
```

- Subagent: ralplan SKILL receipt-only·순차 실행·Architect/Critic fresh spawn 규칙 **그대로**
- **`/skill:ralplan`**: Planner-author loop **유지** (jaw-interview·team gate). `orchestrate p`와 **다른 진입점** [D050-14]

**040 → 050 연결 (I handoff):**

1. `orchestrate i` 또는 `interview` 완료 → `.gjc/specs/jaw-interview-{slug}.md`
2. `pabcd.json`에 `spec_ref`, `current_stage`, `plan_ref`(P 후)
3. `orchestrate p`: Boss가 spec 소비; `--deliberate`는 `ctx`·ralplan writer mode에 전달

**goal 모드** (IPABCD와 별 축): ultragoal + goal-continuation — 060 밴드.

## 4. 결정 상태 (밴드별)

| 항목 | 상태 |
|------|------|
| 040 라운드당 질문 | [041 확정] 1–3; 050은 엔진 호출만 |
| `interview` vs `orchestrate i` | [확정 D050-1] 동일 엔진, pabcd 등록 UX만 차이 |
| I→P 자동 전환 | [확정 D050-2] 금지 — 명시 호출·handoff·원클릭 제안 |
| P 작성·리뷰 | [확정 D050-10/19] Boss-author + Critic 1-pass (D050-11은 D050-19로 개정) |
| A vs Critic | [확정 D050-20/21] A=Planner∥Architect 병렬, trivial→solo (D050-12는 D050-20으로 개정) |
| 상태 등록·게이트·어휘 | [확정 D050-22/23/24] native 레지스트리 / verdict 단계별 분리 / jaw 전용 등록 게이트(+interview 소급 D050-25) |
| 060 멀티골 | [기본값] 멀티골+active 뷰 |
| 070 memory | [실사 후] |
| /goal 슬래시 충돌 | 미정 |

## 5. 검증 골격 (각 밴드 공통)

- gjc 브랜드: 신규 커맨드 미등록(orchestrate/pabcd/**interview** — D050-24/25), `/orchestrate` slash 미노출, diff-0
- jwc 브랜드:
  - `jwc orchestrate i` → spec → `p` (Boss+Critic) → `a` (병렬 감사) → … → `d`
  - spec 보유 시 `orchestrate p` 단독 진입
  - `jwc goal` / `jwc memory` (060/070)
- 전이 규칙 단위 테스트 (`canTransitionPabcd` — `test/gjc-runtime/orchestrate-state.test.ts`) + 브랜드 분기 표면 테스트 (`test/cli-command-surface.test.ts`)
