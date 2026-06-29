# 260626 chase jawdev detail expansion — plan

## Intent

Jun requested every `struct_har/chase` document to carry enough Jawdev detail for agents to continue without guessing:

- why this item is behind or why it can drift again,
- where implementation changes should land,
- what decisions are required before patching,
- what evidence proves the chase item is complete.

This is a docs-only hardening pass. It does not change product code, generated snapshots, clone HEADs, or `struct_har/_scripts`.

## Scope

Target all Markdown files under:

```text
struct_har/chase/**/*.md
```

This includes root chase docs, active GJC/OMP chase cards, `_fin` completed cards, README/index files, and band indexes.

## Patch approach

Append one standardized section to each chase document:

```text
## Jawdev chase expansion — 2026-06-26
```

The section must be file-specific enough to orient a future agent:

- source lane:
  - GJC: `devlog/_gjc_chase/gajae-code` on `dev` tracking `upstream/dev`;
  - OMP: `devlog/_omp_chase/oh-my-pi` on `main` tracking `origin/main`;
  - JWC/index docs: mixed current-state coordination lane.
- current status:
  - active if the file is outside `_fin`;
  - completed/guardrail if the file is under `_fin`.
- implementation surface candidates:
  - `packages/coding-agent`,
  - `packages/agent`,
  - `packages/tui`,
  - `packages/ai`,
  - `packages/utils`,
  - `python/jwc-rpc`,
  selected by filename/title keywords where possible.
- decision records:
  - import upstream behavior,
  - adapt to JWC naming/state/workflow contract,
  - reject with rationale,
  - add/skip regression gate.

The expansion is intentionally repetitive because these docs are used as standalone agent handoff cards.

## Acceptance

- Every Markdown file under `struct_har/chase/**/*.md` has at least 100 lines.
- Every target file contains the `Jawdev chase expansion — 2026-06-26` section.
- Every expansion contains the headings:
  - `Why this is behind or can drift`
  - `Where to patch`
  - `Decision needed before patching`
  - `Verification and done evidence`
  - `Sub-agent handoff contract`
- No product code changes.
- `git diff --check` passes.
- `bun run check:tools` passes or only reports the known Biome deprecation info.

## Verification plan

Run:

```bash
find struct_har/chase -name '*.md' -print0 | xargs -0 wc -l | sort -n
rg -l "Jawdev chase expansion — 2026-06-26" struct_har/chase | wc -l
find struct_har/chase -name '*.md' | wc -l
git diff --check
bun run check:tools
```

Then request a read-only Docs audit to confirm followability.

## Implementation evidence

Completed on 2026-06-26.

- Added `Jawdev chase expansion — 2026-06-26` to all 52 Markdown files under `struct_har/chase/**/*.md`.
- Each section records:
  - canonical source lane and branch,
  - active/completed status,
  - why the card is behind or can drift,
  - where future patches should land,
  - decisions required before patching,
  - verification and done evidence,
  - sub-agent handoff rules,
  - minimum patch worksheet and decision log slots.
- Smallest document after expansion is `struct_har/chase/_fin/10/10.017_gjc_retired_fable_na.md` at 116 lines.
- `rg -l "Jawdev chase expansion — 2026-06-26" struct_har/chase | wc -l` returned 52.
- `find struct_har/chase -name '*.md' | wc -l` returned 52.

## Verification evidence

- `git diff --check` exit 0.
- `bun run check:tools` exit 0; Biome checked 2303 files and emitted only the existing deprecated `biome.json` config info.
