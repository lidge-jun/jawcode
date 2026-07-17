# Evidence Receipt: subagent-stop 7/19 fresh attempt 2

Task: update `struct_har/chase/model/` with the opencodex patch plan and the 2026-07-09 decision to import all provider-specific patches, including Fugu/Sakana and ZAI.

Working directory: `/Users/jun/Developer/new/700_projects/jawcode`

## Check 1: Required content exists

Command:

```bash
rg -n "OpenCodex Provider Coverage|Import all provider-specific patches|Step-by-step for a new OCX built-in provider|Step-by-step for adding a model to an existing OCX provider|How OCX interacts with JWC|src/providers/registry.ts|src/router.ts|src/codex/catalog.ts" struct_har/chase/model/001_model_provider_inventory.md struct_har/chase/model/004_cross_project_patch_index.md struct_har/chase/model/005_upstream_model_delta.md struct_har/chase/model/README.md
```

Exit code: 0

Output:

```text
struct_har/chase/model/README.md:47:Import all provider-specific patches, including Fugu/Sakana and ZAI. For every imported provider delta, check [004_cross_project_patch_index.md](./004_cross_project_patch_index.md) before implementation; its `opencodex` section is the patch plan for Codex proxy routing, model resolution, provider registry metadata, and OCX catalog exposure.
struct_har/chase/model/004_cross_project_patch_index.md:11:| OpenAI-compatible proxy route for Codex runtime | `/Users/jun/Developer/new/700_projects/opencodex/src/providers/registry.ts` and `src/router.ts` | OCX adapters/responses, `cli-jaw` OCX fetch, codexclaw detect/catalog display |
struct_har/chase/model/004_cross_project_patch_index.md:61:Import all provider-specific patches, including Fugu/Sakana and ZAI. That does not mean every patch becomes native JWC code. It means every imported provider delta must be triaged across both JWC and OCX, because OCX is the Codex proxy path where provider aliases, model IDs, auth modes, wire adapters, and catalog visibility may need parallel treatment.
struct_har/chase/model/004_cross_project_patch_index.md:68:| OpenCode Go / Kimi compatibility | Check `src/providers/registry.ts`, `src/server/adapter-resolve.ts`, `src/adapters/`, `src/responses/`, and `src/router.ts` for OpenAI-compatible request/response normalization. | Keep compatibility behavior in the OpenAI-compatible proxy layer. |
struct_har/chase/model/004_cross_project_patch_index.md:79:| `src/providers/registry.ts` | exists | Canonical built-in provider registry: `PROVIDER_REGISTRY`, provider IDs, labels, adapters, base URLs, auth kind, OAuth ID, default models, static model lists, context windows, input modalities, reasoning maps, no-vision/no-reasoning/no-parameter lists, `jawcodeBundle`, and dashboard presets. |
struct_har/chase/model/004_cross_project_patch_index.md:83:| `src/router.ts` | exists | Runtime model resolution: explicit `<provider>/<model>`, provider default models, known model-prefix routing, configured `models`, then default provider fallback. Patch when a new provider needs bare-model prefix routing or route merge behavior. |
struct_har/chase/model/004_cross_project_patch_index.md:89:| `src/codex/catalog.ts` | exists | Codex-visible `/v1/models` and catalog injection: native OpenAI slugs, routed `<provider>/<model>` entries, model metadata, context caps, selected/disabled models, media-generation filtering, and JWC metadata augmentation. |
struct_har/chase/model/004_cross_project_patch_index.md:93:| `src/generated/jawcode-model-metadata.ts` | exists | Generated JWC metadata bridge consumed by `src/codex/catalog.ts`; update only through its owning generation path. |
struct_har/chase/model/004_cross_project_patch_index.md:97:Step-by-step for a new OCX built-in provider:
struct_har/chase/model/004_cross_project_patch_index.md:100:2. Add or update the `PROVIDER_REGISTRY` entry in `src/providers/registry.ts`: stable `id`, `label`, `adapter`, `baseUrl`, `authKind`, `dashboardUrl`, `defaultModel`, `models`, `liveModels`, metadata maps, parameter exclusion lists, `jawcodeBundle`, and aliases.
struct_har/chase/model/004_cross_project_patch_index.md:105:7. Add bare-model prefix routing in `src/router.ts` only when users should type the bare model ID without `<provider>/`. Otherwise rely on explicit `<provider>/<model>`, default model, and configured `models`.
struct_har/chase/model/004_cross_project_patch_index.md:107:9. Verify Codex catalog exposure in `src/codex/catalog.ts`: context windows, input modalities, reasoning efforts, selected/disabled model filtering, media-generation filtering, and JWC metadata augmentation.
struct_har/chase/model/004_cross_project_patch_index.md:110:Step-by-step for adding a model to an existing OCX provider:
struct_har/chase/model/004_cross_project_patch_index.md:112:1. Identify the owning OCX provider ID and adapter in `src/providers/registry.ts`.
struct_har/chase/model/004_cross_project_patch_index.md:117:6. If the model is a media-generation model, confirm `src/codex/catalog.ts` hides it from Codex coding-agent model lists; if it is a vision-input chat model, avoid matching it as media generation.
struct_har/chase/model/004_cross_project_patch_index.md:120:How OCX interacts with JWC:
struct_har/chase/model/004_cross_project_patch_index.md:123:2. OCX exposes Codex-compatible proxy routing. Model strings can route as `<provider>/<model>` through `src/router.ts`; Codex sees routed models through `src/codex/catalog.ts` and `src/codex/sync.ts`.
struct_har/chase/model/004_cross_project_patch_index.md:230:rg -n "export const PROVIDERS|authMode|defaultModel|models" /Users/jun/Developer/new/700_projects/opencodex/src/providers/registry.ts --type ts | head -40
struct_har/chase/model/004_cross_project_patch_index.md:231:rg -n "providers/registry|resolveProvider|model" /Users/jun/Developer/new/700_projects/opencodex/src/router.ts --type ts | head -40
struct_har/chase/model/004_cross_project_patch_index.md:240:- OCX routing is centered on `src/providers/registry.ts` plus `src/router.ts`.
struct_har/chase/model/001_model_provider_inventory.md:59:## OpenCodex Provider Coverage
struct_har/chase/model/001_model_provider_inventory.md:67:| OpenAI / Codex | yes | `opencodex/src/providers/registry.ts` has OpenAI API-key entries and router model routing | Patch JWC for JWC runtime; patch OCX only for Codex proxy behavior. |
struct_har/chase/model/001_model_provider_inventory.md:76:| Fugu/Sakana login (`fish_` keys) | no native `KnownProvider` yet | not confirmed as existing OCX provider; evaluate `src/providers/registry.ts` and `src/oauth/` before import | Import the patch as a tracked provider delta even if final action is "no native JWC provider." |
struct_har/chase/model/001_model_provider_inventory.md:77:| ZAI weekly-limit taxonomy | native `zai` exists; compare rate-limit behavior | OCX `zai` registry entry exists in `src/providers/registry.ts`; adapter/error path must be checked before mirroring taxonomy | Import and evaluate in both runtimes because both expose ZAI-shaped behavior. |
```

Judgment: The requested import-all decision, OpenCodex coverage, OCX provider/model steps, and key OCX path references are present.

## Check 2: Target docs and referenced OCX files exist

Command:

```bash
for p in struct_har/chase/model/001_model_provider_inventory.md struct_har/chase/model/004_cross_project_patch_index.md struct_har/chase/model/005_upstream_model_delta.md struct_har/chase/model/README.md /Users/jun/Developer/new/700_projects/opencodex/src/providers/registry.ts /Users/jun/Developer/new/700_projects/opencodex/src/router.ts /Users/jun/Developer/new/700_projects/opencodex/src/codex/catalog.ts /Users/jun/Developer/new/700_projects/opencodex/src/server/adapter-resolve.ts /Users/jun/Developer/new/700_projects/opencodex/src/server/management-api.ts; do test -f "$p" && echo "exists $p" || { echo "missing $p"; exit 1; }; done
```

Exit code: 0

Output:

```text
exists struct_har/chase/model/001_model_provider_inventory.md
exists struct_har/chase/model/004_cross_project_patch_index.md
exists struct_har/chase/model/005_upstream_model_delta.md
exists struct_har/chase/model/README.md
exists /Users/jun/Developer/new/700_projects/opencodex/src/providers/registry.ts
exists /Users/jun/Developer/new/700_projects/opencodex/src/router.ts
exists /Users/jun/Developer/new/700_projects/opencodex/src/codex/catalog.ts
exists /Users/jun/Developer/new/700_projects/opencodex/src/server/adapter-resolve.ts
exists /Users/jun/Developer/new/700_projects/opencodex/src/server/management-api.ts
```

Judgment: The target docs and referenced OCX source files exist.

## Check 3: Trailing whitespace

Command:

```bash
if rg -n "[ \t]+$" struct_har/chase/model/001_model_provider_inventory.md struct_har/chase/model/004_cross_project_patch_index.md struct_har/chase/model/005_upstream_model_delta.md struct_har/chase/model/README.md; then exit 1; else echo "no trailing whitespace found"; fi
```

Exit code: 0

Output:

```text
no trailing whitespace found
```

Judgment: The edited Markdown files pass the whitespace check.

## Check 4: Scoped git status

Command:

```bash
git status --short -- struct_har/chase/model .codexclaw/evidence | sed -n '1,40p'
```

Exit code: 0

Output before this receipt file was added:

```text
?? .codexclaw/evidence/
?? struct_har/chase/model/
```

Judgment: The requested docs directory is untracked in this worktree, and evidence receipts are under `.codexclaw/evidence/` as required.

## Final Judgment

Verified. The docs-only update is present, the referenced OCX source paths exist, the Markdown files pass trailing-whitespace checks, and no `cxc` command was run.
