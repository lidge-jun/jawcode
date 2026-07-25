# 260702 chase pull + parity docs refresh — P plan

Status: active goal plan
Owner: Boss
Created: 2026-07-02
Work class: C3 documentation/state reconciliation

## Corrected Objective

Pull the two chase repositories inside `devlog/`, then add and update the `struct_har/chase` documents that describe the new upstream/reference deltas.

The two chase repositories are:

- `/Users/jun/Developer/new/700_projects/jawcode/devlog/_gjc_chase/gajae-code`
- `/Users/jun/Developer/new/700_projects/jawcode/devlog/_omp_chase/oh-my-pi`

This work is not a root-repository pull/rebase task and is not a broad `_plan` to `_fin` archive task.

## Evidence Read

- `/Users/jun/Developer/new/700_projects/jawcode/AGENTS.md:72` defines `struct_har/` as the comparison + harness layer for regenerated `gjc_origin` and `jwc_patched` snapshots, OMP reference facts, chase gap indexes, and regeneration tooling.
- `/Users/jun/Developer/new/700_projects/jawcode/AGENTS.md:78` says `devlog/` is the Jawdev logic record and that PABCD artifacts belong inside the relevant phase sequence.
- `/Users/jun/Developer/new/700_projects/jawcode/devlog/README.md:22` points from `devlog/` to `structure/`.
- `/Users/jun/Developer/new/700_projects/jawcode/devlog/README.md:23` points from `devlog/` to `struct_har/`.
- `/Users/jun/Developer/new/700_projects/jawcode/struct_har/README.md:12` identifies the GJC chase source as `devlog/_gjc_chase/gajae-code`.
- `/Users/jun/Developer/new/700_projects/jawcode/struct_har/README.md:14` identifies the OMP chase source as `devlog/_omp_chase/oh-my-pi`.
- `/Users/jun/Developer/new/700_projects/jawcode/struct_har/README.md:44` requires upstream fetch results to update HEADs, MOCs, `002_gap_inventory`, `INDEX.md`, and the README baseline together.
- `/Users/jun/Developer/new/700_projects/jawcode/struct_har/chase/002_gap_inventory.md:136` records the chase update checklist.
- `/Users/jun/Developer/new/700_projects/jawcode/struct_har/chase/007_follow_index.md:142` shows the current OMP latest-delta section that must be extended after OMP advances.

## Current State Snapshot

- Root repo remains dirty; those product-code/test changes are out of scope and must be preserved.
- `devlog/_gjc_chase/gajae-code`: branch `main`, remote `upstream=https://github.com/Yeachan-Heo/gajae-code.git`, current HEAD `fa995807`.
- `devlog/_omp_chase/oh-my-pi`: branch `main`, remote `origin=https://github.com/can1357/oh-my-pi.git`, current HEAD `ca9f2847e`, currently `behind 175`.
- Existing plan file path: `/Users/jun/Developer/new/700_projects/jawcode/devlog/_plan/260702_parity_docs_refresh/00_plan.md`.

## Scope Boundary

### IN

- Fast-forward/fetch the two chase clones only:
  - `/Users/jun/Developer/new/700_projects/jawcode/devlog/_gjc_chase/gajae-code`
  - `/Users/jun/Developer/new/700_projects/jawcode/devlog/_omp_chase/oh-my-pi`
- Create/update chase delta docs under:
  - `/Users/jun/Developer/new/700_projects/jawcode/struct_har/chase/`
  - `/Users/jun/Developer/new/700_projects/jawcode/struct_har/chase/bands/`
  - `/Users/jun/Developer/new/700_projects/jawcode/devlog/_plan/260702_parity_docs_refresh/`
- Refresh index/baseline docs that must agree with those deltas:
  - `/Users/jun/Developer/new/700_projects/jawcode/struct_har/README.md`
  - `/Users/jun/Developer/new/700_projects/jawcode/struct_har/INDEX.md`
  - `/Users/jun/Developer/new/700_projects/jawcode/struct_har/chase/002_gap_inventory.md`
  - `/Users/jun/Developer/new/700_projects/jawcode/struct_har/chase/007_follow_index.md`
  - `/Users/jun/Developer/new/700_projects/jawcode/struct_har/chase/10_gjc_chase_MOC.md`
  - `/Users/jun/Developer/new/700_projects/jawcode/struct_har/chase/20_omp_chase_MOC.md`

### OUT

- No root repo pull, rebase, reset, clean, or branch manipulation.
- No `_plan` to `_fin` folder moves unless a newly created chase card is immediately closed with explicit evidence during this goal.
- No edits to dirty product-code/test files already present in the root worktree.
- No direct commits or pushes inside the chase clones.
- No runtime feature implementation in Jawcode product packages.

## Diff-Level File Change Map

### NEW

The exact new chase-card files depend on the post-pull commit deltas. Naming follows the existing pattern:

- GJC cards: `/Users/jun/Developer/new/700_projects/jawcode/struct_har/chase/10.NNN_gjc_chase_<slug>.md`
- OMP cards: `/Users/jun/Developer/new/700_projects/jawcode/struct_har/chase/20.NNN_omp_chase_<slug>.md`

For each meaningful new delta cluster, add one card containing:

- source range and clone HEAD
- import/adapt/reject/reference-only decision
- affected JWC surfaces
- verification expectation
- status row suitable for the relevant MOC/index

### MODIFY

`/Users/jun/Developer/new/700_projects/jawcode/devlog/_plan/260702_parity_docs_refresh/00_plan.md`

- Replace the earlier mistaken root-pull/archive plan with this corrected chase-clone pull plan.

`/Users/jun/Developer/new/700_projects/jawcode/devlog/_plan/260702_parity_docs_refresh/10_pull_delta.md`

- New or updated phase evidence file recording before/after HEADs and commit-range summaries for both chase clones.

`/Users/jun/Developer/new/700_projects/jawcode/devlog/_plan/260702_parity_docs_refresh/20_card_synthesis.md`

- New or updated synthesis file mapping pulled commits into new/updated chase cards and no-card buckets.

`/Users/jun/Developer/new/700_projects/jawcode/struct_har/README.md`

- Before: baseline rows cite older reviewed-through HEADs.
- After: baseline rows cite the new GJC/OMP chase clone HEADs and current JWC root HEAD.

`/Users/jun/Developer/new/700_projects/jawcode/struct_har/INDEX.md`

- Before: may not include new chase-card ranges.
- After: index points to the new/updated chase docs and current baseline.

`/Users/jun/Developer/new/700_projects/jawcode/struct_har/chase/002_gap_inventory.md`

- Before: snapshot and active tables are stale after clone pulls.
- After: reviewed-through lines, summary rows, and active/backlog tables reflect the new deltas.

`/Users/jun/Developer/new/700_projects/jawcode/struct_har/chase/007_follow_index.md`

- Before: follow order stops at the previous GJC/OMP delta ranges.
- After: follow order includes the new card ranges, with reference-only OMP rows separated from import/adapt GJC rows.

`/Users/jun/Developer/new/700_projects/jawcode/struct_har/chase/10_gjc_chase_MOC.md`

- Add or update GJC cards produced from the pulled `upstream/dev` range.

`/Users/jun/Developer/new/700_projects/jawcode/struct_har/chase/20_omp_chase_MOC.md`

- Add or update OMP reference cards produced from the pulled `origin/main` range.

Optional if the card set touches band summaries:

- `/Users/jun/Developer/new/700_projects/jawcode/struct_har/chase/bands/README.md`
- band-specific files under `/Users/jun/Developer/new/700_projects/jawcode/struct_har/chase/bands/`

## Work-Phase Slice Map

### 10_pull_chase_clones

Goal: update only the two chase clones and record exact before/after evidence.

Planned commands:

```bash
git -C /Users/jun/Developer/new/700_projects/jawcode/devlog/_gjc_chase/gajae-code fetch upstream dev
git -C /Users/jun/Developer/new/700_projects/jawcode/devlog/_gjc_chase/gajae-code pull --ff-only upstream dev
git -C /Users/jun/Developer/new/700_projects/jawcode/devlog/_omp_chase/oh-my-pi fetch origin main
git -C /Users/jun/Developer/new/700_projects/jawcode/devlog/_omp_chase/oh-my-pi pull --ff-only origin main
```

Acceptance:

- Both clone statuses are clean after pull.
- Before/after HEADs and commit counts are recorded in `10_pull_delta.md`.
- Root dirty product-code changes are untouched.

### 20_cluster_commit_deltas

Goal: classify new commits into chase-card clusters.

Planned actions:

1. Use `git log --oneline <old>..<new>` in each clone.
2. Group commits by product surface and risk:
   - security/auth/provider/runtime
   - workflow state/goal/interview/plan
   - TUI/input/output
   - search/browser/network
   - docs/release/chore/no-card
3. Record cluster decisions in `20_card_synthesis.md`.

Acceptance:

- Every pulled commit is either mapped to a card, grouped into a no-card bucket, or explicitly marked as already-covered.
- GJC and OMP are not mixed; OMP remains reference-first unless evidence says JWC needs an adaptation.

### 30_write_chase_docs

Goal: add/update chase cards and indexes.

Planned actions:

1. Add new `10.NNN_*` and/or `20.NNN_*` markdown files for meaningful deltas.
2. Update `10_gjc_chase_MOC.md` and `20_omp_chase_MOC.md`.
3. Update `002_gap_inventory.md` and `007_follow_index.md`.
4. Update `struct_har/README.md` and `struct_har/INDEX.md` baseline rows.

Acceptance:

- New docs cite clone paths and commit ranges.
- Active/open/completed statuses agree across MOC, follow index, gap inventory, and README.
- No stale reviewed-through HEAD remains for the pulled clone ranges.

### 40_verify_and_commit

Goal: verify documentation consistency and commit only this goal's docs.

Planned commands:

```bash
git diff --check
find /Users/jun/Developer/new/700_projects/jawcode/devlog/_plan/260702_parity_docs_refresh /Users/jun/Developer/new/700_projects/jawcode/struct_har -name '*.md' -print0 | xargs -0 grep -nE '<<<<<<<|=======|>>>>>>>'
git status --short
```

Optional if broad docs tooling is clean enough to run:

```bash
bun run check:tools
```

Acceptance:

- No conflict markers in touched docs.
- `git diff --check` passes.
- Root dirty product-code changes remain unstaged.
- Commit stages only `devlog/_plan/260702_parity_docs_refresh/*` and `struct_har/*` changes from this goal.

## Risks and Guards

- GJC clone is `ahead 671`; pull may fail if local clone history diverges from `upstream/dev`. Guard: stop on non-fast-forward failure and report exact error instead of rebasing or resetting the clone.
- OMP clone is currently `behind 175`; this is expected and should fast-forward.
- Existing root repo dirty changes are unrelated. Guard: never stage `packages/*`, `.omo/`, `.codexclaw/`, or unrelated `devlog/_plan/*` paths.
- Card numbering must follow existing highest `10.NNN` and `20.NNN` values. Guard: inspect current chase filenames before adding new docs.

## Forward Gate

After audit passes, advance to build with:

```bash
cli-jaw orchestrate B --attest '{"from":"A","to":"B","did":"Backend audited corrected chase-clone pull + struct_har/chase docs plan and found it safe to implement"}'
```
