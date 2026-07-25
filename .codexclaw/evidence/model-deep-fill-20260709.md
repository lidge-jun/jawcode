# Evidence Receipt — chase/model Deep Fill

Date: 2026-07-09

Task: rewrite `struct_har/chase/model/001` through `005` with verified code grep evidence.

## Commands Run

```bash
rg -n "KnownProvider|providerKey" packages/ai/src/types.ts --type ts
ls packages/ai/src/providers/
rg -n "providerDescriptors\b|defaultModel" packages/ai/src/provider-models/descriptors.ts --type ts | head -20
ls /Users/jun/Developer/new/700_projects/opencodex/src/providers/ 2>/dev/null
sed -n '101,151p' packages/ai/src/types.ts
sed -n '1,360p' packages/ai/src/provider-models/descriptors.ts
```

Judgement: confirmed the `KnownProvider` list, provider implementation directory, uppercase `PROVIDER_DESCRIPTORS` symbol, current defaults, and OpenCodex provider helper files.

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

Judgement: confirmed generator imports, `models.json` line count (`81225`), registry custom overlay behavior, resolver pipeline, and `/model` command behavior.

```bash
rg -n "authStorage|authBroker|oauthFlow|apiKey" packages/ai/src/auth* --type ts | head -20
rg -n "OPENAI_API_KEY|ANTHROPIC_API_KEY|GEMINI_API_KEY|XAI_API_KEY|DEEPSEEK_API_KEY" docs/environment-variables.md | head -15
sed -n '523,551p' docs/models.md
sed -n '35,90p' docs/environment-variables.md
```

Judgement: confirmed auth-storage API key override functions, login/save flows, user-facing auth precedence, broker note, and provider env var rows.

```bash
ls /Users/jun/Developer/new/700_projects/opencodex/src/
rg -rn "provider|model" /Users/jun/Developer/new/700_projects/opencodex/src/providers/ --type ts 2>/dev/null | head -15
ls /Users/jun/Developer/new/700_projects/cli-jaw/src/ 2>/dev/null
rg -l "model|provider" /Users/jun/Developer/new/700_projects/codexclaw/plugins/codexclaw/ --type ts 2>/dev/null | head -10
find /Users/jun/Developer/new/700_projects/opencodex/src/providers -maxdepth 1 -type f -name '*.ts' -print | sort
find /Users/jun/Developer/new/700_projects/codexclaw/plugins/codexclaw/components -maxdepth 4 -type f \( -name '*catalog*.ts' -o -name '*bridge*.ts' -o -name '*spawn*.ts' -o -name 'detect.ts' -o -name 'store.ts' -o -name 'cli.ts' \) -print | sort
rg -n "export const PROVIDERS|authMode|defaultModel|models" /Users/jun/Developer/new/700_projects/opencodex/src/providers/registry.ts --type ts | head -40
rg -n "providers/registry|resolveProvider|model" /Users/jun/Developer/new/700_projects/opencodex/src/router.ts --type ts | head -40
rg -n "model|provider" /Users/jun/Developer/new/700_projects/cli-jaw/src/cli/registry.ts /Users/jun/Developer/new/700_projects/cli-jaw/src/cli/registry-live.ts /Users/jun/Developer/new/700_projects/cli-jaw/src/cli/opencodex-models.ts --type ts | head -60
```

Judgement: confirmed sibling repo structures and concrete path existence for patch-index surfaces. Corrected the stale `packages/ai/src/stream.ts` claim because that path did not exist.

```bash
git -C devlog/_gjc_chase/gajae-code log --oneline --stat db7938e1..b3b5b8a9 -- packages/ai/src packages/coding-agent/src/config/model* | head -60
git -C devlog/_omp_chase/oh-my-pi log --oneline --stat d0c1890a6..f25ab54c5 -- packages/ai packages/catalog | head -60
```

Judgement: confirmed the path-scoped upstream commit anchors used in `005_upstream_model_delta.md` and demoted prior unverified anchors that were not present in the requested scoped outputs.

```bash
for f in struct_har/chase/model/00{1,2,3,4,5}_*.md; do printf '%s: ' "$f"; rg -n '^## Verification$' "$f"; done
git diff --check -- struct_har/chase/model/001_model_provider_inventory.md struct_har/chase/model/002_model_catalog_contract.md struct_har/chase/model/003_provider_auth_flow.md struct_har/chase/model/004_cross_project_patch_index.md struct_har/chase/model/005_upstream_model_delta.md
git status --short -- struct_har/chase/model/001_model_provider_inventory.md struct_har/chase/model/002_model_catalog_contract.md struct_har/chase/model/003_provider_auth_flow.md struct_har/chase/model/004_cross_project_patch_index.md struct_har/chase/model/005_upstream_model_delta.md
```

Judgement: each target file has a `## Verification` section. `git diff --check` produced no whitespace errors. `git status --short` reports the five files as untracked (`??`), which explains why plain tracked `git diff` was empty.

## Final Judgement

The requested five chase/model documents were rewritten with repo-verified grep/list/log evidence, path claims in the key patch index were checked, stale claims were corrected, and each file now includes a `## Verification` section listing commands and confirmations.
