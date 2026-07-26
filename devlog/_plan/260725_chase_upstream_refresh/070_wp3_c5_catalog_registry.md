# 070 — wp3 cycle 5: catalog, discovery, and credential identity (20.081 registry slice)

## Stale check (P, 2026-07-26, post-cycle-4 tree)

Re-verified per anchor by sol surveyor (Linnaeus) against the CURRENT tree — cycles 3–4 already touched
`model-cache.ts`, `model-manager.ts`, `types.ts`, six providers, `stream.ts`, `usage/claude.ts`, and
`coding-agent/src/config/model-registry.ts` (alias-collapse fix).

| anchor | class | current evidence | owner |
|---|---|---|---|
| `b9dd5bce8` union OAuth-account catalogs | import | `OpenAICodexModelManagerConfig` exposes singular `accessToken/accountId`, one fetch (`special.ts:11-27`) | special.ts, model-registry.ts |
| `a3a39b1b0` reject partial unions | import | one `fetchCodexModels()` result returned directly (`special.ts:23-27`) | special.ts |
| `dfeaa7aed` abort on failed account refresh | import | single peeked token, no nullable abort contract (`special.ts:11-35`, `model-registry.ts:1791-1815`) | special.ts, model-registry.ts |
| `2eff59e06` preserve token fallback | import | only the selected `accessToken/accountId` is passed (`model-registry.ts:1791-1798`) | model-registry.ts |
| `5ec402fc1` caller fetch + authoritative refresh | import | no caller `fetch`; `peekApiKey` lets an expired token + warm cache skip refresh (`model-registry.ts:1809-1815`) | special.ts, discovery/codex.ts, model-registry.ts |
| `1945734b4` GPT-5.6 372K fallback | import | runtime fallback is globally `272_000` (`discovery/codex.ts:13`) | discovery/codex.ts |
| `62b47dede` authenticated provider, bare ids | import | `resolveCliModel` uses `getAll()` only (`model-resolver.ts:1158-1171`); `main.ts:606-611` passes no authenticated subset | model-resolver.ts, main.ts |
| `e49426c94` authenticated provider, slashful flat ids | import | CLI resolution decomposes the slash before considering authentication (`model-resolver.ts:1183-1196`) | model-resolver.ts, main.ts |
| `505b6fdc3` qualify auth-gateway ids | import | `/v1/models` emits raw `model.id`, ids from different providers collide (`auth-gateway/server.ts:620-628`) | auth-gateway/server.ts |
| `91061fe82` + `2a0d819e7` workspace-scoped Codex identity | import (C4) | identity is bare-email-first (`auth-storage.ts:3484-3490`), replacement compares exact keys (`:3505-3517`), usage dedupe partitions by email (`:2027-2044`) — today one workspace credential can silently REPLACE another | auth-storage.ts, oauth/openai-codex.ts, oauth/types.ts |
| `2625b92da` Anthropic-only sticky idle gate | import | indefinite session pinning for every provider, no idle gate (`auth-storage.ts:2615-2641`) | auth-storage.ts |
| `9d6e8c217` stats overview totals | import | total = input + output only, cache shown separately (`StatsGrid.tsx:21,52-68,90-96`) | stats StatsGrid.tsx |
| `5b798685e` opaque gateway ids | **needs-redesign** | JWC has no catalog identity/reference module or `inheritReferenceThinking`; enrichment is inline in `model-registry.ts:858-931` | deferred |
| `40ea23181`, `bab156183`, `63cac8dfd` LiteLLM trio | **needs-redesign** | LiteLLM delegates straight to generic `/v1/models` (`openai-compat.ts:1584-1603`); there is no rich-metadata discovery, cache namespace, or structured failure result to attach these to — importing fragments would be inert | deferred |
| `c98b1b83d` Moonshot K3 pricing/capability policy | **needs-decision** | importing `$3/$0.30/$15`, 1,048,576 context, 131,072 output stamps monetary + capability claims users see; stale price data is worse than unknown | **user decision — not autonomous** |

Scope: **12 import** implemented; 4 needs-redesign deferred with reasons; 1 needs-decision escalated to the card residual.

## Packets (disjoint production files)

### Q1 — Codex authoritative discovery (ORDERED: `b9dd5bce8` → `a3a39b1b0` → `dfeaa7aed` → `2eff59e06` → `5ec402fc1` → `1945734b4`)

Files: `packages/ai/src/provider-models/special.ts`, `packages/ai/src/utils/discovery/codex.ts`,
`packages/coding-agent/src/config/model-registry.ts` + their focused tests.

Union every configured OAuth account's catalog; a partial union (any account failing) must NOT replace the
effective catalog; a failed account refresh aborts authoritative discovery (nullable contract) instead of
silently narrowing the catalog; the resolved runtime/non-OAuth token stays a fallback; the caller's `fetch`
is threaded through and authoritative refresh is forced rather than `peekApiKey`; the GPT-5.6 family gets a
372K missing-window fallback while other models keep 272K.

### Q2 — model selection + exposed catalog identity (ORDERED: `62b47dede` → `e49426c94`)

Files: `packages/coding-agent/src/config/model-resolver.ts`, `packages/coding-agent/src/main.ts`,
`packages/ai/src/auth-gateway/server.ts` + focused tests.

CLI resolution prefers an AUTHENTICATED provider for both bare and flat slashful ids (pass the authenticated
subset in, do not decompose the slash first); the auth gateway qualifies `/v1/models` ids as `provider/model`
so identical ids from different providers stop colliding.

### Q3 — credential identity + stats (workspace identity FIRST)

Files: `packages/ai/src/auth-storage.ts`, `packages/ai/src/utils/oauth/openai-codex.ts`,
`packages/ai/src/utils/oauth/types.ts`, `packages/stats/src/client/components/StatsGrid.tsx` + focused tests.

Scope Codex credential identity by ChatGPT workspace so two workspaces under one email stop overwriting each
other — **must preserve existing stored rows via migration, never invalidate tokens**; usage dedupe partitions
by workspace too. Anthropic-only 1h idle rerank (Codex stickiness preserved). Stats overview reconciles the
conversation total including cache read/write.

No cross-packet production-file overlap. CHANGELOG.md reserved for main integration.

## Accept criteria (activation-grounded)

- B1 `b9dd5bce8`: workspace A = {Luna, Terra}, workspace B = {Sol, Terra} → union is {Luna, Sol, Terra}, each once.
- B2 `a3a39b1b0`: one account returns models, another fails → prior/bundled catalog retained, no partial replacement.
- B3 `dfeaa7aed`: two stored rows, one refresh transiently fails → no authoritative replacement performed.
- B4 `2eff59e06`: no stored OAuth row but a runtime token resolves → discovery still calls `/models`.
- B5 `5ec402fc1`: expired OAuth + warm cache + injected fetch → credential refreshed, injected fetch used.
- B6 `1945734b4`: GPT-5.6 response without `context_window` → 372K; non-5.6 → 272K.
- B7 `62b47dede`: `gpt-5.5` on several providers, only Codex authenticated → Codex selected.
- B8 `e49426c94`: flat `openai/gpt-oss-120b` on several gateways, only OpenRouter authenticated → OpenRouter selected.
- B9 `505b6fdc3`: two providers expose `shared-model` → gateway returns `provider-a/shared-model` and `provider-b/shared-model`.
- B10 `91061fe82`/`2a0d819e7`: one email in personal + Team workspaces → both rows survive a migration from the old format; usage and discovery stay workspace-separated; **no token invalidated**.
- B11 `2625b92da`: Codex session idle > 1h stays pinned; Anthropic session idle > 1h reranks by usage.
- B12 `9d6e8c217`: input 100, output 20, cache read 300, cache write 40 → overview total reconciles to 460.
- B13: `bun run check:ts` exit 0; ai + coding-agent + stats suites show no NEW failures vs baseline; `git diff --check` clean.

## Residual (card 20.081)

- `5b798685e` opaque gateway ids — needs a JWC-native catalog identity/reference boundary first (not a mechanical import).
- `40ea23181` / `bab156183` / `63cac8dfd` — need LiteLLM rich-metadata discovery architecture first; fragments would be inert.
- `c98b1b83d` Moonshot K3 pricing/capability — **user decision required** (monetary + capability claims shown to users).
