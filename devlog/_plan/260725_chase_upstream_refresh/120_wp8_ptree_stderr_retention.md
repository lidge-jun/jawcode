# 120 — wp8 P: 20.089 bounded ptree stderr retention

wp8 takes `20.089` (OMP: runtime stats, logging, collaboration, operational edges).

> **Revised after A-audit (Sagan, FAIL — 4 blocking findings).** The first draft claimed 12 of 20 anchors were
> already-satisfied or non-applicable, leaving exactly one thing to build. That triage was wrong in the
> direction that minimized work. The errors are kept visible rather than quietly patched.

## Retracted triage errors

| draft claim | reality | how the draft got it wrong |
|---|---|---|
| "no IRC subsystem in JWC" | **false.** `src/tools/irc.ts` exists, with a process-global registry documented at `registry/agent-registry.ts:1` and IRC tests | it checked `src/irc/` — upstream's layout — saw nothing, and generalized from one wrong path |
| all 20 anchors triaged | **19.** `7550bd887` (fatal logging teardown) was omitted from the table entirely | anchor count never reconciled against the card |
| "stats port conflict satisfied, and stronger" | **partial.** The HMAC probe does beat upstream's static header, but `readProcessIdentity` returns `null` off Linux/macOS (`stats/src/server.ts:73`), so Windows recovery rejects before probing | read the happy path, not the platform branch |
| "OTLP is a product decision, defer" | **false.** `telemetry-export.ts:110` already initializes trace, metric AND log providers, so `506d0942c` is already adapted and `e00eb7cfb` is live chase scope | judged from the commit subject instead of the file |

Two of these share one failure mode: concluding "absent" from a single upstream-shaped path instead of
searching the fork for its equivalent. That is the bar a "non-applicable" verdict has to clear, because the
verdict silently deletes chase scope.

## Anchor triage — corrected, all 20

| anchor group | JWC state | disposition |
|---|---|---|
| `edba577e7` ptree stderr retention | `packages/utils/src/ptree.ts:100` allocates `#stderrChunks` unconditionally and `:126` pushes **every** chunk | **REAL GAP — implement this cycle** |
| `4010bef98` identity before port reuse | JWC's reuse probe is a **challenge–response HMAC** (`server.ts:134`) plus nonce/startId/command/PID ownership proof | **satisfied, stronger** than upstream's static `x-omp-stats-dashboard` header |
| `b7c8fce83` wildcard-bind test | JWC binds loopback `127.0.0.1` by design (`server.ts:549`) | **non-applicable to the current design** |
| `477112e81` occupied-port recovery | `recoverStatsPort` exists (`server.ts:290`) but `readProcessIdentity` is Linux/macOS-only (`server.ts:73`), so Windows can neither reuse a live dashboard nor reclaim a stale JWC holder | **PARTIAL GAP — deferred, named** |
| `7550bd887` fatal logging teardown | `runCleanup` awaits `Promise.allSettled` with **no watchdog** (`postmortem.ts:35`), so one never-settling callback can block fatal exit; every process opens its own `DailyRotateFile` on a shared date-only filename with compression (`logger.ts:76`) | **REAL GAP — deferred, named** |
| `570f3a171`, `a9ef0c9fa`, `7b5d936f9` PID-qualified log bundling | JWC logs are date-only (`logger.ts:80`) and `createDebugLogSource` already walks dated files | **conditional follow-ons** — required only if `7550bd887`'s PID isolation is adopted |
| `da2e630fb`, `54f4a1894` IRC park/dispose | JWC **has** IRC. `irc.ts:141` dispatches to `running`/`idle` targets while `sdk.ts:2047` unregisters only in a `finally` **after** `originalDispose()` settles — a disposing session stays deliverable | **REAL GAP — deferred, named** |
| `506d0942c` OTLP export | already adapted: trace, metric and log providers all initialized (`telemetry-export.ts:110`) | **already satisfied** |
| `e00eb7cfb` telemetry signal fix | JWC still uses the pre-fix log construction / global logger lookup (`telemetry-export.ts:120`) | **GAP — deferred; needs a live OTLP probe, not a blind port** |
| `013f70c7d` TTS escape priority | JWC has STT but no playback/vocalizer subsystem | **non-applicable** |
| `27df75872` collab-web IME | no `packages/collab-web` | **non-applicable** |
| `ac8e9e05b` runtime module resolver | no `packages/utils/src/runtime-install.ts` | **non-applicable** |
| `242bcbef8` eval agent-bridge revert | no `src/eval/agent-bridge.ts` | **non-applicable** |
| `51dbe0536` setup-version guard | no `src/modes/setup-version.ts` | **non-applicable** |
| `b1c0a0193` print-mode teardown | liveness satisfied, semantics differ: JWC races the **entire** disposal against 1.5s (`print-mode.ts:14`) where upstream bounds only memory consolidation, so JWC may abandon unrelated cleanup | **satisfied for liveness; difference recorded** |
| `8b0402b32` cursor mounted-device approval | JWC's Cursor MCP calls go through the wrapped common registry (`sdk.ts:1558`, `cursor.ts:356`); the upstream bypass appears absent | **deferred — closes N/A once a focused approval-denial test confirms it** |
| `1966d041f` bundled namespace resolver | JWC's shim registers only file and legacy-file namespace resolvers (`legacy-pi-compat.ts:294`); upstream's **bundled-virtual registry is the missing prerequisite** | **deferred — dependency-blocked, prerequisite named** |

Corrected shape: **1 implemented this cycle · 3 already satisfied · 5 non-applicable with reasons · 5 real
gaps deferred with named owners** — not "one gap and a pile of N/A". `20.089` closes **ADAPT-partial** with an
enumerated residual.

The deferred gaps are genuinely separate surfaces — fatal-exit watchdog plus log rotation, IRC/registry
lifecycle, telemetry signal wiring, Windows process identity. Folding four unrelated subsystems into one B
step would break one-card-one-unit discipline in the other direction; each needs its own probe and regression.

## The defect

`ChildProcess` drains stderr into two places at once: a bounded tail string (`#stderrTail`, trimmed to
`NonZeroExitError.MAX_TRACE`) and an **unbounded** raw array (`#stderrChunks`). The tail is capped; the array
is not. Any long-lived noisy subprocess therefore grows JWC's memory linearly for the entire life of the
process, even though nothing will ever read those chunks unless the caller asks for `stderr: "full"`.

`#stderrChunks` is only ever consumed at `ptree.ts:261`, in `wait({ stderr: "full" })`.

## Fix

Allocate the array only when full capture was requested at spawn time:

- `#stderrChunks?: Uint8Array[]` — undefined by default.
- Constructor takes `retainFullStderr`, defaulting to `exposeStderr`, and allocates only when true.
- The drain loop uses `this.#stderrChunks?.push(chunk)`.
- `wait({ stderr: "full" })` throws a clear error when capture was not requested at spawn, instead of silently
  returning an empty string.

### JWC-specific hazard the upstream diff does not cover

JWC's `exec()` (`ptree.ts:352`) destructures `stderr` out of its options and forwards it **only to `wait()`**,
never to `spawn()`. So `exec(cmd, { stderr: "full" })` would spawn with retention OFF and then demand full
stderr — turning working calls into throws. This is load-bearing: seven call sites pass `stderr: "full"`,
including the `exec` tool itself (`exec/exec.ts:44`), yt-dlp scraping (`youtube.ts:179`) and package installs
(`tools-manager.ts:259,271`).

**Naively forwarding `stderr: "full"` into public `spawn()` is not the fix** (audit finding 6): `spawn` also
*tees and exposes* `child.stderr`, which `exec` never consumes — creating a second unconsumed buffering path
and reintroducing the leak by another route. Exposure and retention must be separate controls:

- `exposeStderr` → create the public stream tee (unchanged, caller-visible).
- `retainFullStderr` → retain raw chunks.
- `exec({ stderr: "full" })` → retain **without** exposing.

`ChildProcess`'s constructor is public API, so retention is threaded through an internal spawn helper rather
than by widening the exported constructor's contract.

On the error shape: `wait({ stderr: "full" })` without spawn-time capture **throws** rather than degrading to
the tail. `"full"` is an explicit no-data-loss request, so a silent truncation would be worse than a loud
failure. A plain `Error` with a clear message suffices — no new error class. No repository caller currently
does a default `spawn()` followed by `wait({ stderr: "full" })` (the only `wait()` call site is inside
`exec()`), so the throw cannot break an existing path.

## Owner paths

- `packages/utils/src/ptree.ts`
- `packages/utils/test/ptree-stderr.test.ts` (new)

## Verification

The audit is right that a public-API test cannot directly observe `#stderrChunks`; claiming otherwise would
dress an output assertion up as a memory proof. What is honestly provable:

1. A large default-spawn workload returns only the **bounded tail** (~32 KiB cap), not megabytes.
2. `wait({ stderr: "full" })` after a default spawn **throws**.
3. `spawn({ stderr: "full" })` + `wait({ stderr: "full" })` returns **all** bytes.
4. `exec({ stderr: "full" })` returns all bytes — the regression the hazard above would otherwise introduce.
5. Non-zero exits still carry the trimmed tail in the error.

Case 1 is the closest observable proxy for the retention fix: with retention off the only surviving buffer is
the capped tail, so a multi-MB stderr producer must still yield a small result.

Gates: `bun run check:ts` plus the focused `packages/utils` tests. The four rebrand/default-surface gates are
**not** this cycle's proof — `AGENTS.md` requires them after workflow-definition changes, and this is
utils-only (audit finding 8). They still run before the branch push.

## Not in scope

TUI visual identity. Deferred with named owners: `7550bd887` fatal-cleanup watchdog + log rotation isolation
(and its `570f3a171`/`a9ef0c9fa`/`7b5d936f9` follow-ons), `da2e630fb`/`54f4a1894` IRC-during-dispose,
`e00eb7cfb` OTLP signal probe, `477112e81` Windows port recovery, `8b0402b32` cursor approval confirmation,
`1966d041f` bundled-virtual registry prerequisite.
