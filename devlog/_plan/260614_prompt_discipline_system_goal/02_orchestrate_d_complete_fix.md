# Orchestrate D Complete Alias Fix

Date: 2026-06-14

## Problem

`packages/coding-agent/src/prompts/jaw/orchestrate-d.md` instructed agents to close D with:

```sh
jwc orchestrate d
```

but `runNativeOrchestrateCommand()` only closed with `jwc orchestrate complete`; the first compatibility pass added `d --complete`, but `jwc orchestrate d` from an active D stage still tried an invalid `d → d` transition. Agents therefore followed the intended close shorthand, hit an error, then had to discover another close command manually.

## Patch

- `packages/coding-agent/src/jwc-runtime/orchestrate-runtime.ts`
  - Added parsed boolean flag `--complete`.
  - When the subcommand is `d` from an active D stage, target stage becomes `complete`.
  - `jwc orchestrate d --complete` and direct `jwc orchestrate complete` remain supported.
  - `jwc orchestrate d` from C still enters D; `jwc orchestrate d` from an active D stage closes to `complete`.
- `packages/coding-agent/src/commands/orchestrate.ts`
  - Added `--complete` to CLI help as an explicit alias and made the primary example `jwc orchestrate d`.
- `packages/coding-agent/src/prompts/jaw/orchestrate-d.md`
  - Clarified that `jwc orchestrate d` closes the orchestration and `jwc orchestrate d --complete` / `jwc orchestrate complete` are equivalent close actions.
- `packages/coding-agent/test/jwc-runtime/orchestrate-state.test.ts`
  - Full-cycle test now closes with bare `d` and asserts `pabcd → complete`.

## Verification

```sh
JWC_SESSION_ID= GJC_SESSION_ID= bun test packages/coding-agent/test/jwc-runtime/orchestrate-state.test.ts packages/coding-agent/test/jwc-runtime/orchestrate-reset.test.ts
# 39 pass, 0 fail, 187 expect() calls

jwc orchestrate d --help
# Help lists --complete and example: $ jwc orchestrate d

bunx biome check packages/coding-agent/src/jwc-runtime/orchestrate-runtime.ts packages/coding-agent/src/commands/orchestrate.ts packages/coding-agent/test/jwc-runtime/orchestrate-state.test.ts
# OK

bun run check:types (cwd packages/coding-agent)
# tsgo -p tsconfig.json --noEmit passed
```

Note: the first focused test run failed because the ambient shell carried `GJC_SESSION_ID`, causing tests expecting shared state to observe session-scoped state. Rerun with both `JWC_SESSION_ID` and `GJC_SESSION_ID` empty passed.
