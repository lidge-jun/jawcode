# 390 Phase 39 plan — daemon reload/stop control + loop driver (closes 10.030)

> Work-phase 39 = the daemon **lifecycle control** (owner-scoped stop/reload decision) and a
> **loop driver** that runs `runDaemonTick` repeatedly, honoring control without overlap. Closes the
> last `10.030` behavioral done-gate (#3 owner-scoped reload/stop). The literal detached-OS-process
> launch / hidden CLI remains a documented monitored residual (a live bot cannot run in CI).
> Risk class: **C3** (process lifecycle logic); injectable tick/sleep/I/O → fully unit-testable.

## Part 1 — plain explanation
The daemon needs to stop or reload cleanly when asked, without two pollers ever overlapping. This
phase adds an owner-scoped control file (a stop/reload request tagged with the owner it targets) and
the decision that honors it only for the current owner (never clobbering a newer owner or acting on a
stale request), plus a loop driver that runs ticks and obeys the control. Wait-for-pid-death on reload
is already handled by `decideOwnerClaim` (a fresh daemon defers until the old pid is dead/stale).

## Part 2 — diff-level plan

### NEW `packages/coding-agent/src/notifications/daemon-control.ts` (~75 lines, unit-tested)
```ts
export type DaemonControlKind = "stop" | "reload";
export interface DaemonControlRequest { version: 1; kind: DaemonControlKind; targetOwnerId: string; requestedAt: number; }
export type DaemonControlDecision =
  | { action: "honor-stop" | "honor-reload"; reason: "owner-match" }
  | { action: "ignore"; reason: "no-request" | "owner-mismatch" | "stale-request" };
export function daemonControlPath(agentDir: string): string;           // join(transportPaths(dir), "control.json")
export async function readDaemonControl(agentDir): Promise<DaemonControlRequest | null>;
export async function writeDaemonControl(agentDir, req): Promise<void>; // 0600 atomic (reuse private write)
export async function clearDaemonControl(agentDir): Promise<void>;      // unlink, ENOENT-safe
export function decideDaemonControl(input: { current: TransportOwnerState | null; request: DaemonControlRequest | null }): DaemonControlDecision;
```
`decideDaemonControl`: no request → ignore(no-request); no owner → ignore(owner-mismatch); request
`targetOwnerId !== current.ownerId` → ignore(owner-mismatch) (do not clobber a newer owner);
`requestedAt < current.startedAt` → ignore(stale-request); else honor stop/reload.

### NEW `packages/coding-agent/src/notifications/daemon-loop.ts` (~60 lines, unit-tested)
```ts
export type DaemonLoopOutcome = "stopped" | "reloaded" | "max-ticks";
export interface DaemonLoopResult { ticks: number; reloads: number; outcome: DaemonLoopOutcome; }
export interface RunDaemonLoopOptions {
  tick: () => Promise<DaemonTickResult>;
  sleep: (ms: number) => Promise<void>;
  readControl: () => Promise<DaemonControlRequest | null>;
  readOwner: () => Promise<TransportOwnerState | null>;
  clearControl: () => Promise<void>;
  onStop?: () => Promise<void> | void;   // e.g. mark owner stopped
  baseIntervalMs?: number; maxTicks?: number;
}
export async function runDaemonLoop(options): Promise<DaemonLoopResult>;
```
Each iteration: read control+owner → `decideDaemonControl`; honor-stop → clear + `onStop()` + return
`stopped`; honor-reload → clear + return `reloaded` (supervisor relaunches; new owner defers until old
pid dies); else `tick()`, ticks++, sleep `result.poll?.backoffMs ?? baseIntervalMs`. `maxTicks` bounds
test/finite runs (→ `max-ticks`).

### MODIFY `packages/coding-agent/src/notifications/index.ts` — export both.

### Tests
- NEW `test/notifications-daemon-control.test.ts`: decide no-request/no-owner/owner-mismatch/stale/
  honor-stop/honor-reload; read/write/clear round-trip + 0600 + ENOENT-safe clear.
- NEW `test/notifications-daemon-loop.test.ts` (fake tick/sleep/control/owner): runs ticks to maxTicks;
  honor-stop breaks + calls onStop; honor-reload breaks with `reloaded`; uses poll backoffMs for sleep.

### NEW devlog `391_audit`, `392_build`, `393_check`.

## PABCD
- **A**: light independent audit — transportPaths/markTransportOwnerStopped reuse, control decision
  owner-scoping correctness (no newer-owner clobber, stale guard), loop honors control before tick,
  injectable (no real timers/spawn), no token logs, no schema/barrel collisions.
- **B**: Boss writes control + loop + tests.
- **C**: both suites + full notifications regression + check:types + biome + diff-check.
- **D**: **close `10.030` to `_fin`** — all 6 behavioral done-gates met across phases 2/37/38/39;
  document the live detached-OS-process launch / public-vs-internal `jwc daemon` CLI as a monitored
  residual (NEW card if a runnable binary surface is later wanted).

## Constraints
- Owner-scoped control only; never clobber a newer owner. No real timers/spawn — injectable. Token
  never logged. `.jwc` paths. ES modules; files ≤400 lines.
