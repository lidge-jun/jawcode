# WP2 — 10.062 DeepInfra provider + service-tier · Gemini CLI UA alignment (diff-level plan)

> Goal `f8909338-255` · card `struct_har/chase/10.062_gjc_chase_ai_provider_deepinfra_gemini_ua.md` (IMPORT).
> GJC src: `68179e2d` (DeepInfra+service-tier #1314), `b200fc0e` (Gemini UA align #1284).
> JWC worktree HEAD `cf74114`. Project root `/Users/jun/Developer/new/700_projects/jawcode`.

## Why
JWC `packages/ai/` lacks a DeepInfra provider and carries a stale Gemini CLI UA (`0.45.2`, env `PI_AI_GEMINI_CLI_VERSION` only). Two additive reconciles: (1) DeepInfra OpenAI-compatible provider + restricted `priority` service-tier; (2) Gemini UA version bump + env alias + spoofed-version guard regex update.

## Ground Truth (JWC anchors verified)
- `packages/ai/src/utils/oauth/api-key-login.ts:40` `createApiKeyLogin` + `models-endpoint` validation present.
- `packages/ai/src/utils/oauth/index.ts:64` builtin `deepseek` provider; `:323-360` refresh switch api-key group (deepseek absent here → falls to default? — DeepInfra goes in api-key passthrough group near `cerebras`:338).
- `packages/ai/src/utils/oauth/types.ts:17` OAuthProvider union has `deepseek`.
- `packages/ai/src/provider-models/descriptors.ts:158` `catalogDescriptor("deepseek", ..., catalog("DeepSeek", ["DEEPSEEK_API_KEY"]))`.
- `packages/ai/src/provider-models/openai-compat.ts:687` `deepseekModelManagerOptions` via `createSimpleOpenAICompletionsOptions`; `:2207` `MODELS_DEV_PROVIDER_DESCRIPTORS_CORE`; `:2244` `openAiCompletionsDescriptor("deepseek", ...)`.
- `packages/ai/src/types.ts:120` KnownProvider has `deepseek`; `:232` `shouldSendServiceTier` openai/openai-codex gate; `getPriorityPremiumRequests` openai/codex/anthropic.
- `packages/ai/src/auth-storage.ts:1514` `case "deepseek"`; `saveApiKeyCredential` helper `:1361`.
- `packages/ai/src/stream.ts:99` `deepseek: "DEEPSEEK_API_KEY"` in serviceProviderMap.
- `packages/ai/src/cli.ts:112` `deepseek  DeepSeek` providers help.
- `packages/ai/src/models.json` 47 providers, `deepinfra` absent, `deepseek` present.
- `packages/ai/src/providers/google-gemini-headers.ts:7` `process.env.PI_AI_GEMINI_CLI_VERSION || "0.45.2"`.
- `scripts/check-spoofed-versions.ts:54` `sourcePattern: /PI_AI_GEMINI_CLI_VERSION\s*\|\|\s*"(\d+\.\d+\.\d+)"/`.

## Design (diff-level, JWC-adapted not 1:1)

### Slice 2A — DeepInfra provider (additive)
1. NEW `packages/ai/src/utils/oauth/deepinfra.ts` — `loginDeepInfra = createApiKeyLogin({providerLabel:"DeepInfra", authUrl, instructions, promptMessage, placeholder:"sk-...", validation:{kind:"models-endpoint", provider:"DeepInfra", modelsUrl:"https://api.deepinfra.com/v1/openai/models"}})`. Mirror existing JWC api-key login files.
2. `utils/oauth/index.ts` — add `{id:"deepinfra", name:"DeepInfra", available:true}` to builtin list (near deepseek/xai); add `case "deepinfra":` to api-key passthrough refresh group (near `cerebras`:338).
3. `utils/oauth/types.ts` — add `| "deepinfra"` to OAuthProvider union.
4. `provider-models/openai-compat.ts` — add `DeepInfraModelManagerConfig` + `deepinfraModelManagerOptions` → `createSimpleOpenAICompletionsOptions("deepinfra", "https://api.deepinfra.com/v1/openai", config)` after deepseek block; add `openAiCompletionsDescriptor("deepinfra", "deepinfra", "https://api.deepinfra.com/v1/openai")` to MODELS_DEV core.
5. `provider-models/descriptors.ts` — import `deepinfraModelManagerOptions`; add `catalogDescriptor("deepinfra", "deepseek-ai/DeepSeek-V3.2", config => deepinfraModelManagerOptions(config), catalog("DeepInfra", ["DEEPINFRA_API_KEY"]))`.
6. `types.ts` — add `| "deepinfra"` to KnownProvider; in `shouldSendServiceTier` add `if (provider === "deepinfra") return resolved === "priority";` before the openai gate; in `getPriorityPremiumRequests` add `|| provider === "deepinfra"`. Update doc comments to "OpenAI-compatible".
7. `auth-storage.ts` — import `loginDeepInfra`; add `case "deepinfra": { const apiKey = await loginDeepInfra(ctrl); await saveApiKeyCredential(apiKey); return; }`.
8. `stream.ts` — add `deepinfra: "DEEPINFRA_API_KEY"` to serviceProviderMap.
9. `cli.ts` — add `deepinfra  DeepInfra` to providers help.
10. `models.json` — additive merge DeepInfra catalog block (GJC +596 lines, top-level `"deepinfra": {...}`). MUST NOT clobber existing JWC entries; insert key only, preserve all others. Verify with json round-trip (key count 47→48, all prior keys intact).
11. `docs/environment-variables.md` + `docs/models.md` — add `DEEPINFRA_API_KEY` row + DeepInfra models doc (adapt naming).

### Slice 2B — Gemini UA alignment
1. `providers/google-gemini-headers.ts` — export `GEMINI_CLI_VERSION_ENV="PI_AI_GEMINI_CLI_VERSION"` (JWC keeps its own env name — naming contract; GJC used `GJC_AI_GEMINI_CLI_VERSION`), `DEFAULT_GEMINI_CLI_VERSION="0.49.0"`; rewrite `getGeminiCliUserAgent` to read `process.env[GEMINI_CLI_VERSION_ENV] || DEFAULT_GEMINI_CLI_VERSION`. (JWC has single env, no legacy alias needed — confirm during B.)
2. `scripts/check-spoofed-versions.ts:54` — update sourcePattern to `/DEFAULT_GEMINI_CLI_VERSION\s*=\s*"(\d+\.\d+\.\d+)"/`.
3. NEW `packages/ai/test/google-gemini-cli-user-agent.test.ts` — default version 0.49.0 + env override (adapt to JWC env name).

## Invariants
- 0 `gjc`/`gajae`/`GJC_AI_` literals in new/changed lines (JWC keeps `PI_AI_` env names per current code; do not introduce GJC env).
- models.json additive only — no existing provider/model key removed or mutated.
- DeepInfra service-tier: only `priority` forwarded; `flex`/`scale`/`auto`/`default` dropped.
- No behavior change to existing providers.

## Acceptance
| # | criterion | evidence |
|---|---|---|
| 1 | DeepInfra login + provider wired | tsgo + `issue-1313-deepinfra`-style test adapted, or auth-storage type-check |
| 2 | service-tier priority only | `service-tier-premium-requests.test.ts` +deepinfra assertions pass |
| 3 | Gemini UA default 0.49.0 + override | new gemini UA test pass |
| 4 | spoofed-version guard regex matches new const | grep/script dry check |
| 5 | models.json intact additive | json round-trip key count 47→48 |
| 6 | naming clean / types / lint | rg + tsgo + biome |

## Verification
```bash
bun test packages/ai/test/service-tier-premium-requests.test.ts
bun test packages/ai/test/google-gemini-cli-user-agent.test.ts
bun test packages/ai/test/issue-1313-deepinfra.test.ts   # if adapted
cd packages/ai && bun run check:types
bunx biome check <files>
git diff -U0 ... | rg '^\+' | rg -i 'gjc|gajae|GJC_AI'
git diff --check
```

## PABCD plan
- P(this) → A(independent review: DeepInfra union exhaustiveness across all switch sites, service-tier semantics, models.json non-clobber, Gemini env-name naming-contract decision) → B(impl 2A+2B + tests) → C(focused tests + check:types + diff) → D(summary + card _fin).

## Depends / feeds
- depends: 10.054 (_fin), 10.036 (provider/auth/catalog, _fin).
- feeds: card 10.062 closure → next WP3 (20.023 providers/catalog/service-tier).
