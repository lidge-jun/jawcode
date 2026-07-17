# 004 — Cross-Project Model/Provider Patch Index

This is the patch map for model/provider work under `/Users/jun/Developer/new/700_projects`. JWC owns JWC runtime behavior. Sibling repos may mirror names or route compatible requests, but they do not automatically inherit JWC semantics.

## Quick Decision Tree

| change type | first owner | then check |
|---|---|---|
| native JWC provider support | `/Users/jun/Developer/new/700_projects/jawcode/packages/ai` | JWC docs/tests, then hardcoded references in `cli-jaw`, `opencodex`, and `codexclaw` |
| new model for existing JWC generated provider | JWC descriptors/model managers/generator policy | `/model`, resolver, docs, sibling registries only if they hardcode the model |
| OpenAI-compatible proxy route for Codex runtime | `/Users/jun/Developer/new/700_projects/opencodex/src/providers/registry.ts` and `src/router.ts` | OCX adapters/responses, `cli-jaw` OCX fetch, codexclaw detect/catalog display |
| CLI model list/default update | `/Users/jun/Developer/new/700_projects/cli-jaw/src/cli/registry.ts` or live registry | OCX `/v1/models`, JWC provider discovery/defaults |
| skill mentions provider capability | relevant skill `SKILL.md` | runtime owner docs or public/current provider docs |
| Codex subagent model catalog/config | `/Users/jun/Developer/new/700_projects/codexclaw/plugins/codexclaw/components/subagent-config/src/` | OCX/native catalog status and provider bridge detection |

## jawcode

Path: `/Users/jun/Developer/new/700_projects/jawcode`

Role: JWC product runtime, model/provider implementation, generated catalog, auth, usage, selector UX, and user docs.

### Add a New Provider

Verified patch surfaces:

| order | file/path | status | purpose |
|---:|---|---|---|
| 1 | `packages/ai/src/types.ts` | exists | Add `KnownProvider` and API/options types if transport is new. |
| 2 | `packages/ai/src/providers/<provider>.ts` | directory exists | Implement stream/request handling or provider-specific transport. |
| 3 | `packages/ai/src/provider-models/openai-compat.ts`, `google.ts`, `ollama.ts`, or `special.ts` | exist | Add model manager options/discovery metadata in the right family. |
| 4 | `packages/ai/src/provider-models/descriptors.ts` | exists | Add descriptor/default/catalog discovery env vars. |
| 5 | `packages/ai/src/auth-storage.ts`, `packages/ai/src/utils/oauth/**`, `packages/ai/src/auth-broker/**` | exist | Add auth only if the provider needs a new credential shape or OAuth behavior. |
| 6 | `packages/ai/src/providers/register-builtins.ts` or provider-specific stream routing | exists | Verify the new transport is reachable. The old draft's generic `packages/ai/src/stream.ts` path was wrong; no such file exists. |
| 7 | `packages/ai/scripts/generate-models.ts` | exists | Add generator logic only if descriptors are insufficient. |
| 8 | `packages/ai/src/models.json` | exists | Regenerate only; never manual edit. |
| 9 | `packages/coding-agent/src/config/model-registry.ts` | exists | Add schema/custom-config support only for new config keys or API IDs. |
| 10 | `packages/coding-agent/src/config/model-resolver.ts` | exists | Patch only if selector semantics change. |
| 11 | `packages/coding-agent/src/modes/components/model-selector.ts`, `packages/coding-agent/src/slash-commands/builtin-registry.ts` | exist | Patch only for UI/command behavior. |
| 12 | `docs/models.md`, `docs/environment-variables.md`, tests/changelog | exist | Document and verify user-facing changes. |

### Add a Model to Existing Provider

| case | files |
|---|---|
| model comes from models.dev or provider endpoint | prefer generator run; no source edit unless metadata policy is missing |
| static/special model | `provider-models/special.ts`, `provider-models/descriptors.ts`, or provider-specific manager |
| thinking/effort metadata | `packages/ai/src/model-thinking.ts`, provider manager metadata, generated policy |
| OpenAI-compatible metadata correction | `provider-models/openai-compat.ts`, `generate-models.ts` policy helpers |
| docs-only exposure | `docs/models.md`, `docs/environment-variables.md` |

## opencodex

Path: `/Users/jun/Developer/new/700_projects/opencodex`

Role: OCX proxy that routes Codex-compatible requests to non-OpenAI providers and exposes provider/dashboard/model metadata. It is not JWC's native provider runtime.

### Interview Decision Patch Plan (2026-07-09)

Decision source: [10.080_gjc_chase_model_provider_effort_fugu_safety.md](../10.080_gjc_chase_model_provider_effort_fugu_safety.md).

Import all provider-specific patches, including Fugu/Sakana and ZAI. That does not mean every patch becomes native JWC code. It means every imported provider delta must be triaged across both JWC and OCX, because OCX is the Codex proxy path where provider aliases, model IDs, auth modes, wire adapters, and catalog visibility may need parallel treatment.

| patch area | OCX plan | notes |
|---|---|---|
| All provider-specific patches from GJC/OMP model/provider deltas | Record and import/adapt where OCX owns the proxy route. | Fugu/Sakana, ZAI, Kimi/OpenCode Go compatibility, OpenAI-compatible retry/limit taxonomy, safety/refusal semantics, and catalog metadata should be checked against OCX registry/router/adapters/catalog instead of assuming JWC-native ownership covers proxy behavior. |
| Fugu/Sakana | Add or update OCX registry/auth metadata if OCX exposes the provider or routes compatible models. | Preserve OCX provider naming and auth mode; do not infer native JWC provider exposure from OCX support. |
| ZAI | Check OCX `zai` registry metadata and add narrow weekly-limit classification only in the OCX provider/adapter path that emits ZAI errors. | Avoid generic string heuristics in shared retry logic unless evidence shows multiple providers share the exact code. |
| OpenCode Go / Kimi compatibility | Check `src/providers/registry.ts`, `src/server/adapter-resolve.ts`, `src/adapters/`, `src/responses/`, and `src/router.ts` for OpenAI-compatible request/response normalization. | Keep compatibility behavior in the OpenAI-compatible proxy layer. |
| Safety refusal and bounded retry behavior | Mirror terminality and retry bounds only where OCX controls retry decisions. | Do not duplicate JWC session retry logic in OCX unless OCX itself retries upstream requests. |

Verified structure under `src/`: `adapters`, `bridge.ts`, `cli`, `cli.ts`, `codex`, `config.ts`, `generated`, `index.ts`, `lib`, `oauth`, `providers`, `reasoning-effort.ts`, `responses`, `router.ts`, `server`, `service.ts`, `types.ts`, `update`, `usage`, `vision`, `web-search`.

### Add a New Provider

Verified patch surfaces:

| file/path | status | purpose |
|---|---|---|
| `src/providers/registry.ts` | exists | Canonical built-in provider registry: `PROVIDER_REGISTRY`, provider IDs, labels, adapters, base URLs, auth kind, OAuth ID, default models, static model lists, context windows, input modalities, reasoning maps, no-vision/no-reasoning/no-parameter lists, `jawcodeBundle`, and dashboard presets. |
| `src/providers/derive.ts` | exists | Derives preset/key-login metadata from the registry and enriches saved provider configs. Patch when a new registry field must flow into GUI/API-created provider configs. |
| `src/oauth/key-providers.ts` | exists | API-key login provider list from `deriveKeyLoginMap()` plus `enrichProviderFromCatalog()`. Patch only if key-login validation or copied metadata needs a new field. |
| `src/oauth/index.ts`, `src/oauth/<provider>.ts`, `src/oauth/types.ts` | exist | OAuth provider registration, login flow, token shape, refresh policy, and account handling for OAuth-backed providers. |
| `src/router.ts` | exists | Runtime model resolution: explicit `<provider>/<model>`, provider default models, known model-prefix routing, configured `models`, then default provider fallback. Patch when a new provider needs bare-model prefix routing or route merge behavior. |
| `src/config.ts` | exists | Config schema/load/save/defaults and validation for provider names, base URLs, headers, default provider, runtime port, and catalog/subagent defaults. Patch when config shape or validation changes. |
| `src/types.ts` | exists | `OcxConfig` and `OcxProviderConfig` fields consumed by routing, adapters, catalog sync, GUI management, sidecars, and provider metadata. Patch before using a new config field. |
| `src/server/adapter-resolve.ts` | exists | Adapter factory and per-model wire-protocol overrides. Patch when a new adapter exists or a model under one provider must be driven over another wire protocol. |
| `src/adapters/<adapter>.ts` and adapter subdirs | exist | Provider wire behavior. Reuse `openai-chat`, `anthropic`, `google`, `openai-responses`, `azure`, `cursor`, or `kiro` when possible; add a new adapter only when request/stream semantics differ. |
| `src/responses/parser.ts`, `src/bridge.ts`, `src/responses/*` | exist | Codex Responses parsing/bridging and replay semantics. Patch when provider output needs new translation into Codex response items. |
| `src/codex/catalog.ts` | exists | Codex-visible `/v1/models` and catalog injection: native OpenAI slugs, routed `<provider>/<model>` entries, model metadata, context caps, selected/disabled models, media-generation filtering, and JWC metadata augmentation. |
| `src/codex/sync.ts`, `src/codex/refresh.ts`, `src/codex/model-cache.ts` | exist | Sync/refresh/cache path that writes routed models into Codex catalog and invalidates cached model lists. |
| `src/server/management-api.ts` | exists | GUI/API provider management: add/patch/delete providers, list `/api/models`, set selected/disabled models, choose subagent models, start OAuth login, and refresh Codex catalog after changes. |
| `src/cli/models.ts`, `src/cli/provider.ts`, `src/cli/status.ts` | exist | CLI surfaces for listing models and managing provider config/status. Patch only when user-visible CLI behavior changes. |
| `src/generated/jawcode-model-metadata.ts` | exists | Generated JWC metadata bridge consumed by `src/codex/catalog.ts`; update only through its owning generation path. |

No `addProvider` or `registerProvider` function was found by `rg -rn "providers|addProvider|registerProvider" ... --type ts`. Provider addition is registry/config/API driven, not a plugin-style registration call.

Step-by-step for a new OCX built-in provider:

1. Decide whether the provider is OCX-only proxy support, JWC-native support, or both. For imported upstream provider patches, assume "both need triage" until ruled out.
2. Add or update the `PROVIDER_REGISTRY` entry in `src/providers/registry.ts`: stable `id`, `label`, `adapter`, `baseUrl`, `authKind`, `dashboardUrl`, `defaultModel`, `models`, `liveModels`, metadata maps, parameter exclusion lists, `jawcodeBundle`, and aliases.
3. If the provider uses an existing API-key shape, verify `deriveKeyLoginMap()` and `enrichProviderFromRegistry()` copy every needed registry field through `src/providers/derive.ts` and `src/oauth/key-providers.ts`.
4. If the provider needs OAuth or local token import, add the provider flow under `src/oauth/`, register it through `src/oauth/index.ts`, define token/account types in `src/oauth/types.ts`, and set `oauthId`/`authKind: "oauth"` in the registry entry.
5. If the provider needs a new wire protocol, implement the adapter under `src/adapters/`, export it if needed from `src/index.ts`, and add it to `resolveAdapter()` in `src/server/adapter-resolve.ts`.
6. If individual models under this provider need another wire protocol, add the model set to `ANTHROPIC_WIRE_MODELS` or the equivalent override in `src/server/adapter-resolve.ts`.
7. Add bare-model prefix routing in `src/router.ts` only when users should type the bare model ID without `<provider>/`. Otherwise rely on explicit `<provider>/<model>`, default model, and configured `models`.
8. Add config/type fields in `src/types.ts` and `src/config.ts` only if registry metadata and existing provider config fields cannot express the behavior.
9. Verify Codex catalog exposure in `src/codex/catalog.ts`: context windows, input modalities, reasoning efforts, selected/disabled model filtering, media-generation filtering, and JWC metadata augmentation.
10. Verify management and CLI surfaces: `src/server/management-api.ts` provider presets, `/api/models`, selected/disabled models, OAuth/key-login endpoints, `src/cli/models.ts`, and provider status commands.

Step-by-step for adding a model to an existing OCX provider:

1. Identify the owning OCX provider ID and adapter in `src/providers/registry.ts`.
2. If the provider has a static `models` list, add the model there and update `defaultModel` only when the default should change.
3. Add model-scoped metadata in the same registry entry: `modelContextWindows`, `modelInputModalities`, `modelReasoningEfforts`, `modelReasoningEffortMap`, `noVisionModels`, `noReasoningModels`, `noTemperatureModels`, `noTopPModels`, `noPenaltyModels`, `autoToolChoiceOnlyModels`, `preserveReasoningContentModels`, or `thinkingToggleModels`.
4. If the provider is live-discovered, prefer static metadata only for fallback/classification; do not turn a live provider into a static allowlist unless `selectedModels` or user config requires it.
5. If the model needs special wire behavior, patch `src/server/adapter-resolve.ts` and the relevant adapter.
6. If the model is a media-generation model, confirm `src/codex/catalog.ts` hides it from Codex coding-agent model lists; if it is a vision-input chat model, avoid matching it as media generation.
7. If the model's metadata should mirror JWC generated metadata, update the owning JWC metadata generation path, then refresh `src/generated/jawcode-model-metadata.ts` through the generator rather than hand-editing it.

How OCX interacts with JWC:

1. JWC native provider support lives in `jawcode/packages/ai` and `packages/coding-agent/src/config/model-*`. OCX does not inherit those runtime transports.
2. OCX exposes Codex-compatible proxy routing. Model strings can route as `<provider>/<model>` through `src/router.ts`; Codex sees routed models through `src/codex/catalog.ts` and `src/codex/sync.ts`.
3. OCX can reuse generated JWC model metadata through `src/generated/jawcode-model-metadata.ts`, but only for catalog metadata augmentation. It does not make OCX an execution owner for JWC native providers.
4. `cli-jaw` and `codexclaw` may consume OCX `/v1/models` or catalog/provider bridge output, so any OCX provider/model patch should be checked against their selector/catalog surfaces after the OCX owner files are updated.
5. When a provider patch is imported into JWC, decide separately: native JWC runtime support, OCX proxy route, both, or docs-only. The 2026-07-09 interview decision makes this check mandatory for all provider-specific deltas, including Fugu/Sakana auth and ZAI weekly-limit/model behavior.

## cli-jaw

Path: `/Users/jun/Developer/new/700_projects/cli-jaw`

Role: CLI orchestration surface that exposes model selection across CLIs, employees, web-ai vendors, OCX-backed Codex models, and JWC provider choices.

Verified `src/` structure includes `agent`, `bgtask`, `browser`, `cli`, `code-mode`, `command-contract`, `core`, `goal`, `goal-run`, `http`, `ide`, `manager`, `memory`, `messaging`, `orchestrator`, `prompt`, `routes`, `security`, `shared`, `task`, `team`, `telegram`, `trace`, `types`, and `workflows`.

### Add a New Provider or CLI Runtime

Verified patch surfaces:

| file/path | status | purpose |
|---|---|---|
| `src/cli/registry.ts` | exists | Static CLI/provider/model choices, defaults, effort notes, provider grouping. |
| `src/cli/registry-live.ts` | exists | Live model/provider discovery and merging, including JWC and Kiro inventory. |
| `src/cli/opencodex-models.ts` | exists | OCX `/v1/models` fetch and Codex model choice propagation. |
| `src/code-mode/model-options.ts` | exists | JWC provider/model defaults discovered by cli-jaw. |
| `src/cli/handlers.ts` | exists | CLI command behavior and model/provider auto-resolution. |
| `src/cli/handlers-completions.ts` | exists | Argument completions for model/provider choices. |
| `bin/commands/provider.ts` | exists | On-demand provider runtime installer/manager if separate helper is involved. |
| `README.md`, tests | likely repo-local | Public docs and behavior coverage. |

Targeted grep confirmed `registry-live.ts` merges OCX models into Codex choices, merges JWC authenticated provider defaults, and loads Kiro inventory.

## cli-jaw-skills

Path: `/Users/jun/Developer/new/700_projects/cli-jaw-skills`

Role: skill catalog. Skills may mention provider capabilities, env vars, preferred models, or provider-specific tools, but they do not own JWC runtime support.

Patch only the skill that uses the provider/model:

| file/path | purpose |
|---|---|
| `<skill>/SKILL.md` | trigger, provider prerequisites, model/env examples |
| `<skill>/references/*` | longer setup or compatibility docs |
| `<skill>/scripts/*` | provider API callers/helpers only when the skill executes that provider |
| catalog/index docs if present | searchability and install metadata |

Dependency order: runtime owner first, skill docs second.

## codexclaw

Path: `/Users/jun/Developer/new/700_projects/codexclaw`

Role: Codex plugin layer with subagent model/prompt config and detect-only OCX provider bridge. It must not become a provider proxy.

### Add Provider/Catalog Integration

Verified patch surfaces:

| file/path | status | purpose |
|---|---|---|
| `plugins/codexclaw/components/provider-bridge/src/detect.ts` | exists | Read-only OCX/native provider detection. |
| `plugins/codexclaw/components/provider-bridge/src/cli.ts` | exists | SessionStart/manual detect output. |
| `plugins/codexclaw/components/subagent-config/src/catalog.ts` | exists | Native + OCX model catalog surfaced to subagent config. |
| `plugins/codexclaw/components/subagent-config/src/store.ts` | exists | Per-role model/effort/prompt persistence. |
| `plugins/codexclaw/components/subagent-config/src/spawn-attach-hook.ts` | exists | Inject configured model/effort into `spawn_agent` only when caller did not choose one. |
| `plugins/codexclaw/gui/` | exists | GUI model/provider selection if user-facing. |
| `structure/INDEX.md`, `structure/10_subagent_skill_routing.md`, docs-site pages | not path-checked in this pass | Durable docs; verify before editing. |

`rg -l "model|provider" codexclaw/plugins/codexclaw/ --type ts | head -10` returned mostly GUI files first (`gui/src/pages/Subagents.tsx`, `gui/src/App.tsx`, `gui/src/pages/Sessions.tsx`, `gui/src/pages/Agents.tsx`, `gui/src/api.ts`, etc.). Targeted `find` confirmed the provider-bridge and subagent-config source files listed above exist.

## Cross-Repo Ordering Examples

### New Native Provider in JWC and OCX

1. Implement and test JWC provider.
2. Regenerate JWC catalog and update docs.
3. Add OCX registry/adapter only if Codex proxy should route it.
4. Update `cli-jaw` registry/live discovery only if users can select it through cli-jaw.
5. Update `codexclaw` only if OCX/native catalog display or configured subagent models need it.
6. Update skill docs only for skills that invoke or document the provider.

### New Model ID for Existing Provider

1. Confirm provider runtime supports the model's wire format.
2. Update generated/static metadata in the owning runtime.
3. Run resolver/selector checks.
4. Update sibling static registries only when they hardcode model choices.
5. Avoid duplicating model metadata in skill docs unless the skill needs it.

### Auth-Only Change

1. Patch auth storage/broker/provider transport in the owner runtime.
2. Add precedence and redaction tests.
3. Update env/config docs.
4. Update OCX/cli-jaw/codexclaw only if their credential flow changes.

## Verification

Commands run:

```bash
ls /Users/jun/Developer/new/700_projects/opencodex/src/
rg -rn "provider|model" /Users/jun/Developer/new/700_projects/opencodex/src/providers/ --type ts 2>/dev/null | head -15
ls /Users/jun/Developer/new/700_projects/cli-jaw/src/ 2>/dev/null
rg -l "model|provider" /Users/jun/Developer/new/700_projects/codexclaw/plugins/codexclaw/ --type ts 2>/dev/null | head -10
test -e <each concrete path listed in the verified tables>
find /Users/jun/Developer/new/700_projects/opencodex/src/providers -maxdepth 1 -type f -name '*.ts' -print | sort
find /Users/jun/Developer/new/700_projects/codexclaw/plugins/codexclaw/components -maxdepth 4 -type f \( -name '*catalog*.ts' -o -name '*bridge*.ts' -o -name '*spawn*.ts' -o -name 'detect.ts' -o -name 'store.ts' -o -name 'cli.ts' \) -print | sort
rg -n "export const PROVIDERS|authMode|defaultModel|models" /Users/jun/Developer/new/700_projects/opencodex/src/providers/registry.ts --type ts | head -40
rg -n "providers/registry|resolveProvider|model" /Users/jun/Developer/new/700_projects/opencodex/src/router.ts --type ts | head -40
rg -n "model|provider" /Users/jun/Developer/new/700_projects/cli-jaw/src/cli/registry.ts /Users/jun/Developer/new/700_projects/cli-jaw/src/cli/registry-live.ts /Users/jun/Developer/new/700_projects/cli-jaw/src/cli/opencodex-models.ts --type ts | head -60
```

Confirmed:

- The OCX, cli-jaw, and codexclaw structures cited above exist.
- All concrete patch-surface paths marked `exists` were checked with `test -e`.
- The previous draft's `packages/ai/src/stream.ts` claim was not retained because that path does not exist.
- OCX routing is centered on `src/providers/registry.ts` plus `src/router.ts`.
- cli-jaw model exposure is centered on static registry, live registry, OCX model fetch, and JWC code-mode model defaults.
- codexclaw provider/model integration is centered on provider bridge, subagent config, and GUI surfaces.
