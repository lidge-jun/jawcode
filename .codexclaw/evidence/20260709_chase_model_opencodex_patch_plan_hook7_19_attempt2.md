# Evidence Receipt: hook7/hook19 attempt 2

Task: update `struct_har/chase/model/` with the opencodex patch plan and the 2026-07-09 decision to import all provider-specific patches, including Fugu/Sakana and ZAI.

Working directory: `/Users/jun/Developer/new/700_projects/jawcode`

## Check 1: Target documentation excerpts

Command:

```bash
set -o pipefail
sed -n '57,125p' struct_har/chase/model/004_cross_project_patch_index.md
sed -n '59,82p' struct_har/chase/model/001_model_provider_inventory.md
sed -n '62,70p' struct_har/chase/model/005_upstream_model_delta.md
sed -n '45,48p' struct_har/chase/model/README.md
```

Exit code: 0

Output:

```text
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
```

Note: the command output continued into the other three target files and showed the `OpenCodex Provider Coverage`, `Interview Decision: Import All Provider Patches`, and README `Interview Decision - 2026-07-09` sections.

Judgment: The target docs contain the requested OCX patch plan, provider/model steps, import-all decision, and cross-references.

## Check 2: Referenced OCX files exist

Command:

```bash
for p in /Users/jun/Developer/new/700_projects/opencodex/src/providers/registry.ts /Users/jun/Developer/new/700_projects/opencodex/src/providers/derive.ts /Users/jun/Developer/new/700_projects/opencodex/src/oauth/key-providers.ts /Users/jun/Developer/new/700_projects/opencodex/src/router.ts /Users/jun/Developer/new/700_projects/opencodex/src/config.ts /Users/jun/Developer/new/700_projects/opencodex/src/types.ts /Users/jun/Developer/new/700_projects/opencodex/src/server/adapter-resolve.ts /Users/jun/Developer/new/700_projects/opencodex/src/codex/catalog.ts /Users/jun/Developer/new/700_projects/opencodex/src/codex/sync.ts /Users/jun/Developer/new/700_projects/opencodex/src/server/management-api.ts; do test -e "$p" && echo "exists $p" || { echo "missing $p"; exit 1; }; done
```

Exit code: 0

Output:

```text
exists /Users/jun/Developer/new/700_projects/opencodex/src/providers/registry.ts
exists /Users/jun/Developer/new/700_projects/opencodex/src/providers/derive.ts
exists /Users/jun/Developer/new/700_projects/opencodex/src/oauth/key-providers.ts
exists /Users/jun/Developer/new/700_projects/opencodex/src/router.ts
exists /Users/jun/Developer/new/700_projects/opencodex/src/config.ts
exists /Users/jun/Developer/new/700_projects/opencodex/src/types.ts
exists /Users/jun/Developer/new/700_projects/opencodex/src/server/adapter-resolve.ts
exists /Users/jun/Developer/new/700_projects/opencodex/src/codex/catalog.ts
exists /Users/jun/Developer/new/700_projects/opencodex/src/codex/sync.ts
exists /Users/jun/Developer/new/700_projects/opencodex/src/server/management-api.ts
```

Judgment: The OCX source paths used by the docs are real.

## Check 3: Trailing whitespace

Command:

```bash
if rg -n "[ \t]+$" struct_har/chase/model/004_cross_project_patch_index.md struct_har/chase/model/001_model_provider_inventory.md struct_har/chase/model/005_upstream_model_delta.md struct_har/chase/model/README.md; then exit 1; else echo "no trailing whitespace found"; fi
```

Exit code: 0

Output:

```text
no trailing whitespace found
```

Judgment: The edited Markdown files have no trailing whitespace.

## Check 4: Scoped git status

Command:

```bash
git status --short -- struct_har/chase/model .codexclaw/evidence
```

Exit code: 0

Output before this receipt file was added:

```text
?? .codexclaw/evidence/
?? struct_har/chase/model/
```

Judgment: The model docs directory and evidence directory are currently untracked in this worktree. The requested docs work stayed under `struct_har/chase/model/`; this evidence receipt was added under `.codexclaw/evidence/` only to satisfy the verification hook.

## Final Judgment

Verified. The docs-only update is present, the OCX source paths cited by the plan exist, the Markdown whitespace check passes, and no `cxc` command was run.
