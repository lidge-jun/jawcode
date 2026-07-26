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

### P1 — Google stream failover

| anchor | change | files |
|---|---|---|
| `cdebd27dd` | on an empty Antigravity stream, retry the NEXT endpoint instead of the already-selected `requestUrl`; exhaustion still surfaces the existing empty-response error | `packages/ai/src/providers/google-gemini-cli.ts` + its focused tests |

### P2 — Cursor transport lifecycle (ORDERED: `4a9eaf63b` → `148a48a21`)

| anchor | change | files |
|---|---|---|
| `4a9eaf63b` | defer success until HTTP/2 protocol end AND `turnEnded` was observed: late protocol error after `turnEnded` must fail; clean `end` without `turnEnded` must raise an incomplete-stream error | `packages/ai/src/providers/cursor.ts` + tests |
| `148a48a21` | map `ERR_HTTP2_ERROR` / "h2 is not supported" to an actionable ALPN/proxy provider error naming the configured Cursor base URL remedy — routed through the unified settle path from the previous anchor | same |

### P3 — independent provider contracts (no internal ordering)

| anchor | change | files |
|---|---|---|
| `67ca037b1` | explicit override contract: on a NON-official Anthropic OAuth base URL with the override compat flag, custom fingerprint headers replace defaults; official Anthropic and Cloudflare routes keep rejecting overrides | `packages/ai/src/providers/anthropic.ts` |
| `242b3866e` | Kimi dispatch honors mandatory-reasoning models: K3 with `disableReasoning:true` stays reasoning-enabled at the lowest supported effort | `packages/ai/src/stream.ts` |
| `3f5fec0c0` | pass the request `Model` as `onPayload`'s second argument (type already allows it), including the model-less SDK transport path | `packages/ai/src/providers/openai-completions.ts` |
| `5a54a70e3` | separate account identity from organization: `metadata.orgId` keeps the organization; `accountId` resolves only from account/user/profile/credential identity | `packages/ai/src/usage/claude.ts` |
| `aa4386d8c` | characterization test only: Moonshot K3 with catalog 131K emits the full value, not 65_536 | test only |

No cross-packet file overlap. CHANGELOG.md is reserved for main integration.

## Accept criteria (activation-grounded, C-ACTIVATION-GROUNDING-01)

- A1 `cdebd27dd`: first Antigravity endpoint returns 200 + empty SSE, second returns content + finish reason → both URLs called, stream succeeds.
- A2 `4a9eaf63b`: (a) `turnEnded` then late protocol error → failure; (b) clean protocol end with no `turnEnded` → incomplete-stream error.
- A3 `148a48a21`: H2 session emits `ERR_HTTP2_ERROR` "h2 is not supported" → error text explains ALPN/proxy and names the base-URL remedy.
- A4 `67ca037b1`: non-official OAuth base URL + override flag + custom fingerprint headers → headers replace defaults; official/Cloudflare routes still reject.
- A5 `242b3866e`: K3 via `streamSimple` with `disableReasoning:true` → captured payload keeps thinking at lowest effort.
- A6 `3f5fec0c0`: Chat Completions `onPayload` second argument is the exact request `Model`, incl. model-less SDK path.
- A7 `5a54a70e3`: distinct `anthropic-organization-id` header → `metadata.orgId` = org, `accountId` never sourced from it.
- A8 `aa4386d8c` (characterization): K3 131K catalog → emitted max tokens = 131K.
- A9: `bun run check:ts` exit 0; `bun test packages/ai/test/` no NEW failures vs baseline; `git diff --check` clean.

## Residual

- `c1b8070ef` planning-leak retry: no-surface in JWC — adopting it requires first importing upstream's planning-leak buffering (a feature, not a fix). Recorded in card 20.081 residual.
