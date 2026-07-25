# 050 — wp3 cycle 3: stream/wire integrity + cache safety (20.124 A-slice + 20.081 foundations)

## Stale check (P, 2026-07-26)

Mill's dual-card survey (verified per-anchor against upstream diffs and current tree `da952b3`):

- 20.081: 32 import / 14 already-fixed / 11 no-surface / 3 na (60 anchors)
- 20.124: 9 import / 5 c-bucket (excluded per card amendment) / 1 no-surface (15 anchors)

The combined 41 imports split into three cycles by subsystem (PHASE-SPLIT-01):

| cycle | theme | anchors |
|---|---|---|
| 3 (this) | stream/wire integrity + cache safety | 13 |
| 4 (060) | providers (gemini/cursor/anthropic/openai/kimi/stream) | ~9 |
| 5 (070) | catalog/registry/discovery/auth-storage | ~17 |

## Cycle 3 implement slices

### Packet W1 — Anthropic server-tool preservation family (6 anchors, 20.124)

| commit | change | JWC owner |
|---|---|---|
| `07fcec1e6` + `1e25f13c4` + `6aa8c8cfb` | stop flattening inbound `server_tool_use`/results to placeholder text; preserve web-search-class server-tool blocks as typed history; unknown variants still degrade but via an explicit allowlist, not catch-all | `packages/ai/src/providers/anthropic-messages-server.ts` |
| `d373a8ab0` + `0e2d2a226` | gateway stream schema/walker emits server-tool blocks as typed output; validate preserved web-search history block ID/type pairing | `packages/ai/src/providers/anthropic-messages-server-schema.ts` |
| `b461b8e76` | compaction token collector accounts preserved server-tool blocks | `packages/agent/src/compaction/compaction.ts` |

### Packet W2 — stream robustness (4 anchors)

| commit | change | JWC owner |
|---|---|---|
| `ae178422a` | unstreamed signed-thinking recovery projector (port upstream's leaked-thinking-stream semantics — JWC has streamed signature handling at anthropic.ts:1311-1315 but no unstreamed recovery) | NEW `packages/ai/src/utils/leaked-thinking-stream.ts` (+test) |
| `21cb04bd3` | OpenAI Responses: retry only safe truncated-stream cases selectively | `packages/ai/src/providers/openai-responses.ts` (+test) |
| `a421ea8ac` + `946b7d9bd` | idle-iterator: preserve numeric `0` sentinel (disable) instead of normalizing `<=0` to undefined; OpenAI first-event watchdog honors disable | `packages/ai/src/utils/idle-iterator.ts` (+ OpenAI provider call sites) |

### Packet W3 — cache + error classification (3 anchors, 20.081 foundations)

| commit | change | JWC owner |
|---|---|---|
| `3ab9ef29c` + `c654abc98` | model cache must strip credential-bearing dynamic headers on write/restore; restore only safe static/request-model headers; post-login provider-scoped refresh strips credentials | `packages/ai/src/model-cache.ts` (+ model-registry refresh hook if needed) |
| `c0ec090a9` | classify 402/balance-exhausted as usage-limit status with explicit predicate | `packages/ai/src/error/rate-limit.ts` (+test) |

## Out of scope

- 20.124 c-bucket 5 anchors (df0e77c58, 8191cf41d, d1cedfe18, 036636d39, 443398a9d) — card amendment exclusion.
- 20.081 providers/catalog slices → cycles 060/070.
- 20.081 no-surface (devin/vibe/auth-gateway-model-list... wait: auth-gateway EXISTS per survey — 505b6fdc3 is import; it lands in cycle 070 registry group), na anchors.

## Accept criteria

- A1: server-tool round-trip test: inbound history with server_tool_use/result survives typed through gateway parse + compaction token count includes it; unknown non-allowlisted variant still degrades safely.
- A2: idle-iterator `0` sentinel test: `firstEventWatchdogMs: 0` disables (not undefined→default).
- A3: model-cache test: a cached model with credential-bearing headers round-trips WITHOUT the credentials; safe headers preserved.
- A4: rate-limit test: 402 body variants classify as usage-limit.
- A5: `bun run check:ts` green; focused tests per slice green; `git diff --check` clean.
