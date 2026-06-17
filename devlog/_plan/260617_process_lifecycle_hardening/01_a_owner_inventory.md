# 10.029 process/resource lifecycle hardening — A owner inventory

Date: 2026-06-17
Project root: `/Users/jun/Developer/new/700_projects/jawcode`
Plan: `/Users/jun/Developer/new/700_projects/jawcode/devlog/_plan/260617_process_lifecycle_hardening/00_p_owner_inventory_plan.md`

## Audit summary

The A phase audited the 10.029 plan against JWC code and the upstream GJC process-lifecycle primitive. The initial plan failed twice and was revised until Backend audit returned PASS.

Final A verdict: PASS.

## Owner decisions

| Owner | Decision | Why | Follow-up |
|---|---|---|---|
| bash shell/PTY | Defer code adoption | JWC already has retained shell sessions, `disposeAllShellSessions()`, broken-session reset, native `Shell.abort()`, and postmortem registration. A generic `ptree` wrapper does not own the native shell implementation. | Keep existing tests; no B code change. |
| JS eval worker | Defer code adoption | JWC already has per-session worker handles, abort-driven hard worker termination, pending tool-call abort, `resetVmContext()`, and `disposeAllVmContexts()`. The gap is documentation/inventory, not immediate code. | Consider later `registerResourceOwner` adoption only if postmortem coverage is missing. |
| Python eval kernel | Defer code adoption | JWC has retained kernel sessions, owner IDs, owner-scoped disposal, global disposal, interrupt-before-kill behavior, and lifecycle tests. | Keep owner-specific kernel lifecycle; no B code change. |
| DAP | Defer code adoption | DAP has stdio and socket modes plus adapter/debuggee semantics. Direct adoption needs deeper socket/process-group design and is too broad for this slice. | Future slice can evaluate DAP client owner wrapper separately. |
| LSP | Adopt | LSP directly uses `ptree.spawn` and has multiple teardown paths: normal shutdown, init failure, reload fallback, and shutdown-all. It benefits from a shared owned-process wrapper if all kill paths use `owner.dispose()`. | Add `OwnedProcess` field, keep `proc` child compatibility, migrate all LSP teardown paths, add/follow lifecycle tests. |
| runtime MCP stdio | Adopt | MCP stdio directly uses `ptree.spawn`, reads stdout/stderr, writes stdin, and currently uses single `process.kill()` plus 1s wait on close. It is the cleanest adopter for owned-process teardown. | Add `stderr` passthrough to primitive and migrate stdio stream accesses to `owner.child.*`. |
| async job manager | Defer code adoption | JWC already has job owner IDs, lifecycle cleanup hooks, tombstones, delivery retry state, max-running bounds, output retention, and dispose state. | No B code change; keep as inventory evidence. |
| tmux/team | Defer code adoption | Team runtime is tmux/state-file centric and JWC-specific. It owns worker lifecycle state through tmux sessions and team records, not simple child process handles. | Future tmux cleanup audit can be a separate card. |

## Evidence

### Upstream primitive

- `/Users/jun/Developer/new/700_projects/jawcode/devlog/_upstream_gjc/packages/coding-agent/src/runtime/process-lifecycle.ts`
  - `spawnOwnedProcess`: process-group ownership, abort listener cleanup, bounded await exit, SIGTERM to SIGKILL escalation, postmortem cleanup.
  - `registerResourceOwner`: idempotent postmortem adapter for non-process resources.

### JWC owner files

- `/Users/jun/Developer/new/700_projects/jawcode/packages/coding-agent/src/exec/bash-executor.ts`
- `/Users/jun/Developer/new/700_projects/jawcode/packages/coding-agent/src/eval/js/context-manager.ts`
- `/Users/jun/Developer/new/700_projects/jawcode/packages/coding-agent/src/eval/py/executor.ts`
- `/Users/jun/Developer/new/700_projects/jawcode/packages/coding-agent/src/eval/py/kernel.ts`
- `/Users/jun/Developer/new/700_projects/jawcode/packages/coding-agent/src/dap/client.ts`
- `/Users/jun/Developer/new/700_projects/jawcode/packages/coding-agent/src/dap/session.ts`
- `/Users/jun/Developer/new/700_projects/jawcode/packages/coding-agent/src/lsp/client.ts`
- `/Users/jun/Developer/new/700_projects/jawcode/packages/coding-agent/src/lsp/index.ts`
- `/Users/jun/Developer/new/700_projects/jawcode/packages/coding-agent/src/lsp/types.ts`
- `/Users/jun/Developer/new/700_projects/jawcode/packages/coding-agent/src/runtime-mcp/transports/stdio.ts`
- `/Users/jun/Developer/new/700_projects/jawcode/packages/coding-agent/src/runtime-mcp/manager.ts`
- `/Users/jun/Developer/new/700_projects/jawcode/packages/coding-agent/src/async/job-manager.ts`
- `/Users/jun/Developer/new/700_projects/jawcode/packages/coding-agent/src/jwc-runtime/team-runtime.ts`
- `/Users/jun/Developer/new/700_projects/jawcode/packages/coding-agent/src/jwc-runtime/tmux-sessions.ts`

### Audit fixes applied before PASS

1. Added `stderr?: "full" | null` to the planned primitive and required MCP stdio to pass `stderr: "full"`.
2. Added `/Users/jun/Developer/new/700_projects/jawcode/packages/coding-agent/src/lsp/index.ts` to the LSP adoption plan for the reload fallback direct-kill path.
3. Blocked upstream `ReturnType<>` copy-paste because JWC AGENTS.md forbids `ReturnType<>`.
4. Made `/Users/jun/Developer/new/700_projects/jawcode/packages/coding-agent/test/runtime/` creation explicit.
5. Added the LSP initialization-failure `proc.kill()` path to the adoption plan.
6. Fixed the LSP diagnostic label from out-of-scope `serverConfig.command` to in-scope `config.command`.
7. Corrected the LSP before snippet so it does not claim existing LSP spawn exposes `stderr: "full"`.

## Adopt/defer/reject notes

Adopt only:

- Shared primitive: `/Users/jun/Developer/new/700_projects/jawcode/packages/coding-agent/src/runtime/process-lifecycle.ts`
- MCP stdio adoption: `/Users/jun/Developer/new/700_projects/jawcode/packages/coding-agent/src/runtime-mcp/transports/stdio.ts`
- LSP adoption:
  - `/Users/jun/Developer/new/700_projects/jawcode/packages/coding-agent/src/lsp/client.ts`
  - `/Users/jun/Developer/new/700_projects/jawcode/packages/coding-agent/src/lsp/index.ts`
  - `/Users/jun/Developer/new/700_projects/jawcode/packages/coding-agent/src/lsp/types.ts`

Defer:

- bash, JS eval, Python eval, DAP, async job manager, tmux/team.

Reject:

- No owner is rejected outright. Deferred owners remain valid future lifecycle hardening candidates.

## Regression-test plan

New focused tests:

- `/Users/jun/Developer/new/700_projects/jawcode/packages/coding-agent/test/runtime/process-lifecycle.test.ts`
- `/Users/jun/Developer/new/700_projects/jawcode/packages/coding-agent/test/runtime/process-lifecycle.redteam.test.ts`

Focused existing suites after adopter changes:

- `/Users/jun/Developer/new/700_projects/jawcode/packages/coding-agent/test/mcp-lifecycle-cleanup.test.ts`
- `/Users/jun/Developer/new/700_projects/jawcode/packages/coding-agent/test/lsp-lifecycle-cleanup.test.ts`

Type gate:

```bash
bun --cwd /Users/jun/Developer/new/700_projects/jawcode/packages/coding-agent run check:types
```

## A-phase verdict

PASS. Proceed to B with the narrowed adopt scope above. Do not expand to bash, JS eval, Python eval, DAP, async job manager, or tmux/team in this goal unless a new P/A cycle is opened.
