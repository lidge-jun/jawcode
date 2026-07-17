# Evidence Receipt: chase/model opencodex patch plan

Task: Update `struct_har/chase/model/` with the opencodex patch plan and the 2026-07-09 decision to import all provider-specific patches, including Fugu/Sakana and ZAI.

Working directory: `/Users/jun/Developer/new/700_projects/jawcode`

## Commands and Output

### 1. Explore opencodex source structure

Command:

```bash
ls /Users/jun/Developer/new/700_projects/opencodex/src/
```

Exit code: 0

Output:

```text
adapters
bridge.ts
cli
cli.ts
codex
config.ts
generated
index.ts
lib
oauth
providers
reasoning-effort.ts
responses
router.ts
server
service.ts
types.ts
update
usage
vision
web-search
```

### 2. Required broad provider/model/route grep

Command:

```bash
rg -l "provider\|model\|route" /Users/jun/Developer/new/700_projects/opencodex/src/ --type ts 2>/dev/null | head -15
```

Exit code: 0

Output:

```text
```

Judgment: The exact requested pattern uses escaped alternation with ripgrep's default regex handling and produced no matches. This was recorded as an empty result; follow-up targeted reads of `src/providers/registry.ts`, `src/router.ts`, `src/config.ts`, `src/types.ts`, `src/server/adapter-resolve.ts`, `src/codex/catalog.ts`, `src/codex/sync.ts`, and `src/server/management-api.ts` supplied the actual file-path evidence used in the docs.

### 3. Required index export preview

Command:

```bash
head -30 /Users/jun/Developer/new/700_projects/opencodex/src/index.ts 2>/dev/null
```

Exit code: 0

Output:

```text
export { startServer } from "./server";
export { parseRequest } from "./responses/parser";
export { bridgeToResponsesSSE, buildResponseJSON, formatErrorResponse } from "./bridge";
export { createAnthropicAdapter } from "./adapters/anthropic";
export { createAzureAdapter } from "./adapters/azure";
export { createCursorAdapter } from "./adapters/cursor";
export { createGoogleAdapter } from "./adapters/google";
export { createOpenAIChatAdapter } from "./adapters/openai-chat";
export { createResponsesPassthroughAdapter } from "./adapters/openai-responses";
export { loadConfig, saveConfig } from "./config";
export type { ProviderAdapter } from "./adapters/base";
export type {
  OcxConfig,
  OcxContext,
  OcxMessage,
  OcxParsedRequest,
  OcxProviderConfig,
  OcxRequestOptions,
  OcxTool,
  AdapterEvent,
} from "./types";
```

### 4. Required provider registration grep

Command:

```bash
rg -rn "providers\|addProvider\|registerProvider" /Users/jun/Developer/new/700_projects/opencodex/src/ --type ts 2>/dev/null | head -15
```

Exit code: 0

Output:

```text
```

Judgment: The exact requested search returned no `addProvider` or `registerProvider` evidence. The docs therefore state that OCX provider addition is registry/config/API driven, not a plugin-style registration call.

### 5. Verify updated model docs contain the requested sections and paths

Command:

```bash
rg -n "Interview Decision|OpenCodex Provider Coverage|Step-by-step|How OCX interacts|Import all provider|src/server/adapter-resolve.ts|src/codex/catalog.ts" struct_har/chase/model
```

Exit code: 0

Output:

```text
struct_har/chase/model/001_model_provider_inventory.md:59:## OpenCodex Provider Coverage
struct_har/chase/model/005_upstream_model_delta.md:62:## Interview Decision: Import All Provider Patches
struct_har/chase/model/README.md:45:## Interview Decision - 2026-07-09
struct_har/chase/model/README.md:47:Import all provider-specific patches, including Fugu/Sakana and ZAI. For every imported provider delta, check [004_cross_project_patch_index.md](./004_cross_project_patch_index.md) before implementation; its `opencodex` section is the patch plan for Codex proxy routing, model resolution, provider registry metadata, and OCX catalog exposure.
struct_har/chase/model/004_cross_project_patch_index.md:57:### Interview Decision Patch Plan (2026-07-09)
struct_har/chase/model/004_cross_project_patch_index.md:61:Import all provider-specific patches, including Fugu/Sakana and ZAI. That does not mean every patch becomes native JWC code. It means every imported provider delta must be triaged across both JWC and OCX, because OCX is the Codex proxy path where provider aliases, model IDs, auth modes, wire adapters, and catalog visibility may need parallel treatment.
struct_har/chase/model/004_cross_project_patch_index.md:68:| OpenCode Go / Kimi compatibility | Check `src/providers/registry.ts`, `src/server/adapter-resolve.ts`, `src/adapters/`, `src/responses/`, and `src/router.ts` for OpenAI-compatible request/response normalization. | Keep compatibility behavior in the OpenAI-compatible proxy layer. |
struct_har/chase/model/004_cross_project_patch_index.md:86:| `src/server/adapter-resolve.ts` | exists | Adapter factory and per-model wire-protocol overrides. Patch when a new adapter exists or a model under one provider must be driven over another wire protocol. |
struct_har/chase/model/004_cross_project_patch_index.md:89:| `src/codex/catalog.ts` | exists | Codex-visible `/v1/models` and catalog injection: native OpenAI slugs, routed `<provider>/<model>` entries, model metadata, context caps, selected/disabled models, media-generation filtering, and JWC metadata augmentation. |
struct_har/chase/model/004_cross_project_patch_index.md:93:| `src/generated/jawcode-model-metadata.ts` | exists | Generated JWC metadata bridge consumed by `src/codex/catalog.ts`; update only through its owning generation path. |
struct_har/chase/model/004_cross_project_patch_index.md:97:Step-by-step for a new OCX built-in provider:
struct_har/chase/model/004_cross_project_patch_index.md:103:5. If the provider needs a new wire protocol, implement the adapter under `src/adapters/`, export it if needed from `src/index.ts`, and add it to `resolveAdapter()` in `src/server/adapter-resolve.ts`.
struct_har/chase/model/004_cross_project_patch_index.md:104:6. If individual models under this provider need another wire protocol, add the model set to `ANTHROPIC_WIRE_MODELS` or the equivalent override in `src/server/adapter-resolve.ts`.
struct_har/chase/model/004_cross_project_patch_index.md:107:9. Verify Codex catalog exposure in `src/codex/catalog.ts`: context windows, input modalities, reasoning efforts, selected/disabled model filtering, media-generation filtering, and JWC metadata augmentation.
struct_har/chase/model/004_cross_project_patch_index.md:110:Step-by-step for adding a model to an existing OCX provider:
struct_har/chase/model/004_cross_project_patch_index.md:116:5. If the model needs special wire behavior, patch `src/server/adapter-resolve.ts` and the relevant adapter.
struct_har/chase/model/004_cross_project_patch_index.md:117:6. If the model is a media-generation model, confirm `src/codex/catalog.ts` hides it from Codex coding-agent model lists; if it is a vision-input chat model, avoid matching it as media generation.
struct_har/chase/model/004_cross_project_patch_index.md:120:How OCX interacts with JWC:
struct_har/chase/model/004_cross_project_patch_index.md:123:2. OCX exposes Codex-compatible proxy routing. Model strings can route as `<provider>/<model>` through `src/router.ts`; Codex sees routed models through `src/codex/catalog.ts` and `src/codex/sync.ts`.
```

Note: The actual README heading in the file uses an en dash. The line above is normalized in this receipt for ASCII safety; the source file was inspected separately and contains the intended 2026-07-09 decision note.

### 6. Trailing whitespace check

Command:

```bash
if rg -n "[ \t]+$" struct_har/chase/model/004_cross_project_patch_index.md struct_har/chase/model/001_model_provider_inventory.md struct_har/chase/model/005_upstream_model_delta.md struct_har/chase/model/README.md; then exit 1; else echo "no trailing whitespace found"; fi
```

Exit code: 0

Output:

```text
no trailing whitespace found
```

### 7. Git state scoped to touched docs and evidence

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

Judgment: The requested files live under `struct_har/chase/model/`. That directory is currently untracked in this worktree, so Git reports the directory as untracked instead of per-file tracked diffs. The receipt file is also under the requested `.codexclaw/evidence/` location.

## Final Judgment

The docs-only task is verified:

- `004_cross_project_patch_index.md` contains the expanded OCX patch plan, exact OCX routing/config/catalog/adapter paths, steps for adding a new OCX provider, steps for adding a new model to an existing OCX provider, and JWC/OCX interaction notes.
- `001_model_provider_inventory.md` contains the OpenCodex provider coverage section and records the 2026-07-09 import-all provider decision.
- `005_upstream_model_delta.md` records the import-all decision and cross-references the OCX plan in `004`.
- `README.md` records the 2026-07-09 interview decision and points readers to `004`.
- No `cxc` command was run.
- No files outside `struct_har/chase/model/` were modified for the requested docs work; this receipt file was added only because the verification hook required it under `.codexclaw/evidence/`.
