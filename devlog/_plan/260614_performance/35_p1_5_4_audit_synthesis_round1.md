# P1.5.4 A-stage audit synthesis — round 1

> Plan: `devlog/_plan/260614_performance/34_p1_5_4_serialization_diff_tests_plan.md`
> Architect audit: `agent://9-P154ArchitectAudit` copied in runtime output
> Verdict: FAIL

## Findings and resolutions

### ARCH-A1 — Secrets tests require upstream production obfuscator delta

Decision: accept.

Resolution: the plan is revised from test-only to test-plus-production for this lane. It now includes MODIFY `packages/coding-agent/src/secrets/obfuscator.ts` to port upstream sorted mapping caches, combined plain regex, single-pass plain mapping path with sequential fallback, direct `#obfuscateIndexBySecret`, `escapeRegex()`, and split/join `replaceAll()`.

### ARCH-A2 — Diff oracle fast-path fixtures require upstream renderDiff fast path

Decision: accept.

Resolution: the plan now includes MODIFY `packages/coding-agent/src/modes/components/diff.ts` to port upstream intra-line fast path helpers (`LONG_LINE_FAST_PATH_LIMIT`, `renderIntraLineDiffFastPath`, `renderSingleSpanIntraLineDiff`, whitespace-boundary guards). Snapshot updates are only valid after this source delta lands.

### ARCH-A3 — Snapshot update command underspecified

Decision: accept.

Resolution: the plan now names `bun test packages/coding-agent/test/core/diff-oracle.test.ts --update-snapshots` as the snapshot update command when the added fixtures create/update snapshots.

### ARCH-A4 — Hindsight LCS parity may reveal implementation mismatch

Decision: accept as risk.

Resolution: the plan now states to run the LCS parity test before treating it as test-only; if it fails, patch `diffMentalModelContent()` / `longestCommonSubsequence()` only to match the legacy dense-DP oracle and document the source change.

### ARCH-A5/ARCH-A6 — Path/import/gate confirmations

Decision: accept as non-blocking.

Resolution: no plan change beyond the expanded focused gates for source files and snapshots.

## Residual risk

This is no longer purely test-additive: it ports small production fast-path/cache deltas required for upstream tests. The verification scope is expanded to include source files, snapshots, and package check.
