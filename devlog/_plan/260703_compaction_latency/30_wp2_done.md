# WP2 — Cache-Friendly Summarization Prefix (DONE 2026-07-03)

Second PABCD cycle of the compaction-latency goal. Plan: `20_wp2_cache_prefix.md`.
Audit trail: codex gpt-5.5 xhigh full audit FAIL (boundary-gate reliability, modelKey
baseUrl, tsc-vs-bun-check contract) → revisions → delta re-audit PASS ×2 (final boundary
gate round confirmed content-identity rule). Build verified by codex xhigh: NEEDS_FIX
(compact() dropped cachePrefix in its summaryOptions rebuild — real integration bug) →
fixed + threading test with red-green proof. Final micro re-verify self-executed (codex
usage limit) with file:line + red-green evidence.

## Files changed

- `packages/agent/src/compaction/compaction.ts`
  - `summaryModelKey(model)` — endpoint-inclusive identity (`provider|api|id|baseUrl`).
  - `compactionBoundaryMatches(live, boundary)` — slice-gate identity: reference equality
    for ordinary roles (shared `entry.message` objects); role + timestamp + content
    identity for synthesized roles (custom/hookMessage: customType + stringified content;
    branchSummary: fromId + summary; compactionSummary: summary). False positive requires
    an identical-content twin → worst case benign duplication, never context loss.
  - `SummaryOptions.cachePrefix` + cache path in `generateSummary`: replays live
    systemPrompt/tools/message-head verbatim with the summarization instruction as a
    trailing agent-attributed user message (`toolChoice: "none"`), gated on
    modelKey match + api ∈ {anthropic-messages, openai-responses, openai-codex-responses}
    + no generic remoteEndpoint. `<previous-summary>` block retained (update prompt
    references the tag). Serialized `<conversation>` path unchanged as fallback and now
    built lazily (cache path skips the multi-hundred-KB string assembly).
  - compact() summaryOptions forwards `cachePrefix` (the NEEDS_FIX bug).
- `packages/coding-agent/src/session/agent-session.ts`
  - `#buildCompactionCachePrefix(preparation)` — slices `agent.state.messages` by
    `recent + turnPrefix` counts, validates the boundary via `compactionBoundaryMatches`,
    returns undefined (serialized fallback) on any mismatch.
  - Manual (`#compactWithFallbackModel`) and auto candidate loops pass cachePrefix only
    when `summaryModelKey(candidate) === summaryModelKey(session model)` — fallback
    models never get it.
- Tests: `packages/agent/test/compaction-cache-prefix.test.ts` (7 cases: prefix replay
  shape, guard text, previous-summary retention, modelKey fallback, summaryModelKey
  baseUrl, boundary-match matrix); `packages/coding-agent/test/compaction.test.ts` +1
  threading test (red-green proven); `compaction-prefer-current-model.test.ts` +1
  fallback-never-gets-prefix test.

## Verification

- `bun run check` clean in packages/agent + packages/coding-agent (biome + tsgo;
  repo contract AGENTS.md §Commands — note: WP1's C gate used `npx tsc --noEmit` in
  violation of that contract; WP2's gates re-covered both packages with the compliant
  command).
- 8 affected suites: **84 pass / 2 skip / 0 fail**.

## Why this is the big lever

Anthropic places cache breakpoints at last/penultimate user messages of every live
request (anthropic.ts:1729-1804), and auto-compaction fires right after live turns —
so the summarize head is a cached prefix in the common case. History bytes are stable
across thinking settings (signed thinking blocks serialize from message content,
anthropic.ts:2163-2214), so WP1's lowered effort doesn't perturb replay. Uncached
full-context prefill (the dominant remaining cost after WP1) becomes a cache read.

## Residual risks / follow-ups

- Extension `transformContext` divergence → cache miss only (correctness unaffected).
- Cache WRITE surcharge (~25% on uncached spans, Anthropic) on the summarize call,
  offset by post-compaction turns replaying the same head.
- Telemetry follow-up: measure cache-hit ratio (`cacheRead` in the summarize call usage)
  to confirm the win in production; revisit CACHE_PREFIX_APIS if more providers gain
  visible prompt caching.
- Codex-side quota interrupted the final micro re-verify; the deviation is documented
  above with equivalent local evidence.
