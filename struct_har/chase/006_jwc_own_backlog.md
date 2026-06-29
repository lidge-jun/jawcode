# chase — jwc 자체 백로그 (타 제품 drift 아님)

> gjc/omp가 아니라 **jawcode가 스스로 아직 안 닫은 것**. 정본: 99 MOC · [status](../../structure/50_status.md).

## MLB

| 지금 (260614) | **62** | 99.03✅ · 99.01✅ · 99.07 부분✅ · 100 완료✅ · computer_use lazy ✅ |
| 99.02 PR 마감 후 | **62** | + CI green — 드라이버 임계 (런타임 무관) |
| 99.01~99.07 마감 후 | **68** | HUD · 슬래시 패리티 |

## CRITICAL (참조: 구현은 devlog)

| # | 갭 | GG | 참조 문서 |
|---|---|---|---|
| 1 | pabcd discovery M1/M2/M3 | 99.03 | ✅ 완료 (`45cba4e2`·`8a7ea342`·`90ef5223`) |
| 2 | `jwc memory` CLI | 99.01 | ✅ 구현 완료 (`ada449b2`·`693c5ee0`·`56fcf0de`) |
| 3 | check:schemas + biome | 99.02 | 코드 ✅ / **마감 ⬜** (PR 게이트, 런타임 무관) |

## 99 패키지 맵

| GG | 내용 | chase 밴드 |
|---|---|---|
| 99.01 | memory CLI + chat search | 070 |
| 99.02 | schemas·biome·병렬 랜딩 | 횡단 |
| 99.03 | workflow surface / pabcd discovery | 020, 050, 099 |
| 99.04 | HUD + TUI /goal 별칭 | 080, 060 |
| 99.05 | auth 릴리즈 게이트 | 090 |
| 99.06 | 문서 stale 스윕 | structure |
| 99.07 | 슬래시 패리티 | 030, 040, 050 |

착수 순서: `99.01 → 99.02 → 99.03 → 99.04 → 99.05 → 99.06 → 99.07` ([99.00.00](../../devlog/_plan/260612_jawcode_fork/phase1/99.00.00_moc_stabilization.md) · [status](../../structure/50_status.md)).

## M2 / OSS (99 밖)

| 항목 | MOC | chase |
|---|---|---|
| Node 포팅 | ✅ **완료**(260613, 감사 6라운드) [100_moc](../../devlog/_plan/260612_jawcode_fork/100_moc_node_porting.md) | [bands/100_node.md](./bands/100_node.md) |
| 런타임 부착 | [111_design_runtime_attach](../../devlog/_plan/260612_jawcode_fork/111_design_runtime_attach.md) | 110+ |
| β struct_har/Node | goal `3f6989ac` | **99 제외** |
| OSS v0.1 | LICENSE·릴리즈·CONTRIBUTING | [status](../../structure/50_status.md) |

## jwc만 **앞선** 것 (chase에서 추적 불필요·문서만)

- orchestrate native + `prompts/jaw/`
- `jaw-interview` + mutation-guard jwc
- `goal` CLI + goal-runtime
- Phase β `.jwc` 경로
- cli-jaw skill substitution (031)

→ [fork_logic_changelog](../../structure/40_fork-delta.md) · [jwc_patched/050_plan/02_logic_changes](../jwc_patched/050_plan/02_logic_changes.md)

## Jawdev chase expansion — 2026-06-26

> Document: `struct_har/chase/006_jwc_own_backlog.md`
> Title: chase — jwc 자체 백로그 (타 제품 drift 아님)
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
