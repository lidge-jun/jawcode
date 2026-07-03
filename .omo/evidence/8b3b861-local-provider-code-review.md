# Code Quality Review: 8b3b861 local-provider CLI discovery/diagnostics

## Scope

- Commit: `8b3b8616955a6962085814f45e867809351b5cbb`
- Repository: `/Users/jun/Developer/new/700_projects/jawcode`
- Reviewed files:
  - `/Users/jun/Developer/new/700_projects/jawcode/packages/coding-agent/src/cli/local-provider-smoke.ts`
  - `/Users/jun/Developer/new/700_projects/jawcode/packages/coding-agent/src/commands/local-provider.ts`
  - `/Users/jun/Developer/new/700_projects/jawcode/packages/coding-agent/src/cli.ts`
  - `/Users/jun/Developer/new/700_projects/jawcode/packages/coding-agent/test/local-provider-smoke.test.ts`

## Verification Evidence

- `git rev-parse HEAD` -> `8b3b8616955a6962085814f45e867809351b5cbb`
- `git show 8b3b861 --stat` -> 4 files changed, 1010 insertions.
- `rg -n -i "gjc|gajae|@gajae-code" packages/coding-agent/src/cli/local-provider-smoke.ts packages/coding-agent/src/commands/local-provider.ts packages/coding-agent/src/cli.ts packages/coding-agent/test/local-provider-smoke.test.ts`
  - `/Users/jun/Developer/new/700_projects/jawcode/packages/coding-agent/src/cli.ts:2`
  - `/Users/jun/Developer/new/700_projects/jawcode/packages/coding-agent/src/cli.ts:78`
- `bun test packages/coding-agent/test/local-provider-smoke.test.ts`
  - 12 pass, 0 fail, 46 assertions.

## Skill-Perspective Check

- Loaded/consulted: `cxc-dev` and `dev-code-reviewer`.
- Requested `remove-ai-slops` and `programming` skill files were not available in the configured skill roots checked under `/Users/jun/.codex/skills`, `/Users/jun/.cli-jaw/skills`, and `/Users/jun/Developer/new/700_projects/codexclaw/plugins/codexclaw/skills`.
- Applied the prompt-provided `remove-ai-slops` and `programming` criteria manually.
- Result: the diff violates those perspectives through an implementation-mirroring constant test and a missing regression test for the smoke auto-discovery failure path.

## Findings By Severity

### CRITICAL

None.

### HIGH

1. Exact naming gate fails on the reviewed file set.
   - File refs:
     - `/Users/jun/Developer/new/700_projects/jawcode/packages/coding-agent/src/cli.ts:2`
     - `/Users/jun/Developer/new/700_projects/jawcode/packages/coding-agent/src/cli.ts:78`
   - Evidence: requested `rg -i "gjc|gajae|@gajae-code"` returns two `gjc` matches in `cli.ts`.
   - Note: both matches predate commit `8b3b861`; the commit only added `/Users/jun/Developer/new/700_projects/jawcode/packages/coding-agent/src/cli.ts:50`. Still, the explicit success criterion was zero literals in the reviewed files, so this gate is not satisfied.

2. `runLocalProviderSmoke()` loses `/models` failure classification when no model is passed.
   - File refs:
     - `/Users/jun/Developer/new/700_projects/jawcode/packages/coding-agent/src/cli/local-provider-smoke.ts:294`
     - `/Users/jun/Developer/new/700_projects/jawcode/packages/coding-agent/src/cli/local-provider-smoke.ts:301`
     - `/Users/jun/Developer/new/700_projects/jawcode/packages/coding-agent/src/cli/local-provider-smoke.ts:533`
     - `/Users/jun/Developer/new/700_projects/jawcode/packages/coding-agent/src/cli/local-provider-smoke.ts:540`
     - `/Users/jun/Developer/new/700_projects/jawcode/packages/coding-agent/src/cli/local-provider-smoke.ts:560`
   - `smoke` is documented to use the first `/models` id when `--model` is omitted. In that default path, `fetchLocalModelIds()` converts an HTTP failure into a plain `Error` containing only the rendered error string. `runLocalProviderSmoke()` then catches it and reclassifies it as a `chat_stream` thrown failure.
   - Consequence: `/v1/models` `401/403` becomes `http_error` instead of `auth`, `/v1/models` `503`/loading becomes `http_error` instead of `not_ready`, and malformed `/models` JSON is reported as a streaming chat failure. That is incoherent for a diagnostics command and defeats the requested failure classification in the default smoke flow.

### MEDIUM

1. Test coverage misses the default `smoke` auto-discovery failure path and overstates command coverage.
   - File refs:
     - `/Users/jun/Developer/new/700_projects/jawcode/packages/coding-agent/test/local-provider-smoke.test.ts:107`
     - `/Users/jun/Developer/new/700_projects/jawcode/packages/coding-agent/test/local-provider-smoke.test.ts:144`
     - `/Users/jun/Developer/new/700_projects/jawcode/packages/coding-agent/test/local-provider-smoke.test.ts:208`
     - `/Users/jun/Developer/new/700_projects/jawcode/packages/coding-agent/test/local-provider-smoke.test.ts:244`
   - The tests cover direct `smoke` with an explicit model and status/discover failure paths, but not `runLocalProviderSmoke({ modelsPath })` when model discovery itself fails.
   - The "diagnose" action is only covered by checking exported constants, not by exercising the command dispatch path.
   - The malformed tests assert error text but not the `malformed_response` category, so they do not fully verify failure classification.

2. `local-provider-smoke.ts` is oversized and mixes concerns.
   - File ref: `/Users/jun/Developer/new/700_projects/jawcode/packages/coding-agent/src/cli/local-provider-smoke.ts:1`
   - The new file is 645 lines and combines config resolution, URL normalization, HTTP calls, failure classification, result orchestration, and terminal rendering. This exceeds the 500-line local rule and increases maintenance risk around the already subtle classification paths.

### LOW

1. `local-provider` command registration itself is correct.
   - File refs:
     - `/Users/jun/Developer/new/700_projects/jawcode/packages/coding-agent/src/cli.ts:50`
     - `/Users/jun/Developer/new/700_projects/jawcode/packages/coding-agent/src/commands/local-provider.ts:4`
   - The base command entry lazily imports `./commands/local-provider`, and the command file exports a default `Command` subclass.

2. Flat schema lookup is implemented correctly.
   - File refs:
     - `/Users/jun/Developer/new/700_projects/jawcode/packages/coding-agent/src/cli/local-provider-smoke.ts:113`
     - `/Users/jun/Developer/new/700_projects/jawcode/packages/coding-agent/src/cli/local-provider-smoke.ts:114`
     - `/Users/jun/Developer/new/700_projects/jawcode/packages/coding-agent/src/cli/local-provider-smoke.ts:117`
     - `/Users/jun/Developer/new/700_projects/jawcode/packages/coding-agent/src/cli/local-provider-smoke.ts:118`
   - `getLocalOpenAICompatConfig()` reads `config.providers.local.baseUrl` and `apiKey/apiKeyEnv`; it does not read nested `openaiCompat`.

## Criteria Verdicts

1. Correctness: FAIL. Flat schema lookup passes, but default `smoke` failure classification is incoherent.
2. Naming: FAIL. The requested `rg` returns `gjc` literals in `cli.ts`.
3. Registration: PASS. `local-provider` is in `baseCommands` and the import path resolves to a default `Command` class.
4. Test coverage: FAIL. Tests pass, but they miss the bugged default smoke discovery failure path and include an implementation-mirroring constant test for command actions/defaults.
5. Regressions/blockers: FAIL. The naming gate and smoke classification bug are blockers for approval under the provided criteria.

## Status

- codeQualityStatus: BLOCK
- recommendation: REQUEST_CHANGES
- blockers:
  - Exact requested naming gate returns `gjc` matches in `/Users/jun/Developer/new/700_projects/jawcode/packages/coding-agent/src/cli.ts`.
  - `runLocalProviderSmoke()` must preserve `/models` failure context/category when auto-discovering the first model.
  - Tests should cover `runLocalProviderSmoke({ modelsPath })` model-discovery failures and should replace the constant-only diagnose/default action test with behavior-level command coverage.
