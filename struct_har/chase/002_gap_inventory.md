# chase — 갭 인벤토리 (횡단)

> 스냅샷: gjc **`f0a8a3eb`** (`upstream/dev`) · jwc **`da23db8`** (worktree) · omp **`0fc6d136`** (`origin/main`) (2026-06-26 **6차 — actual chase clone refresh**).
> **reviewed through**: GJC `f0a8a3eb` · OMP `0fc6d136` · JWC `da23db8`
> **명명**: [008_gjc_jwc_naming_contract.md](./008_gjc_jwc_naming_contract.md) — Python **`python/jwc-rpc`** (`jwc_rpc`); upstream만 `gjc-rpc`.
> **RPC 실현성**: [devlog 03_rpc_bundle_feasibility_jwc_rpc](../../devlog/_fin/260614_chase_upstream_pull_priority_report/03_rpc_bundle_feasibility_jwc_rpc.md)
> 상태: `⬜` 미착수 · `🟡` 설계/부분 · `✅` jwc 선행 · `—` 해당 없음
> **기록**: [10_gjc_chase_MOC](./10_gjc_chase_MOC.md) · [20_omp_chase_MOC](./20_omp_chase_MOC.md) (`10.NNN_*` / `20.NNN_*`)

## 요약

| 축 | jwc가 **앞서거나 유일** | jwc가 **뒤처지거나 약함** |
|---|---|---|
| **gjc** | orchestrate/PABCD, jaw 표면, `.jwc`, lazy `computer_use`, pi-shell·submit gate(10.009·10.010 ✅), goal busy-loop #616 ✅, session compaction/progress ✅ | RPC lifecycle 잔여(008), receipt spool 테스트(011), **registry TS+Py ✅ / UDS ✅**(018), team profile self-heal(007) |
| **omp** | 4 workflow 번들, jaw 워크플로 | task-agent, session ops, memory, pruning = **참조** ([20.008](./_fin/20/20.008_omp_chase_pull_15_13_delta.md)) |
| **자체** | 100 Node 완료, TUI O(n²) 수정, 99.03·99.01·99.07 부분 | 99.02·99.04·99.05·99.06 · M2 110+ |

## 밴드별

| 밴드 | G1 gjc | G2 omp | G3 jwc | 참조 카드 |
|---|---|---|---|---|
| 010_shell | 🟡 bin/퍼블리시 | — | ✅ jwc only | [bands/README.md](./bands/README.md) |
| 020_prompt | 🟡 upstream drift | 🟡 ttsr/docs | ✅ **99.03 M1–M3** | [bands/README.md](./bands/README.md) |
| 030_skills | 🟡 team profile guard | 🟡 skills 3계층 | 🟡 D5 cli-jaw | [bands/README.md](./bands/README.md) |
| 040_interview | 🟡 deep-interview | — | ✅ jaw-interview | [bands/README.md](./bands/README.md) |
| 050_plan | 🟡 ralplan upstream | — | ✅ orchestrate | [bands/README.md](./bands/README.md) |
| 060_goal | ✅ busy-loop #616 | — | ✅ goal · 🟡 steering | [10.022](./_fin/10/10.022_gjc_chase_goal_agent_busy_loop.md) |
| 070_memory | 🟡 hooks | 🟡 mnemopi | ✅ **99.01** | [bands/README.md](./bands/README.md) |
| 080_tui | 🟡 fixes | 🟡 micro | 🟡 **99.04** HUD | [bands/README.md](./bands/README.md) |
| 081_cursor | 🟡 **높음** | 🟡 IDE | 🟡 kiro | [bands/README.md](./bands/README.md) |
| 082_input | 🟡 | — | ✅ IME | [bands/README.md](./bands/README.md) |
| 083_output | 🟡 compaction | 🟡 pruning | ✅ segment·collapse | [bands/README.md](./bands/README.md) |
| 090_auth | 🟡 oauth | 🟡 | 🟡 99.05 | [bands/README.md](./bands/README.md) |
| 099 | — | — | 🟡 99.02·04·05·06 ⬜ | [../jwc_patched/099_stabilization/](../jwc_patched/099_stabilization/) |
| 100_node | 🟡 runtime | 🟡 workerHost | ✅ 완료 | [bands/README.md](./bands/README.md) |

## G1 — gjc에서 흔히 뒤쳐지는 항목

### Telegram / notifications (upstream/dev `a791d72a`, 2026-06-28)

| 영역 | upstream 후보 | jaw 병합 난이도 | 참조 |
|---|---|---|---|
| notifications SDK | loopback WS endpoint, `.gjc/state/notifications`, action/reply protocol | 높음 — Rust/N-API + session gate | [10.028](./10.028_gjc_chase_notifications_sdk.md) |
| notify config CLI | `gjc notify setup/status`, BotFather token, private-chat pairing | 중 — secret/settings/schema | [10.029](./10.029_gjc_chase_notify_config_cli.md) |
| Telegram daemon | singleton `getUpdates` poller, roots registry, owner reload/stop | 높음 — long-lived process | [10.030](./10.030_gjc_chase_telegram_managed_daemon.md) |
| remote answers | inline buttons, free text, Other/custom input, ask race | 높음 — live gate control | [10.032](./10.032_gjc_chase_telegram_remote_answers.md) |
| threaded surface | per-session topics, identity/context/turn render, inbound fail-closed routing | 높음 — remote routing | [10.031](./10.031_gjc_chase_telegram_threaded_surface.md) |
| media/file transfer | image/file frames, inbound media, `telegram_send` workspace egress | 높음 — file egress | [10.034](./10.034_gjc_chase_telegram_media_file_transfer.md) |
| session lifecycle | Telegram create/close/resume/list | 매우 높음 — remote process control | [10.033](./10.033_gjc_chase_telegram_session_lifecycle.md) |
| adapters/docs | SDK docs, Telegram onboarding, Discord/Slack scaffolding | 중 — product boundary | [10.035](./10.035_gjc_chase_notifications_adapters_docs.md) |

| 영역 | upstream 후보 | jaw 병합 난이도 | 참조 |
|---|---|---|---|
| 세션/autocompact | pre-send `#checkEstimatedContextBeforePrompt` | ✅ pre-send + threshold prune persistence + progress UX | [_fin/10.004](./_fin/10/10.004_gjc_chase_session_compaction.md) |
| RPC lifecycle | malformed JSONL; EOF flush; bridges | **🟡** fast-lane reads ✅; durability diff ⬜ | [10.008](./10.008_gjc_chase_rpc_lifecycle.md) |
| RPC registry/UDS | #589 registry, `--listen` | ✅ TS+`jwc_rpc.list_sessions` + UDS Phase 2 | [10.018](./_fin/10/10.018_gjc_chase_rpc_registry_uds.md) |
| receipt spool | #554 JSONL exporter | **🟡** core ✅; tests/`_fin` ⬜ | [10.011](./10.011_gjc_chase_receipt_spool.md) |
| goal busy-loop | #616 AgentBusyError | ✅ landed 260615 | [_fin/10.022](./_fin/10/10.022_gjc_chase_goal_agent_busy_loop.md) |
| team self-heal | #546 `@gjc-profile` | 중 | [10.007](./10.007_gjc_chase_team_profile_self_heal.md) |
| pi-shell / harness submit | #551 / #549 | ✅ landed 260613 | [_fin/10](./_fin/INDEX.md) |
| model-profiles UX | #553 | 사용자 패치 중 — 카드 없음 | [10.001](./10.001_gjc_chase_cycle.md) |
| providers/schemas | drift | ai diff; **99.02** | `packages/ai/` |

### RPC 한 묶음 (PABCD 권장)

**011 → 008 → 018 → 026** — [007_follow_index](./007_follow_index.md) · [03 feasibility](../../devlog/_fin/260614_chase_upstream_pull_priority_report/03_rpc_bundle_feasibility_jwc_rpc.md).  
Executor v2 (260614): **011 YES**, **008/026 RISKY**; **018 registry TS+Py landed** @ `d60b7822`; UDS `--listen` + issues 06–08 client API **갭**.

## G2 — omp 참조만

| 영역 | omp | jaw 방향 |
|---|---|---|
| 15.13 delta | session split, auto-learn, STT | [20.008](./_fin/20/20.008_omp_chase_pull_15_13_delta.md) |
| steering delivery | yield re-poll, stranded drain | [20.005](./_fin/20/20.005_omp_chase_steering_delivery.md) |
| TUI micro | Esc draft, ast status | [20.006](./20.006_omp_chase_tui_input_micro_fixes.md) |
| session modules | listing/loader | [20.007](./_fin/20/20.007_omp_chase_session_modularization.md) |
| memory/skills | mnemopi | [20.003](./_fin/20/20.003_omp_chase_memory_skills.md) |
| collab/brew | — | **비채택** |

## 260613–14 jwc 독자 성과 (chase 비대상 완료)

Codex reformation · TUI O(n²) · xAI `/searchengine` · 100 Node · MCP discovery · 99.xx TUI — [structure/50_status.md](../../structure/50_status.md).  
**260614**: upstream pull +68 gjc / +370 omp; chase 카드 10.018–026 발급; **008 명명 계약**.

## 구현가치 (MLB) — 활성 핵심

| 항목 | 축 | 가치 | 분류 |
|---|---|:---:|---|
| 10.011 spool | gjc | 60 | 🟡 코어 landed |
| 10.008 RPC | gjc | 60 | 🟡 선별 |
| 10.018 registry | gjc | 60 | ✅ _fin |
| 10.022 busy-loop | gjc | 55 | ✅ _fin |
| 10.004 session compaction | gjc | 60 | ✅ _fin |
| 10.026 issues | gjc | 50 | 설계 |
| 10.002·003 | gjc | 60 | 선별 |
| 20.005 steering | omp | 60 | 참조 |
| 20.006 TUI micro | omp | 50 | 선별 |

## 갱신 체크리스트

```bash
git -C devlog/_gjc_chase/gajae-code pull --ff-only upstream dev
git -C devlog/_omp_chase/oh-my-pi pull --ff-only origin main
```

→ 본 표 · [bands/](./bands/) · **008 명명** · MOC `reviewed through` · [10.001](./10.001_gjc_chase_cycle.md) changelog 행.

## Jawdev chase expansion — 2026-06-26

> Document: `struct_har/chase/002_gap_inventory.md`
> Title: chase — 갭 인벤토리 (횡단)
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
