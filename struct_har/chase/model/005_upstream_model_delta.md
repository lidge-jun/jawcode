# 005 — Upstream Model Delta

This file records model/provider-related commits from the supplied GJC and OMP chase ranges, verified with path-scoped git logs.

## Reviewed-through Pins — 2026-07-17

| lane | previous pin | reviewed-through pin | reviewed range | release span |
|---|---|---|---|---|
| GJC | `4a80bac9` | `3ddf26079` | `4a80bac9..3ddf26079` | v0.9.6 → v0.11.1+ |
| OMP | `7aa1d581c` | `b0d04e517` | `7aa1d581c..b0d04e517` | v16.4.2 → v17.0.1 |

These pins supersede the 2026-07-09 current-delta snapshot below. The older tables remain preserved as historical evidence so previously reviewed commits are not lost.

## Current GJC Model and Provider Delta

Range: `4a80bac9..3ddf26079` in `devlog/_gjc_chase/gajae-code`.

| cluster | commits | reviewed contract | model/ owner |
|---|---|---|---|
| C02 security/control-token | `9036b594e`, `5ca557eaa`, `032f5cb6b`, `9663f7744`, `749449a6a`, `236ecf14c` | fail-closed reasoning egress, reserved control-token neutralization, GPT-5.6 prompt cap | `002`, `003` |
| C03 preset/fallback/selection | `bceb66bab`, `f30323b2e`, `5c76e5556`, `f56d6b2c5`, `b12fb2573`, `08c58a87a`, `c8c2d92b9`, `41c8e1f76` | sticky fallback chains, immediate role overrides, cache/admission ordering, durable promotion, thinking preservation, login fallback | `002`, `003` |
| C11 Grok/Codex presets | `684a26694`, `cc661b43a`, `2f213136c` | Grok 4.5 inventory, GPT-5.6 Codex benchmark presets, authoritative `mpreset` selection | `001`, `002` |
| C12 reasoning/thinking SDK | `1a3d04649`, `cf94f8804`, `f912eddcf` | thinking capability exposure, explicit `invalid_prompt` circuit breaker, reasoning/summary queue safety | `002`, `003` |
| C13 durable RPC selection | `82b5159b8`, `9f6de8820` | durable default model and unchanged explicit thinking persistence | `002` |
| C17 provider safety | `5331bdb29`, `e0b4b0ee7` | cross-transport safety-stop classification and local managed-fallback authority boundary | `003` |

GJC adoption order:

1. Enforce prompt/control-token and reasoning egress boundaries.
2. Reconcile preset, role override, sticky fallback, and durable-promotion ownership.
3. Add model metadata/presets only through the generator and shared resolver.
4. Keep safety stops, invalid prompts, and local fallback failures as separate outcomes.

## Current OMP Model and Provider Delta

Range: `7aa1d581c..b0d04e517` in `devlog/_omp_chase/oh-my-pi`.

| cluster | commits | reviewed contract | model/ owner |
|---|---|---|---|
| D01 model hub/selector | `59d08172c`, `8dbc43b6e`, `ab7b776f9`, `666327608`, `af7345e87`, `c4fa0ebaa`, `1822603b2` | unified model hub, floating selection, custom roles, deterministic search/filtering, persistent performance tracking | `001`, `002` |
| D02 catalog/pricing/routing | `6e0b9d34f`, `b865e6a4d`, `d7241e572`, `fdf79caf2`, `f34034fa7`, `4d89b2902`, `03c48d073`, `c1480b29e` | Kimi K2.7-Code 65K, provider-scoped timeout, MAI Responses routing, GLM-5.2 effort/pricing, OpenRouter reconciliation, Claude ID parsing | `001`, `002` |
| D03 auth/OAuth/credential | `6ae7cdbf9`, `792f75298`, `e858c1be6`, `044d722a3`, `7029789e7`, `c97449c51`, `7cef4a769`, `0ab90f63e` | credential rotation, serialized refresh, org-scoped identity, stale-sticky cleanup, endpoint leak prevention, quota-account rotation | `003` |
| D04 provider/transport/schema | `ae0d5054d`, `80815af78`, `8932acb6f`, `f6de37350`, `375e89099`, `4b3ec660f`, `b0f22caf8`, `188985eb0` | Vertex effort gating, schema coercion, unsupported parameter omission, endpoint beta/stream guards, Copilot vision, header isolation | `001`, `002`, `003` |
| D05 resolver/fallback | `58d6130b5`, `d54dcc222`, `a55e4b1a7`, `00c8e921f`, `570f8af57`, `06095c103` | hard-error/retry fallback, thinking suffix preservation, non-vision replay boundary, GPT-5.6 Codex web search, stale role-thinking cleanup | `001`, `002` |
| D10 agent-loop/provider stream | `e28197c69`, `1df790a5d`, `7a2e34988`, `4200dec04`, `94fc54859`, `f64a17c52`, `9e72202b4`, `33bbf69f1`, `4b3ec660f`, `d00e5548e`, `5a7f10780`, `408641822`, `b3145170a`, `8c6b2fb45`, `0b9bdaaed`, `54af1c03f`, `51cc34ac6`, `fabded89e` | retryable empty stops, incomplete tool-call cleanup, effective-endpoint streaming policy, failed-stream result pairing, provider/ACP error surfacing | `003` |
| D17 usage/quota/spend limit | `2faa345d1`, `e3a7ec880`, `b0d04e517` | persistent spend-limit classification, quota parser retention, login API-key snapshot validation | `003` |
| D19 small model/task agent | `93635e7b6`, `425e583ae`, `441037025` | centralized small-model preprocessing, task-agent model resolution, thinking precedence | `002` |

OMP adoption order:

1. Reconcile catalog identities and auth/transport eligibility before exposing model-hub UI.
2. Preserve provider-scoped routing, timeout, effort, vision, and web-search metadata.
3. Validate fallback against classified provider errors and partial-stream integrity.
4. Add small-model preprocessing only through a centralized task-agent resolution path.

## Current Cross-file Ledger

| file | current delta responsibility |
|---|---|
| [001_model_provider_inventory.md](./001_model_provider_inventory.md) | Grok 4.5, Kimi K2.7-Code 65K, MAI Code, GLM-5.2, OpenRouter, Copilot vision, GPT-5.6 Codex web search |
| [002_model_catalog_contract.md](./002_model_catalog_contract.md) | model hub/floating selection, sticky fallback, durable default, `mpreset`, thinking and prompt-cap contracts, small-model/task-agent resolution |
| [003_provider_auth_flow.md](./003_provider_auth_flow.md) | rotation/refresh/org identity, reasoning egress, endpoint/effort gating, safety stops, spend limits, snapshot validation |
| [004_cross_project_patch_index.md](./004_cross_project_patch_index.md) | unchanged until an actual cross-project code patch is approved |

Current review checklist:

- [x] Move GJC reviewed-through pin to `3ddf26079`.
- [x] Move OMP reviewed-through pin to `b0d04e517`.
- [x] Link every model/provider cluster to its owning `model/` reference file.
- [ ] Mark implementation adoption only after focused JWC code and runtime evidence exists.

## Preserved Prior Snapshot — 2026-07-09

### Prior GJC Delta

Range: `db7938e1..b3b5b8a9` in `devlog/_gjc_chase/gajae-code`.

Command evidence was path-scoped to `packages/ai/src` and `packages/coding-agent/src/config/model*`. The first 60 lines showed these model/provider-relevant commits:

| commit | files from scoped log | category | JWC action |
|---|---|---|---|
| `78b94562` `fix(ai): point Fugu login at Sakana platform console and fish_ key prefix` | `packages/ai/src/utils/oauth/fugu.ts` | provider auth | JWC has no native `fugu`/`sakana` provider. Treat as a candidate provider gap only. |
| `6dd147ba` `docs(ai): capacity jitter comment...` | `packages/ai/src/rate-limit-utils.ts` | rate-limit docs | Low priority; not catalog behavior. |
| `5c46b293` `fix(ai): detect ZAI weekly limit exhaustion` | `packages/ai/src/rate-limit-utils.ts` | usage/rate-limit taxonomy | Compare against JWC ZAI/rate-limit behavior before adopting. |
| `47b287b3` `fix(providers): unify the Cursor client version across agent runs and discovery` | `providers/cursor.ts`, `providers/cursor/client-version.ts`, `utils/discovery/cursor.ts` | Cursor provider/discovery | Relevant to JWC Cursor drift if JWC lacks the shared client-version helper. |
| `783cbe31` `fix(providers): bound OpenAI SDK 429 retries...` | Azure/OpenAI provider files and `openai-bounded-rate-limits.ts` | provider retry behavior | Candidate follow-up for OpenAI/Azure retry taxonomy. |
| `cfe26cbe` `Fix OpenCode Go Kimi compatibility` | `providers/openai-completions-compat.ts` | OpenAI-compatible request shape | Compare with JWC `opencode-go`/Kimi compatibility. |
| `6b907e70` `Strip image generation output fields from responses replay` | `packages/ai/src/utils.ts` | response replay | Adjacent provider replay behavior; not a model catalog change. |
| `7fb3e9a1` `feat(model): batch role-model assignment for /model and TUI selector` | `packages/coding-agent/src/config/model-profile-activation.ts` | model roles/selector UX | Active `/model`/role assignment follow-up. |
| `79440d32` `fix(coding-agent): default custom gpt-5.5 context to Codex-safe 272K` | `model-registry.ts` | custom model metadata | Compare JWC custom GPT-5.5 context defaults if not already patched. |
| `117fc235` `fix(ai): refresh imported oauth credentials` | `auth-broker/remote-store.ts`, `auth-broker/wire-schemas.ts`, `auth-storage.ts` | OAuth/import refresh | Compare with JWC auth broker/import behavior. |
| `e5b7c4c7` `fix(ai): omit disabled thinking for Anthropic` | `providers/anthropic.ts` | thinking wire behavior | Compare with JWC Anthropic transport. |
| `7cdef7af` `fix(ai): sanitize tool call argument strings` | multiple provider files including OpenAI Codex and Google | provider payload sanitization | Broader provider safety follow-up, not catalog inventory. |

Earlier draft commits such as `89c30edb`, `2455cc11`, `e035d512`, `55321eaf`, `2690cf05`, `64cce6fd`, `29e8e6cc`, `746dec46`, `55449a43`, and `bbc604d5` were not present in the requested path-scoped `head -60` output. Keep them only if another chase card has separate evidence.

### Prior OMP Delta

Range: `d0c1890a6..f25ab54c5` in `devlog/_omp_chase/oh-my-pi`.

The requested path-scoped log covered `packages/ai` and `packages/catalog`. The first 60 lines showed:

| commit | files from scoped log | category | JWC action |
|---|---|---|---|
| `f25ab54c5` `chore: bump version to 16.3.12` | package changelogs/package files | release metadata | No model behavior. |
| `3f0c2c63a` `fix(ai): reconciled codex self-heal with shared-scoped blocks` | `auth-storage.ts`, Codex auth-storage test | Codex auth/usage | Compare with JWC Codex credential selection. |
| `93edb2ad4` merge PR `fix(ai): self-heal stale Codex usage-limit blocks` | merge commit | Codex auth/usage | See underlying auth-storage changes in range. |
| `2e189b6f9` `test: aligned full suite...` | auth/openrouter tests | test alignment | Test-only unless failure maps to JWC. |
| `68da3dca8` `test: aligned merged regression tests...` | `openai-codex-stream.test.ts` | Codex stream tests | Candidate test reference. |
| `53df3c82b` `style: applied biome formatting...` | `openai-codex-responses.ts` | formatting | No behavior by itself. |
| `3ee194dcc` `chore: normalized changelog entries...` | changelogs | release docs | No behavior. |
| `32158b74e` merge PR `fix(coding-agent): scoped TTSR abort reason...` | merge commit | tool/runtime adjacent | Not model catalog from scoped output. |
| `e2a01aa4f` `fix(catalog): preserve LiteLLM rich metadata` | `packages/catalog/src/provider-models/openai-compat.ts`, test | LiteLLM catalog metadata | Strong JWC comparison candidate. |
| `caa0ecf6c` merge PR `fix(catalog): preserve LiteLLM vision metadata` | merge commit | LiteLLM catalog metadata | Compare with JWC LiteLLM metadata behavior. |
| `6aa8aefb1` `fix-catalog-litellm-cache-version` | `packages/catalog/src/provider-models/openai-compat.ts`, test | LiteLLM catalog cache/version | Compare with JWC generator/catalog cache behavior. |
| `961e27aae` merge PR `fix(catalog): restore LiteLLM bundled metadata fallback` | merge commit | LiteLLM fallback | Compare with JWC fallback from previous generated catalog. |
| `3253407ae` merge PR `fix(oauth): copy-safe URL chunks...` | merge commit | OAuth UX | Auth-adjacent, not catalog by itself. |
| `32953c1b3` merge PR `fix(ai): disable strict tools on Azure Foundry Anthropic` | merge commit | provider compatibility | Compare if JWC has Azure Foundry Anthropic strict-tool behavior. |
| `847124465` `fix(auth): honor login API keys in peek` | `auth-storage.ts`, auth-storage test | auth precedence | Compare with JWC API-key/OAuth precedence. |
| `a3d6bd070` merge PR `fix(auth): prioritize login API keys over env fallbacks` | merge commit | auth precedence | Compare with JWC order. |
| `d47879feb` `chore: drop unrelated changelog entries` | changelog | release docs | No behavior. |
| `2d29d5167` merge PR `fix(auth): rotate Codex credentials before provider fallback` | merge commit | Codex auth rotation | Important JWC Codex auth comparison. |
| `5f948878b` `fix(ai): guard codex stale-code lookup` | `openai-codex-responses.ts` | Codex stale-chain handling | Compare with JWC Codex response handling. |
| `48155c0fb` merge PR `fix(ai): recognize proxy stale-anchor codes...` | merge commit | Codex websocket previous-response chain | Compare if JWC carries the same chain logic. |
| `e2ac3efa5` merge PR `fix(ai): keep assistant tool_use blocks trailing...` | merge commit | Anthropic replay | Provider replay follow-up. |
| `c5da99283` merge PR `fix(ai): accept response.done terminal event` | merge commit | OpenAI/Codex response stream | Provider stream follow-up. |
| `af86bd87e` `fix(ai): self-heal stale Codex usage-limit blocks on healthy live usage` | `auth-broker/remote-store.ts`, `auth-storage.ts`, tests | Codex auth/usage self-heal | Important JWC Codex auth/broker comparison. |

The previous draft listed additional OMP commits (`2f67fb372`, `da4ac01c7`, `41a29c83c`, `7101527e6`, `465412502`, `b59a4050d`, `fd9bf38eb`, `1dcab092d`, `1e6782af1`, `8aae263ea`, `bfb170ae6`, `8c01b1633`, `2dfddfd6a`, `90aabbac9`, `9be287516`, `a4b168023`, `32d12dde9`, `2859dc5be`, `db9cb3076`, `d1a29be3a`, and selector/resolver commits). They were not present in the requested path-scoped first 60 lines. Keep them only when separately verified by broader log search or existing chase-card evidence.

## Interview Decision: Import All Provider Patches

Decision date: 2026-07-09.

The current import posture is "all provider-specific patches are in scope," including Fugu/Sakana and ZAI. The action is still triage-first: each delta must be classified as native JWC runtime, OCX proxy route, both, or docs-only before implementation.

Cross-reference: [004_cross_project_patch_index.md](./004_cross_project_patch_index.md) now carries the OCX patch plan, exact provider-routing files, and separate steps for adding a new OCX provider or a new model to an existing OCX provider.

## Confirmed Follow-Up Buckets

| bucket | evidence from requested logs | status |
|---|---|---|
| Fugu/Sakana provider import | GJC `78b94562` | Import candidate; decide JWC native vs OCX proxy vs docs-only. |
| ZAI weekly-limit taxonomy | GJC `5c46b293` | Import candidate; compare both JWC `zai` behavior and OCX `zai` proxy path. |
| Cursor client-version discovery | GJC `47b287b3` | Candidate Cursor drift comparison. |
| OpenAI/Azure 429 bounded retries | GJC `783cbe31` | Candidate provider retry comparison. |
| OpenCode Go/Kimi compatibility | GJC `cfe26cbe` | Candidate OpenAI-compatible request-shape comparison. |
| `/model` batch role assignment | GJC `7fb3e9a1` | Active selector/role UX follow-up. |
| custom GPT-5.5 context default | GJC `79440d32` | Candidate metadata comparison. |
| imported OAuth refresh | GJC `117fc235` | Candidate auth broker/import comparison. |
| Anthropic disabled-thinking wire behavior | GJC `e5b7c4c7` | Candidate transport comparison. |
| LiteLLM rich/vision/fallback metadata | OMP `e2a01aa4f`, `caa0ecf6c`, `6aa8aefb1`, `961e27aae` | Strong catalog parity candidate. |
| login API key precedence | OMP `847124465`, `a3d6bd070` | Auth precedence comparison. |
| Codex credential rotation/self-heal/stale chain | OMP `3f0c2c63a`, `2d29d5167`, `5f948878b`, `48155c0fb`, `af86bd87e` | Important Codex auth/stream comparison. |
| provider replay/terminal-event compatibility | OMP `e2ac3efa5`, `c5da99283` | Provider replay/stream follow-up. |

## Recommended Follow-Up Split

1. `model-provider-fugu-sakana` — import the patch record, then decide native JWC provider, OCX proxy route, both, or docs-only.
2. `zai-rate-limit-taxonomy` — compare GJC weekly-limit detection against JWC rate-limit handling and OCX `zai` proxy behavior.
3. `cursor-discovery-client-version` — compare shared Cursor client-version behavior.
4. `openai-azure-429-bounds` — compare bounded SDK retry behavior for usage-limit exhaustion.
5. `opencode-go-kimi-compat` — compare OpenCode Go/Kimi request compatibility.
6. `litellm-metadata-parity` — compare OMP LiteLLM rich/vision/fallback metadata with JWC catalog generation.
7. `codex-auth-rotation-self-heal` — compare OMP Codex auth rotation/quota/stale-chain behavior against JWC.
8. `model-selector-role-batch` — reconcile GJC `/model` role assignment and selector behavior.

## Verification

Commands run:

```bash
git -C devlog/_gjc_chase/gajae-code log --oneline --stat db7938e1..b3b5b8a9 -- packages/ai/src packages/coding-agent/src/config/model* | head -60
git -C devlog/_omp_chase/oh-my-pi log --oneline --stat d0c1890a6..f25ab54c5 -- packages/ai packages/catalog | head -60
```

Confirmed:

- GJC path-scoped first 60 lines included Fugu/Sakana auth, ZAI weekly-limit detection, Cursor discovery versioning, OpenAI/Azure retry bounds, OpenCode Go/Kimi compatibility, `/model` batch role assignment, custom GPT-5.5 context default, imported OAuth refresh, Anthropic disabled-thinking behavior, and provider payload sanitization.
- OMP path-scoped first 60 lines included LiteLLM catalog metadata/fallback work, auth precedence, Codex credential selection/self-heal/stale-chain changes, and provider replay/stream merge commits.
- Several commits from the previous draft were not present in the requested path-scoped evidence. They were removed or demoted to "separately verify before using" rather than retained as verified anchors.
