# chase/model — Model and Provider Support Reference

This directory is the JWC-wide reference point for model/provider support. Use it before patching `packages/ai`, `/model`, `/effort`, model presets, auth storage, OpenAI-compatible proxy routing, or any sibling repo in `/Users/jun/Developer/new/700_projects` that needs to understand the same provider surface.

The goal is separation. The normal chase cards stay focused on upstream gaps and done evidence; this directory keeps the durable cross-project map: what JWC supports, how the generated catalog works, how auth flows resolve, where every repo should patch, and which current GJC/OMP deltas are model-related.

## Reading Order

1. [001_model_provider_inventory.md](./001_model_provider_inventory.md) — current JWC provider inventory, upstream-only provider gaps, and MLB 20-80 comparison.
2. [002_model_catalog_contract.md](./002_model_catalog_contract.md) — generated catalog contract, resolver pipeline, presets, `/model`, and `/effort`.
3. [003_provider_auth_flow.md](./003_provider_auth_flow.md) — provider auth flows, opaque tokens, API keys, OAuth, broker mode, and env vars.
4. [004_cross_project_patch_index.md](./004_cross_project_patch_index.md) — exact patch surfaces across `jawcode`, `opencodex`, `cli-jaw`, `cli-jaw-skills`, and `codexclaw`.
5. [005_upstream_model_delta.md](./005_upstream_model_delta.md) — GJC and OMP current model/provider deltas from the latest chase pull.

## Cross-References

| card | status | why it matters here |
|---|---:|---|
| [`_fin/10/10.036_gjc_chase_ai_provider_auth_model_catalog.md`](../_fin/10/10.036_gjc_chase_ai_provider_auth_model_catalog.md) | `_fin` | Closed the original GJC auth/catalog parity slice and records the no-direct-`models.json` posture. |
| [`_fin/10/10.069_gjc_chase_provider_search_docs_model_support.md`](../_fin/10/10.069_gjc_chase_provider_search_docs_model_support.md) | `_fin` | Provider/search/docs/model support evidence, including Claude Sonnet 5 and retry/search documentation closure. |
| [`_fin/20/20.023_omp_chase_ai_providers_catalog_service_tier.md`](../_fin/20/20.023_omp_chase_ai_providers_catalog_service_tier.md) | `_fin` | OMP provider/catalog/service-tier design reference and explicit no-code triage. |
| [`../20.036_omp_chase_ai_catalog_auth_usage.md`](../20.036_omp_chase_ai_catalog_auth_usage.md) | active | Current OMP catalog/auth/usage reference card; includes Baseten, Claude usage/rate-limit, signing, and resolver fixes. |
| [`../10.066_gjc_chase_composer_command_model_selector_ux.md`](../10.066_gjc_chase_composer_command_model_selector_ux.md) | active | GJC composer and `/model` selector UX reference. |
| [`../10.072_gjc_chase_model_selector_tmux_cmux_ux.md`](../10.072_gjc_chase_model_selector_tmux_cmux_ux.md) | active | Current GJC model-selector state/search cursor and tmux/cmux UX cluster. |

## Primary JWC Owners

| surface | owner path |
|---|---|
| provider types and transport APIs | `packages/ai/src/types.ts` |
| provider descriptors and default models | `packages/ai/src/provider-models/descriptors.ts` |
| provider runtime implementations | `packages/ai/src/providers/` |
| generated model catalog | `packages/ai/src/models.json` |
| catalog generator | `packages/ai/scripts/generate-models.ts` |
| registry + custom `models.yml` merge | `packages/coding-agent/src/config/model-registry.ts` |
| model parsing/resolution | `packages/coding-agent/src/config/model-resolver.ts` |
| interactive model selector | `packages/coding-agent/src/modes/components/model-selector.ts` |
| slash command dispatch | `packages/coding-agent/src/slash-commands/builtin-registry.ts` |
| user docs | `docs/models.md`, `docs/environment-variables.md` |

## Operating Rule

Do not patch a provider in only one place. A real provider/model change usually crosses the type union, descriptor/default, transport, auth/env mapping, generated catalog, resolver or selector behavior, user docs, and at least one sibling consumer. If the change is only a model addition for an existing generated provider, start at the generator/descriptors and regenerate; never hand-edit `packages/ai/src/models.json`.

## Interview Decision — 2026-07-09

Import all provider-specific patches, including Fugu/Sakana and ZAI. For every imported provider delta, check [004_cross_project_patch_index.md](./004_cross_project_patch_index.md) before implementation; its `opencodex` section is the patch plan for Codex proxy routing, model resolution, provider registry metadata, and OCX catalog exposure.

## Jawdev chase expansion — 2026-07-09

> Document: `struct_har/chase/model/README.md`
> Title: chase/model — Model and Provider Support Reference
> Lane: JWC model/provider coordination
> Status: active chase reference
> Canonical source: `packages/ai`, `packages/coding-agent/src/config/model-*`, `docs/models.md`, `docs/environment-variables.md`, plus GJC/OMP chase clones
> Primary patch surfaces: `packages/ai/`, `packages/coding-agent/src/config/`, `packages/coding-agent/src/modes/components/model-selector.ts`, sibling repos under `/Users/jun/Developer/new/700_projects/`

### Why this is behind or can drift

1. Model catalogs change faster than chase cards, and provider auth behavior can drift independently from model IDs.
2. JWC has generated catalog rules, custom `models.yml`, OAuth/broker auth, model profiles, and role assignment UX; a provider patch that ignores one layer is incomplete.
3. GJC and OMP often land provider changes as mixed commits with UX, auth, retry, usage, and catalog edits in one cluster.
4. Sibling repos (`opencodex`, `cli-jaw`, `cli-jaw-skills`, `codexclaw`) reuse provider/model names but do not own JWC's runtime contracts.
5. A direct source clone copy can be wrong when upstream uses `gjc` naming, OMP `packages/catalog`, or non-JWC auth assumptions.

### Where to patch

1. Start here, then open [004_cross_project_patch_index.md](./004_cross_project_patch_index.md).
2. Patch JWC source only after deciding whether the change is native provider support, generated catalog data, auth-only behavior, UI selection behavior, or sibling-reference metadata.
3. Keep public command names and examples JWC-first: `jwc`, `.jwc`, and `@jawcode-dev/*`.
4. Treat `devlog/_gjc_chase/gajae-code` and `devlog/_omp_chase/oh-my-pi` as read-only evidence unless the explicit task is to update those clones.
5. For sibling repos, patch only the repo that owns the behavior; do not use `codexclaw` as a provider proxy and do not use `cli-jaw-skills` as a runtime registry.

### Decision needed before patching

1. Is this a new provider, a new model for an existing provider, a catalog metadata correction, an auth/credential change, a usage/billing change, or a selector UX change?
2. Does the provider belong natively in JWC, only in `opencodex`, only in `cli-jaw`, or only as skill documentation?
3. Does the generated catalog need regeneration, or is this a runtime-discovery/custom-config-only change?
4. Does auth require API key, OAuth, Codex opaque token, broker refresh, or local keyless handling?
5. Which focused test proves the selected behavior?

### Verification and done evidence

1. Cite source commit anchors or JWC file:line anchors in the change note.
2. Run `git diff --check` for docs-only changes.
3. For runtime changes, run the focused package tests that exercise provider auth, catalog generation, resolver behavior, or selector dispatch.
4. For generated catalog changes, include the generator command and the diff summary.
5. Do not call a model/provider patch done until [004_cross_project_patch_index.md](./004_cross_project_patch_index.md) has been checked for sibling surfaces.
