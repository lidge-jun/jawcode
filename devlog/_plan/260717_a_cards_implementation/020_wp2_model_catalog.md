# 020 — WP2: Model Catalog/Selection

5 cards: 10.083, 10.097, 10.099, 20.055, 20.067

## 10.083 — GPT-5.6 backend persistence
- MODIFY: `packages/ai/src/provider-models/descriptors.ts` (Sol/Terra/Luna entries)
- MODIFY: `packages/ai/scripts/generate-models.ts` (373K context normalization)
- MODIFY: `packages/coding-agent/src/config/model-registry.ts` (preset migration)
- REGENERATE: `packages/ai/src/models.json`
- VERIFY: `bun run generate-models && tsc --noEmit`

## 10.097 — coordinator mpreset authority
- MODIFY: `packages/coding-agent/src/coordinator/` (preset resolution at spawn)
- MODIFY: `packages/coding-agent/src/config/model-resolver.ts` (fail-closed unknown profiles)
- VERIFY: coordinator spawn test with invalid preset

## 10.099 — durable selection atomicity
- MODIFY: `packages/coding-agent/src/config/model-resolver.ts` (atomic save/rollback)
- MODIFY: session state persistence (thinking-level persistence)
- VERIFY: rollback test on failed selection

## 20.055 — perf tracking backend
- NEW: `packages/coding-agent/src/config/model-performance.ts` (persistent perf tracking)
- MODIFY: `packages/coding-agent/src/config/model-resolver.ts` (perf-aware resolution)
- VERIFY: perf data persistence across sessions

## 20.067 — usage classifier/spend-limit
- MODIFY: `packages/ai/src/` (spend-limit classification in quota parser)
- MODIFY: provider auth (classifier composition protection)
- NEW: spend-limit regression test (429 vs persistent)
- VERIFY: classifier fixture coverage
