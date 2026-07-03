# Phase 10: Wire buildRequest + Remove Legacy Cache Refs

## Current state (partial B from prior aborted turn)
- New functions ALREADY in `anthropic.ts` lines 45-225: `resolveCacheControl`, `withCacheControl`, `applyPromptCaching`, `enforceCacheControlLimit`, `normalizeTtlOrdering`, helpers
- `types.ts`: `OcxConfig.cacheRetention` field ALREADY added (line 265-266)
- OLD refs still in `buildRequest`: `EPHEMERAL_CACHE_CONTROL`, `withPromptCache` — these are undefined now, file won't compile

## Changes

### MODIFY `../opencodex/src/adapters/anthropic.ts`

1. **`toolsToAnthropicFormat`** (~line 421): Remove `withPromptCache(converted[last])`. Cache marking is now done centrally by `applyPromptCaching` after body assembly — no inline marking.

2. **`createAnthropicAdapter`** — add `cacheRetention` parameter:
   ```ts
   export function createAnthropicAdapter(
     provider: OcxProviderConfig,
     cacheRetention?: "none" | "short" | "long",
   ): ProviderAdapter
   ```

3. **`buildRequest`** body assembly (~lines 441-449):
   - Remove `body.cache_control = EPHEMERAL_CACHE_CONTROL` (top-level `cache_control` is not a Messages API field)
   - Remove `withPromptCache(...)` calls from system block construction — just use plain `{ type: "text", text: system }`
   - After body is fully assembled (tools, system, messages, reasoning, tool_choice), call:
     ```ts
     const cc = resolveCacheControl(cacheRetention);
     applyPromptCaching(body, cc);
     enforceCacheControlLimit(body);
     normalizeTtlOrdering(body);
     ```

4. **Cleanup**: Remove dead `withCacheControl` if unused after wiring.

### MODIFY `../opencodex/src/server/adapter-resolve.ts`

Change the Anthropic case to pass config through:
```ts
// resolveAdapter gains an optional cacheRetention param
export function resolveAdapter(providerConfig: OcxProviderConfig, cacheRetention?: "none" | "short" | "long") {
  case "anthropic":
    return createAnthropicAdapter(providerConfig, cacheRetention);
```

### MODIFY `../opencodex/src/server.ts`

At the `resolveAdapter` callsite (~line 359):
```ts
const adapter = resolveAdapter(adapterProvider, config.cacheRetention);
```

## Acceptance Criteria

1. **Compile**: `bun check` passes (no TS errors on `../opencodex`)
2. **Existing tests**: `bun test` passes
3. **`cacheRetention = "none"`**: No `cache_control` on any block
4. **`cacheRetention = "short"` (default)**: `{ type: "ephemeral" }` on up to 4 blocks
5. **`cacheRetention = "long"`**: `{ type: "ephemeral", ttl: "1h" }` on up to 4 blocks
6. **4-breakpoint cap**: Never more than 4 `cache_control` entries
7. **TTL ordering**: No `ttl: "1h"` after a `ttl`-less (5-min) breakpoint
8. **External skip**: If messages already have `cache_control`, skip all marking
9. **Focused test**: At least one test file covering invariants 3-8
