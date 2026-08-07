# 062 — wp3 cycle 4 closeout: provider transport + identity contracts

Outcome: **DONE** (7 import anchors implemented; 1 already-fixed characterized; 1 no-surface recorded).

| phase | evidence |
|---|---|
| P | `060_wp3_c4_provider_contracts.md` — Plato stale check against the post-cycle-3 tree: 7 import / 1 already-fixed (`aa4386d8c`) / 1 no-surface (`c1b8070ef`) |
| A | Franklin GO-WITH-FIXES (6 blockers: 4 High, 2 Medium) → `061` synthesis: cursor strict `turnEnded` descoped to residual, anthropic compat field added to write set, kimi enumerated predicate, `onPayload` widened to 3 call sites, claude precedence pinned, google failover made structural |
| B | Mencius (P1 google), Mill (P2 cursor), Leibniz (P3 contracts) → integration `d29af37`; check:ts exit 0, ai 1792/1792, agent 280/280, coding-agent tools+registry 1288/1288 |
| C | Kierkegaard GO-WITH-FIXES (2 High, one a REPRODUCED header-injection bypass) → fixes `0323809` → same-reviewer re-verify **PASS** (adversarial hostname probe across trailing-dot / percent-encoded dot / Unicode dot / uppercase / port / userinfo / backslash; cursor lifecycle suite ×5) |

## Delivered

- Google Gemini CLI: structural outer endpoint loop so an empty Antigravity stream fails over to the next endpoint; per-endpoint additive retry budget; no failover after any content emission (text, thinking, tool calls, policy stops), fixed `baseUrl` modes stay single-endpoint.
- Cursor: settlement deferred to HTTP/2 protocol end (late error after `turnEnded` now fails the stream) with a bounded `CURSOR_POST_TURN_ENDED_TIMEOUT_MS = 30_000` guard that destroys request+session and clears the heartbeat; `ERR_HTTP2_ERROR` → actionable `CursorTransportError` naming the base-URL remedy; `onPayload` receives the request model.
- Anthropic: `AnthropicCompat.allowAnthropicHeaderOverrides` with a fingerprint allowlist — `Authorization`/`X-Api-Key` never overridable, `redirect: "error"` on the opt-in custom-host route, and canonical hostname normalization (single trailing dot stripped) plus provider-independent Cloudflare gateway detection.
- Kimi: enumerated `kimi-code/kimi-k3` mandatory-reasoning clamp applied to a copied options object; other Kimi ids still honor `disableReasoning`.
- `onPayload` request model for OpenAI Completions, Bedrock, and Cursor.
- Claude usage identity: payload account/user → `credential.accountId` → profile; organization confined to `metadata.orgId`.

## Residual (card 20.081)

- `c1b8070ef` planning-leak retry — no-surface; needs upstream's planning-leak buffering first (a feature, not a fix).
- Cursor strict `turnEnded` requirement — needs captured production streams (official gateway + one bridge/proxy) before clean-end-without-turn may become an error.
- Data-driven mandatory reasoning (`ThinkingConfig` field + catalog generation) instead of the enumerated predicate.
- `onPayload` model argument for Azure Responses, OpenAI Codex Responses, OpenAI Responses (outside the upstream anchor's surface).
