# 155 — active public zero gap run

## Goal

Turn the 151 preplan into a concrete, executable gap map before the cleanup
patches land.

This slice does not attempt the full internal namespace rename. It defines the
first enforceable boundary:

- public Jawcode package/docs surface is Jawcode/JWC only;
- cli-jaw embedded Jawcode runtime does not expose upstream `gajae` or `gjc`
  identity strings;
- internal `@gajae-code/*` build imports remain out of scope unless they leak
  through the active public guard.

## Gap inventory

| Area | Current gap | Fix in 156 |
|---|---|---|
| root package metadata | private root still presents as `gajae-code` | either keep out of public guard or rename to `jawcode-workspace` after gate updates |
| `README.md` / `README.jwc.md` | current docs still explain transitional upstream scope in user-facing sections | move lineage/compat detail to `NOTICE.md` or fork-delta docs |
| `packages/jwc/package.json` | description says "fork surface over gajae-code" | make the published `jawcode` package metadata Jawcode-first |
| JWC launcher | `GJC_BRAND_NAME` is set as a preferred peer of `JWC_BRAND_NAME` | prefer only `JWC_BRAND_NAME` in launchers; compatibility readers stay internal |
| cli-jaw tracked embedded bundles | generated bundle contains upstream package metadata, release URLs, stale GJC docs, `GJC_*` env labels, and `gjc-*` temp/state names | regenerate from cleaned source where possible; otherwise patch the embedded generated artifact as a 156 bridge and record the source follow-up |
| cli-jaw untracked code-mode recovery files | local `src/agent/jwc-runtime.ts` and `src/code-mode/**` files still exist outside git tracking | do not stage another slice's recovery work here; once those files become repository surface, they must pass the same `JWC_*` guard |

## Guard contract

Add `scripts/check-public-legacy-zero.ts` with two scan lanes:

1. **Jawcode lane**
   - parse public metadata from `packages/jwc/package.json`;
   - scan active landing docs: `README.md`, `README.jwc.md`;
   - scan active launcher files: `packages/jwc/bin/jwc.js`,
     `packages/jwc/src/cli-entry.ts`;
   - do not scan internal package imports or historical docs in this lane.
2. **cli-jaw lane**
   - scan only git-tracked files in `/Users/jun/Developer/new/700_projects/cli-jaw`;
   - current active public target is `/Users/jun/Developer/new/700_projects/cli-jaw/src/lib/tui/jawcode-*bundle*`;
   - skip local untracked recovery files such as `src/agent/jwc-runtime.ts` and
     `src/code-mode/**` until they are part of the repository surface;
   - fail on upstream identity strings, legacy public env labels, and stale
     release/schema URLs.

The guard is intentionally stricter than `scripts/rebrand-inventory.ts`, which
still exists to protect older workflow/default-surface invariants.

## Verification

```bash
bun scripts/check-public-legacy-zero.ts
bun scripts/verify-g002-gates.ts
bun scripts/rebrand-inventory.ts --strict
bun scripts/check-visible-definitions.ts
git diff --check
```

cli-jaw must additionally run:

```bash
npm run build
```

## Stop condition

155 is done when the guard exists, fails against the pre-cleanup state or has
the failing evidence recorded, and the 156 execution plan points at every
guarded file that needs cleanup.
