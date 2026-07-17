# 010 — WP1: Provider Safety Foundation

5 cards: 10.090, 10.089, 10.105, 10.106, 20.053

## 10.090 — dead-shim migration
- MODIFY: `packages/coding-agent/src/tools/tool-index.ts` (delete 4 deprecated shims)
- MODIFY: `packages/coding-agent/src/agent-session.ts`, `search-tool-bm25.ts`, `sdk.ts`, `discoverable-tool-metadata.ts` (caller migration to generic)
- VERIFY: `rg "getDiscoverableMCPTool\|collectDiscoverableMCPTools" packages/` → 0 hits

## 10.089 — sticky fallback chains
- MODIFY: `packages/ai/src/providers/` (fallback chain controller)
- MODIFY: `packages/coding-agent/src/config/model-resolver.ts` (sticky session selection)
- NEW: focused test for fallback chain stickiness
- VERIFY: `bun test` model-resolver tests

## 10.105 — routing/availability cache
- MODIFY: `packages/coding-agent/src/config/model-registry.ts` (availability cache)
- MODIFY: `packages/coding-agent/src/config/model-resolver.ts` (cache-aware resolution)
- VERIFY: adversarial test: refresh doesn't replace sticky selection

## 10.106 — credential persistence safety
- MODIFY: `packages/coding-agent/src/config/config-file.ts` (atomic write)
- MODIFY: `packages/ai/src/utils/oauth/` (credential authority contract)
- VERIFY: crash-mid-write recovery test

## 20.053 — rotation/serialization/isolation
- MODIFY: `packages/ai/src/utils/oauth/` (serialized refresh, rotation)
- MODIFY: `packages/ai/src/providers/` (stale sticky clearing)
- NEW: perplexity bearer isolation test
- VERIFY: concurrent refresh race test
