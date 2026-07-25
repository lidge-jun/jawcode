# 030 — wp3 cycle 1: card 10.116 (A-slice) natives/Windows/platform import

## Stale check (P, 2026-07-25)

Card re-verified against current dev tree (`ef0d29e`). Findings change the implementation shape:

| anchor theme | upstream delta | JWC current state | verdict |
|---|---|---|---|
| embedded addon intra-version freshness (`f5cd965b`, `09e5263b`) | loader-state.js/.d.ts + `embedded-extraction-freshness.test.ts` | absent (probe in card confirmed: no `cachedEmbeddedExtractionIsFresh`) | **implement** |
| CI addon provisioning for generated checks (`6cba5465`) | scripts/ci-dev-affected.ts(+test) | file exists, differs from upstream head | **implement (adapt)** |
| release: keep empty changelogs versioned (`d81af8bc`) | scripts/release.ts + coding-agent CHANGELOG | file exists, differs | **implement (adapt)** |
| platform guard churn (`6ad2cf4e`) | 3 test files | JWC has own platform guards | **implement (adapt, minimal)** |
| path_identity.rs fixes (9 commits) | `crates/pi-natives/src/path_identity.rs` (6532 lines upstream) | **module absent in JWC** — fixes are inapplicable without the module | **defer (tracked residual)** |
| pi-iso plain_tree.rs fixes (4 commits) | `crates/pi-iso/src/plain_tree.rs` (1239 lines) | **module absent in JWC**; JWC pi-iso lib.rs/diff.rs predate its introduction | **defer (tracked residual)** |
| `87ac45be54` perf startup | cli.ts + welcome.ts + interactive-mode.ts | welcome.ts is protected visual surface (AGENTS.md) | **excluded from A (C bucket)** — whole-commit defer; partial import not meaningful for one atomic perf change |

Residual rationale: path_identity/plain_tree are upstream-NEW native modules with no JWC consumers (`git grep` upstream shows only intra-crate consumers). The delta commits are hardening fixes to those modules, not to code JWC runs. Importing 7.7k lines of new native modules is a feature port, not a chase fix; it is recorded as a tracked residual and recommended to fold into 10.063 (natives platform split, tier ③) or a dedicated user-approved port card.

## Diff-level plan (B)

1. `packages/natives/native/loader-state.js` (+`.d.ts`): port the intra-version freshness predicate — same-version cached embedded addon counts fresh only when both files stat successfully AND cached vs embedded byte sizes match; on mismatch, re-extract. Port upstream test as `packages/natives/test/embedded-extraction-freshness.test.ts` adapted to JWC loader layout. (MODIFY loader-state.js, MODIFY loader-state.d.ts, NEW test)
2. `scripts/ci-dev-affected.ts` (+`scripts/ci-dev-affected.test.ts` if present in JWC): adapt the addon-provisioning slice so generated checks have the native addon provisioned; keep JWC's existing affected-path logic. (MODIFY)
3. `scripts/release.ts`: adapt "keep empty changelogs versioned" — release flow must not drop/version-strip empty changelog files. (MODIFY, small)
4. Test guard churn: port `packages/natives/test/path-identity-posix.test.ts` guard minimization only insofar as JWC has the counterpart tests; skip coding-agent test files that JWC lacks. (MODIFY, minimal)

Out of scope: path_identity.rs, plain_tree.rs (residual), welcome.ts/cli.ts perf commit (C bucket).

## Accept criteria

- A1: `bun test packages/natives/test/embedded-extraction-freshness.test.ts` passes (intra-version drift triggers re-extract; matched cache does not).
- A2: `bun run check:ts` green; `git diff --check` clean.
- A3: release.ts changelog behavior pinned by a focused test or existing release test suite green.
- A4: residual recorded in card 10.116 Decision Log + this doc (path_identity/plain_tree defer with reasons).
- Activation scenarios (C-ACTIVATION-GROUNDING-01): A1's freshness predicate is exercised by constructing a stale same-version cache fixture in the new test; release.ts branch is exercised by the focused release test with an empty changelog fixture.
