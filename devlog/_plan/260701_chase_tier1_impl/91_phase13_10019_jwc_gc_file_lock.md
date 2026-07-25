# WP13 — 10.019 gjc chase: `jwc gc` + file-lock GC (ADAPT)

> Card: `struct_har/chase/10.019_gjc_chase_gc_file_lock.md`
> Source: GJC `269387b` (`0cce55f6` #588, `251ea268` #618 TOCTOU) vs JWC `d60b7822`.
> Interview decision (2026-07-01): ADAPT — jwc gc(lock/orphan/TOCTOU GC) 운영 명령 채택. `.gjc→.jwc` naming.
> Card is split into 4 phases (Decision H: multiple PABCD cycles). **This cycle = Phase 1 vertical only.**

## Scope decision (this cycle)

The card's Confirmed-decisions split:
1. **File-lock stale-owner GC + TOCTOU regression** ← THIS CYCLE
2. `jwc gc` command/runtime/render surface ← bundled into this cycle (minimal, file_locks-only) so Phase 1 is a LIVE vertical, not dead code
3. Harness GC adapter — **DEFER** (depends on 10.011 receipt-spool readiness review)
4. Team/tmux GC — **DEFER** (depends on 10.007 tmux self-heal contract)

A GC adapter with no runtime/command to invoke it is dead code. So the minimal LIVE slice is: file-lock GC hooks + a `jwc gc` runtime/command registering ONLY the file_locks store (other stores added in later cycles). This keeps the command real and testable while honoring the split (no team/tmux/harness adapters yet).

## Ground Truth (JWC)
- `packages/coding-agent/src/config/file-lock.ts` — `withFileLock`, lock dir `${file}.lock`, info at `${lockPath}/info` (JSON `{pid,timestamp}`). NO GC hooks yet.
- `packages/coding-agent/src/jwc-runtime/` — exists (runtime dir; GJC used `gjc-runtime/`).
- `packages/coding-agent/src/commands/` — explicit registration in `cli.ts` baseCommands (e.g. `local-provider` line 50).
- `packages/utils/src/dirs.ts:231,242` — `getConfigRootDir()`, `getAgentDir()`. `fs-error.ts:30` — `isEnoent`.
- `packages/coding-agent/src/harness-control-plane/receipt-spool.ts:51` — `resolveReceiptSpoolDir(env)`.
- `cli.ts:36` baseCommands; brand gating via `isJawBrandEnv()`.

## GJC Source (reference, NOT 1:1)
- `config/file-lock-gc.ts` — `fileLocksGcAdapter` (walk roots → `.lock` dirs → classify by pid probe → prune with owner-token re-verify).
- `config/file-lock.ts` — `readFileLockInfoForGc`, `removeFileLockDirForGc` (TOCTOU owner-token guard #606), `FileLockOwnerToken`, `FileLockGcRemoval`.
- `gjc-runtime/gc-runtime.ts` — orchestrator: `GcStore`/`GcRecord`/`GcContext`/`GcStoreAdapter` types, `gcPidProbe`, `collectGcReport`, `computeExitCode`, `runGjcGcCommand`, arg parse, help.
- `gjc-runtime/gc-render.ts` — `buildGcReportText`.
- `commands/gc.ts` — oclif Command wrapper.

## Design (JWC-authored ADAPT)

### Slice A — file-lock GC hooks (`config/file-lock.ts`)
Add (mirroring GJC, JWC layout `${lockDir}/info`):
- `export interface FileLockOwnerToken { pid: number; timestamp: number; }`
- `export type FileLockGcRemoval = "removed" | "owner_changed" | "missing";`
- `export async function readFileLockInfoForGc(lockDir): Promise<{pid,timestamp}|null>` — reuse `readLockInfo`, validate finite pid>0 & finite timestamp.
- `export async function removeFileLockDirForGc(lockDir, expected): Promise<FileLockGcRemoval>` — re-read info; `missing` if gone, `owner_changed` if pid/timestamp differ, else `fs.rm(recursive,force)` → `removed`. TOCTOU guard #606.

### Slice B — gc-runtime backbone (`jwc-runtime/gc-runtime.ts`, NEW)
Port the orchestrator types + probe + collect/prune + arg-parse + exit-code + `runJwcGcCommand` + help. **Naming: `jwc gc`** in help text (not `gjc gc`). Help text JWC-branded.

**TYPE-SOUNDNESS FIX (audit Meitner FAIL → resolved):**
- Keep `GcStore` as a forward-compat union (`"harness_leases" | "team_workers" | "file_locks" | "tmux_sessions" | "registry_entries"`) so future phases can extend without renaming.
- `export const GC_STORES = ["file_locks"] as const;`
- `export type ActiveGcStore = (typeof GC_STORES)[number];` — the **runtime-mapped** key type.
- ALL runtime-mapped records use `ActiveGcStore`, NOT `GcStore`: `GcReport.stores: Record<ActiveGcStore, GcStoreReport>`, `GcCounts.by_store: Record<ActiveGcStore, GcStoreCounts>`, `STORE_HEADINGS: Record<ActiveGcStore, string>`, `emptyStores()`, `emptyByStore()`, `computeCounts()`. This keeps the type contract sound (no full-union map promised while runtime only fills `file_locks`).

**NO-INLINE-IMPORT FIX (audit + AGENTS.md):**
- `defaultGcAdapters()` returns `[fileLocksGcAdapter]` from a **top-level static import** of `./file-lock-gc` adapter (Slice C). Do NOT port GJC's lazy `await import("./team-gc" | "./tmux-gc" | "../harness-control-plane/gc-adapter")` multi-import — those files are deferred (absent) and inline imports violate AGENTS.md.

### Slice C — file_locks adapter (`config/file-lock-gc.ts`, NEW)
Port `fileLocksGcAdapter`: walk `knownFileLockRoots` (getConfigRootDir/getAgentDir/resolveReceiptSpoolDir), depth/entry caps, `.lock` discovery, `collectLockRecord` via probe, `prune` via `removeFileLockDirForGc`. JWC imports.

### Slice D — render (`jwc-runtime/gc-render.ts`, NEW)
Port `buildGcReportText`; iterate `GC_STORES` only; `STORE_HEADINGS: Record<ActiveGcStore, string>` (file_locks key only). `jwc gc` branding.

### Slice E — command (`commands/gc.ts`, NEW) + `cli.ts` registration
oclif Command "Garbage-collect stale JWC session/PID records"; register in baseCommands (operational command, brand-neutral). Calls `runJwcGcCommand`.

### Slice F — TOCTOU regression test
Port `file-lock-gc-toctou.test.ts` + a focused `gc-runtime` file_locks test, JWC-adapted: dead-pid lock removed; live reclaim (owner_changed) refused; missing lock skipped; dry-run default.

## Invariants
- `jwc gc` default = dry-run; `--prune/--force` removes only dead-owner locks; live/eperm/unknown kept.
- TOCTOU: prune re-verifies exact `{pid,timestamp}` before unlink; reclaimed live lock refused (`owner_changed`).
- Only file_locks store wired; team/tmux/harness adapters absent (deferred).
- No `gjc gc`/`.gjc`/gajae literals in added lines (source-citation comments allowed).
- No mutation of user sessions; lock roots = config/agent/spool only, never invocation cwd project dir.

## Acceptance
| check | expectation |
|---|---|
| `jwc gc` dry-run | lists locks, removes nothing |
| `jwc gc --prune` dead-owner lock | removed |
| live reclaim during prune | refused (owner_changed) |
| TOCTOU test | green |
| `bun test` file-lock-gc + gc-runtime | green |
| `bun run check:types` | EXIT 0 |
| naming scan | 0 new gjc/gajae/.gjc literals |

## Verification
- `bun test packages/coding-agent/test/file-lock-gc-toctou.test.ts packages/coding-agent/test/gc-runtime.test.ts` (JWC-adapted names)
- `cd packages/coding-agent && bun run check:types`
- `git diff --check`

## PABCD plan
- P: this doc.
- A: gpt-5.4 explorer audit — dead-code risk, TOCTOU correctness, naming, scope-split soundness.
- B: implement slices A-F, independent reviewer PASS, atomic commit(s).
- C: focused tests + tsgo EXIT 0 + naming + diff --check.
- D: attest → IDLE. Card stays OPEN (phases 2-4 remain) — update card with Phase-1-done note + remaining-phase tracking, do NOT move to _fin yet.

## Depends / feeds
- Depends: card 008 naming, 10.011 (_fin receipt-spool, for spool dir root), 10.007 (_fin tmux, for deferred phase 4).
- Feeds: later cycles add team/tmux/harness GC adapters to the same runtime; card closes to _fin only when split phases are resolved or explicitly deferred-closed.
