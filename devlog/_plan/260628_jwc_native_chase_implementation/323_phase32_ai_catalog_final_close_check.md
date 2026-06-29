# 323 Phase 32 check — 10.036 final close verification

> Mechanical gates for the docs-only closure. All green.

## Link integrity

- Dangling-link scan: `grep -rn '](\./10\.036_…\.md)' struct_har/chase/` → **NONE** (no stale
  sibling-path links remain).
- All 5 inbound references now point to `./_fin/10/…` (or `./10/…` inside `_fin/INDEX.md`):
  - `007_follow_index.md:47` — `✅ _fin · phases 14,31,32`
  - `10_gjc_chase_MOC.md:74` — `✅ _fin`
  - `002_gap_inventory.md:69` — `✅ _fin`
  - `20.010_…md:6` — cross-link `(✅ _fin)`
  - `_fin/INDEX.md:36` — new GJC row; header count `29`
- Moved card internal links rewritten `./` → `../../` (MOC + 008, 2 occurrences) resolve from `_fin/10/`.
- `git diff --check` → exit 0 (no whitespace errors).

## Owned-scope tests

`bun test packages/ai/test/{auth-storage-project-dotenv,auth-storage-config-override,auth-storage-broker-no-sentinel,fable-tool-choice-catalog,oauth-local-import}.test.ts`

```
18 pass / 0 fail / 44 expect() calls — Ran 18 tests across 5 files.
```

## Type check

`cd packages/ai && bun run check:types` (`tsgo -p tsconfig.json --noEmit`) → **exit 0**.

## Result

10.036 closed to `_fin/10`. `_fin/10` count 28 → 29. Immediate in-scope open cards now exclude
10.036 and 10.047. Ready to commit.
