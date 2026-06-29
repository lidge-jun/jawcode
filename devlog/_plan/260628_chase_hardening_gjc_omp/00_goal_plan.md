# 260628 chase hardening — GJC + OMP real-commit audit plan

> Goal: harden `struct_har/chase` by running multiple PABCD loops over GJC and OMP chase cards, comparing against real upstream commits and the JWC worktree, filling missing evidence, splitting missed deltas, and reviewing `_fin` cards for stale or overbroad closure.

## Context

- Project root: `/Users/jun/Developer/new/700_projects/jawcode`.
- GJC source clone: `/Users/jun/Developer/new/700_projects/jawcode/devlog/_gjc_chase/gajae-code` at `a791d72a` (`upstream/dev`). The checkout may be local `main` tracking `origin/main`; the source of truth is `git rev-parse upstream/dev == a791d72a`, not the local branch name.
- OMP source clone: `/Users/jun/Developer/new/700_projects/jawcode/devlog/_omp_chase/oh-my-pi` at `0fc6d136` (`origin/main`, v16.1.20). OMP comparison range for new cards is pinned to `cc0c67be` (`v16.1.13`)..`0fc6d136` (`v16.1.20`).
- Recent docs commits:
  - `393a623 docs(chase): split gjc telegram notification gaps`
  - `af363c8 docs(chase): split gjc upstream dev backlog`
- Existing unrelated dirty items to preserve; do not stage unless a later phase explicitly proves they are owned by this goal:
  - `devlog/.gitignore`
  - `devlog/_tmp/`
  - `devlog/_fin/260628_docs_sync/`
  - `structure/00_INDEX.md`
  - `structure/06-devlog-map.md`
  - `structure/08-git-commit-history.md`
  - `structure/11_conventions.md`
  - `structure/40_fork-delta.md`
  - `structure/50_status.md`
  - `structure/data/`
  - `structure/direction.md`
  - `structure/roadmap.md`

## Work-phase map

### Phase 0 — orchestration plan and audit scaffold

Purpose: create this durable multi-loop plan, then independently audit whether the slices are complete enough to execute.

Planned changes:

- NEW: `/Users/jun/Developer/new/700_projects/jawcode/devlog/_plan/260628_chase_hardening_gjc_omp/00_goal_plan.md`
- NEW: `/Users/jun/Developer/new/700_projects/jawcode/devlog/_plan/260628_chase_hardening_gjc_omp/01_source_audit_matrix.md`
- NEW: `/Users/jun/Developer/new/700_projects/jawcode/devlog/_plan/260628_chase_hardening_gjc_omp/02_phase_map.md`

Verification:

- Independent plan audit by Docs employee.
- `git diff --check` for devlog and chase docs.
- Commit only plan docs.

### Phase 1A — GJC Telegram active card hardening

Purpose: harden active GJC Telegram cards `10.028` through `10.035` so each has concrete upstream commit/file evidence, no generic placeholder text, and a clear import/adapt/reject/split decision.

### Phase 1B — GJC core active card hardening

Purpose: harden GJC core cards `10.036` through `10.045` with real source facts. This phase must replace all `plus ... cluster` phrasing in these cards.

### Phase 1C — GJC reference/edge active card hardening

Purpose: harden GJC reference/edge cards `10.046` through `10.052`. This phase must replace `RLM/research-mode commit cluster` and other vague cluster placeholders with concrete commit anchors.

The earlier single Phase 1 batch is intentionally split into three full PABCD cycles to keep audit/build/check/commit discipline sharp.

Planned surfaces:

- MODIFY: `/Users/jun/Developer/new/700_projects/jawcode/struct_har/chase/10.028_gjc_chase_notifications_sdk.md` through `/Users/jun/Developer/new/700_projects/jawcode/struct_har/chase/10.052_gjc_chase_docs_external_integrations.md`
- MODIFY: `/Users/jun/Developer/new/700_projects/jawcode/struct_har/chase/10_gjc_chase_MOC.md`
- MODIFY: `/Users/jun/Developer/new/700_projects/jawcode/struct_har/chase/007_follow_index.md`
- MODIFY: `/Users/jun/Developer/new/700_projects/jawcode/struct_har/chase/002_gap_inventory.md`
- NEW: `/Users/jun/Developer/new/700_projects/jawcode/devlog/_plan/260628_chase_hardening_gjc_omp/10_gjc_active_audit.md`

Verification:

- Sub-agent/employee audit checks the 616-commit dirstat and keyword clusters against card coverage for the current sub-batch only.
- `rg` checks no `RLM/research-mode commit cluster`, `plus .* cluster`, or similarly vague placeholders remain in the current sub-batch.
- `git diff --check`.
- Commit GJC active-card hardening only.

### Phase 2 — GJC `_fin` stale-closure review

Purpose: review completed GJC cards under `_fin/10` against newer GJC `a791d72a`, verifying that closed cards remain closed or explicitly point to new active follow-up cards.

Planned surfaces:

- MODIFY as needed: `/Users/jun/Developer/new/700_projects/jawcode/struct_har/chase/_fin/10/*.md`
- MODIFY as needed: `/Users/jun/Developer/new/700_projects/jawcode/struct_har/chase/_fin/INDEX.md`
- MODIFY as needed: `/Users/jun/Developer/new/700_projects/jawcode/struct_har/chase/README.md` to move stale GJC head `f0a8a3eb` to `a791d72a` before later phases rely on it
- MODIFY as needed: `/Users/jun/Developer/new/700_projects/jawcode/struct_har/chase/10_gjc_chase_MOC.md`
- NEW: `/Users/jun/Developer/new/700_projects/jawcode/devlog/_plan/260628_chase_hardening_gjc_omp/20_gjc_fin_review.md`

Verification:

- Independent reviewer challenges closure claims and verifies `_fin/INDEX.md` reflects the actual `_fin/10` inventory.
- Any reopened scope must be represented as an active card rather than silently editing `_fin` as done.
- `git diff --check`.

### Phase 3 — OMP latest delta split

Purpose: apply the same real-commit chase split to OMP `0fc6d136`, especially the visible 16.1.17→16.1.20 deltas around append-only logs, OAuth/account selection, reasoning replay, local binary attachments, bash snapshots, TUI image drafts, compaction, and release/test hardening.

Planned surfaces:

- NEW: `/Users/jun/Developer/new/700_projects/jawcode/struct_har/chase/20.009_omp_chase_append_only_context_integrity.md`
- NEW: `/Users/jun/Developer/new/700_projects/jawcode/struct_har/chase/20.010_omp_chase_ai_oauth_reasoning_replay.md`
- NEW: `/Users/jun/Developer/new/700_projects/jawcode/struct_har/chase/20.011_omp_chase_tui_image_drafts_terminal_edges.md`
- NEW: `/Users/jun/Developer/new/700_projects/jawcode/struct_har/chase/20.012_omp_chase_bash_snapshot_env_security.md`
- NEW: `/Users/jun/Developer/new/700_projects/jawcode/struct_har/chase/20.013_omp_chase_plugin_virtual_registry_bundle.md`
- NEW: `/Users/jun/Developer/new/700_projects/jawcode/struct_har/chase/20.014_omp_chase_goal_compaction_provider_concurrency.md`
- NEW: `/Users/jun/Developer/new/700_projects/jawcode/struct_har/chase/20.015_omp_chase_release_test_leak_hardening.md`
- MODIFY: `/Users/jun/Developer/new/700_projects/jawcode/struct_har/chase/20_omp_chase_MOC.md`
- MODIFY: `/Users/jun/Developer/new/700_projects/jawcode/struct_har/chase/007_follow_index.md`
- MODIFY: `/Users/jun/Developer/new/700_projects/jawcode/struct_har/chase/002_gap_inventory.md`
- NEW: `/Users/jun/Developer/new/700_projects/jawcode/devlog/_plan/260628_chase_hardening_gjc_omp/30_omp_delta_split.md`

Verification:

- OMP `git log --oneline cc0c67be..0fc6d136` and `git diff --dirstat=files,0 cc0c67be..0fc6d136` evidence captured.
- New OMP cards use reference-only wording and do not suggest direct import.
- `git diff --check`.
- Commit OMP split only.

### Phase 4 — OMP `_fin` and active card consistency review

Purpose: review OMP `_fin/20` and active cards after Phase 3 so old 15.13 references do not hide newer 16.1.20 deltas.

Planned surfaces:

- MODIFY as needed: `/Users/jun/Developer/new/700_projects/jawcode/struct_har/chase/_fin/20/*.md`
- MODIFY as needed: `/Users/jun/Developer/new/700_projects/jawcode/struct_har/chase/20_omp_chase_MOC.md`
- MODIFY as needed: `/Users/jun/Developer/new/700_projects/jawcode/struct_har/chase/_fin/INDEX.md`
- NEW: `/Users/jun/Developer/new/700_projects/jawcode/devlog/_plan/260628_chase_hardening_gjc_omp/40_omp_fin_review.md`

Verification:

- Independent reviewer checks for stale head/version references.
- `git diff --check`.

### Phase 5 — final synthesis and goal evidence

Purpose: collect final source coverage matrix, commits, residual risks, JWC baseline/head reconciliation, and next recommended implementation order.

Planned surfaces:

- NEW: `/Users/jun/Developer/new/700_projects/jawcode/devlog/_plan/260628_chase_hardening_gjc_omp/50_final_synthesis.md`
- MODIFY as needed: `/Users/jun/Developer/new/700_projects/jawcode/struct_har/chase/README.md`

Verification:

- Final independent audit challenges whether the user request was satisfied.
- `git status --short --branch` confirms only intentional/unrelated dirty files remain.
- `git diff --check` passes.

## Risks

1. GJC/OMP source clone history is large; command evidence must be sampled by cluster and dirstat rather than pasted wholesale.
2. Existing `_fin` cards may be correct despite new upstream commits; avoid reopening without evidence.
3. JWC has fork-specific behavior that may already be ahead; cards should not imply direct upstream superiority.
4. Unrelated dirty files must not be staged.
5. Documentation-only changes still need commit discipline because future agents depend on these cards.

## Completion criteria

- Every new GJC/OMP chase split has source commit anchors, source file anchors, JWC reconcile notes, done gates, and decision slots.
- Active and `_fin` indexes match real file locations.
- OMP latest `0fc6d136` delta is represented by detailed cards, not only the older 15.13 summary.
- At least one independent audit per major phase is recorded.
- All intentional docs changes are committed in logical units.

## Explicit exclusions for this goal

- `10.001`, `10.006`, `10.019`, and `10.027` remain active but are not part of Phase 1A-1C hardening unless a source audit finds they hide a newly missed upstream cluster. `10.001` is the fetch/changelog cycle row in the GJC MOC and `10.001_gjc_chase_cycle.md`; `10.006`, `10.019`, and `10.027` retain their deferral rationale in `007_follow_index.md`.
- Existing unrelated dirty files listed above are preserved and must not be staged by broad `git add .`.
