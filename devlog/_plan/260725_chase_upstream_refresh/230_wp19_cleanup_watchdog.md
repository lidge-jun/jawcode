# 230 — wp19: Ctrl-C did nothing if one cleanup callback hung

Source: **residual gap 1** named in the wp8 `_fin` card for `20.089` (anchor `7550bd887`). Deferred there
with an owner; collected here. Deferring is only honest if the list is eventually worked.

| phase | evidence |
|---|---|
| P | live hang reproduction |
| A | **pass**, budget sized against the real registrations |
| B | `10b2457` |
| C | gates green; ablation reproduces the hang |

## The defect

`runCleanup` awaited `Promise.allSettled(...)` with no bound. Every fatal path awaits it *before*
`process.exit`:

```
SIGINT · SIGTERM · uncaughtException · unhandledRejection  →  await runCleanup(...)  →  process.exit(...)
```

So one callback that never settles means Ctrl-C does nothing, twice does nothing, and the user reaches for
`kill -9`. Measured rather than reasoned: a registered never-resolving callback left `cleanup()` still
pending after 3s.

## Sizing the budget was the real question

A watchdog that fires too early is worse than the hang, because it silently truncates teardown. So I
enumerated what actually registers: `sshfs-cleanup`, `ssh-cleanup`, `otel-export`, `runtime:owned-processes`,
`bash-executor:shell-sessions`, `session-manager-flush`, `terminal-restore`. Several are network or mount
operations. Hence 10s — generous enough for real teardown, short enough that Ctrl-C still feels like it
worked — plus `JWC_CLEANUP_TIMEOUT_MS`, with `0` restoring wait-forever for anyone who would rather hang
than risk truncation.

Two smaller traps the audit caught:

- A bare `setTimeout` would itself keep the event loop alive on a healthy fast shutdown. The timer is
  `unref`'d.
- Bounding the **wait** must not skip the healthy callbacks. A test registers a stuck callback and a healthy
  one together and asserts the healthy one still ran.

The log names the callbacks still pending at the deadline, so a hang is diagnosable instead of mysterious —
which is why registration ids are now tracked.

## Two anchors probed and found already satisfied

Recorded rather than reworked, and rather than quietly dropped:

- OMP `817a08122` (auth stickiness warm window) — `auth-storage.ts` already has
  `ANTHROPIC_SESSION_STICKY_CACHE_WARM_MS` and gates `shouldRank` on it.
- GJC `26078eecc` (structured-error delivery) — the bridge already guards its fire-and-forget promises.

Also confirmed genuinely non-applicable, by capability search rather than path check: devin and warp
providers do not exist in this fork, and there is no empty-stop retry subsystem for `2481a4c51`/`02443a1c5`.

## Test hygiene

The probe writes its script **inside** the repo. From an unrelated cwd Bun resolves the published
`@jawcode-dev/utils` from the install cache, so a temp-dir probe silently measures a different module — the
same trap as wp14. And because a deliberately-hanging probe can get the runner killed, the per-call
`finally` is backed by an `afterAll` sweep; the first ablation run left a stray directory in the source tree
before I added it.
