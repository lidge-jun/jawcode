# 001 — Model Provider Inventory

This file inventories the JWC model/provider surface as verified on 2026-07-09. It is not a generated model dump. For exact model IDs, use `packages/ai/src/models.json`, `packages/ai/scripts/generate-models.ts`, and runtime `ModelRegistry`.

## Provider Sources

Provider identity starts in `KnownProvider` in `packages/ai/src/types.ts`. The verified union contains 50 known provider IDs:

```text
alibaba-coding-plan, amazon-bedrock, azure-openai, anthropic, google,
google-gemini-cli, google-antigravity, google-vertex, openai, openai-codex,
kimi-code, minimax-code, minimax-code-cn, github-copilot, fireworks, firepass,
gitlab-duo, cursor, deepinfra, deepseek, xai, groq, cerebras, openrouter, kilo,
vercel-ai-gateway, zai, mistral, minimax, opencode-go, opencode-zen, synthetic,
cloudflare-ai-gateway, huggingface, litellm, moonshot, nvidia, nanogpt, ollama,
ollama-cloud, qianfan, qwen-portal, together, venice, vllm, xiaomi, zenmux,
lm-studio, kiro
```

The central descriptor symbol is `PROVIDER_DESCRIPTORS`, not `providerDescriptors`. `rg -n "providerDescriptors\b|defaultModel" packages/ai/src/provider-models/descriptors.ts --type ts | head -20` returned only `defaultModel` hits, while direct file inspection shows `export const PROVIDER_DESCRIPTORS`.

Runtime provider implementations are under `packages/ai/src/providers/`. The implementation directory includes first-class transports such as `anthropic.ts`, `openai-responses.ts`, `openai-completions.ts`, `openai-codex-responses.ts`, `azure-openai-responses.ts`, `amazon-bedrock.ts`, `google.ts`, `google-gemini-cli.ts`, `google-vertex.ts`, `cursor.ts`, `kiro.ts`, `github-copilot-headers.ts`, and `gitlab-duo.ts`.

Model manager families live under `packages/ai/src/provider-models/`:

| file | role |
|---|---|
| `descriptors.ts` | central provider descriptors, catalog discovery config, and `DEFAULT_MODEL_PER_PROVIDER` |
| `openai-compat.ts` | OpenAI-compatible provider model managers |
| `google.ts` | Google Gemini model manager |
| `ollama.ts` | Ollama and Ollama Cloud managers |
| `special.ts` | Cursor, Kiro, and zAI special managers |

## Native Provider Inventory

| provider group | verified source | current posture |
|---|---|---|
| Anthropic | `KnownProvider`, `PROVIDER_DESCRIPTORS`, `providers/anthropic.ts` | Native descriptor and transport. Default is `claude-sonnet-4-6`. |
| OpenAI API | `KnownProvider`, `PROVIDER_DESCRIPTORS`, `providers/openai-responses.ts`, `providers/openai-completions.ts` | Native Responses and Chat Completions transports. Default is `gpt-5.4`. |
| OpenAI Codex | `KnownProvider`, `DEFAULT_MODEL_PER_PROVIDER`, `providers/openai-codex-responses.ts`, `providers/openai-codex/` | Special provider outside `PROVIDER_DESCRIPTORS`; default is `gpt-5.5`. |
| Azure OpenAI | `KnownProvider`, `DEFAULT_MODEL_PER_PROVIDER`, `providers/azure-openai-responses.ts` | Special default provider; default is `gpt-4.1`. |
| Amazon Bedrock | `KnownProvider`, `DEFAULT_MODEL_PER_PROVIDER`, `providers/amazon-bedrock.ts` | AWS-chain provider; default is `us.anthropic.claude-opus-4-6-v1`. |
| Google family | `google`, `google-gemini-cli`, `google-antigravity`, `google-vertex` in `KnownProvider` and defaults | Gemini API, Gemini CLI, Antigravity, and Vertex are split provider IDs. |
| Product-token providers | `cursor`, `kiro`, `github-copilot`, `gitlab-duo` | Native/special product auth adapters; not generic OpenAI-compatible API-key clones. |
| OpenAI-compatible catalogs | `groq`, `cerebras`, `fireworks`, `deepinfra`, `deepseek`, `openrouter`, `kilo`, `vercel-ai-gateway`, `cloudflare-ai-gateway`, `kimi-code`, `qwen-portal`, `synthetic`, `venice`, `litellm`, `vllm`, `moonshot`, `qianfan`, `together`, `xiaomi`, `zenmux`, `zai`, `alibaba-coding-plan`, `huggingface`, `nvidia`, `nanogpt`, `ollama`, `ollama-cloud` | Mostly descriptor-backed manager entries. Catalog providers declare env vars and optional unauthenticated/OAuth discovery metadata. |
| Static OpenAI-compatible defaults | `firepass`, `xai`, `mistral`, `opencode-go`, `opencode-zen`, `lm-studio`, `minimax`, `minimax-code`, `minimax-code-cn` | Known providers with descriptors or special defaults; not all participate in endpoint catalog discovery. |

## Confirmed Gaps From GJC/OMP

| provider / surface | source lane | JWC status | note |
|---|---|---|---|
| Fugu/Sakana login (`fish_` keys) | GJC commit `78b94562` | not native | `KnownProvider` has no `fugu` or `sakana`. JWC has adjacent Kimi/Moonshot/Firepass routes, but no Sakana-specific provider. |
| Baseten | OMP source card / commit `4c18cc1a1` referenced by earlier chase docs | not native | `KnownProvider` has no `baseten`. Treat as a candidate provider, not an existing JWC route. |
| OMP Google Interactions transport | OMP `_fin/20.023` reference | not native | JWC splits Gemini, Gemini CLI, Antigravity, and Vertex; no separate Interactions API provider was found. |
| llama.cpp first-class provider | OMP local-provider deltas | not native | JWC docs mention `LLAMA_CPP_API_KEY`, but `KnownProvider` has no `llama.cpp`; use custom/local-compatible config unless promoted. |
| LiteLLM metadata parity | OMP `e2a01aa4f`, `6aa8aefb1`, related catalog commits | native provider exists, parity unverified | JWC has `litellm` in `KnownProvider` and descriptors. OMP metadata preservation should be compared before claiming parity. |
| ZAI weekly-limit taxonomy | GJC `5c46b293` | adjacent | JWC has `zai` provider and usage/rate-limit code, but exact weekly-limit behavior should be compared separately. |

## 2026-07-17 Reviewed Model and Provider Delta

The reviewed pins now extend through GJC `3ddf26079` and OMP `b0d04e517`. The rows below are upstream inventory facts and adoption inputs. They do not claim that every item is already native in JWC.

| model / provider surface | upstream evidence | inventory contract for JWC |
|---|---|---|
| Grok 4.5 | GJC `684a26694` | JWC already has generated catalog entries. Keep xAI identity, effort clamps, payload sanitation, selector visibility, coordinator `mpreset` authority, and benchmark receipts aligned. |
| Kimi K2.7-Code 65K | OMP `6e0b9d34f`, `b865e6a4d` | Preserve the 65K output cap on the Fireworks route while keeping the extended timeout scoped to Moonshot. Do not apply one provider's timeout policy to every Kimi route. |
| MAI Code routing | OMP `d7241e572`, `4d89b2902` | Invalidate stale MAI routes and use the Responses route for Copilot MAI Code where the provider contract supports it. Route identity is provider-specific metadata. |
| Z.ai GLM-5.2 | OMP `fdf79caf2`, `f34034fa7` | Track PAYG pricing and the Anthropic-messages budget/effort contract as separate metadata fields. Do not infer wire behavior from price data. |
| OpenRouter catalog reconciliation | OMP `03c48d073` | Reconcile catalog metadata and reported usage against the effective routed model/account rather than only the requested alias. |
| Copilot business vision | OMP `b0f22caf8` | Advertise vision only when the effective Copilot route confirms image support; preserve a text-only fallback otherwise. |
| GPT-5.6 Codex web search | OMP `570f8af57` | Expose web search only for the Codex model/transport combination that implements it. Catalog capability, resolver selection, and tool availability must agree. |

Inventory review checklist:

- [ ] Confirm the canonical provider/model ID before adding a bundled entry.
- [ ] Keep provider-scoped token, timeout, pricing, effort, vision, and web-search metadata separate.
- [ ] Regenerate the bundled catalog rather than editing `packages/ai/src/models.json` by hand.
- [ ] Verify that selector and role-resolution surfaces expose only callable models.

## OpenCodex Provider Coverage

`/Users/jun/Developer/new/700_projects/opencodex/src/providers/` contains provider metadata helpers (`registry.ts`, `api-keys.ts`, `context-cap.ts`, `derive.ts`, `key-failover.ts`, `quota.ts`, and model lists). OCX is a Codex-compatible proxy/router, not the owner of JWC native provider runtime behavior.

Interview decision, 2026-07-09: import all provider-specific patches, including Fugu/Sakana and ZAI. Every imported provider patch needs two separate decisions: whether JWC should support it natively, and whether OCX should expose or adjust the Codex proxy route.

| provider family | JWC native | OCX routing evidence | guidance |
|---|---:|---:|---|
| OpenAI / Codex | yes | `opencodex/src/providers/registry.ts` has OpenAI API-key entries and router model routing | Patch JWC for JWC runtime; patch OCX only for Codex proxy behavior. |
| Anthropic | yes | OCX registry has Anthropic entries | Keep auth/catalog semantics separate. |
| Google / Vertex / Antigravity | yes | OCX registry has Google, Vertex, and Antigravity entries | Do not assume OCX defaults equal JWC defaults. |
| xAI / Grok | yes | OCX registry has xAI/Grok entries and key-failover support | Patch the user-facing runtime owner. |
| DeepSeek / Kimi / OpenRouter / gateways | yes | OCX registry has matching proxy/provider entries | Align model IDs where useful, but metadata is not automatically shared. |
| Umans / Neuralwatt | no | OCX registry includes non-JWC providers | Treat as OCX-only unless JWC gets native `KnownProvider` entries. |

| provider / patch | JWC path | OCX path | decision note |
|---|---|---|---|
| Fugu/Sakana login (`fish_` keys) | no native `KnownProvider` yet | not confirmed as existing OCX provider; evaluate `src/providers/registry.ts` and `src/oauth/` before import | Import the patch as a tracked provider delta even if final action is "no native JWC provider." |
| ZAI weekly-limit taxonomy | native `zai` exists; compare rate-limit behavior | OCX `zai` registry entry exists in `src/providers/registry.ts`; adapter/error path must be checked before mirroring taxonomy | Import and evaluate in both runtimes because both expose ZAI-shaped behavior. |
| OpenCode Go / Kimi compatibility | JWC has OpenAI-compatible and Kimi/OpenCode-related providers | OCX has `opencode-go`, Kimi/Moonshot routes, model-scoped reasoning/tool/parameter metadata, and wire overrides | Treat request-shape fixes as likely dual-surface. |
| LiteLLM metadata parity | native `litellm` exists | OCX has `litellm` registry entry and catalog exposure path | Compare metadata preservation separately; generated JWC metadata may augment OCX but does not replace OCX registry metadata. |
| OCX-only providers | not native unless promoted | `umans`, `neuralwatt`, and other registry-only entries | Do not add JWC `KnownProvider` just because OCX routes the provider. |

## MLB 20-80 Comparison

| system | provider breadth | catalog discipline | auth depth | selector UX | patchability | overall |
|---|---:|---:|---:|---:|---:|---:|
| JWC native | 70 | 70 | 70 | 60 | 60 | 70 |
| GJC current delta | 60 | 60 | 70 | 70 | 50 | 60 |
| OMP current delta | 70 | 70 | 70 | 60 | 50 | 70 |
| opencodex | 70 | 60 | 70 | 50 | 70 | 70 |
| cli-jaw | 60 | 50 | 50 | 60 | 60 | 60 |
| codexclaw | 40 | 50 | 30 | 50 | 60 | 50 |

Scale: 20 = poor, 50 = average, 60 = plus, 70 = plus-plus, 80 = elite. These are local architecture grades from inspected repo surfaces, not vendor quality claims.

## Patch Rule

If adding a provider to JWC, update `KnownProvider`, descriptor/default/model manager, runtime transport, auth/env docs, generated catalog path, tests, and user docs together. If adding only a model for a descriptor-backed provider, update generator inputs or model policy and regenerate; do not hand-edit `packages/ai/src/models.json`.

## Verification

Commands run:

```bash
rg -n "KnownProvider|providerKey" packages/ai/src/types.ts --type ts
ls packages/ai/src/providers/
rg -n "providerDescriptors\b|defaultModel" packages/ai/src/provider-models/descriptors.ts --type ts | head -20
ls /Users/jun/Developer/new/700_projects/opencodex/src/providers/ 2>/dev/null
sed -n '101,151p' packages/ai/src/types.ts
sed -n '1,360p' packages/ai/src/provider-models/descriptors.ts
```

Confirmed:

- `KnownProvider` is defined in `packages/ai/src/types.ts` and contains the 50 IDs listed above.
- `providerKey` did not appear in `types.ts` output from the requested grep.
- `packages/ai/src/providers/` contains the native transport files cited above.
- The requested descriptor grep did not find a lowercase `providerDescriptors`; it found `defaultModel` fields. Direct inspection confirmed the actual exported symbol is `PROVIDER_DESCRIPTORS`.
- OpenCodex provider files are metadata/routing helpers under `opencodex/src/providers/`, with `registry.ts` as the main provider registry.
