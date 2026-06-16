# Perf profiling corpus

The profiling corpus is the successor to the static [`cpu-hotspot-map.json`](./cpu-hotspot-map.json) ranking. The static map ranked hotspots by complexity and trigger frequency, but did not prove real CPU self-time. The corpus replaces that guess with measured, separated evidence and is the source of future perf prioritization.

Implementation:

- Schema + evidence taxonomy + validation: `packages/coding-agent/bench/perf-corpus-schema.ts`
- Runner: `packages/coding-agent/bench/perf-corpus.bench.ts`
- Threshold/evidence ledger: `packages/coding-agent/bench/perf-threshold.ledger.ts`
- Tests: `packages/coding-agent/test/perf-corpus.test.ts`

## Evidence taxonomy

Each metric and optimization claim is classified by **evidence class**. These classes must never be conflated:

| Class | Meaning | Sufficient for CPU self-time? |
|---|---|---|
| `wall-clock-proxy` | elapsed time around a phase/operation | No |
| `process-cpu-usage` | `process.cpuUsage()` user/system deltas | No |
| `profiler-self-time` | profiler/sampled attribution of self-time to a symbol | **Yes (required)** |
| `rss-memory` | RSS/heap baseline/growth/return | No (memory only) |
| `byte-parity` | golden rendered/persisted/provider/materialized comparisons | n/a (safety) |
| `ledger-approved-threshold` | human-approved threshold change | n/a (process) |

Optimization **status vocabulary** for a hotspot:

- `CPU-self-time confirmed` — requires `profiler-self-time` evidence (an `artifactPath` or non-empty `samples`).
- `fallback-toggle-confirmed` — comparable before/after or feature/fallback-toggle evidence proves an end-to-end win without byte changes.
- `covered-current` — the corpus exercises the path but has no comparable before/after evidence.
- `not-visible` — the path was not exercised or showed no measurable impact.
- `needs-trace-coverage` — the corpus lacks fixture coverage for the path.

A v1–v3 win is **never** called "confirmed" from current-only coverage. `validatePerfCorpusReport()` enforces this: a `CPU-self-time confirmed` classification is rejected unless the report carries profiler self-time evidence.

## Schema (`jwc.perf-corpus/1`)

`PerfCorpusReport` keeps the evidence classes as **separate named fields** per fixture:

- `wallClockPhase: Record<string, { elapsedMs, p50Ms?, p95Ms?, advisoryOnly }>`
- `processCpuUsage: Record<string, { userMicros, systemMicros, elapsedMs, cpuFraction? }>`
- `profilerSelfTime: { profiler, artifactPath?, samples? }`
- `rssMemory: { baselineBytes, peakBytes?, growthBytes, returnBytes, ... }`
- `byteParity: { renderedGolden?, persistedJsonlGolden?, providerPayloadGolden?, materializedSessionGolden? }`

`hotspotClassifications: HotspotClassification[]` carry `{ hotspotId, status, evidenceClass, artifactRefs, notes }`. The current v1–v3 reclassification lives in `V1_V3_RECLASSIFICATION`; no entry is `CPU-self-time confirmed` because no profiler artifacts have been captured yet.

## Privacy rules

- Never commit raw private session transcripts.
- Default fixtures are `synthetic` (deterministic PRNG, no real data).
- `sanitized-real` / `dogfood-redacted` fixtures are allowed only with documented redaction in `privacy.redactionNotes`; `privacy.rawPrivateTranscriptCommitted` must be `false`.

## Commands

```bash
# Emit a corpus report (stable JSON)
bun packages/coding-agent/bench/perf-corpus.bench.ts

# Run the corpus schema/classification/ledger tests
bun test packages/coding-agent/test/perf-corpus.test.ts

# Run the retained-session-memory smoke bench with GC return samples
bun --smol --expose-gc packages/coding-agent/bench/session-memory.bench.ts
```

## Profiler-artifact expectations

The base runner attaches no profiler (`profilerSelfTime.profiler: "none"`), so it can never promote a hotspot to `CPU-self-time confirmed`. To confirm CPU self-time:

1. Capture a profiler artifact (for example, a `.cpuprofile`) while running the relevant fixture.
2. Record it in the fixture's `profilerSelfTime` as `{ profiler, artifactPath, samples }`.
3. Set the hotspot classification to `CPU-self-time confirmed` with `evidenceClass: "profiler-self-time"` and the artifact in `artifactRefs`.
4. `validatePerfCorpusReport()` will then accept the claim.

## Threshold-promotion process

Wall-clock and RSS thresholds are noisy. Promotion is gradual:

1. **Advisory** — reported in the corpus JSON / console; never fails CI. All thresholds start here (`APPLIED_PERF_THRESHOLDS`, `advisoryOrEnforced: "advisory"`, `varianceCharacterized: false`).
2. **Opt-in numeric** — exercised under the existing `PI_TUI_PERF_GATES=1` gate surface (see `packages/tui/test/perf-gates.test.ts`).
3. **Enforced** — a hard CI gate, allowed only with `varianceCharacterized: true`, passed before/after `benchmarkEvidence`, and human approval. `validatePerfThresholdLedger()` rejects enforced thresholds lacking this evidence.

Held thresholds (`HELD_PERF_THRESHOLDS`) name candidates that need variance characterization before enforcement.

## Memory retention & fail-closed materialization

Resident-memory retention (hotspots M01–M05) is measured before further memory rewrites. P1.5.2 owns the resident-cache lifecycle merge; this corpus lane only adds measurement and validation scaffolding.

Retained growth and post-GC return are measured by `packages/coding-agent/bench/session-memory.bench.ts` (emits the corpus `rssMemory` shape). The bench uses deterministic synthetic entries and a temporary `jwc-session-memory-*` root; it does not commit raw private transcripts.

**Measured deferral:** further memory rewrites beyond byte-parity-preserving bounds are deferred to corpus prioritization. Per [`native-ffi-optimization-policy.md`](./native-ffi-optimization-policy.md) and the byte-parity principle, speculative memory rewrites wait for profiler/RSS corpus evidence rather than being undertaken on a static-ranking guess.
