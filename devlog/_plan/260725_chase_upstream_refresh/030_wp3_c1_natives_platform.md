# 030 — wp3 cycle 1: card 10.116 (A-slice) natives/Windows/platform import

## Stale check (P, 2026-07-25)

Card re-verified against current dev tree (`d9eadb6`). Findings change the implementation shape:

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

1. `packages/natives/native/loader-state.js` (+`.d.ts`): **cache-optimization port (A-audit correction, not a bug fix)** — JWC's loader currently re-reads the embedded payload and overwrites the target on every load (loader-state.js:232,249); there is no `existsSync(targetPath) → reuse` branch, so there is no freshness bug, only missing reuse. Port as a small pure seam: extract the reuse decision (`shouldReuseCachedExtraction(targetStat, embeddedMeta)` — same-version cache is fresh only when both stat successfully and byte sizes match) and call it before the rewrite; on fresh cache, skip the write. New `packages/natives/test/embedded-extraction-freshness.test.ts` tests the pure seam plus write/no-write behavior with temp-file fixtures and injected embedded metadata (the committed `embedded-addon.js` payload is null, so no loader-level extraction fixture is claimed). (MODIFY loader-state.js, MODIFY loader-state.d.ts, NEW test)
2. `scripts/ci-dev-affected.ts`: **NO-OP — already satisfied (A-audit scenario matrix)**. Upstream `6cba5465` activated addon provisioning for root-check/coding-agent check tasks in a task-matrix structure JWC does not have. JWC scenario matrix: (a) full-workspace → root-check + `addNativeBuild` (ci-dev-affected.ts:209-211); (b) coding-agent runtime path → `needsNativeRuntime` adds native-build (:205-207); affected packages with test script → addNativeBuild (:214); (c) tooling-script-only root-check runs `check:ts` = biome + node20-baseline + schemas + jwc-ui + per-workspace `check` — packages/natives `check` is biome+tsgo only, **no addon load**, so no producer is needed. No reachable scenario lacks the native addon producer. Recorded as evidence; no edit.
3. `scripts/release.ts`: port "keep empty changelogs versioned" (`d81af8bc`). Exact upstream semantics: (a) remove stale empty version entries BEFORE inserting; (b) Unreleased with content → move under new version heading (JWC already does this); (c) empty Unreleased → keep `## [Unreleased]` AND insert an empty `## [version] - date` heading below it (JWC currently skips versioning entirely). Seam for tests (A-audit blocker 3): extract the pure transformation into an import-safe module `scripts/release-changelog.ts` exporting `hasUnreleasedContent`, `removeEmptyVersionEntries`, `versionChangelogContent(content, version, date)`; `scripts/release.ts` imports from it (its bottom-level main dispatch is unguarded, so the pure functions must move, not just be exported). NEW `scripts/release-changelog.test.ts` with 4 cases: empty Unreleased → new empty version heading kept; content Unreleased → content moved; stale empty version removed before insert; idempotent rerun → no duplicate headings. (NEW scripts/release-changelog.ts, MODIFY scripts/release.ts, NEW test)
4. Test guard churn (`6ad2cf4e`): **skip — no semantic counterpart in JWC** (A-audit correction: `cli-command-surface.test.ts` exists as a file, but the upstream change targeted a managed-owner supervisor test case JWC does not have; `path-identity-posix.test.ts` also absent). Recorded as evidence; no edit.

Out of scope: path_identity.rs, plain_tree.rs (residual), welcome.ts/cli.ts perf commit (C bucket).

## Accept criteria

- A1: `bun test packages/natives/test/embedded-extraction-freshness.test.ts` passes — pure reuse-decision seam + temp-fixture write/no-write behavior (size-match same-version cache skips rewrite; size-mismatch rewrites).
- A2: `bun run check:ts` green; `git diff --check` clean.
- A3: `bun test scripts/release-changelog.test.ts` passes — 4 cases (empty Unreleased versioned, content moved, stale empty removed first, idempotent rerun).
- A4: residual recorded in card 10.116 Decision Log + this doc (path_identity/plain_tree defer; ci-dev-affected no-op evidence; guard-churn skip evidence; `87ac45be54` exclusion).
- Activation scenarios (C-ACTIVATION-GROUNDING-01): A1 exercises the new early-reuse branch via temp target files with matching vs mismatching byte sizes; A3 exercises the empty-Unreleased else-branch via a synthetic changelog fixture passed to the pure function (no release main dispatch).
