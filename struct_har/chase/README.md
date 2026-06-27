# struct_har/chase/ — 뒤쳐진 영역 · 참조 방안

> **목적**: jawcode(jwc)가 **선택적으로 따라잡거나 참고**할 gjc·omp·cli-jaw 축의 갭을 한곳에 모은다.
> **아님**: git cherry-pick 절차, fork 리베이스, upstream에 기여하는 PR 목록 — 그건 [structure/40_fork-delta.md](../../structure/40_fork-delta.md) · [conventions.md](../../structure/11_conventions.md).

## gjc / omp 플랜 (정본 = 이 디렉터리)

| 축 | MOC | 플랜 파일 |
|---|---|---|
| **10 gjc** | [10_gjc_chase_MOC.md](./10_gjc_chase_MOC.md) | `10.001_` … `10.NNN_*` |
| **20 omp** | [20_omp_chase_MOC.md](./20_omp_chase_MOC.md) | `20.001_` … `20.NNN_*` |

- 규약 · 완료 이동: [005_devlog_numbering.md](./005_devlog_numbering.md) → [`_fin/10|20/`](./_fin/README.md)
- devlog `10_gjc_chase_MOC` / `20_omp_chase_MOC` = **스텁** (로드맵 링크용)

## GJC ↔ JWC 명명 (포팅)

[008_gjc_jwc_naming_contract.md](./008_gjc_jwc_naming_contract.md) — upstream `gjc-rpc` → jaw **`python/jwc-rpc`** (`jwc_rpc`).

## 정본 축 (2026-06-28)

| 축 | 클론 / SoT | struct_har 대조 |
|---|---|---|
| **gjc** | `devlog/_gjc_chase/gajae-code/` @ **`f0a8a3eb`** (`upstream/dev`) | [../gjc_origin/](../gjc_origin/) |
| **jwc** | worktree @ **`af363c8`** | [../jwc_patched/](../jwc_patched/) · [structure/](../../structure/) |
| **omp** | `devlog/_omp_chase/oh-my-pi/` @ **`0fc6d136`** (`origin/main`) | [../omp_origin/](../omp_origin/) |
| **자체 백로그** | 99·M2·OSS | [006_jwc_own_backlog.md](./006_jwc_own_backlog.md) |

## 문서 트리

| 파일 | 내용 |
|---|---|
| `10_*` · `20_*` | **chase MOC + NNN 플랜** |
| [007_follow_index.md](./007_follow_index.md) | **실행 순** · RPC 묶음 |
| [008_gjc_jwc_naming_contract.md](./008_gjc_jwc_naming_contract.md) | **gjc↔jwc 명명** |
| [001_overview.md](./001_overview.md) | 정의 · 읽기 순서 |
| [002_gap_inventory.md](./002_gap_inventory.md) | 횡단 갭 + MLB 표 |
| [003](./003_reference_from_gjc.md) · [004](./004_reference_from_omp.md) | 참조 원칙 |
| [005_devlog_numbering.md](./005_devlog_numbering.md) | NNN · `_fin` |
| [006_jwc_own_backlog.md](./006_jwc_own_backlog.md) | G3/G4 |
| [bands/](./bands/) | 밴드 카드 |

## 갱신

1. `10.001` / `20.001` 사이클 (fetch)
2. 새 갭 → `10.NNN_<slug>.md` (**jwc 스니펫** + reconcile 표 권장)
3. 완료 → `_fin/10/` 또는 `20/`
4. [002](./002_gap_inventory.md) · MOC · **008 명명**
5. 카드 쓰기 전 [001 §worktree 검증](./001_overview.md) grep으로 이미 랜딩 여부 확인

## 관련

- [structure/50_status.md](../../structure/50_status.md)
- [devlog 260614 chase pull](../../devlog/_fin/260614_chase_upstream_pull_priority_report/000_moc.md)

*정본: `struct_har/chase/10_` · `20_`.*

## Jawdev chase expansion — 2026-06-26

> Document: `struct_har/chase/README.md`
> Title: struct_har/chase/ — 뒤쳐진 영역 · 참조 방안
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
