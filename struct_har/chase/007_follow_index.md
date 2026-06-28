# chase — 따라갈 내용 인덱스 (실행 순)

> **부채 스택**: [devlog 02_debt_priority_stack](../../devlog/_fin/260614_chase_upstream_pull_priority_report/02_debt_priority_stack.md)  
> **pull 델타**: [devlog 01_pull_delta](../../devlog/_fin/260614_chase_upstream_pull_priority_report/01_pull_delta_gjc_omp.md)  
> **명명 (필수)**: [008_gjc_jwc_naming_contract.md](./008_gjc_jwc_naming_contract.md) — `jwc` · **`python/jwc-rpc`** · `.jwc`  
> **RPC 묶음 실현성**: [03_rpc_bundle_feasibility_jwc_rpc](../../devlog/_fin/260614_chase_upstream_pull_priority_report/03_rpc_bundle_feasibility_jwc_rpc.md)  
> 업데이트: **2026-06-14** (executor v2 · chase refresh)
> **PABCD devlog**: [260614_chase_rpc_harness_bundle](../../devlog/_plan/260614_chase_rpc_harness_bundle/000_moc.md)

## 2026-06-27 세션 상태 (방향-결정 인터뷰 + 닫기 루프)

> **마감(_fin) 9**: reference 6 (20.002·003·007·008, 10.020·025) · 코드 10.013 · doc-judgment 10.024·10.005.
> **방향 기록 9** (인터뷰 elici). **보류/연기 active**: 20.004(held) · 10.006(082/083 게이트).
> **test-env 해제 → 실테스트 마감 +6**: 네이티브 catalog 정렬(`f53f285` natives→`workspace:*`) 후 10.003 · 10.012 · 10.023 · 20.005 · 20.006 · 10.007 모두 실테스트로 마감. 10.007은 추가로 실 tmux 3.6a 스모크가 잠재 버그(`=NAME` option-target 깨짐 → `=NAME:` #580) 발견·수정. (이전 "⛔ blocked 8" 프레이밍 폐기.)
> **잔여 active 0 — 확정 goal 타깃 11개 전부 _fin 마감 완료** (10.002 C4 auth는 독립 보안 감사 기반 split-decision으로 **무코드** 마감: jwc가 모든 안전 축 at-or-ahead, gjc import 시 보안 회귀). **비-타깃 active**: 10.006(082/083 게이트) · 20.004(held) · 10.027(split-off P3 deferred ← 10.021) · 10.019(borderline). **후속 버그**: `tmux-sessions.ts:143` `=NAME` 폼 **✅ 수정**(dd5d7b0). audit 경위: [devlog 16_pause_audit](../../devlog/_plan/260627_chase_direction_interview/16_pause_audit.md) · [18_native_testenv_fix](../../devlog/_plan/260627_chase_direction_interview/18_native_testenv_fix.md).

## G3 — jwc 자체 (Tier 1)

| 순 | 항목 | 문서 |
|---|------|------|
| 1 | 99.02 CI/schemas 마감 | [006](./006_jwc_own_backlog.md) · [50_status](../../structure/50_status.md) |
| 2 | 99.04 HUD | [006](./006_jwc_own_backlog.md) |
| 3 | ctrl+t full transcript | [devlog 260614_tui](../../devlog/_plan/260614_tui_codex_live_toggle/10_pabcd_ctrl_t_full_transcript_p_plan.md) |
| 4 | jaw-interview markdown WIP | [devlog 260614_jaw_interview](../../devlog/_plan/260614_jaw_interview_markdown_mode/) |

## G1 — gjc 카드 (Tier 2)

### Telegram / notifications stack (2026-06-28, upstream/dev `a791d72a`)

| 순 | NNN | 문서 | P | 상태 |
|---|-----|------|---|------|
| T1 | 028 | [10.028 notifications SDK](./_fin/10/10.028_gjc_chase_notifications_sdk.md) | **P1** | ✅ _fin · phases 33,34,35 |
| T2 | 029 | [10.029 notify config CLI](./_fin/10/10.029_gjc_chase_notify_config_cli.md) | **P1** | ✅ _fin · phases 1,36 |
| T3 | 030 | [10.030 Telegram managed daemon](./_fin/10/10.030_gjc_chase_telegram_managed_daemon.md) | **P1** | ✅ _fin · phases 37-40 |
| T4 | 032 | [10.032 Telegram remote answers](./_fin/10/10.032_gjc_chase_telegram_remote_answers.md) | **P1** | ✅ _fin · phases 44-51 |
| T5 | 031 | [10.031 threaded surface](./_fin/10/10.031_gjc_chase_telegram_threaded_surface.md) | P2 | ✅ _fin · phases 4,41,42,43 |
| T6 | 034 | [10.034 media/file transfer](./_fin/10/10.034_gjc_chase_telegram_media_file_transfer.md) | P2 | ✅ _fin · phases 4,12,53,54,55 |
| T7 | 033 | [10.033 session lifecycle](./_fin/10/10.033_gjc_chase_telegram_session_lifecycle.md) | P2 | ✅ _fin · A=ph11, B/C=ph52 |
| T8 | 035 | [10.035 adapters/docs](./_fin/10/10.035_gjc_chase_notifications_adapters_docs.md) | P3 | ✅ _fin · phase 56 |

Recommended first user-value path: **028 → 029 → 030 → 032**, then 031/034/033/035.

### Non-Telegram upstream/dev backlog (2026-06-28, split from 616-commit delta)

| 순 | NNN | 문서 | P | 상태 |
|---|-----|------|---|------|
| U1 | 036 | [10.036 AI provider/auth/model catalog](./_fin/10/10.036_gjc_chase_ai_provider_auth_model_catalog.md) | **P1** | ✅ _fin · phases 14,31,32 |
| U2 | 047 | [10.047 security/privacy guardrails](./_fin/10/10.047_gjc_chase_security_privacy_guardrails.md) | **P1** | ✅ _fin · phases 14/16/17, 30 |
| U3 | 037 | [10.037 runtime/process lifecycle](./_fin/10/10.037_gjc_chase_runtime_process_lifecycle_hardening.md) | **P1** | ✅ _fin · phases 6,17,18,57 |
| U4 | 038 | [10.038 RPC control plane v2](./_fin/10/10.038_gjc_chase_rpc_control_plane_v2.md) | **P1** | ✅ _fin · phases 7,20,27,58 |
| U5 | 040 | [10.040 compaction/pruning/resident memory](./_fin/10/10.040_gjc_chase_compaction_pruning_resident_memory.md) | **P1** | ✅ _fin · phases 21–23 |
| U6 | 043 | [10.043 web-search/read URL hardening](./_fin/10/10.043_gjc_chase_web_search_insane_security.md) | **P1** | ✅ _fin · phases 24-26, 29 |
| U7 | 051 | [10.051 agent/composer/toolcall integrity](./_fin/10/10.051_gjc_chase_agent_composer_toolcall_integrity.md) | **P1** | ✅ _fin · phases 6,15,19,59 |
| U8 | 039 | [10.039 harness receipts/phase rollup](./10.039_gjc_chase_harness_receipts_phase_rollup.md) | P2 | ⬜ |
| U9 | 041 | [10.041 TUI/input/render/Windows psmux](./10.041_gjc_chase_tui_input_render_windows_psmux.md) | P2 | ⬜ |
| U10 | 042 | [10.042 deep-interview/ask/goal state](./10.042_gjc_chase_deep_interview_ask_goal_state.md) | P2 | ⬜ |
| U11 | 044 | [10.044 plugin/extensibility bundle](./10.044_gjc_chase_plugin_extensibility_bundle.md) | P2 | ⬜ |
| U12 | 045 | [10.045 computer-use native control](./10.045_gjc_chase_computer_use_native_control.md) | P2 | ⬜ |
| U13 | 048 | [10.048 dev/CI/release packaging](./10.048_gjc_chase_dev_ci_release_packaging.md) | P2 | ⬜ |
| U14 | 050 | [10.050 session/tmux/team/worktree](./10.050_gjc_chase_session_tmux_team_worktree.md) | P2 | ⬜ |
| U15 | 046 | [10.046 RLM/research mode](./10.046_gjc_chase_rlm_research_mode.md) | P3 | ⬜ |
| U16 | 049 | [10.049 perf/bench/corpus](./10.049_gjc_chase_performance_bench_corpus.md) | P3 | ⬜ |
| U17 | 052 | [10.052 docs/external integrations](./10.052_gjc_chase_docs_external_integrations.md) | P3 | ⬜ |

Recommended order after Telegram MVP: **036/047 security-auth first**, then runtime/RPC/compaction, then UX/docs/perf reference cards.

| 순 | NNN | 문서 | P | 상태 |
|---|-----|------|---|------|
| 9 | 011 | [10.011 receipt spool](./_fin/10/10.011_gjc_chase_receipt_spool.md) | P1 | ✅ _fin · receipt spool |
| 10 | 008 | [10.008 RPC lifecycle](./_fin/10/10.008_gjc_chase_rpc_lifecycle.md) | P1 | ✅ _fin · lifecycle evidence |
| 10b | 018 | [10.018 RPC registry/UDS](./_fin/10/10.018_gjc_chase_rpc_registry_uds.md) | P1 | ✅ _fin · TS+Py · UDS P2 |
| 10c | 026 | [10.026 issues audit](./_fin/10/10.026_gjc_chase_rpc_issues_audit.md) | P2 | ✅ _fin · residual rows documented |
| 11 | 022 | [10.022 goal busy-loop](./_fin/10/10.022_gjc_chase_goal_agent_busy_loop.md) | P1 | ✅ _fin · busy guard |
| 12 | 004 | [10.004 session compaction](./_fin/10/10.004_gjc_chase_session_compaction.md) | P1 | ✅ _fin · JWC-ahead progress |
| 13 | 007 | [10.007 team profile](./_fin/10/10.007_gjc_chase_team_profile_self_heal.md) | P1 | **✅ _fin** self-heal + `=NAME:` 폼 수정 (jwc 7cc3f31, 64/0 + 실 tmux 스모크) |
| 14–15 | 002·003 | [10.002](./_fin/10/10.002_gjc_chase_ai_auth.md) · [10.003](./_fin/10/10.003_gjc_chase_cursor.md) | P1 | **10.002 ✅ _fin** (C4 split-decision, 보안감사 무코드 마감) · **10.003 ✅ _fin** (timeout fix 4eeffb7) |
| 16–17 | 012 · 021 | [10.012](./_fin/10/10.012_gjc_chase_goal_steering.md) · [10.021](./_fin/10/10.021_gjc_chase_goal_redteam_review.md) | P2 | **✅ 둘 다 _fin** — 012 steering `0974e20`(84/0) · 021 live-surface proof `cdee4f7`(85/0), split→[10.027](./10.027_gjc_chase_goal_live_artifact_engine.md) |
| 18 | 019 | [10.019 gc](./10.019_gjc_chase_gc_file_lock.md) | P2 | ⬜ |
| 19 | 023 | [10.023 task notifications](./_fin/10/10.023_gjc_chase_task_notification_context.md) | P2 | **✅ _fin** (omp 0.5.1, e80075b) |
| — | 005·013·020·024·025 | **✅ _fin (260627)** task_subagent·assistant_cache·deep_interview·coordinator·perf_geobench · 006 deferred(082/083) | P2–3 | ✅/⏸ |

### RPC PABCD 묶음 (한 사이클 권장)

```
011 (spool 잔여 테스트) → 008 (rpc-mode durability) → 018 (TS registry + jwc_rpc list_sessions) → 026 (issues 매트릭스 클로즈)
```

- **Python**: `python/jwc-rpc` — upstream `gjc_rpc` diff 참조만 ([008](./008_gjc_jwc_naming_contract.md)).
- **완료 기준**: [03](./../../devlog/_fin/260614_chase_upstream_pull_priority_report/03_rpc_bundle_feasibility_jwc_rpc.md) Phase 1 / 1b.

## G2 — omp 카드 (Tier 3)

| 순 | NNN | 문서 |
|---|-----|------|
| 23 | 20.006 | [20.006 TUI micro](./_fin/20/20.006_omp_chase_tui_input_micro_fixes.md) **✅ _fin** (omp e914bf0/3d646d8, jwc a291199) |
| 24 | 20.005 | [20.005 steering](./_fin/20/20.005_omp_chase_steering_delivery.md) **✅ _fin** (omp 42ffc83, 055aee8) |
| 25 | 20.003 | [20.003 memory/skills](./_fin/20/20.003_omp_chase_memory_skills.md) |
| 26 | 20.007 | [20.007 session modules](./_fin/20/20.007_omp_chase_session_modularization.md) |
| — | 20.008 | [20.008 15.13 delta](./_fin/20/20.008_omp_chase_pull_15_13_delta.md) |


### OMP latest delta split (v16.1.13 → v16.1.20, reference-only)

| 순 | NNN | 문서 | P | 상태 |
|---|-----|------|---|------|
| O1 | 009 | [20.009 append-only context integrity](./20.009_omp_chase_append_only_context_integrity.md) | P2 | ⬜ |
| O2 | 010 | [20.010 AI OAuth/reasoning replay](./_fin/20/20.010_omp_chase_ai_oauth_reasoning_replay.md) | P2 | ✅ _fin · reference · phases 10,60 |
| O3 | 011 | [20.011 TUI image drafts/terminal edges](./20.011_omp_chase_tui_image_drafts_terminal_edges.md) | P2 | ⬜ |
| O4 | 012 | [20.012 bash snapshot/env security](./20.012_omp_chase_bash_snapshot_env_security.md) | P2 | ⬜ |
| O5 | 013 | [20.013 plugin virtual registry/bundle](./20.013_omp_chase_plugin_virtual_registry_bundle.md) | P2 | ⬜ |
| O6 | 014 | [20.014 goal compaction/provider concurrency](./20.014_omp_chase_goal_compaction_provider_concurrency.md) | P2 | ⬜ |
| O7 | 015 | [20.015 release/test leak hardening](./20.015_omp_chase_release_test_leak_hardening.md) | P3 | ⬜ |

## 완료 (_fin)

| NNN | [_fin/10](./_fin/INDEX.md) |
|-----|---------------------------|
| 009–017 | pi-shell, submit, perf×3, context, tool_choice, Fable N/A |

## Jawdev chase expansion — 2026-06-26

> Document: `struct_har/chase/007_follow_index.md`
> Title: chase — 따라갈 내용 인덱스 (실행 순)
> Lane: JWC coordination
> Status: active chase card
> Canonical source: `devlog/_gjc_chase/gajae-code + devlog/_omp_chase/oh-my-pi` (GJC dev/upstream/dev and OMP main/origin/main)
> Primary patch surfaces: structure/, struct_har/chase/, devlog/_plan/

### Why this is behind or can drift

1. This card exists because JWC must reconcile a concrete upstream/reference behavior with the current Jawcode fork, not because file names happen to differ.
2. The comparison source is devlog/_gjc_chase/gajae-code + devlog/_omp_chase/oh-my-pi; agents must not substitute `devlog/_upstream_*` or the root repository history as the chase baseline.
3. The current drift risk is semantic: behavior, workflow state, command contract, persistence, or operator evidence can diverge even when a simple diff looks small.
4. The fork also carries JWC-specific naming, `.jwc` state, and Jawdev workflow rules, so a direct copy from the source lane can be wrong.
5. For active cards, the lag means JWC either lacks the source behavior, lacks a matching guard, or has not documented a conscious rejection.
6. For completed cards, the lag can return when the source clone advances past the reviewed HEAD or when adjacent JWC code changes without updating this card.
7. Index and MOC documents can drift by pointing agents at stale priority, stale branch names, stale clone paths, or already-finished work.
8. The first Jawdev obligation is to restate the delta in JWC terms before touching implementation files.
9. The second obligation is to decide whether the source behavior is a product requirement, a reference pattern, or a rejected mismatch.
10. The third obligation is to bind the decision to a verification gate so later agents can prove the card is closed.

### Where to patch

1. Start from this document, then open the current source lane at `devlog/_gjc_chase/gajae-code + devlog/_omp_chase/oh-my-pi` and the matching JWC files under structure/, struct_har/chase/, devlog/_plan/.
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

1. Re-read this file after patching and verify the stated source lane still matches devlog/_gjc_chase/gajae-code + devlog/_omp_chase/oh-my-pi.
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
3. A sub-agent must resolve the chase baseline from `devlog/_gjc_chase/gajae-code + devlog/_omp_chase/oh-my-pi` and verify the branch with `git status --short --branch`.
4. A sub-agent must treat the source clone as read-only evidence unless the explicit task is to fast-forward that clone.
5. A sub-agent must write the patch against JWC files only and must not stage clone contents.
6. A sub-agent must preserve JWC naming and translate upstream identifiers through the naming contract.
7. A sub-agent must report decisions in terms of import/adapt/reject/split, not as vague 'needs follow-up' text.
8. A sub-agent must name the exact files that should change before editing them.
9. A sub-agent must include verification output, not just an implementation summary.
10. A sub-agent must leave this document more accurate than it found it whenever the card's status changes.

### Minimum patch worksheet

1. Source anchor checked: devlog/_gjc_chase/gajae-code + devlog/_omp_chase/oh-my-pi.
2. Source branch checked: GJC dev/upstream/dev and OMP main/origin/main.
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
