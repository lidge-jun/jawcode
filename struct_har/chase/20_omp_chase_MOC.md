# 20 — omp_chase_MOC (omp 따라잡기)

> 상태: 🟡 운영 중
> **정본 디렉터리**: `struct_har/chase/20_*` · `20.NNN_*`
> **의미**: `devlog/_omp_chase/oh-my-pi` 대비 jwc **약함(G2)** — 참조·설계 (`20.NNN`). **1:1 이식 ❌**

## 번호

| **20** | 본 MOC |
| **20.NNN** | `20.001_…` 파일명 |

규약: [005_devlog_numbering.md](./005_devlog_numbering.md)

## 링크

| | |
|---|---|
| G2 | [002_gap_inventory.md](./002_gap_inventory.md) |
| 참조 | [004_reference_from_omp.md](./004_reference_from_omp.md) |
| omp | [../omp_origin/](../omp_origin/) |
| 따라갈 순 | [007_follow_index.md](./007_follow_index.md) |

## Reviewed through

| omp | jwc |
|---|---|
| `0fc6d136` (`origin/main`, v16.1.20) | `da23db8` (worktree) |

> GJC head is intentionally not repeated here; see [10_gjc_chase_MOC.md](./10_gjc_chase_MOC.md).

## Recent reference-only deltas

| 영역 | OMP source facts | jwc 처리 |
|---|---|---|
| task-agent discovery | `.omp/agents` roots and Claude plugin roots; first-wins exact-name dedup; execution-time rediscovery; `read-summarize: false`; plan-mode tool narrowing (`devlog/_omp_chase/oh-my-pi/docs/task-agent-discovery.md:38,59,68-77,114,126-130,180-186`) | 030/099 참조; jwc role-agent 4종 표면 유지 |
| task tool lifecycle | batch default-on, required shared `context`, no per-call `schema`, async jobs, `agent://`/`history://`, yield-required finish, idle/parked revival, semaphore/recursion gates, IRC follow-up (`docs/tools/task.md:29-46,52-58,69-71,76-97,132-140,157-163`) | subagent UX/contract gap으로만 분해 |
| session ops | export `subSessions`, custom share failure no-fallback, encrypted share, fork parentSession metadata, cross-project resume re-root/fork, rollback switch caveats (`docs/session-operations-export-share-fork-resume.md:21-28,45,115-130,181-190,236-249,257-277,313-327`) | operator semantics 후보 |
| memory | disabled-by-default local pipeline, Memory Guidance injection, `memory://`, extraction/consolidation, redaction, model-role fallback (`docs/memory.md:3-5,16-24,28-30,44-56,76-89,95-98`) | 99.01 후보 |
| compaction pruning | superseded read pruning, useless-result elision, protected tools, 40k protect/20k min savings, suffix/idle prompt-cache-aware flush (`packages/agent/src/compaction/pruning.ts:19-39,48-70,108-138,146-165,171-215,243-274,284-331`) | 083/session 후보 |
| steering delivery | yield-boundary `lateSteering` re-poll; settle-time stranded queue drain; steer image-normalization idle mirror (`packages/agent/src/agent-loop.ts:1066-1081`, `agent-session.ts:1432-1447,6373-6410,6599-6611`, `42ffc83`) | **[20.005](./_fin/20/20.005_omp_chase_steering_delivery.md)** — jwc 부분 보유, gjc 미수용 |
| TUI 입력 micro | Esc draft clear + selector `resetDisplay` (`e914bf0`); double-esc history **revert** (`d055f64`); ast-edit status 공백 축약 (`3d646d8`) | **[20.006](./_fin/20/20.006_omp_chase_tui_input_micro_fixes.md)** ✅ _fin — Esc draft-clear+ast collapse 채택(jwc `a291199`), resetDisplay defer(`ui.resetDisplay()` 부재); collab/brew 비채택 |
| OMP 15.12→15.13 | session split, auto-learn, STT/TTS, compaction UI | [20.008](./_fin/20/20.008_omp_chase_pull_15_13_delta.md) |

## 활성 (`20.NNN`)

| NNN | 문서 | 스코프 | jaw | 상태 |
|---|---|---|---|---|
| 001 | [20.001_omp_chase_cycle.md](./20.001_omp_chase_cycle.md) | fetch·regen | struct_har | 🟡 |
| 002 | [20.002_omp_chase_worker_catalog.md](./_fin/20/20.002_omp_chase_worker_catalog.md) | worker | 100 | ✅ _fin |
| 003 | [20.003_omp_chase_memory_skills.md](./_fin/20/20.003_omp_chase_memory_skills.md) | memory·skills | 99.01 | ✅ _fin |
| 004 | [20.004_omp_chase_lsp_dap.md](./20.004_omp_chase_lsp_dap.md) | LSP/DAP | 081 | ⬜ |
| 005 | [20.005_omp_chase_steering_delivery.md](./_fin/20/20.005_omp_chase_steering_delivery.md) | steer/followUp 전달 | session | ✅ _fin |
| 006 | [20.006_omp_chase_tui_input_micro_fixes.md](./_fin/20/20.006_omp_chase_tui_input_micro_fixes.md) | Esc·ast status | 082·99.20 | ✅ _fin |
| 007 | [20.007_omp_chase_session_modularization.md](./_fin/20/20.007_omp_chase_session_modularization.md) | session modules | 083 | ✅ _fin |
| 008 | [20.008_omp_chase_pull_15_13_delta.md](./_fin/20/20.008_omp_chase_pull_15_13_delta.md) | 15.13 index | 횡단 | ✅ _fin |
| 009+ | _(미할당)_ | | | ⬜ |

## 완료

→ [_fin/20/](./_fin/20/README.md)

## gjc

[10_gjc_chase_MOC.md](./10_gjc_chase_MOC.md)

## Jawdev chase expansion — 2026-06-26

> Document: `struct_har/chase/20_omp_chase_MOC.md`
> Title: 20 — omp_chase_MOC (omp 따라잡기)
> Lane: OMP
> Status: active chase card
> Canonical source: `devlog/_omp_chase/oh-my-pi` (main tracking origin/main)
> Primary patch surfaces: structure/, struct_har/chase/, devlog/_plan/

### Why this is behind or can drift

1. This card exists because JWC must reconcile a concrete upstream/reference behavior with the current Jawcode fork, not because file names happen to differ.
2. The comparison source is devlog/_omp_chase/oh-my-pi; agents must not substitute `devlog/_upstream_*` or the root repository history as the chase baseline.
3. The current drift risk is semantic: behavior, workflow state, command contract, persistence, or operator evidence can diverge even when a simple diff looks small.
4. The fork also carries JWC-specific naming, `.jwc` state, and Jawdev workflow rules, so a direct copy from the source lane can be wrong.
5. For active cards, the lag means JWC either lacks the source behavior, lacks a matching guard, or has not documented a conscious rejection.
6. For completed cards, the lag can return when the source clone advances past the reviewed HEAD or when adjacent JWC code changes without updating this card.
7. Index and MOC documents can drift by pointing agents at stale priority, stale branch names, stale clone paths, or already-finished work.
8. The first Jawdev obligation is to restate the delta in JWC terms before touching implementation files.
9. The second obligation is to decide whether the source behavior is a product requirement, a reference pattern, or a rejected mismatch.
10. The third obligation is to bind the decision to a verification gate so later agents can prove the card is closed.

### Where to patch

1. Start from this document, then open the current source lane at `devlog/_omp_chase/oh-my-pi` and the matching JWC files under structure/, struct_har/chase/, devlog/_plan/.
2. For GJC-sourced cards, compare against `devlog/_gjc_chase/gajae-code` on `dev` tracking `upstream/dev`.
3. For OMP-sourced cards, compare against `devlog/_omp_chase/oh-my-pi` on `main` tracking `origin/main`.
4. Patch only the JWC implementation surface after the delta is understood; do not edit the chase clone.
5. Keep public command names, state directories, and user-facing examples JWC-first: `jwc`, `.jwc`, and `@jawcode-dev/*`.
6. If a source path uses upstream names such as `gjc`, translate them through `008_gjc_jwc_naming_contract.md` before copying any behavior.
7. If this card points to docs/index behavior, update `structure/`, `struct_har/chase/`, and the relevant devlog plan rather than product code.
8. If this card points to runtime behavior, add or update the nearest package test before declaring the card finished.
9. If the correct patch surface is outside structure/, struct_har/chase/, devlog/_plan/, record why the owner changed in the devlog before widening scope.
10. Do not batch this card with unrelated chase cards unless a MOC explicitly says they form one PABCD bundle.

### Decision needed before patching

1. Decide whether to import the source behavior, adapt it to JWC, reject it, or split it into smaller cards.
2. Decide whether the user-visible contract changes; if yes, update docs and tests with the same patch.
3. Decide whether persistence/state migration is involved; if yes, identify the `.jwc` state files and rollback posture.
4. Decide whether subagents must learn a new rule; if yes, promote the durable rule to `AGENTS.md` or `structure/`, not only this chase file.
5. Decide whether the source behavior conflicts with the fork's TUI, workflow, or naming constraints.
6. Decide whether this card is still active; if already implemented, move or keep it under `_fin` with evidence instead of reopening vague work.
7. Decide which verification command is authoritative for the changed surface: focused test, `bun run check:tools`, `bun run check:ts`, smoke test, or manual artifact proof.
8. Decide whether a failed broad check is caused by this card; unrelated failures must be recorded, not hidden.
9. Decide whether the implementation needs a follow-up goal because the card implies more than one atomic patch.
10. Decide what evidence will convince a read-only reviewer that the chase gap is actually closed.

### Verification and done evidence

1. Re-read this file after patching and verify the stated source lane still matches devlog/_omp_chase/oh-my-pi.
2. Run a focused diff against the source lane and paste the relevant file anchors into the devlog or final report.
3. Run the package-level focused test that proves the affected behavior, not just a broad lint pass.
4. Run `bun run check:tools` for repository formatting/lint hygiene.
5. Run `git diff --check` before committing to catch whitespace and conflict-marker mistakes.
6. If `bun run check:ts` is relevant and fails, classify whether the failure is caused by the patch or a pre-existing dependency drift.
7. Update this card's status line, MOC row, or `_fin` placement only after evidence exists.
8. Add a devlog evidence note for the patch surface, tests, reviewer, and any known residual risks.
9. Ask a read-only reviewer to challenge the closure if the patch touches runtime behavior, workflow state, or subagent routing.
10. Commit only the card's intended docs/code/test files; preserve unrelated worktree changes.

### Sub-agent handoff contract

1. A sub-agent must start from the Project root `/Users/jun/Developer/new/700_projects/jawcode`, not from `~/.cli-jaw`.
2. A sub-agent must read `AGENTS.md`, `structure/00_INDEX.md`, and this file before proposing implementation.
3. A sub-agent must resolve the chase baseline from `devlog/_omp_chase/oh-my-pi` and verify the branch with `git status --short --branch`.
4. A sub-agent must treat the source clone as read-only evidence unless the explicit task is to fast-forward that clone.
5. A sub-agent must write the patch against JWC files only and must not stage clone contents.
6. A sub-agent must preserve JWC naming and translate upstream identifiers through the naming contract.
7. A sub-agent must report decisions in terms of import/adapt/reject/split, not as vague 'needs follow-up' text.
8. A sub-agent must name the exact files that should change before editing them.
9. A sub-agent must include verification output, not just an implementation summary.
10. A sub-agent must leave this document more accurate than it found it whenever the card's status changes.

### Minimum patch worksheet

1. Source anchor checked: devlog/_omp_chase/oh-my-pi.
2. Source branch checked: main tracking origin/main.
3. JWC owner files listed before edit: structure/, struct_har/chase/, devlog/_plan/.
4. Naming contract checked against `008_gjc_jwc_naming_contract.md`.
5. Current MOC row checked for priority and status.
6. Current devlog plans searched for prior implementation or rejection.
7. Related tests searched before adding new tests.
8. Runtime/state risk classified as none, local, or migration.
9. User-facing command/help change classified as yes or no.
10. Subagent instruction change classified as yes or no.
11. Implementation option chosen: import, adapt, reject, or split.
12. Rejection rationale written if source behavior is not adopted.
13. Focused verification command selected.
14. Broad hygiene command selected.
15. Reviewer/audit route selected when risk is not local.
16. Documentation update location selected: this card, MOC, `structure/`, or devlog.
17. Commit scope listed before staging.
18. Known unrelated failures separated from card failures.
19. Completion evidence attached to final report.
20. Card status changed only after evidence is present.

### Decision log slots

1. Decision A — source behavior classification: import / adapt / reject / split.
2. Decision B — JWC naming impact: none / command text / state path / package namespace.
3. Decision C — test impact: existing test update / new focused test / manual evidence only.
4. Decision D — docs impact: chase only / structure promotion / AGENTS durable rule.
5. Decision E — rollout impact: no migration / local state migration / user-visible behavior note.
6. Decision F — residual risk: closed / monitored / intentionally deferred.
7. Decision G — reviewer needed: no / docs / backend / frontend / architecture.
8. Decision H — bundle policy: single-card commit / PABCD bundle / separate goal.

### Done-state wording

When this card is closed, the final note should say: produce a focused patch or explicit rejection note.
It should cite the source commit, JWC commit, files changed, focused verification, and any rejected source behavior.
It should not say 'done' solely because the document is longer or because a broad lint command passed.
It should leave enough evidence for a future agent to re-open the comparison without reading the whole chat history.
