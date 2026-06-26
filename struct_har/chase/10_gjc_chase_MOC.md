# 10 — gjc_chase_MOC

> 상태: 🟡 운영 중 (2026-06-26)
> **정본 디렉터리**: `struct_har/chase/10_*` · `10.NNN_*`
> **의미**: `devlog/_gjc_chase/gajae-code` 대비 jwc **뒤쳐짐(G1)** — **1갭 = 문서 1개** (`10.NNN`, `001`~)

## 번호

| **10** | 본 MOC (`10_gjc_chase_MOC.md`) |
| **10.NNN** | 플랜 (`10.001_…` 파일명) |

규약 · `_fin`: [005_devlog_numbering.md](./005_devlog_numbering.md)

## 링크

| | |
|---|---|
| 갭 | [002_gap_inventory.md](./002_gap_inventory.md) |
| **명명** | **[008_gjc_jwc_naming_contract.md](./008_gjc_jwc_naming_contract.md)** |
| 참조 | [003_reference_from_gjc.md](./003_reference_from_gjc.md) |
| bands | [bands/](./bands/) |
| 델타 | [structure/40_fork-delta.md](../../structure/40_fork-delta.md) |
| 따라갈 순 | [007_follow_index.md](./007_follow_index.md) |

## Reviewed through

| gjc | jwc |
|---|---|
| `f0a8a3eb` (`upstream/dev`) | `da23db8` (worktree) |

> OMP head is intentionally not repeated here; see [20_omp_chase_MOC.md](./20_omp_chase_MOC.md).

## Recent GJC dev deltas

| NNN | upstream fact | jwc 처리 |
|---|---|---|
| 004 | pre-send `#checkEstimatedContextBeforePrompt()` before message packing; pruning/compaction at sanctioned maintenance boundary (`devlog/_gjc_chase/gajae-code/packages/coding-agent/src/session/agent-session.ts:4747-4756,6517-6533,6537-6558`) | ✅ **_fin** [10.004](./_fin/10/10.004_gjc_chase_session_compaction.md) |
| 007 | `GJC_TMUX_LAUNCHED_ENV`-guarded `@gjc-profile` retag only for genuinely launched leaders (`team-runtime.ts:1646-1683`; changelog `:17-18`) | ownership invariant; rebrand-safe team gap |
| 008 | RPC lifecycle stdio | ✅ **_fin** [10.008](./_fin/10/10.008_gjc_chase_rpc_lifecycle.md) |
| 009 | pi-shell UTF-8 fixup #551 | ✅ **_fin** [10.009](./_fin/10/10.009_gjc_chase_pishell_utf8_fixup.md) 260613 |
| 010 | harness submit readiness #549 | ✅ **_fin** [10.010](./_fin/10/10.010_gjc_chase_harness_submit_readiness.md) 260613 |
| 011 | receipt spool | ✅ **_fin** [10.011](./_fin/10/10.011_gjc_chase_receipt_spool.md) |
| 018 | RPC registry | ✅ **_fin** [10.018](./_fin/10/10.018_gjc_chase_rpc_registry_uds.md) (UDS P2) |
| 022 | goal AgentBusyError (#616) | ✅ **_fin** [10.022](./_fin/10/10.022_gjc_chase_goal_agent_busy_loop.md) |
| 026 | issues/01–13 | ✅ **_fin** [10.026](./_fin/10/10.026_gjc_chase_rpc_issues_audit.md) |

## 활성 (`10.NNN`)

| NNN | 문서 | 스코프 | P | 상태 |
|---|---|---|---|---|
| 001 | [10.001_gjc_chase_cycle.md](./10.001_gjc_chase_cycle.md) | fetch·CHANGELOG | P0 | 🟡 |
| 002 | [10.002_gjc_chase_ai_auth.md](./10.002_gjc_chase_ai_auth.md) | ai·090 | **P1** | ⬜ |
| 003 | [10.003_gjc_chase_cursor.md](./10.003_gjc_chase_cursor.md) | 081 | **P1** | ⬜ |
| 005 | [10.005_gjc_chase_task_subagent.md](./10.005_gjc_chase_task_subagent.md) | task | P2 | ⬜ |
| 006 | [10.006_gjc_chase_tui_core.md](./10.006_gjc_chase_tui_core.md) | tui | P3 | ⬜ |
| 007 | [10.007_gjc_chase_team_profile_self_heal.md](./10.007_gjc_chase_team_profile_self_heal.md) | team·leader profile | **P1** | ⬜ |
| 013-cache | [10.013_gjc_chase_assistant_msg_cache.md](./_fin/10/10.013_gjc_chase_assistant_msg_cache.md) | assistant cache | P3 | ✅ _fin |
| 019 | [10.019_gjc_chase_gc_file_lock.md](./10.019_gjc_chase_gc_file_lock.md) | gc | P2 | ⬜ |
| 021 | [10.021_gjc_chase_goal_redteam_review.md](./10.021_gjc_chase_goal_redteam_review.md) | goal red-team | P2 | ⬜ |
| 023 | [10.023_gjc_chase_task_notification_context.md](./10.023_gjc_chase_task_notification_context.md) | task notify | P2 | ⬜ |
| 020 | [10.020_gjc_chase_deep_interview_semantics.md](./_fin/10/10.020_gjc_chase_deep_interview_semantics.md) | interview ref | P3 | ✅ _fin |
| 024 | [10.024_gjc_chase_coordinator_mcp_watch.md](./_fin/10/10.024_gjc_chase_coordinator_mcp_watch.md) | coordinator | P3 | ✅ _fin |
| 025 | [10.025_gjc_chase_perf_corpus_geobench.md](./_fin/10/10.025_gjc_chase_perf_corpus_geobench.md) | perf ref | P3 | ✅ _fin |
| 027+ | _(미할당)_ | | | ⬜ |

## 완료

→ [_fin/10/](./_fin/10/README.md) · [INDEX](./_fin/INDEX.md)

| NNN | 문서 | 완료일 | 구현 |
|---|---|---|---|
| 009 | [10.009 pi-shell UTF-8 panic](./_fin/10/10.009_gjc_chase_pishell_utf8_fixup.md) | 260613 | [99.11.01](../../devlog/_plan/260612_jawcode_fork/phase1/99.11.01_plan_upstream_pishell_utf8_fixup.md) — 188 tests green |
| 010 | [10.010 harness submit gate](./_fin/10/10.010_gjc_chase_harness_submit_readiness.md) | 260613 | [99.11.02](../../devlog/_plan/260612_jawcode_fork/phase1/99.11.02_plan_upstream_harness_submit_gate.md) — 175 tests green |
| 008 | [10.008 RPC lifecycle](./_fin/10/10.008_gjc_chase_rpc_lifecycle.md) | 260615 | [RPC bundle](../../../devlog/_plan/260614_chase_rpc_harness_bundle/000_moc.md) — 31+3 tests |
| 011 | [10.011 receipt spool](./_fin/10/10.011_gjc_chase_receipt_spool.md) | 260615 | same |
| 018 | [10.018 registry](./_fin/10/10.018_gjc_chase_rpc_registry_uds.md) | 260615 | same; UDS P2 |
| 026 | [10.026 issues audit](./_fin/10/10.026_gjc_chase_rpc_issues_audit.md) | 260615 | [RPC bundle](../../../devlog/_plan/260614_chase_rpc_harness_bundle/000_moc.md) — Phase 1 appendix + UDS issue 09 |
| 022 | [10.022 goal busy-loop](./_fin/10/10.022_gjc_chase_goal_agent_busy_loop.md) | 260615 | goal continuation busy/compaction guard — 19 tests green |
| 004 | [10.004 session compaction](./_fin/10/10.004_gjc_chase_session_compaction.md) | 260615 | pre-send + pruning persistence + compaction progress — 45 focused tests green |

## 불변

orchestrate · jaw-interview · `.jwc` · `packages/jwc` only bin · `@jawcode-dev/*`

## omp

[20_omp_chase_MOC.md](./20_omp_chase_MOC.md)

`10_phase1_jwc_shell`(devlog) = 010 셸 ✅, 본 MOC 무관.

## Jawdev chase expansion — 2026-06-26

> Document: `struct_har/chase/10_gjc_chase_MOC.md`
> Title: 10 — gjc_chase_MOC
> Lane: GJC
> Status: active chase card
> Canonical source: `devlog/_gjc_chase/gajae-code` (dev tracking upstream/dev)
> Primary patch surfaces: structure/, struct_har/chase/, devlog/_plan/

### Why this is behind or can drift

1. This card exists because JWC must reconcile a concrete upstream/reference behavior with the current Jawcode fork, not because file names happen to differ.
2. The comparison source is devlog/_gjc_chase/gajae-code; agents must not substitute `devlog/_upstream_*` or the root repository history as the chase baseline.
3. The current drift risk is semantic: behavior, workflow state, command contract, persistence, or operator evidence can diverge even when a simple diff looks small.
4. The fork also carries JWC-specific naming, `.jwc` state, and Jawdev workflow rules, so a direct copy from the source lane can be wrong.
5. For active cards, the lag means JWC either lacks the source behavior, lacks a matching guard, or has not documented a conscious rejection.
6. For completed cards, the lag can return when the source clone advances past the reviewed HEAD or when adjacent JWC code changes without updating this card.
7. Index and MOC documents can drift by pointing agents at stale priority, stale branch names, stale clone paths, or already-finished work.
8. The first Jawdev obligation is to restate the delta in JWC terms before touching implementation files.
9. The second obligation is to decide whether the source behavior is a product requirement, a reference pattern, or a rejected mismatch.
10. The third obligation is to bind the decision to a verification gate so later agents can prove the card is closed.

### Where to patch

1. Start from this document, then open the current source lane at `devlog/_gjc_chase/gajae-code` and the matching JWC files under structure/, struct_har/chase/, devlog/_plan/.
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

1. Re-read this file after patching and verify the stated source lane still matches devlog/_gjc_chase/gajae-code.
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
3. A sub-agent must resolve the chase baseline from `devlog/_gjc_chase/gajae-code` and verify the branch with `git status --short --branch`.
4. A sub-agent must treat the source clone as read-only evidence unless the explicit task is to fast-forward that clone.
5. A sub-agent must write the patch against JWC files only and must not stage clone contents.
6. A sub-agent must preserve JWC naming and translate upstream identifiers through the naming contract.
7. A sub-agent must report decisions in terms of import/adapt/reject/split, not as vague 'needs follow-up' text.
8. A sub-agent must name the exact files that should change before editing them.
9. A sub-agent must include verification output, not just an implementation summary.
10. A sub-agent must leave this document more accurate than it found it whenever the card's status changes.

### Minimum patch worksheet

1. Source anchor checked: devlog/_gjc_chase/gajae-code.
2. Source branch checked: dev tracking upstream/dev.
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
