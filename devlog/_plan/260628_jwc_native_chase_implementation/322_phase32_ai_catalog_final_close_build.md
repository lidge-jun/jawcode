# 322 Phase 32 build — 10.036 final close (closure surgery)

> Boss-direct docs-only surgery. No product code. Implements `320` plan after `321` audit PASS.

## Changes

### MOVE+EDIT (card → `_fin/10/`)
`git mv struct_har/chase/10.036_gjc_chase_ai_provider_auth_model_catalog.md`
→ `struct_har/chase/_fin/10/10.036_gjc_chase_ai_provider_auth_model_catalog.md`

In-file edits:
- Header `⬜` → `✅ _fin`; relative links `./10_gjc_chase_MOC.md` → `../../10_gjc_chase_MOC.md`,
  `./008_gjc_jwc_naming_contract.md` → `../../008_gjc_jwc_naming_contract.md` (2 occurrences).
- Appended `## JWC Phase 32 Final Close — 2026-06-28`: close decision (adapt, closed), `-A`/`-B`/`-C`
  rollup, `-C` REJECT/DEFER rationale table, deferred-gaps list. All 5 audit notes folded in:
  parity table marks sources JWC does NOT read; deferred gaps enumerated; test scope worded exactly
  (4 tests, xai-only, 3 modes, no no-leak fixture); redaction attributed to `10.047`; commits
  `2c60aed`/`71240b6` cited.

### MODIFY (inbound link surgery)
- `007_follow_index.md:47` — U1/036 `⬜` → `✅ _fin · phases 14,31,32`; link → `./_fin/10/…`.
- `10_gjc_chase_MOC.md:74` — 036 `⬜` → `✅ _fin`; link → `./_fin/10/…`.
- `002_gap_inventory.md:69` — link → `./_fin/10/…` + `✅ _fin`.
- `20.010_…md:6` — cross-link → `./_fin/10/…` + `(✅ _fin)`.
- `_fin/INDEX.md` — added 10.036 row in GJC `_fin/10` table (between 10.026 and 10.040);
  header count `28` → `29`.

NOT changed (per audit): `20.010:28` bare `[10.036]` table text (not a functional link); bare
prose mentions in `_fin/10/10.043` and `_fin/10/10.047` (citations, not links).

## Verification handoff

Proceed to C: link scan (`rg 10.036`), owned-scope tests (5 suites), `bun run check:types`,
`git diff --check`.
