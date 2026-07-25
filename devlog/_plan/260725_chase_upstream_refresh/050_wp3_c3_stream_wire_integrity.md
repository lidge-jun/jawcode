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

> **A-audit amendments (051 synthesis):** (1) W1 reworded to "validated Anthropic web-search history preservation" — upstream preserves ONLY validated `web_search` server_tool_use/web_search_tool_result blocks, and the change spans types/wire/replay/snapshot, not just the gateway parser; W1 write set expanded accordingly, ordered types/wire → parser/stream/replay → compaction. (2) W2 leaked-thinking descoped to a minimal JWC-native projector (terminal signed-thinking before tool calls in OpenAI Responses); full OMP healer module NOT ported. (3) idle sentinel: shared `normalizeIdleTimeoutMs()` untouched; OpenAI-specific first-event resolver preserves `0`; `model.compat.streamFirstEventTimeoutMs` wired to OpenAI Responses/Completions call sites. (4) W3 cache follows FINAL upstream state: cache payload stores NO `headers` at all (3ab9ef29c superseded c654abc98's selective strip); live headers reconstituted from static catalog/provider config/AuthStorage. (5) W3 refresh write set includes the actual auth-completion call sites (selector-controller.ts:1572, command-dispatch.ts:398). (6) rate-limit owner is `packages/ai/src/rate-limit-utils.ts` (+ central classifier as needed).

### Packet W1 — Anthropic server-tool preservation family (6 anchors, 20.124)

| commit | change | JWC owner |
|---|---|---|
| `07fcec1e6` + `1e25f13c4` + `6aa8c8cfb` | introduce the JWC-native `anthropicServerTool` content representation; preserve validated `web_search` `server_tool_use`/`web_search_tool_result` blocks as typed history (gateway parse site anthropic-messages-server.ts:209, cross-provider replay filtering, snapshot copy); unknown variants degrade via explicit allowlist only | `packages/ai/src/types.ts`, `packages/ai/src/providers/anthropic-messages-server.ts`, `packages/ai/src/providers/anthropic.ts` (replay/transform), snapshot/copy owner |
| `d373a8ab0` + `0e2d2a226` | gateway stream schema/walker emits validated server-tool blocks as typed output; validate preserved web-search history block ID/type pairing | `packages/ai/src/providers/anthropic-messages-server-schema.ts` |
| `b461b8e76` | compaction token collector accounts preserved server-tool blocks (AFTER the representation lands) | `packages/agent/src/compaction/compaction.ts` |

### Packet W2 — stream robustness (4 anchors)

| commit | change | JWC owner |
|---|---|---|
| `ae178422a` | minimal JWC-native projector: in OpenAI Responses, a signed thinking block that appears ONLY in the terminal message (no streamed delta) is projected before tool calls; NOT the full OMP healer module | `packages/ai/src/providers/openai-responses.ts` (+ small util if needed, +test) |
| `21cb04bd3` | OpenAI Responses: retry only safe truncated-stream cases selectively | `packages/ai/src/providers/openai-responses.ts` (+test) |
| `a421ea8ac` + `946b7d9bd` | OpenAI-specific first-event timeout resolver preserving explicit `0` (disable); shared `normalizeIdleTimeoutMs()` UNCHANGED; wire `model.compat.streamFirstEventTimeoutMs` into OpenAI Responses/Completions call sites; tests: compat `0`, explicit option `0`, OpenAI env `0`, positive fallback, global env precedence | `packages/ai/src/utils/idle-iterator.ts` (additive only), `packages/ai/src/providers/openai-responses.ts`, `packages/ai/src/providers/openai-completions.ts` |

### Packet W3 — cache + error classification (3 anchors, 20.081 foundations)

| commit | change | JWC owner |
|---|---|---|
| `3ab9ef29c` + `c654abc98` | FINAL upstream semantics: cache payload stores NO `headers` at all; live model headers reconstitute from static catalog/provider config/AuthStorage; post-login provider-scoped refresh uses existing `refreshProvider(providerId,"online")` wired at the real auth-completion call sites | `packages/ai/src/model-cache.ts`, `packages/ai/src/model-manager.ts` (restore path), `packages/coding-agent/src/modes/controllers/selector-controller.ts`, `packages/coding-agent/src/modes/shared/agent-wire/command-dispatch.ts` |
| `c0ec090a9` | classify 402/balance-exhausted as usage-limit — opaque 402 → usage limit; "balance exhausted" (any status) → usage limit; informative non-quota 402 → NOT usage limit | `packages/ai/src/rate-limit-utils.ts` (+ central classifier if needed, +test) |

## Out of scope

- 20.124 c-bucket 5 anchors (df0e77c58, 8191cf41d, d1cedfe18, 036636d39, 443398a9d) — card amendment exclusion.
- 20.081 providers/catalog slices → cycles 060/070.
- 20.081 no-surface (devin/vibe/auth-gateway-model-list... wait: auth-gateway EXISTS per survey — 505b6fdc3 is import; it lands in cycle 070 registry group), na anchors.

## Accept criteria

- A1: server-tool round-trip test: inbound history with server_tool_use/result survives typed through gateway parse + compaction token count includes it; unknown non-allowlisted variant still degrades safely.
- A2: OpenAI first-event resolver tests: compat `0` → disabled; explicit option `0` → disabled; env `0` → disabled; positive fallback unchanged; global env precedence unchanged.
- A3: model-cache test: a cached model with credential-bearing headers round-trips with NO `headers` in the cache payload; live model regains headers only from static/provider config.
- A4: rate-limit test: 3 cases (opaque 402 → usage-limit; balance-exhausted → usage-limit; informative non-quota 402 → not).
- A5: `bun run check:ts` green; focused tests per slice green; `git diff --check` clean.
