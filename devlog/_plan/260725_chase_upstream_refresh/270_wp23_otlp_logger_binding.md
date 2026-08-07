# 270 — wp23: the logs went to somebody else's provider

Source: **residual gap 3** in the wp8 `_fin` card for `20.089` (anchor `e00eb7cfb`) — the last one open.
All five residuals are now closed.

| phase | evidence |
|---|---|
| P | SDK source + live collector |
| A | **pass**, after checking upstream's patch against the installed SDK |
| B | `9ee07f0` |
| C | gates green; ablation-verified |

## Half of upstream's patch would have broken us

`e00eb7cfb` changed two things. The first:

```
new BatchLogRecordProcessor(exporter)   →   new BatchLogRecordProcessor({ exporter })
```

At this repo's `@opentelemetry/sdk-logs` **0.218.0** the declaration is
`constructor(exporter: LogRecordExporter, config?)` — positional. Porting that half would have broken log
export outright. Upstream is simply on a different SDK version.

This is the concrete reason the card said *"needs a live collector probe, not a blind port"*, and it is worth
recording that the deferral was correct rather than cautious.

## The other half is a real, silent defect

`logs.setGlobalLoggerProvider(provider)` **returns the existing provider** when one is already registered —
it does not replace it. So:

```
logs.setGlobalLoggerProvider(logProvider);      // may be a no-op
otelLogger = logs.getLogger("…");               // → logger from SOMEBODY ELSE's provider
```

An embedder that configures OpenTelemetry before creating a session — the normal order — gets JWC's logs
emitted through their provider, bypassing the exporter, resource and batch processor built two lines above.
Nothing errors. The logs just go somewhere else.

Proven against the SDK directly: two sequential registrations, and the second call returns the first
provider.

## Why the live probe mattered

A source-level check cannot distinguish "logger bound correctly" from "logger bound to a stranger" — both
compile and both run. So the suite stands up a real `Bun.serve` OTLP endpoint, initializes telemetry in a
child process, logs, flushes, and asserts a non-empty protobuf body arrived. It does: 157 bytes.

Under ablation the binding test goes red and the live probe stays **green**, which is correct and worth
stating — with no pre-registered provider there is nothing to collide with, so the live path works either
way. The bug needs a host that got there first.

## Test mechanics I got wrong first

- I asserted the collector saw a `/v1/logs` path. It sees `/`: the exporter POSTs to the configured endpoint
  as given, so that assertion was testing the SDK's URL joining, not JWC's delivery.
- The child spawn takes ~8s (the exporter retries), against bun's 5s default timeout. Needed an explicit
  budget — and an `afterAll` sweep, because two temp directories leaked from the timed-out runs before I
  added it. Same lesson as wp19; I should have carried it forward the first time.

## `20.089` residuals: closed

| # | anchor | phase |
|---|---|---|
| 1 | `7550bd887` cleanup watchdog | wp19 |
| 2 | `da2e630fb`/`54f4a1894` dispose delivery | wp21 |
| 3 | `e00eb7cfb` OTLP binding | wp23 |
| 4 | `477112e81` Windows stats identity | wp20 |
| 5 | `8b0402b32` tool approval gate | wp22 |
