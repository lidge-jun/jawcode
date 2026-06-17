# 10.029 process/resource lifecycle hardening — D done

Date: 2026-06-17
Project root: `/Users/jun/Developer/new/700_projects/jawcode`

## P — Plan

Selected the 10.029 chase card as the active goal and wrote an owner-inventory-first implementation plan.

Plan artifact:

- `/Users/jun/Developer/new/700_projects/jawcode/devlog/_plan/260617_process_lifecycle_hardening/00_p_owner_inventory_plan.md`

## A — Audit

Backend plan audit failed twice, then passed after the plan fixed:

- MCP stdio `stderr: "full"` preservation.
- LSP reload and initialization-failure teardown paths.
- JWC `ReturnType<>` copy-paste risk.
- New runtime test directory creation.
- LSP snippet variable/scope mismatch.

Audit artifact:

- `/Users/jun/Developer/new/700_projects/jawcode/devlog/_plan/260617_process_lifecycle_hardening/01_a_owner_inventory.md`

## B — Build

Implemented:

- Shared owned-process lifecycle primitive.
- Runtime MCP stdio adoption.
- LSP process-owner adoption.
- Runtime lifecycle tests.
- LSP mock owner updates for the widened `LspClient` contract.
- 10.029 chase evidence update.

Deferred:

- bash shell/PTY.
- JS eval worker.
- Python eval kernel.
- DAP.
- async job manager.
- tmux/team.

## C — Check

Passed:

```bash
bun --cwd /Users/jun/Developer/new/700_projects/jawcode/packages/coding-agent test test/runtime/process-lifecycle.test.ts test/runtime/process-lifecycle.redteam.test.ts test/mcp-lifecycle-cleanup.test.ts test/lsp-lifecycle-cleanup.test.ts test/tools/lsp-diagnostics-freshness.test.ts test/tools/lsp-regressions.test.ts
```

Result: 32 pass, 0 fail.

Passed:

```bash
bun run --cwd /Users/jun/Developer/new/700_projects/jawcode/packages/coding-agent check
```

Result: `biome check .` and `tsgo -p tsconfig.json --noEmit` passed.

## Commit

- `e11f0632` — `feat(runtime): harden process lifecycle ownership`
