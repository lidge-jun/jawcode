# P1.5.4 — serialization/diff test parity plan

> Status: PABCD P-stage draft (260615)
> Parent: `23_p1_5_upstream_v3_merge_plan.md`
> Scope: implement only P1.5.4 in this PABCD cycle. P1.5.5 is complete; P1.5.3/P1.5.2 remain follow-up cycles.

## 1. Objective

Port the upstream Optimization Suite v3 serialization/diff implementation and test coverage needed for parity in Jawcode. The lane strengthens secrets obfuscation, diff rendering fast-path coverage, and hindsight mental-model LCS parity.

## 2. Non-goals

- Do not modify P1.5.1 TUI scheduling.
- Do not implement P1.5.3 pruning/resultDigest changes.
- Do not implement P1.5.2 resident-cache lifecycle changes.
- Do not port native/algorithmic diff replacements; this lane ports only the upstream TypeScript fast-path/cache deltas needed for the tests.

## 3. File-level plan

### MODIFY `packages/coding-agent/src/secrets/obfuscator.ts`

Port upstream v3 plain-secret performance/correctness delta from `devlog/_upstream_gjc/packages/coding-agent/src/secrets/obfuscator.ts`:

- Add sorted replace/obfuscate mapping caches (`#sortedReplaceMappings`, `#sortedObfuscateMappings`).
- Add direct `#obfuscateIndexBySecret`.
- Add combined plain-secret regex cache (`#combinedPlainRegex`, `#combinedPlainReplacementBySecret`, dirty flag, sequential fallback flag).
- Replace per-call plain mapping sorts in `obfuscate()` with `#obfuscatePlainMappings()`.
- On regex-discovered obfuscation, update index map, sorted obfuscate cache, and dirty the combined regex.
- Add `#insertSortedObfuscateMapping()`, `#obfuscatePlainMappingsSequential()`, `#ensureCombinedPlainRegex()`, and `escapeRegex()`.
- Keep fallback sequential behavior when replacements/placeholders contain other secrets or overlapping secrets would change semantics.
- Keep public API and imports unchanged.

### MODIFY `packages/coding-agent/test/secrets-obfuscator.test.ts`

Append upstream missing test blocks from `devlog/_upstream_gjc/packages/coding-agent/test/secrets-obfuscator.test.ts` after the existing regex/object tests:

- `SecretObfuscator single-pass equivalence`
  - local `placeholder(index)` oracle using Bun xxHash32;
  - `referenceObfuscate()` sequential longest-first oracle;
  - seeded adversarial plain mappings;
  - fallback when replacement/placeholder contains another secret;
  - cross-phase substring overlap.
- `SecretObfuscator sorted mapping cache`
  - old sorted-per-call oracle;
  - longest-first plain mapping output;
  - random plain secret sets;
  - regex-discovered stable/reversible obfuscation.

Imports remain unchanged: `SecretObfuscator` from `../src/secrets/obfuscator` and `compileSecretRegex` from `../src/secrets/regex`.

### MODIFY `packages/coding-agent/src/modes/components/diff.ts`

Port upstream v3 TypeScript diff-render fast path from `devlog/_upstream_gjc/packages/coding-agent/src/modes/components/diff.ts`:

- Add `LONG_LINE_FAST_PATH_LIMIT = 500`.
- Split existing `renderIntraLineDiff()` diffWords implementation into `renderIntraLineDiffWithDiffWords()`.
- Add `renderIntraLineDiffFastPath()`, `renderSingleSpanIntraLineDiff()`, `isWhitespaceOnlyChange()`, `isSingleDiffWordsReplacement()`, `snapPrefixToWhitespaceBoundary()`, `snapEndToWhitespaceBoundary()`, and `isWhitespaceBoundary()`.
- Preserve existing render output semantics; fall back to diffWords for whitespace-only, long/pathological, sub-word, and unsafe boundary cases.

### MODIFY `packages/coding-agent/test/core/diff-oracle.test.ts`

Add upstream missing fixtures to the existing `fixtures` array:

- `single-token replacement fast path`
- `prefix suffix change fast path`
- `whitespace-only change fast path`
- `tabs indent fast path`
- `unicode combining marks fast path`
- `very long line fast path guard`
- `sub-word replacement falls back to diffWords`
- `word boundary spanning replacement`

Keep the existing oracle shape unchanged. Update snapshots with `bun test packages/coding-agent/test/core/diff-oracle.test.ts --update-snapshots` after source/test changes land if the new fixtures create snapshots.

### NEW `packages/coding-agent/test/hindsight-mental-models-lcs.test.ts`

Port upstream LCS parity test from `devlog/_upstream_gjc/packages/coding-agent/test/hindsight-mental-models-lcs.test.ts`:

- Import `diffMentalModelContent` from `@gajae-code/coding-agent/hindsight/mental-models`.
- Include a local legacy dense-DP LCS oracle.
- Verify current, local-edit, repeated-line, ambiguous tie-break, and 1000x1000 fixtures.
- Assert current implementation matches legacy output with `maxLines = 4_000`.

If this test fails, patch `packages/coding-agent/src/hindsight/mental-models.ts` only to restore byte parity with the local legacy dense-DP oracle, then document the source change in the B summary.

## 4. Verification plan

B-stage sequencing:
1. Port `packages/coding-agent/src/secrets/obfuscator.ts`.
2. Port `packages/coding-agent/src/modes/components/diff.ts`.
3. Append secrets and diff-oracle tests.
4. Add the hindsight LCS parity test; patch `mental-models.ts` only if parity fails.
5. Run/update snapshots through the focused Bun test command, then run the focused gates below.
Focused gates:

```bash
bun test packages/coding-agent/test/secrets-obfuscator.test.ts packages/coding-agent/test/core/diff-oracle.test.ts packages/coding-agent/test/hindsight-mental-models-lcs.test.ts
bun biome check packages/coding-agent/src/secrets/obfuscator.ts packages/coding-agent/src/modes/components/diff.ts packages/coding-agent/test/secrets-obfuscator.test.ts packages/coding-agent/test/core/diff-oracle.test.ts packages/coding-agent/test/hindsight-mental-models-lcs.test.ts devlog/_plan/260614_performance/34_p1_5_4_serialization_diff_tests_plan.md
```

Package check if focused gates pass and command time allows:

```bash
bun --cwd=packages/coding-agent run check
```

## 5. Acceptance criteria

- Secrets obfuscator source ports upstream sorted-cache/single-pass plain mapping behavior while preserving sequential fallback semantics for overlapping/reentrant mappings.
- Secrets obfuscator tests cover adversarial longest-first, overlapping replacement, fallback, sorted-cache, random plain mappings, and regex-discovered reversibility.
- Diff renderer source ports upstream TypeScript fast-path helpers while preserving diffWords fallback behavior.
- Diff oracle includes upstream fast-path and fallback fixtures and snapshots are current.
- Hindsight mental-model LCS parity test exists and passes against the shipped `diffMentalModelContent()`; any source patch is limited to byte parity with the legacy dense-DP oracle.

## 6. Risk controls

- Production changes are limited to upstream TypeScript fast-path/cache deltas required by the upstream tests; no native/algorithmic replacement is introduced.
- Snapshot updates are limited to the new diff-oracle fixtures and must be produced by the focused test runner, not hand-authored.
- Hindsight LCS test uses synthetic strings only; no private transcript data.

## 7. Follow-up after this cycle

Continue the active goal with:

1. P1.5.3 targeted `resultDigest()` / staleness parity port.
2. P1.5.2 resident cache lifecycle/manual session-manager merge.
