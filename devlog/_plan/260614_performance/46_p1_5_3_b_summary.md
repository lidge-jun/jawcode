# P1.5.3 B summary — pruning digest/staleness

## Implementation

- `packages/agent/src/compaction/pruning.ts`
  - Added bounded digest-aware pruned notices for `bash`, `search`, and `grep`.
  - Preserved generic notice text for non-digest tools.
  - Changed candidate flow so `tokensSaved` uses actual notice length.
  - Preserved `pruneToolOutputs(entries, config, encoding?)` and the `countMessageTokensNative(..., encoding)` branch.
  - Added `*** Add File:` parsing to patch-envelope touched files.

- `packages/agent/test/pruning-redteam.test.ts`
  - Added digest-capable bash/search assertions.
  - Updated generic exact-notice cases to non-digest tools.
  - Added `tokensSaved` assertion using the actual mutated notice lengths.

- `packages/agent/test/pruning-staleness.test.ts`
  - Added Add File envelope coverage.
  - Existing coverage retained: selector stripping, Move to destination, failed per-file results, resolve/ast_edit details, and search defaults.

- `devlog/_plan/260614_performance/04_verification_matrix.md`
  - P1.5.3 row now reflects digest-aware pruning/staleness parity, not absent token-cache tests.

- `devlog/_plan/260614_performance/23_p1_5_upstream_v3_merge_plan.md`
  - P1.5.3 verification row now lists the three pruning tests in this slice.

## Staleness parity evidence map

- Selector stripping: existing `packages/agent/test/pruning-staleness.test.ts` selector-qualified read test.
- Add File: newly added `packages/agent/test/pruning-staleness.test.ts` Add File envelope test.
- Move to: existing `packages/agent/test/pruning-staleness.test.ts` rename destination test.
- Failed per-file grouping: existing `packages/agent/test/pruning-staleness.test.ts` failed per-file tests.
- Search defaults: existing `packages/agent/test/pruning-staleness.test.ts` search pagination/result-shaping tests.

## Encoding path note

No existing runtime-safe test utility exposes a real `Encoding` fixture in `packages/agent/test`. The implementation preserved the `encoding?: Encoding` signature and the `countMessageTokensNative(message as AgentMessage, encoding)` branch unchanged; package typecheck passed. This is the named B-stage waiver required by the plan and must be cited in C-stage.

## Verification

- `bun test packages/agent/test/pruning-redteam.test.ts packages/agent/test/pruning-staleness.test.ts packages/agent/test/pruning-staleness-redteam.test.ts` — PASS, 45 tests / 158 expects.
- `bun biome check packages/agent/src/compaction/pruning.ts packages/agent/test/pruning-redteam.test.ts packages/agent/test/pruning-staleness.test.ts packages/agent/test/pruning-staleness-redteam.test.ts devlog/_plan/260614_performance/41_p1_5_3_pruning_digest_plan.md devlog/_plan/260614_performance/04_verification_matrix.md devlog/_plan/260614_performance/23_p1_5_upstream_v3_merge_plan.md` — PASS.
- `bun --cwd=packages/agent run check` — PASS.
