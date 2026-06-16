# 250 — remaining 160+ cleanup execution

> PABCD Cycle — dev branch
> Classification: C2 (docs + config sweep)
> Prior slices 162, 167, 169, 170, 171 are already implemented.

## Goal

Close the remaining 160+ gaps: fix the `validate:jwc-release` failure and clean
active-public legacy identity in docs/.

## Changes

### 1. Fix release validation (MODIFY)

**File**: `packages/gajae-code/package.json`
**Change**: Add `"private": true` — the legacy wrapper is not published under
the Jawcode release train. This makes `release-publish-order.test.ts` stop
expecting it in the publish set.

### 2. Docs active-public identity cleanup (MODIFY — ~50 files)

**Scope**: All files under `docs/` plus `CONTRIBUTING.jwc.md` and `AGENTS.md`
that contain bare `gjc`/`GJC`/`gajae`/`Gajae` references in active prose.

**Rules**:
- `GJC` (product/CLI name) → `JWC`
- `gjc` (product/CLI name) → `jwc`
- `gajae-code` (product name) → `jawcode`
- `Gajae-Code` → `Jawcode`
- `gajae` (standalone brand) → `jawcode` or remove
- `Gajae` (standalone brand) → `Jawcode` or remove
- `@gajae-code/` (npm scope in code examples) → **KEEP** — real published package scope
- `python/robogjc/` (directory path) → **KEEP** — real directory structure
- File-internal `$GJC_*` env vars → `$JWC_*` when the codebase already uses that name
- Historical lineage context (e.g., "forked from gajae-code") → **KEEP** if explicitly marked

**Exceptions**:
- `docs/REBRANDING_PLAN_260525.md` — historical doc, keep as-is
- `docs/gjc-dogfood-skill-template.md` — filename + content legacy; rename to `jwc-dogfood-skill-template.md`

### 3. Verification

```bash
# 1. Release validation green
bun run validate:jwc-release

# 2. Active-public inventory reduced
bun run scripts/legacy-name-inventory.ts | python3 -c "import json,sys; d=json.load(sys.stdin); print(d['summary'])"

# 3. Public legacy zero check
bun run scripts/check-public-legacy-zero.ts

# 4. Package build + smoke
bun --cwd=packages/jwc run bundle && bun --cwd=packages/jwc run build:node && node packages/jwc/scripts/smoke-packed-sdk.mjs

# 5. No GitHub workflow leakage
bun run check:no-github-workflows
```

## Not in scope

- `@gajae-code/*` internal package scope rename (D-070-5: high churn, deferred)
- `python/robogjc/` directory rename (structural, separate effort)
- cli-jaw integration slices 163-166 (separate repo, user confirmed stack-on-tui approach)
- Provider tokenizer work (separate plan)

## Commit plan

1. `chore: mark packages/gajae-code private`
2. `docs: clean active-public legacy identity in docs/ and CONTRIBUTING`
3. Verification evidence in this file (appended after gates green)
