# 003 — Provider Auth Flow

JWC provider auth is layered. A provider can be authenticated by runtime override, stored API key, stored OAuth credential, env var, custom `models.yml` provider config, broker snapshot, local import, or a keyless sentinel.

## Global Resolution Order

`docs/models.md` verifies the user-facing API key order:

1. Runtime override, usually CLI `--api-key`.
2. Stored API key credential in `agent.db`.
3. Stored OAuth credential in `agent.db`, including refresh.
4. Environment variable mapping such as `OPENAI_API_KEY`, `ANTHROPIC_API_KEY`, or `GEMINI_API_KEY`.
5. `ModelRegistry` fallback resolver from `models.yml` provider `apiKey`, with env-name-or-literal semantics.

Broker mode replaces the local SQLite credential store with `RemoteAuthCredentialStore` when `JWC_AUTH_BROKER_URL` or `auth.broker.url` is set. Broker snapshot refresh uses redacted refresh tokens and a remote refresh endpoint.

Important nuance: `models.yml` provider `apiKey` is registered through `AuthStorage.setConfigApiKey()`, so it can beat broker-resolved OAuth without overriding runtime `--api-key`.

## Auth Source Files

| owner | path |
|---|---|
| stored credentials and resolution | `packages/ai/src/auth-storage.ts` |
| broker client/server/wire schema | `packages/ai/src/auth-broker/` |
| auth gateway endpoints | `packages/ai/src/auth-gateway/` |
| provider-specific transports | `packages/ai/src/providers/` |
| OAuth utilities and local imports | `packages/ai/src/utils/oauth/`, `packages/ai/src/utils/discovery/` |
| user env docs | `docs/environment-variables.md` |
| user model/auth docs | `docs/models.md` |

The requested grep over `packages/ai/src/auth*` confirmed `auth-storage.ts` has runtime/config API key setters and login flows for provider credentials:

```text
auth-storage.ts:795 setRuntimeApiKey(provider, apiKey)
auth-storage.ts:816 setConfigApiKey(provider, apiKey)
auth-storage.ts:1362 saveApiKeyCredential(...)
auth-storage.ts:1388 loginAlibabaCodingPlan(...)
auth-storage.ts:1477 loginHuggingface(...)
auth-storage.ts:1484 loginOpenCode(...)
auth-storage.ts:1490 loginLmStudio(...)
auth-storage.ts:1496 loginOllama(...)
```

## Provider Flows

| provider family | credential modes | verified anchors | notes |
|---|---|---|---|
| OpenAI API | `OPENAI_API_KEY`, runtime override, custom provider `apiKey` | `docs/environment-variables.md` row for `OPENAI_API_KEY`; `providers/openai-responses.ts`; `providers/openai-completions.ts` | Base URL overrides keep the bundled Responses transport unless custom config selects another API. |
| OpenAI Codex | opaque Codex auth, auth storage, Codex discovery | `providers/openai-codex-responses.ts`; `providers/openai-codex/`; generator imports Codex discovery and constants | Do not treat Codex opaque tokens as normal `OPENAI_API_KEY`. |
| Anthropic | `ANTHROPIC_FOUNDRY_API_KEY`, `ANTHROPIC_OAUTH_TOKEN`, `ANTHROPIC_API_KEY` | `docs/environment-variables.md` rows and Anthropic precedence note; `providers/anthropic.ts` | Foundry mode changes precedence; otherwise OAuth token precedes API key. |
| Gemini / Google | `GEMINI_API_KEY`, Google/Vertex config, Antigravity OAuth | `docs/environment-variables.md` row for `GEMINI_API_KEY`; `providers/google*.ts`; `utils/discovery/antigravity.ts` | Keep AI Studio, Gemini CLI, Antigravity, and Vertex separate. |
| xAI / Grok | `XAI_API_KEY` plus local/OAuth-adjacent paths where implemented | `docs/environment-variables.md` row for `XAI_API_KEY`; `providers/openai-compat.ts`; usage code | OCX has richer xAI proxy routing; JWC native patches still need JWC auth tests. |
| DeepSeek / DeepInfra | `DEEPSEEK_API_KEY`, `DEEPINFRA_API_KEY` | `docs/environment-variables.md`; descriptor env vars | OpenAI-compatible providers with provider-specific catalog metadata. |
| Fugu/Sakana | not native JWC | no `KnownProvider` entry | Candidate gap only; add provider id, descriptor/default, auth docs, and tests before using as native. |
| Local providers | keyless or optional dummy key | `docs/models.md` keyless section; env rows for `OLLAMA_API_KEY`, `LM_STUDIO_API_KEY`, `LLAMA_CPP_API_KEY`, `VLLM_API_KEY` | JWC native `KnownProvider` includes `ollama`, `lm-studio`, and `vllm`; docs mention llama.cpp for custom/local use, but it is not a native `KnownProvider`. |
| Gateways/proxies | provider API key, custom `models.yml`, base URL overrides | env rows for `OPENROUTER_API_KEY`, `KILO_API_KEY`, `AI_GATEWAY_API_KEY`, `CLOUDFLARE_AI_GATEWAY_API_KEY`, `LITELLM_API_KEY` | Gateway docs must match actual code-supported env/config keys. |
| AWS Bedrock | AWS credential chain | `providers/amazon-bedrock.ts`; docs models Bedrock section | Do not model Bedrock as a `models.yml` API-key provider. |
| GitHub Copilot / GitLab Duo / Cursor / Kiro | product-specific tokens, OAuth, or imports | env rows for Copilot/GitLab/Cursor; `providers/github-copilot-headers.ts`; `providers/gitlab-duo.ts`; `providers/cursor.ts`; `providers/kiro.ts` | Treat as product auth adapters, not generic OpenAI-compatible providers. |

## Environment Variable Index

The requested env grep confirmed these core rows in `docs/environment-variables.md`:

```text
ANTHROPIC_OAUTH_TOKEN
ANTHROPIC_API_KEY
ANTHROPIC_FOUNDRY_API_KEY
OPENAI_API_KEY
GEMINI_API_KEY
XAI_API_KEY
AZURE_OPENAI_API_KEY
DEEPSEEK_API_KEY
```

Additional verified provider rows include `DEEPINFRA_API_KEY`, `LITELLM_API_KEY`, `OLLAMA_API_KEY`, `LM_STUDIO_API_KEY`, `LLAMA_CPP_API_KEY`, `OPENROUTER_API_KEY`, `MISTRAL_API_KEY`, `ZAI_API_KEY`, `MINIMAX_API_KEY`, `MINIMAX_CODE_API_KEY`, `OPENCODE_API_KEY`, `QWEN_OAUTH_TOKEN`, `QWEN_PORTAL_API_KEY`, `ZENMUX_API_KEY`, `VLLM_API_KEY`, `CURSOR_ACCESS_TOKEN`, `AI_GATEWAY_API_KEY`, `CLOUDFLARE_AI_GATEWAY_API_KEY`, `ALIBABA_CODING_PLAN_API_KEY`, `KILO_API_KEY`, `OLLAMA_CLOUD_API_KEY`, and `GITLAB_TOKEN`.

When adding a provider, document an env var only after code uses it.

## Codex Opaque Tokens

OpenAI Codex provider auth is separate from normal OpenAI API-key auth. JWC declares `openai-codex` in `KnownProvider`, sets its default in `DEFAULT_MODEL_PER_PROVIDER`, and uses dedicated `providers/openai-codex-responses.ts` plus `providers/openai-codex/`.

OMP current deltas include Codex credential rotation and opaque-key changes. Compare before adopting, because JWC already has a distinct Codex transport/auth path.

## 2026-07-17 Auth, Reasoning, and Safety Delta

The current reviewed ranges extend the auth contract beyond key precedence. Credential identity, refresh serialization, reasoning egress, endpoint eligibility, provider safety stops, and persistent spend limits must remain separate classifications.

| contract | upstream evidence | JWC adoption rule |
|---|---|---|
| automatic credential rotation | OMP `6ae7cdbf9`, `0ab90f63e` | Rotate after a credential is explicitly invalidated or quota-blocked, preserving provider/account identity and a bounded attempt set. |
| serialized OAuth refresh | OMP `792f75298`, `e858c1be6` | Serialize refresh per credential identity and retain the targeted row when concurrent refreshes race. Never let a later stale write replace a newer token. |
| org-scoped identity | OMP `044d722a3` | Include organization scope in Anthropic credential identity and broker routing so tokens from different orgs cannot collapse into one row. |
| stale session cleanup and fallback | OMP `7029789e7`, `7cef4a769` | Clear stale OAuth stickies before fallback while preserving login reachability when no model credential is available (GJC `08c58a87a`). |
| reasoning egress gating | GJC `9036b594e`, `f912eddcf` | Fail closed for unmarked Responses reasoning and serialize reasoning/summary queues before any provider egress. |
| provider safety stop classification | GJC `5331bdb29` | Normalize safety stops across transports as terminal provider policy outcomes, distinct from transient retry and prompt validation. |
| managed fallback authority | GJC `e0b4b0ee7` | Keep local managed-fallback failures outside provider authority so they cannot be reported as provider safety or quota decisions. |
| Vertex effort gating | OMP `ae0d5054d`, `80815af78` | Send Anthropic Vertex effort beta fields only when the effective endpoint supports them; sanitize fallback effort otherwise. |
| legacy Anthropic endpoint gating | OMP `375e89099`, `4b3ec660f` | Restrict legacy beta behavior to official endpoints and disable eager streaming for unsupported custom Anthropic routes. |
| header isolation | OMP `188985eb0` | Build provider header defaults per effective transport. Do not leak one provider or endpoint's auth/feature headers into another. |
| spend-limit classification | OMP `2faa345d1`, `e3a7ec880` | Treat confirmed spend limits as persistent usage limits, not transient rate limits, and retain the classifier through quota parsing. |
| login snapshot validation | OMP `b0d04e517` | Validate login-sourced API-key snapshots at the wire boundary without rejecting their legitimate credential shape. |

Provider stream failures remain transport errors. OMP D10 evidence (`5a7f10780`, `408641822`, `b3145170a`, `54af1c03f`, `51cc34ac6`, `fabded89e`) requires preserving partial tool-call integrity and surfacing the provider failure to ACP/interactive clients instead of silently rotating credentials.

Auth delta checklist:

- [ ] Key refresh/rotation by provider, account, and organization identity.
- [ ] Serialize refresh writes and test stale-row races.
- [ ] Gate reasoning, effort, beta headers, and eager streaming by the effective endpoint.
- [ ] Keep `invalid_prompt`, safety stop, spend limit, quota, local fallback failure, and transport failure as distinct error classes.
- [ ] Validate broker/login snapshots without logging or persisting raw secrets in evidence.

## Provider Auth Patch Checklist

- [ ] Identify the provider's auth class: API key, OAuth, opaque token, AWS chain, keyless local, proxy-forwarded, or product-token import.
- [ ] Add/update env docs only for code-supported env vars.
- [ ] Update auth storage/broker only with focused precedence and redaction tests.
- [ ] Confirm `ModelRegistry.getAvailable()` filters models correctly with and without credentials.
- [ ] Confirm `/model` role assignment rejects unauthenticated non-keyless models and preserves local keyless providers.
- [ ] Do not store raw secrets in docs, tests, chase cards, or generated fixtures.

## Verification

Commands run:

```bash
rg -n "authStorage|authBroker|oauthFlow|apiKey" packages/ai/src/auth* --type ts | head -20
rg -n "OPENAI_API_KEY|ANTHROPIC_API_KEY|GEMINI_API_KEY|XAI_API_KEY|DEEPSEEK_API_KEY" docs/environment-variables.md | head -15
sed -n '523,551p' docs/models.md
sed -n '35,90p' docs/environment-variables.md
```

Confirmed:

- `auth-storage.ts` exposes runtime and config API-key override paths and provider login/save flows.
- `docs/models.md` states runtime override, stored API key, stored OAuth, env var, then `models.yml` fallback resolver order.
- `docs/environment-variables.md` contains the core provider env vars listed above and Anthropic precedence details.
- Native/product/local/gateway auth descriptions above were constrained to files and env rows that exist in the repo.
