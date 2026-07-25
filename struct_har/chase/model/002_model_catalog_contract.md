# 002 — Model Catalog Contract

JWC has two catalog layers:

1. A generated bundled catalog in `packages/ai/src/models.json`.
2. Runtime/custom overlays loaded by `packages/coding-agent/src/config/model-registry.ts`.

Do not hand-edit `packages/ai/src/models.json`. The repository-local contract says to change generator/descriptors/resolvers and regenerate with `bun --cwd=packages/ai run generate-models`.

## Generated Catalog

The generator is `packages/ai/scripts/generate-models.ts`. Its first 40 lines confirm it is a Bun script that imports the previous generated `models.json`, `AuthStorage`, `createModelManager`, generated model policy helpers, `PROVIDER_DESCRIPTORS`, model-manager descriptors, GitLab Duo static models, OpenAI Codex constants, and Antigravity/Codex discovery helpers.

Verified generator structure:

| step | evidence | behavior |
|---|---|---|
| previous bundle import | `import prevModelsJson from "../src/models.json"` | Reads the previous generated catalog for fallback/preservation behavior. |
| descriptor import | `PROVIDER_DESCRIPTORS`, `isCatalogDescriptor`, `allowsUnauthenticatedCatalogDiscovery` | Uses descriptors as the standard provider discovery source. |
| auth import | `AuthStorage`, `OAuthAccess`, `SqliteAuthCredentialStore` | Catalog generation can consult env and stored credentials. |
| policy import | `applyGeneratedModelPolicies`, `linkOpenAIPromotionTargets`, `CLOUDFLARE_FALLBACK_MODEL` | Generated entries are post-processed by JWC policy. |
| special discovery imports | `fetchAntigravityDiscoveryModels`, `fetchCodexModels`, `getGitLabDuoModels` | Special providers are not only descriptor endpoint fetches. |

`wc -l packages/ai/src/models.json` returned `81225`, confirming the bundled catalog is a large generated artifact.

## Descriptor Contract

`packages/ai/src/provider-models/descriptors.ts` is the shared metadata owner for standard providers. It defines:

| symbol | purpose |
|---|---|
| `ProviderDescriptor` | provider id, model manager factory, default model, unauthenticated runtime flag, optional catalog discovery |
| `CatalogDiscoveryConfig` | generator label, env vars, OAuth provider, unauthenticated discovery flag |
| `isCatalogDescriptor()` | type guard for descriptors that participate in endpoint catalog discovery |
| `allowsUnauthenticatedCatalogDiscovery()` | central unauthenticated discovery decision |
| `PROVIDER_DESCRIPTORS` | standard provider descriptors |
| `DEFAULT_MODEL_PER_PROVIDER` | defaults for every `KnownProvider`, including special providers outside `PROVIDER_DESCRIPTORS` |

Descriptor forms:

| form | meaning |
|---|---|
| `descriptor(...)` | runtime/default metadata; not endpoint-fetched unless special logic covers it |
| `catalogDescriptor(...)` | runtime/default metadata plus generator endpoint discovery config |
| `DEFAULT_MODEL_PER_PROVIDER` | full known-provider default map, built from descriptors plus special defaults |

## Runtime Registry Layer

`packages/coding-agent/src/config/model-registry.ts` loads the bundled catalog and runtime custom config. The requested grep confirms this file owns the relevant config surface:

```text
model-registry.ts:517: Result of loading custom models from models.json
model-registry.ts:1029: Reload models from disk (built-in + custom from models.json).
model-registry.ts:1088: removed from models.yml must actually disappear from the resolver
model-registry.ts:1115: models: customModels = [],
model-registry.ts:1202: #mergeCustomModels(...)
model-registry.ts:1450: bearer in models.yml ...
```

Terminology note: some code comments still say "custom models from models.json", but the active user-facing config is `models.yml`; the same grep output includes `models.yml` removal and auth comments. Keep docs clear: `packages/ai/src/models.json` is bundled/generated, while `models.yml` is user custom config.

Verified runtime behavior:

| behavior | source evidence |
|---|---|
| bundled + custom reload | `#reloadStaticModels()` invalidates config state, clears config API keys, restores runtime keys, then calls `#loadModels()` |
| custom overlays | `#loadModels()` reads `customModels`, overrides, keyless/discoverable/configured providers, equivalence, bindings, and profiles |
| merge semantics | `#mergeCustomModels()` replaces matching provider/id entries and enriches thinking metadata |
| auth config override | provider `apiKey` or `apiKeyEnv` resolves into `#customProviderApiKeys` and `authStorage.setConfigApiKey()` |
| discovery merge | `mergeDiscoveredModel()` prioritizes explicit provider override base URL, then discovered base URL, then bundled base URL |

## Resolver Pipeline

`packages/coding-agent/src/config/model-resolver.ts` owns selector parsing and initial choice behavior.

| stage | verified behavior |
|---|---|
| parse selector | `parseModelString()` accepts `provider/modelId` and strips a valid trailing thinking suffix. |
| format selector | `formatModelString()` emits `provider/modelId`; `formatModelSelectorValue()` appends a non-inherit thinking level. |
| pattern matching | `parseModelPattern()` builds preference context and resolves exact/fuzzy/canonical patterns. |
| role aliases | `pi/<role>`, `default`, and `self` are handled by role-alias helpers; `self` and `default` can intentionally resolve to inherited behavior. |
| role values | `resolveModelRoleValue()` resolves configured role selectors against available models and thinking metadata. |
| task/subagent fallback | `resolveModelOverrideWithAuthFallback()` tries configured patterns, treats `kNoAuth` local providers as authenticated, then falls back to parent active model only when needed. |
| allowed scope | `resolveAllowedModels()` starts from `getAvailable()` and applies scoped `enabledModels`; empty scoped matches stay empty rather than falling back globally. |
| CLI `--model` | `resolveCliModel()` supports provider-prefixed selectors, canonical IDs, exact IDs, and pattern parsing. |
| initial selection | `findInitialModel()` uses CLI provider/model, then scoped models, then saved default, then default-per-provider/first available. |
| session restore | `restoreModelFromSession()` restores saved provider/model only if it exists and has a valid key; otherwise it falls back to current or first available model. |

Correction from the previous draft: the current `findInitialModel()` code does not place session restore inside its own priority list. Session restore is handled by `restoreModelFromSession()` as a separate function.

## `/model` Surface

The slash command lives in `packages/coding-agent/src/slash-commands/builtin-registry.ts`. The verified handler:

- sets `allowArgs: true` so `/model sonnet` is dispatched as a command;
- parses optional target selectors;
- resolves the selected model;
- persists default model selection via `runtime.session.setModel()`;
- persists agent-role overrides in `task.agentModelOverrides`;
- opens `runtime.ctx.showModelSelector()` for bare TUI `/model`.

The interactive UI owner remains `packages/coding-agent/src/modes/components/model-selector.ts`.

## `/effort` Surface

Thinking metadata comes from `ThinkingConfig` in `packages/ai/src/types.ts`, generated/model policy in `packages/ai/src/model-thinking.ts`, resolver thinking suffix parsing, and command aliases in `builtin-registry.ts`. When adding a model with unusual thinking behavior, patch metadata and provider wire mapping together.

## 2026-07-17 Catalog, Selection, and Fallback Delta

The GJC `4a80bac9..3ddf26079` and OMP `7aa1d581c..b0d04e517` ranges add a broader contract than a static model list. Catalog discovery, selection UX, fallback policy, durable defaults, thinking capabilities, and prompt preprocessing now need to be reviewed as one pipeline.

### Model hub and floating selection

| contract | upstream evidence | JWC adoption rule |
|---|---|---|
| unified model hub | OMP `59d08172c` | Treat browsing, searching, role management, and availability state as views over one registry. Do not create a second catalog owner in the UI. |
| floating model selection | OMP `8dbc43b6e` | A temporary selection may preview or stage a model without promoting it to the durable default. Promotion requires an explicit persistence boundary. |
| custom role management | OMP `ab7b776f9`, `af7345e87` | Role overrides must resolve through the same auth and thinking metadata checks as the active model. |
| search ranking | OMP `666327608` | Rank exact provider/model matches before aliases and fuzzy text while preserving deterministic ties. |
| performance tracking | OMP `c4fa0ebaa` | Persist measurements with schema migration and model identity keys; never let historical speed data silently change auth eligibility. |

### Presets, sticky fallback, and durable defaults

| contract | upstream evidence | JWC adoption rule |
|---|---|---|
| sticky fallback chains | GJC `bceb66bab` | Preserve the selected preset/override fallback chain across retries and turns. A fallback result must not silently replace the user's durable default. |
| hard-error and retry-budget fallback | OMP `58d6130b5`, `d54dcc222` | Advance only after a classified hard error or exhausted retry budget. Keep safety stops and local managed failures out of generic provider fallback. |
| durable default model | GJC `82b5159b8`, `c8c2d92b9` | Persist only after explicit selection succeeds. Fence deferred/RPC promotion so session rollback cannot commit an unconfirmed default. |
| durable thinking level | GJC `41c8e1f76`, `9f6de8820` | Preserve an unchanged explicit thinking level across selection persistence; do not rewrite it to an inferred provider default. |
| `mpreset` authority | GJC `2f213136c` | Resolve profile selection through one authoritative preset path and make its model/role/thinking result inspectable. |
| preset reasoning | GJC `f30323b2e`, `cc661b43a` | Keep benchmark-derived preset effort as configuration, not a provider-wide hardcoded default. |

### Thinking, prompt caps, and preprocessing

| contract | upstream evidence | JWC adoption rule |
|---|---|---|
| thinking capabilities | GJC `1a3d04649` | Expose supported levels/capabilities from model metadata and validate selection before transport mapping. |
| GPT-5.6 prompt cap | GJC `236ecf14c` | Enforce the model-specific cap before request dispatch, including custom/preset routes that resolve to GPT-5.6 Codex. |
| `invalid_prompt` circuit breaker | GJC `cf94f8804` | Classify explicitly and stop bounded retries when the prompt itself is invalid. Do not fold this into transient transport retry. |
| small-model preprocessing | OMP `93635e7b6` | Centralize compact guidance/envelope preprocessing before task dispatch; avoid role-specific copies that drift. |
| task-agent resolution | OMP `425e583ae`, `441037025` | Resolve task-agent fields, model selectors, and thinking precedence once, then pass the resolved contract to execution. |
| fuzzy thinking suffix | OMP `a55e4b1a7` | Preserve a valid literal suffix through fuzzy model matching and clear stale thinking only when automatic role assignment changes the model contract. |
| non-vision fallback | OMP `00c8e921f` | Strip or replace images only at an explicit text-only fallback boundary and retain user-visible evidence that media was omitted. |

### Transport boundary constraints

Reserved control tokens neutralized by GJC `5ca557eaa`, `032f5cb6b`, `9663f7744`, and `749449a6a` are transport-boundary concerns, not catalog aliases. Catalog/model selection must never encode leaked control text as a model capability or retry hint.

Adoption checklist:

- [ ] Keep bundled catalog, runtime registry, model hub, and resolver on one model identity contract.
- [ ] Separate temporary/floating selection from durable default promotion.
- [ ] Test sticky fallback across presets, role overrides, retries, and session restore.
- [ ] Verify thinking capability and prompt-cap validation before provider dispatch.
- [ ] Verify small-model preprocessing and task-agent resolution with one centralized precedence path.

## Done Checklist For Catalog Changes

- [ ] Decide whether the change belongs to generated bundled catalog, runtime discovery, custom `models.yml`, or profile/preset behavior.
- [ ] Update `KnownProvider` only for real native providers.
- [ ] Update descriptor/default/model manager and transport only when runtime can call the provider.
- [ ] Regenerate `packages/ai/src/models.json` through the generator when static catalog data changes.
- [ ] Verify `/model`, `--list-models`, and role/profile selection against expected selectors.
- [ ] Update `docs/models.md` and `docs/environment-variables.md` for user-facing auth/config changes.

## Verification

Commands run:

```bash
cat packages/ai/scripts/generate-models.ts | head -40
rg -n "models\.json|models\.yml|customModels" packages/coding-agent/src/config/ --type ts | head -15
wc -l packages/ai/src/models.json
sed -n '430,470p' packages/coding-agent/src/config/model-registry.ts
sed -n '1020,1135p' packages/coding-agent/src/config/model-registry.ts
sed -n '1200,1225p' packages/coding-agent/src/config/model-registry.ts
sed -n '35,95p' packages/coding-agent/src/config/model-resolver.ts
sed -n '500,585p' packages/coding-agent/src/config/model-resolver.ts
sed -n '617,660p' packages/coding-agent/src/config/model-resolver.ts
sed -n '753,825p' packages/coding-agent/src/config/model-resolver.ts
sed -n '995,1025p' packages/coding-agent/src/config/model-resolver.ts
sed -n '1032,1188p' packages/coding-agent/src/config/model-resolver.ts
sed -n '1193,1358p' packages/coding-agent/src/config/model-resolver.ts
sed -n '780,865p' packages/coding-agent/src/slash-commands/builtin-registry.ts
```

Confirmed:

- The generator imports descriptors, previous `models.json`, auth storage, policy helpers, GitLab Duo, Antigravity, and Codex discovery helpers.
- `packages/ai/src/models.json` has 81,225 lines and should be treated as generated.
- `model-registry.ts` is the runtime overlay owner for custom models, provider overrides, keyless/discoverable providers, equivalence, bindings, profiles, and config API keys.
- `model-resolver.ts` matches the resolver pipeline above; initial selection and session restore are separate functions in current code.
- `/model` command supports args and TUI selector dispatch in `builtin-registry.ts`.
