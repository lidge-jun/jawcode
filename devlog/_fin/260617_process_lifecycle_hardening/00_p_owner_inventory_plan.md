# 10.029 process/resource lifecycle hardening — P plan

Date: 2026-06-17
Goal: Complete a PABCD-led 10.029 process/resource lifecycle hardening effort for Jawcode.
Project root: `/Users/jun/Developer/new/700_projects/jawcode`

## Part 1 — easy explanation

This work is not a feature button. It is long-running runtime safety: when JWC runs bash, JS/Python eval, MCP, LSP, DAP, async jobs, or tmux/team workers, those resources must have a clear owner and a bounded cleanup path.

The upstream GJC reference added a shared lifecycle primitive, but JWC already has several local cleanup systems. The plan is to audit each owner first, decide adopt/defer/reject per owner, then implement only the low-risk slices that the audit proves are needed.

Expected outcome: a current owner inventory, documented decisions in the chase card, focused lifecycle regression tests, and small code changes only where JWC has an actual gap.

## Repository context read

- `/Users/jun/Developer/new/700_projects/jawcode/AGENTS.md`
- `/Users/jun/Developer/new/700_projects/jawcode/README.md`
- `/Users/jun/Developer/new/700_projects/jawcode/devlog/README.md`
- `/Users/jun/Developer/new/700_projects/jawcode/struct_har/chase/README.md`
- `/Users/jun/Developer/new/700_projects/jawcode/struct_har/chase/002_gap_inventory.md`
- `/Users/jun/Developer/new/700_projects/jawcode/struct_har/chase/007_follow_index.md`
- `/Users/jun/Developer/new/700_projects/jawcode/struct_har/chase/10_gjc_chase_MOC.md`
- `/Users/jun/Developer/new/700_projects/jawcode/struct_har/chase/_fin/10/10.029_gjc_chase_process_lifecycle_hardening.md`
- `/Users/jun/Developer/new/700_projects/jawcode/devlog/_upstream_gjc/packages/coding-agent/src/runtime/process-lifecycle.ts`
- `/Users/jun/.cli-jaw/skills/dev/SKILL.md`
- `/Users/jun/.cli-jaw/skills/dev-pabcd/SKILL.md`
- `/Users/jun/.cli-jaw/skills/dev-architecture/SKILL.md`
- `/Users/jun/.cli-jaw/skills/dev-testing/SKILL.md`

## Current repository shape

Compact shape relevant to this work:

```text
/Users/jun/Developer/new/700_projects/jawcode/
  AGENTS.md
  devlog/
    README.md
    _plan/
    _upstream_gjc/
      packages/coding-agent/src/runtime/process-lifecycle.ts
      packages/coding-agent/test/*lifecycle*.test.ts
  packages/coding-agent/
    package.json
    src/
      async/job-manager.ts
      dap/client.ts
      dap/session.ts
      eval/js/context-manager.ts
      eval/py/executor.ts
      eval/py/kernel.ts
      exec/bash-executor.ts
      jwc-runtime/team-runtime.ts
      jwc-runtime/tmux-sessions.ts
      lsp/client.ts
      runtime-mcp/manager.ts
      runtime-mcp/transports/stdio.ts
    test/
      async-job-manager.test.ts
      async/job-manager-resume-queue.test.ts
      bash-executor.test.ts
      lsp-lifecycle-cleanup.test.ts
      mcp-lifecycle-cleanup.test.ts
      core/python-executor*.test.ts
      jwc-runtime/*team*.test.ts
```

## Detected conventions

- Primary product surface: `/Users/jun/Developer/new/700_projects/jawcode/packages/coding-agent`.
- Use devlog for durable implementation plans; use `structure/` for maintained current-state docs only after a stable rule exists.
- Devlog plan artifacts must use numbered Jawdev filenames and stay inside the relevant plan folder.
- Source code is ES module TypeScript. No CommonJS, no inline dynamic imports, no `any` unless unavoidable.
- Use `bun --cwd packages/coding-agent run check:types`; never `tsc`/`npx tsc`.
- Tests should assert externally visible lifecycle contracts, not tautologies.
- Do not alter TUI visual files or workflow-surface definitions for this goal.
- Existing worktree has unrelated `.jwc/goal/*` changes and untracked `260614_cli_jaw_jwc_distribution_strategy` files; this goal must stage only its own files.

## Owner inventory scope

The audit inventory must cover:

| Owner | JWC current evidence | Upstream evidence | Initial stance |
|---|---|---|---|
| bash shell/PTY | `/Users/jun/Developer/new/700_projects/jawcode/packages/coding-agent/src/exec/bash-executor.ts` | GJC bash lifecycle tests and process owner primitive | audit existing native `Shell.abort()` and session postmortem before adopting anything |
| JS eval worker | `/Users/jun/Developer/new/700_projects/jawcode/packages/coding-agent/src/eval/js/context-manager.ts` | GJC JS worker VM lifecycle tests | likely document existing worker kill semantics; add postmortem hook if absent |
| Python eval kernel | `/Users/jun/Developer/new/700_projects/jawcode/packages/coding-agent/src/eval/py/executor.ts`, `/Users/jun/Developer/new/700_projects/jawcode/packages/coding-agent/src/eval/py/kernel.ts` | GJC Python lifecycle tests | likely keep owner-specific kernel cleanup; test owner disposal paths |
| DAP | `/Users/jun/Developer/new/700_projects/jawcode/packages/coding-agent/src/dap/client.ts`, `/Users/jun/Developer/new/700_projects/jawcode/packages/coding-agent/src/dap/session.ts` | GJC DAP lifecycle test | inspect adapter spawn/terminate path before adopting owned process |
| LSP | `/Users/jun/Developer/new/700_projects/jawcode/packages/coding-agent/src/lsp/client.ts` | GJC LSP lifecycle tests | likely candidate for owned process wrapper because it directly uses `ptree.spawn` |
| runtime MCP stdio | `/Users/jun/Developer/new/700_projects/jawcode/packages/coding-agent/src/runtime-mcp/transports/stdio.ts`, `/Users/jun/Developer/new/700_projects/jawcode/packages/coding-agent/src/runtime-mcp/manager.ts` | GJC runtime MCP transport lifecycle tests | likely candidate for owned process wrapper because it directly uses `ptree.spawn` and currently waits only 1s after `kill()` |
| async job manager | `/Users/jun/Developer/new/700_projects/jawcode/packages/coding-agent/src/async/job-manager.ts` | GJC async job manager bounds/redteam tests | mostly already owner-aware; audit max-running, tombstone, dispose, delivery loop |
| tmux/team | `/Users/jun/Developer/new/700_projects/jawcode/packages/coding-agent/src/jwc-runtime/team-runtime.ts`, `/Users/jun/Developer/new/700_projects/jawcode/packages/coding-agent/src/jwc-runtime/tmux-sessions.ts` | no direct GJC primitive equivalent; JWC-specific | defer shared process wrapper unless audit finds uncontrolled OS process ownership |

## Diff-level plan

### Phase P output

#### NEW

`/Users/jun/Developer/new/700_projects/jawcode/devlog/_fin/260617_process_lifecycle_hardening/00_p_owner_inventory_plan.md`

Purpose: this plan.

### Phase A output

#### NEW

`/Users/jun/Developer/new/700_projects/jawcode/devlog/_fin/260617_process_lifecycle_hardening/01_a_owner_inventory.md`

Complete content shape:

```markdown
# 10.029 process/resource lifecycle hardening — A owner inventory

Date: 2026-06-17

## Audit summary

| Owner | Decision | Why | Follow-up |
|---|---|---|---|
| bash shell/PTY | TBD | TBD | TBD |
| JS eval worker | TBD | TBD | TBD |
| Python eval kernel | TBD | TBD | TBD |
| DAP | TBD | TBD | TBD |
| LSP | TBD | TBD | TBD |
| runtime MCP stdio | TBD | TBD | TBD |
| async job manager | TBD | TBD | TBD |
| tmux/team | TBD | TBD | TBD |

## Evidence

## Adopt/defer/reject notes

## Regression-test plan

## A-phase verdict
```

### Phase B candidate code changes

The A audit may narrow this list. B must not expand beyond this plan without returning to P.

#### NEW

`/Users/jun/Developer/new/700_projects/jawcode/packages/coding-agent/src/runtime/process-lifecycle.ts`

Purpose: JWC-local, small lifecycle primitive modeled on upstream GJC but namespace-adjusted and adapted to this repo's API constraints.

Planned public surface:

```ts
export interface SpawnOwnedOptions {
	cwd?: string;
	env?: Record<string, string | undefined>;
	stdin?: "pipe" | "ignore";
	stderr?: "full" | null;
	signal?: AbortSignal;
	gracefulMs?: number;
	processGroup?: boolean;
	name?: string;
}

export interface AwaitExitResult {
	exited: boolean;
	code: number | null;
}

export interface OwnedProcess {
	readonly child: ptree.ChildProcess;
	readonly pid: number | undefined;
	readonly exited: Promise<number>;
	readonly disposed: boolean;
	awaitExit(opts?: { timeoutMs?: number }): Promise<AwaitExitResult>;
	dispose(): Promise<void>;
}

export function spawnOwnedProcess(cmd: string[], opts?: SpawnOwnedOptions): OwnedProcess;
export function registerResourceOwner(name: string, dispose: () => void | Promise<void>): () => void;
```

Key implementation constraints:

- Import from `@jawcode-dev/utils`, not upstream `@gajae-code/utils`.
- Use existing `postmortem.register` facility.
- No `ReturnType<>`; the upstream reference uses it, but JWC implementation must use explicit timer types such as `NodeJS.Timeout`.
- Bounded cleanup: `SIGTERM -> graceful wait -> SIGKILL -> cap wait`.
- Idempotent disposal and abort-listener cleanup.
- Do not drain stdout/stderr inside the primitive; adopters remain responsible for protocol streams.
- Preserve adopter stream exposure by passing `stderr?: "full" | null` through to `ptree.spawn`.

#### NEW

`/Users/jun/Developer/new/700_projects/jawcode/packages/coding-agent/test/runtime/process-lifecycle.test.ts`

Purpose: focused unit tests for idempotent dispose, abort listener cleanup behavior, bounded await exit, and postmortem-safe resource owner registration.

#### NEW

`/Users/jun/Developer/new/700_projects/jawcode/packages/coding-agent/test/runtime/process-lifecycle.redteam.test.ts`

Purpose: redteam behavior for backgrounded descendant cleanup on POSIX and bounded cleanup when a child ignores SIGTERM. If platform or runner limitations make these flaky, mark cases as conditional and document the fallback in `01_a_owner_inventory.md`.

#### MODIFY

`/Users/jun/Developer/new/700_projects/jawcode/packages/coding-agent/src/runtime-mcp/transports/stdio.ts`

Before:

```ts
import { getProjectDir, ptree, readJsonl, Snowflake } from "@jawcode-dev/utils";

// ...
#process: ptree.ChildProcess<"pipe"> | null = null;

// ...
this.#process = ptree.spawn([this.config.command, ...args], {
	cwd: this.config.cwd ?? getProjectDir(),
	env,
	stdin: "pipe",
	stderr: "full",
});

// ...
process.kill();
await Promise.race([process.exited.catch(() => {}), Bun.sleep(CLOSE_WAIT_MS)]);
this.#process = null;
```

After:

```ts
import { getProjectDir, readJsonl, Snowflake } from "@jawcode-dev/utils";
import type { OwnedProcess } from "../../runtime/process-lifecycle";
import { spawnOwnedProcess } from "../../runtime/process-lifecycle";

// ...
#process: OwnedProcess | null = null;

// ...
this.#process = spawnOwnedProcess([this.config.command, ...args], {
	cwd: this.config.cwd ?? getProjectDir(),
	env,
	stdin: "pipe",
	stderr: "full",
	name: `mcp:${this.config.command}`,
});

// ...
await process.dispose();
this.#process = null;
```

Note: stream accesses change from `this.#process.stdout` to `this.#process.child.stdout`, stderr accesses change to `this.#process.child.stderr`, and stdin writes change to `this.#process.child.stdin`. The `stderr: "full"` option is required because `#startStderrLoop()` reads the exposed stderr stream.

#### MODIFY

`/Users/jun/Developer/new/700_projects/jawcode/packages/coding-agent/src/lsp/client.ts`

Before:

```ts
import { isEnoent, logger, ptree, untilAborted } from "@jawcode-dev/utils";

// ...
const proc = ptree.spawn([command, ...args], {
	cwd,
	stdin: "pipe",
	env,
});

// ...
client.proc.kill();
await Promise.race([client.proc.exited.catch(() => {}), Bun.sleep(1000)]);
```

After:

```ts
import { isEnoent, logger, untilAborted } from "@jawcode-dev/utils";
import type { OwnedProcess } from "../runtime/process-lifecycle";
import { spawnOwnedProcess } from "../runtime/process-lifecycle";

// ...
const owner = spawnOwnedProcess([command, ...args], {
	cwd,
	env,
	stdin: "pipe",
	name: `lsp:${config.command}`,
});

// ...
await client.owner.dispose();
```

Additional required edit in the same file if LSP adopts `OwnedProcess`:

Before:

```ts
clients.delete(key);
clientLocks.delete(key);
proc.kill();
throw error;
```

After:

```ts
clients.delete(key);
clientLocks.delete(key);
await owner.dispose();
throw error;
```

Reason: `getOrCreateClient()` has an initialization-failure catch block that currently calls local `proc.kill()`. That path must use the same owned-process teardown path or failed LSP startup can bypass lifecycle cleanup.

Note: only proceed if A confirms the `LspClient` type can hold an owned process without widening unrelated APIs. The current LSP spawn does not expose `stderr: "full"`; the plan must not add it unless a later audit proves it is required.

#### MODIFY

`/Users/jun/Developer/new/700_projects/jawcode/packages/coding-agent/src/lsp/index.ts`

Only if LSP adopts `OwnedProcess`.

Before:

```ts
client.proc.kill();
```

After:

```ts
await client.owner.dispose();
```

Reason: `reloadServer(...)` currently has a restart fallback that directly kills `client.proc`. If LSP adopts the owned lifecycle wrapper, this path must also use the owner so restart cleanup and shutdown cleanup share one teardown path.

#### MODIFY

`/Users/jun/Developer/new/700_projects/jawcode/packages/coding-agent/src/lsp/types.ts`

Only if LSP adopts `OwnedProcess`.

Before:

```ts
proc: ptree.ChildProcess<"pipe">;
```

After:

```ts
owner: OwnedProcess;
proc: OwnedProcess["child"];
```

#### MODIFY

`/Users/jun/Developer/new/700_projects/jawcode/struct_har/chase/_fin/10/10.029_gjc_chase_process_lifecycle_hardening.md`

Before:

```markdown
## 완료 기준

- [ ] Runtime owners listed: bash, eval JS, eval Python, DAP, LSP, MCP, async job manager, tmux/team.
- [ ] Each owner has adopt/defer/reject diff notes against JWC.
- [ ] Regression tests cover signal teardown and stale resource cleanup for adopted slices.
```

After:

```markdown
## JWC execution notes

- Owner inventory: `/Users/jun/Developer/new/700_projects/jawcode/devlog/_fin/260617_process_lifecycle_hardening/01_a_owner_inventory.md`
- Adopted slices: TBD after B/C.
- Verification: TBD after C.

## 완료 기준

- [x] Runtime owners listed: bash, eval JS, eval Python, DAP, LSP, MCP, async job manager, tmux/team.
- [x] Each owner has adopt/defer/reject diff notes against JWC.
- [ ] Regression tests cover signal teardown and stale resource cleanup for adopted slices.
```

At D, the final checkbox may be marked complete only if adopted-slice tests actually pass.

### Phase C verification

Run focused gates first:

```bash
bun --cwd /Users/jun/Developer/new/700_projects/jawcode/packages/coding-agent test test/runtime/process-lifecycle.test.ts
bun --cwd /Users/jun/Developer/new/700_projects/jawcode/packages/coding-agent test test/runtime/process-lifecycle.redteam.test.ts
```

If runtime MCP or LSP is modified:

```bash
bun --cwd /Users/jun/Developer/new/700_projects/jawcode/packages/coding-agent test test/mcp-lifecycle-cleanup.test.ts
bun --cwd /Users/jun/Developer/new/700_projects/jawcode/packages/coding-agent test test/lsp-lifecycle-cleanup.test.ts
```

Required type gate:

```bash
bun --cwd /Users/jun/Developer/new/700_projects/jawcode/packages/coding-agent run check:types
```

Do not run `tsc` or `npx tsc`.

### Phase D output

#### NEW

`/Users/jun/Developer/new/700_projects/jawcode/devlog/_fin/260617_process_lifecycle_hardening/90_d_done.md`

Content must summarize:

- P/A/B/C phases.
- Owner decisions.
- Adopted code/test slices.
- Verification output.
- Commit hash for this goal only.

## Risk controls

- No blanket cherry-pick from upstream.
- No runtime owner migration without tests.
- No public workflow-surface changes.
- No TUI visual edits.
- No staging of unrelated `.jwc/goal/*` or existing untracked distribution strategy files unless they are generated by the active goal command and required for the goal ledger.
- If a lifecycle test is platform-sensitive, the test must be conditional and the rationale must be documented.
- B must create `/Users/jun/Developer/new/700_projects/jawcode/packages/coding-agent/test/runtime/` before adding the new runtime lifecycle tests.

## A-phase audit request

Audit this plan against actual code signatures and upstream evidence. Required checks:

- Confirm exact file paths exist.
- Confirm `ptree.spawn` and stream types can support `OwnedProcess` wrapping in runtime MCP and LSP.
- Confirm `postmortem.register` API shape matches the proposed primitive.
- Confirm test command paths are valid under `packages/coding-agent`.
- Identify any owner where adoption should be deferred because JWC already has stronger owner-specific cleanup.
- Return PASS only if the B candidate changes are sufficiently scoped and type-compatible.
