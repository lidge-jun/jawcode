# struct_har chase baseline refresh plan

## Objective

Refresh the Jawcode `struct_har` comparison/chase layer against the actual local upstream clones, then commit only the intended documentation/script updates.

User correction: **GJC must use the `dev` branch**, not `main`.

## Current facts

- Project root: `/Users/jun/Developer/new/700_projects/jawcode`
- Root branch: `main`, currently aligned with `origin/main`.
- Actual GJC clone: `devlog/_gjc_chase/gajae-code`
  - Current branch before work: `main`
  - Remotes: `origin=https://github.com/lidge-jun/gajae-code.git`, `upstream=https://github.com/Yeachan-Heo/gajae-code.git`
  - Required refresh target: `upstream/dev`, fast-forward only.
- Actual OMP clone: `devlog/_omp_chase/oh-my-pi`
  - Current branch before work: `main`
  - Remote: `origin=https://github.com/can1357/oh-my-pi.git`
  - Required refresh target: current tracking branch, fast-forward only.
- `struct_har/_scripts/resolve-heads.ts` currently resolves missing legacy paths:
  - `devlog/_upstream_gjc`
  - `devlog/_upstream_omp`
- Therefore regeneration currently falls back to stale hard-coded heads instead of the actual chase clones.

## Plan

### 1. Refresh upstream clones

Run read-safe git operations only:

```bash
git -C devlog/_gjc_chase/gajae-code fetch --all --prune
git -C devlog/_gjc_chase/gajae-code switch dev || git -C devlog/_gjc_chase/gajae-code switch --track -c dev upstream/dev
git -C devlog/_gjc_chase/gajae-code pull --ff-only upstream dev
git -C devlog/_gjc_chase/gajae-code rev-parse HEAD
```

```bash
git -C devlog/_omp_chase/oh-my-pi fetch --all --prune
git -C devlog/_omp_chase/oh-my-pi pull --ff-only
git -C devlog/_omp_chase/oh-my-pi rev-parse HEAD
```

No push, reset, rebase, or clean.

### 2. Patch struct_har head resolution

Modify:

```text
struct_har/_scripts/resolve-heads.ts
struct_har/_scripts/struct-har-regenerate.ts
struct_har/_scripts/struct-har-regenerate-logic.ts
struct_har/_scripts/struct-har-regenerate-architecture.ts
struct_har/_scripts/struct-har-regenerate-overviews.ts
struct_har/_scripts/struct-har-regenerate-omp.ts
```

Before:

- GJC resolves only `devlog/_upstream_gjc`, then stale fallback.
- OMP resolves only `devlog/_upstream_omp`, then stale fallback.
- The regeneration scripts still hard-code legacy clone/citation paths, so generated anchor/citation text can point at missing directories even if HEAD resolution is fixed.

After:

- GJC resolves the first existing git clone from:
  1. `devlog/_gjc_chase/gajae-code`
  2. `devlog/_upstream_gjc`
- OMP resolves the first existing git clone from:
  1. `devlog/_omp_chase/oh-my-pi`
  2. `devlog/_upstream_omp`
- If no clone exists, keep the prior string fallback behavior.
- `struct-har-regenerate.ts` uses the same GJC clone resolver/path for file existence checks and generated diff commands.
- `struct-har-regenerate-logic.ts` and `struct-har-regenerate-overviews.ts` use the same GJC clone resolver/path for generated diff and overview text.
- `struct-har-regenerate-architecture.ts` refreshes its snapshot date after the structure inputs are updated.
- `struct-har-regenerate-omp.ts` uses the same OMP clone resolver/path and absolute citation path for generated docs.

### 2a. Ignore actual chase clone directories

Modify:

```text
.gitignore
devlog/.gitignore
```

Add ignore entries for:

```text
devlog/_gjc_chase/
devlog/_omp_chase/
```

and/or the devlog-relative equivalents:

```text
_gjc_chase/
_omp_chase/
```

Reason: current `git status` reports both actual clone directories as untracked. The goal explicitly must not commit clone contents.

### 3. Regenerate struct_har outputs

Run the existing regeneration scripts from the repository root:

```bash
bun struct_har/_scripts/struct-har-regenerate.ts
bun struct_har/_scripts/struct-har-regenerate-logic.ts
bun struct_har/_scripts/struct-har-regenerate-architecture.ts
bun struct_har/_scripts/struct-har-regenerate-overviews.ts
bun struct_har/_scripts/struct-har-regenerate-omp.ts
```

Then inspect `git diff` and keep only intentional `struct_har`/devlog changes.

### 4. Update chase/current-state docs if regeneration leaves stale baseline text

Expected likely manual updates:

```text
structure/00_INDEX.md
structure/11_conventions.md
structure/40_fork-delta.md
struct_har/README.md
struct_har/chase/README.md
struct_har/chase/10_gjc_chase_MOC.md
struct_har/chase/20_omp_chase_MOC.md
struct_har/chase/002_gap_inventory.md
struct_har/INDEX.md
```

Only edit these if the refreshed clone HEADs prove their reviewed-through rows are stale.

The `structure` edits are limited to clone path/head/remote/current-state wording so regenerated architecture excerpts do not reintroduce stale `_upstream_*` paths.

### 5. Verification

Run:

```bash
bun run check:tools
```

Also run focused sanity checks:

```bash
bun struct_har/_scripts/struct-har-regenerate.ts
bun struct_har/_scripts/struct-har-regenerate-omp.ts
git diff --check
git status --short --ignore-submodules=none
```

If broader script/type failures appear in files unrelated to this work, record them and keep scope narrow.

## Commit scope

Commit only:

- `.gitignore` / `devlog/.gitignore` if needed to keep actual chase clones out of root status.
- `struct_har/_scripts/resolve-heads.ts` if changed.
- `struct_har/_scripts/struct-har-regenerate*.ts` files if their clone/citation constants or snapshot text need correction.
- Regenerated `struct_har/**` files.
- `structure/00_INDEX.md`, `structure/11_conventions.md`, and `structure/40_fork-delta.md` if needed to keep struct_har architecture excerpts current.
- This plan under `devlog/_plan/260626_struct_har_chase_refresh/`.

Do not commit the gitignored clone directories themselves:

- `devlog/_gjc_chase/`
- `devlog/_omp_chase/`

Do not touch unrelated root files.

## B implementation evidence

Completed on 2026-06-26.

- GJC clone: `devlog/_gjc_chase/gajae-code`, branch `dev`, tracking `upstream/dev`, HEAD `f0a8a3eb6e619392af4965273c3cf95c3faf4345`.
- OMP clone: `devlog/_omp_chase/oh-my-pi`, branch `main`, tracking `origin/main`, HEAD `0fc6d136c34a279a711a2d3f2df9d64e0fa06cee`.
- Patched resolver/generator files:
  - `struct_har/_scripts/resolve-heads.ts`
  - `struct_har/_scripts/struct-har-regenerate.ts`
  - `struct_har/_scripts/struct-har-regenerate-logic.ts`
  - `struct_har/_scripts/struct-har-regenerate-architecture.ts`
  - `struct_har/_scripts/struct-har-regenerate-overviews.ts`
  - `struct_har/_scripts/struct-har-regenerate-omp.ts`
- Regenerated all struct_har outputs with:
  - `bun struct_har/_scripts/struct-har-regenerate.ts`
  - `bun struct_har/_scripts/struct-har-regenerate-logic.ts`
  - `bun struct_har/_scripts/struct-har-regenerate-architecture.ts`
  - `bun struct_har/_scripts/struct-har-regenerate-overviews.ts`
  - `bun struct_har/_scripts/struct-har-regenerate-omp.ts`
- Verification:
  - `bun run check:tools` exit 0; Biome emitted one deprecated config info only, no fixes applied.
  - `git diff --check` exit 0.
  - `git diff --name-only -- bun.lock` produced no output after removing the `bun install` lockfile side effect.
- Backend B-phase read-only verification returned `DONE`.

## C verification evidence

Completed on 2026-06-26.

- Regeneration rerun from the repository root:
  - `bun struct_har/_scripts/struct-har-regenerate.ts` exit 0; regenerated 26 band `02_code_facts` docs plus `099`.
  - `bun struct_har/_scripts/struct-har-regenerate-logic.ts` exit 0; wrote 27 logic change docs.
  - `bun struct_har/_scripts/struct-har-regenerate-architecture.ts` exit 0; refreshed both architecture sets.
  - `bun struct_har/_scripts/struct-har-regenerate-overviews.ts` exit 0; refreshed 13 bands x 2 overview docs.
  - `bun struct_har/_scripts/struct-har-regenerate-omp.ts` exit 0; refreshed 13 bands x 4 OMP docs plus architecture.
- `bun run check:tools` exit 0; Biome checked 2303 files, emitted one deprecated `biome.json` config info, and applied no fixes.
- `git diff --check` exit 0.
- `git diff --name-only -- bun.lock packages/natives/native packages/coding-agent/src/internal-urls/docs-index.generated.ts` produced no output, confirming the prior `bun install` side effects are not in the worktree.
- `bun run check:ts` was attempted and failed in the pre-existing native package layer:
  - `check:tools` passed.
  - `check:node20-baseline` passed.
  - `check:schemas` failed because `packages/utils/node_modules/@jawcode-dev/natives/native/pi_natives.darwin-arm64.node` does not expose the `@jawcode-dev/natives@1.0.2` sentinel `__piNativesV1_0_2`.
  - This is outside the `struct_har` documentation/script baseline refresh scope and was not fixed or committed here.
