# 060 — wp3 cycle 4: provider transport + identity contracts (20.081 providers slice)

## Stale check (P, 2026-07-26, HEAD `b5811d1`)

Re-verified by sol surveyor (Plato) against the CURRENT tree — required because cycle 3 already modified
`openai-responses.ts`, `openai-completions.ts`, `anthropic.ts`, `anthropic-messages-server*.ts`,
`transform-messages.ts`, `idle-iterator.ts`, `model-cache.ts`, `model-manager.ts`.

| anchor | class | current evidence | owner |
|---|---|---|---|
| `cdebd27dd` | import | empty-stream retry reuses the already-selected `requestUrl` (`google-gemini-cli.ts:552`) instead of failing over to the next Antigravity endpoint (`:316`) | google-gemini-cli.ts |
| `c1b8070ef` | **no-surface** | JWC has no planning-leak buffering/discard mechanism; every text part sets `hasContent` and emits immediately (`google-gemini-cli.ts:411`). Adopting upstream leak suppression would CREATE the surface — out of scope for a chase fix | — |
| `148a48a21` | import | direct H2 connect (`cursor.ts:357`), session/request errors passed through unchanged (`:504`); no ALPN/`ERR_HTTP2_ERROR` mapping | cursor.ts |
| `4a9eaf63b` | import | `turnEnded` resolves before protocol end (`cursor.ts:456`); a clean `end` resolves even with no `turnEnded` (`:495`) | cursor.ts |
| `67ca037b1` | import | enforced fingerprint headers stripped from custom model headers (`anthropic.ts:162`) then overwritten by OAuth defaults (`:181`); no non-official-endpoint override contract | anthropic.ts |
| `242b3866e` | import | Kimi dispatch forwards raw options (`stream.ts:424`), bypassing `mapOptionsForApi` (`:444`), so K3 + `disableReasoning:true` is not clamped | stream.ts |
| `3f5fec0c0` | import | `onPayload` type accepts the request model (`types.ts:363`) but Chat Completions calls it with only `params` (`openai-completions.ts:490`) | openai-completions.ts |
| `aa4386d8c` | **already-fixed** | `effectiveMaxTokens` defaults to catalog `model.maxTokens` (`openai-completions.ts:1124`) and is sent directly (`:1157`); no generic 64K clamp exists in this path | — (characterization test only) |
| `5a54a70e3` | import | organization IDs accepted as accountId fallbacks (`usage/claude.ts:99`), header emitted as both `accountId` and `metadata.orgId` (`:393`) — identities conflated | usage/claude.ts |

Scope: **7 import** implemented this cycle; 1 already-fixed (regression test only); 1 no-surface (recorded residual).

## Packets (disjoint write sets, parallel)

> **A-audit amendments (061 synthesis).** (1) P2 `4a9eaf63b` DEScoped to the safe half: settlement is deferred to
> HTTP/2 protocol end, but a clean end WITHOUT `turnEnded` stays successful — we have no production capture proving
> every gateway/proxy emits `TurnEndedUpdate`, so strict rejection would be an unevidenced compatibility break.
> A characterization test pins today's clean-end-without-turn behavior; strict mode is a tracked residual needing
> real-stream evidence. (2) `67ca037b1` needs a NEW compat field — `packages/ai/src/types.ts` added to P3;
> only an explicit fingerprint-header allowlist is overridable (never `Authorization`/`X-Api-Key`), and redirect
> leakage to the official host must be covered. (3) `242b3866e`: JWC has no mandatory-reasoning metadata
> (`ThinkingConfig` carries effort range/default/mode only), and routing Kimi through `mapOptionsForApi` would
> pre-choose an API dialect — so this cycle uses an explicitly enumerated K3 predicate; the data-driven
> `ThinkingConfig` field is a tracked residual. (4) `3f5fec0c0` expanded to its full upstream surface: OpenAI
> Completions + Amazon Bedrock (P3) and Cursor (P2, to avoid file overlap); remaining model-less call sites
> (Azure Responses, OpenAI Codex Responses, OpenAI Responses) are explicitly classified below. (5) `5a54a70e3`
> precedence fixed explicitly with an undefined-accountId guard. (6) P1 requires a structural endpoint loop, not a
> retry-line substitution. (7) P3 is ONE worker — `3f5fec0c0` and `aa4386d8c` share
> `packages/ai/test/openai-completions-compat.test.ts`.

### P1 — Google stream failover

| anchor | change | files |
|---|---|---|
| `cdebd27dd` | **structural**: hoist endpoint iteration around the empty-stream retry loop (or convert empty-stream exhaustion into a retryable pre-content error consumed by an outer endpoint loop) so failover reaches the NEXT endpoint, not the already-selected `requestUrl` (`:537`/`:552` only knows the selected URL). Invariants: per-endpoint bounded empty-stream budget; failover only BEFORE emitted content; fixed `production`/`sandbox` modes never cross endpoints; terminal policy/output errors never fail over; document the combined HTTP-retry × empty-stream budget cap | `packages/ai/src/providers/google-gemini-cli.ts` + its focused tests |

### P2 — Cursor transport lifecycle (ORDERED: `4a9eaf63b` → `148a48a21`)

| anchor | change | files |
|---|---|---|
| `4a9eaf63b` (partial) | defer settlement to HTTP/2 protocol end so a late protocol error AFTER `turnEnded` still fails the stream. **Do NOT** turn clean-end-without-`turnEnded` into an error this cycle (no evidence every gateway/proxy emits it) — add a characterization test pinning that it still succeeds, plus coverage for fragmented/coalesced frames and `turnEnded` followed by trailers/end | `packages/ai/src/providers/cursor.ts` + tests |
| `148a48a21` | map `ERR_HTTP2_ERROR` / "h2 is not supported" to an actionable ALPN/proxy provider error naming the configured Cursor base URL remedy — routed through the unified settle path from the previous anchor | same |
| `3f5fec0c0` (Cursor slice) | pass the request `Model` into `onPayload` at `cursor.ts:2617` | same |

### P3 — independent provider contracts (no internal ordering)

| anchor | change | files |
|---|---|---|
| `67ca037b1` | NEW `AnthropicCompat.allowAnthropicHeaderOverrides?: boolean`; on a NON-official base URL with the flag, an explicit ALLOWLIST of fingerprint headers may be overridden — `Authorization`/`X-Api-Key` never. Official Anthropic and Cloudflare routes keep rejecting overrides. Tests: official URL case/trailing-slash/`/v1`, Cloudflare, malformed URL, and a custom-host redirect to `api.anthropic.com` (disable redirects for this route or re-filter headers after redirect) | `packages/ai/src/types.ts`, `packages/ai/src/providers/anthropic.ts` |
| `242b3866e` | explicitly enumerated mandatory-reasoning predicate (name the exact provider/model IDs in code + tests) applied before `streamKimi`: K3 with `disableReasoning:true` stays reasoning-enabled at the lowest supported effort. Do NOT route Kimi through `mapOptionsForApi` (it would pre-choose an API dialect) | `packages/ai/src/stream.ts` |
| `3f5fec0c0` (OpenAI + Bedrock slices) | pass the request `Model` as `onPayload`'s second argument at `openai-completions.ts:490` and `amazon-bedrock.ts:215`; assert exact two-argument invocation. Deferred with reason: Azure Responses, OpenAI Codex Responses, OpenAI Responses were not in the upstream anchor's surface — record them in the card residual | `packages/ai/src/providers/openai-completions.ts`, `packages/ai/src/providers/amazon-bedrock.ts` |
| `5a54a70e3` | precedence exactly: payload account/user → stored `credential.accountId` → profile account. Organization stays ONLY in `metadata.orgId` (prefer stored `credential.orgId`). Guard the undefined-accountId path so usage reports are never silently merged or dropped | `packages/ai/src/usage/claude.ts` |
| `aa4386d8c` | characterization test only: Moonshot K3 with catalog 131K emits the full value, not 65_536 | test only |

No cross-packet file overlap. **P3 is a single worker** (`3f5fec0c0` and `aa4386d8c` both touch
`packages/ai/test/openai-completions-compat.test.ts`). CHANGELOG.md is reserved for main integration.

## Accept criteria (activation-grounded, C-ACTIVATION-GROUNDING-01)

- A1 `cdebd27dd`: first Antigravity endpoint returns 200 + empty SSE, second returns content + finish reason → both URLs called, stream succeeds.
- A2 `4a9eaf63b`: (a) `turnEnded` then late protocol error → failure; (b) characterization: clean protocol end with no `turnEnded` still SUCCEEDS; (c) fragmented/coalesced `turnEnded` frames and `turnEnded`-then-trailers both settle correctly.
- A3 `148a48a21`: H2 session emits `ERR_HTTP2_ERROR` "h2 is not supported" → error text explains ALPN/proxy and names the base-URL remedy.
- A4 `67ca037b1`: non-official base URL + flag + allowlisted fingerprint headers → replace defaults; `Authorization`/`X-Api-Key` never overridable; official (case/slash/`/v1`), Cloudflare, malformed URL, and custom→official redirect all reject.
- A5 `242b3866e`: K3 via `streamSimple` with `disableReasoning:true` → captured payload keeps thinking at lowest effort.
- A6 `3f5fec0c0`: `onPayload` second argument is the exact request `Model` for Chat Completions, Bedrock, and Cursor.
- A7 `5a54a70e3`: distinct `anthropic-organization-id` header → `metadata.orgId` = org, `accountId` never sourced from it; cases for credential identity present, profile-only identity, and no account identity at all (no report merged/dropped).
- A8 `aa4386d8c` (characterization): K3 131K catalog → emitted max tokens = 131K.
- A9: `bun run check:ts` exit 0; `bun test packages/ai/test/` no NEW failures vs baseline; `git diff --check` clean.

## Residual

- `c1b8070ef` planning-leak retry: no-surface in JWC — adopting it requires first importing upstream's planning-leak buffering (a feature, not a fix). Recorded in card 20.081 residual.
- Cursor strict `turnEnded` requirement: needs captured production streams (official gateway + one bridge/proxy) proving the protocol invariant before clean-end-without-turn may become an error.
- Data-driven mandatory reasoning (`ThinkingConfig` field + catalog/descriptor generation) instead of the enumerated K3 predicate.
- `onPayload` model argument for Azure Responses, OpenAI Codex Responses, OpenAI Responses (outside the upstream anchor's surface).
