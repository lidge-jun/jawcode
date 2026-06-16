DONE

Read-only P1.5.4 verification completed against `devlog/_plan/260614_performance/34_p1_5_4_serialization_diff_tests_plan.md`.

Findings:
- `packages/coding-agent/src/secrets/obfuscator.ts` contains the upstream sorted-cache/single-pass/fallback deltas: sorted replace/obfuscate caches, direct secret→index lookup, combined plain regex cache, dirty flag, sequential fallback, sorted insertion for regex-discovered secrets, and `escapeRegex()`.
- `packages/coding-agent/test/secrets-obfuscator.test.ts` includes the requested upstream blocks for single-pass equivalence and sorted mapping cache, covering seeded adversarial mappings, fallback/reentrant overlap, cross-phase substring overlap, longest-first output, random plain mappings, and regex-discovered stable reversible obfuscation.
- `packages/coding-agent/src/modes/components/diff.ts` contains `LONG_LINE_FAST_PATH_LIMIT`, `renderIntraLineDiffWithDiffWords()`, fast-path helpers, whitespace-only guard, single-span replacement checks, whitespace-boundary snapping, and diffWords fallback paths.
- `packages/coding-agent/test/core/diff-oracle.test.ts` includes the requested fixtures: single-token replacement, prefix/suffix replacement, whitespace-only, tabs indent, unicode combining marks, very long line guard, sub-word fallback, and word-boundary spanning replacement.
- `packages/coding-agent/test/core/__snapshots__/diff-oracle.test.ts.snap` has snapshot entries for the added diff fixtures.
- `packages/coding-agent/test/hindsight-mental-models-lcs.test.ts` exists and imports `diffMentalModelContent`, includes a local legacy dense-DP LCS oracle, and covers current, local-edit, repeated-line, ambiguous tie-break, and 1000x1000 fixtures with `maxLines = 4_000`.

Main-session focused gates:
- `bun test packages/coding-agent/test/secrets-obfuscator.test.ts packages/coding-agent/test/core/diff-oracle.test.ts packages/coding-agent/test/hindsight-mental-models-lcs.test.ts` — PASS, 30 tests / 12 snapshots / 204 expects.
- `bun biome check packages/coding-agent/src/secrets/obfuscator.ts packages/coding-agent/src/modes/components/diff.ts packages/coding-agent/test/secrets-obfuscator.test.ts packages/coding-agent/test/core/diff-oracle.test.ts packages/coding-agent/test/hindsight-mental-models-lcs.test.ts devlog/_plan/260614_performance/34_p1_5_4_serialization_diff_tests_plan.md` — PASS.
- `bun --cwd=packages/coding-agent run check` — FAIL due unrelated `test/task/executor-ext-model-routing.test.ts` formatting outside this slice.
