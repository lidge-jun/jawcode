# 71 — P2.0a metrics core + TUI JSONL plan

Date: 2026-06-15

## Objective

Complete a narrowed PABCD implementation cycle for the first part of Bundle A: metrics core plus real TUI JSONL emission. This is the recovery plan after Bundle A's broad P2.0 A-stage hit the audit round cap. P2.0a deliberately excludes coding-agent/session/sdk hooks so Stage A can verify one integration surface before the rest of Bundle A continues as P2.0b.

## Why the scope changed

The broad P2.0 plan in [70_p2_0_measurement_plan.md](./70_p2_0_measurement_plan.md) was architecturally useful but too wide for one audit cycle: it included TUI lifecycle flushing, assistant-message counters, transcript overlay counters, session open/materialization counters, and SDK startup counters. Stage A reached the native round cap after planner/architect delta failures.

P2.0a keeps the load-bearing foundation:

- `JWC_PERF=1` enablement and `PI_TUI_METRICS=1` compatibility.
- `jwc.perf-events/1` JSONL schema.
- bounded in-memory event/counter retention.
- synchronous TUI lifecycle flush from `TUI.stop()`.
- real TUI render-path JSONL fixture.

P2.0b will add coding-agent/session/sdk counters after P2.0a proves the sink and lifecycle are stable.

## Source files

### MODIFY `packages/tui/src/metrics.ts`

Before:

- `RenderMetrics` defaults to `$flag("PI_TUI_METRICS")`.
- Existing snapshot covers render durations, request sources, full-redraw causes/storms, RSS samples, owner/timer gauges, and helper stats.
- Existing helper timing uses `recordHelper()`.
- No runtime JSONL event schema or flush helper exists.

After:

- Add `isPerfMetricsEnabled(env = process.env): boolean`:
  - `JWC_PERF=1` enables metrics.
  - `PI_TUI_METRICS=1` remains a compatibility alias.
  - For P2.0a JSONL lifecycle, `PI_TUI_METRICS=1` is in-memory compatibility collection only; automatic `TUI.stop()` JSONL flush requires `JWC_PERF=1` or `JWC_PERF_LOG`.
  - explicit constructor argument still overrides default behavior for tests.
- Change the `RenderMetrics` constructor default from `$flag("PI_TUI_METRICS")` to `isPerfMetricsEnabled()` so the process-wide `renderMetrics` singleton honors `JWC_PERF=1` when the environment is set before import.
- Add runtime event schema:
  - `PERF_EVENT_SCHEMA = "jwc.perf-events/1"`.
  - `PerfCounterEvent { schema, ts, source, counters, labels? }` with ISO-8601 UTC `ts`.
- Add bounded event/counter methods to `RenderMetrics`:
  - `recordCounter(source: string, name: string, value?: number, labels?: Record<string, string>): void`.
  - `recordEvent(source: string, counters: Record<string, number>, labels?: Record<string, string>): void`.
  - disabled calls return before event object allocation.
  - cap buffered events at `MAX_PERF_EVENTS = 2048`; overflow increments `eventsDropped`.
  - source/counter/label cardinality follows existing `MAX_LABEL_MAP_ENTRIES` / `other` overflow policy.
  - `recordCounter(source, name)` aggregates snapshot counter `${source}.${name}` and appends exactly one event row `{ source, counters: { [name]: value } }`.
  - `recordEvent(source, counters)` aggregates each short key as snapshot counter `${source}.${key}` and appends exactly one event row `{ source, counters }`.
- Extend `RenderMetricsSnapshot` with bounded summary only:
  - `counters: Record<string, number>` using source-qualified keys such as `tui.frame.frame.count`.
  - `eventsBuffered: number`.
  - `eventsDropped: number`.
  - `reset()` clears buffered events, snapshot perf counters, `eventsBuffered`, and `eventsDropped` while preserving enabled state.
- Add JSONL helpers:
  - `serializePerfEvent(event: PerfCounterEvent): string` — compact one-line JSON, no pretty print.
  - `resolvePerfLogPath(env?: NodeJS.ProcessEnv): string` — default `path.join(getLogsDir(), "perf.jsonl")` from `@gajae-code/utils`, override `JWC_PERF_LOG`.
  - `flushPerfEvents(metrics?: RenderMetrics, path?: string): Promise<void>` — async helper for tests/future owners.
  - `flushPerfEventsSync(metrics?: RenderMetrics, path?: string): void` — sync helper for `TUI.stop()`.
- Flush contract:
  - UTF-8 append mode.
  - create parent directory with Bun/Node filesystem APIs.
  - one compact JSON object per line with trailing newline.
  - no stdout/stderr fallback.
  - write failures do not throw in interactive use; they increment `perf.write.error` and keep shutdown safe.
  - successful flush appends all buffered rows, then clears the event buffer; a second successful flush/stop is idempotent.
  - write failures do not throw, increment `snapshot().counters["perf.write.error"]`, and retain buffered rows for a later explicit flush.
  - `TUI.stop()` auto-flush is gated by explicit perf logging intent (`JWC_PERF=1` or `JWC_PERF_LOG` set), not programmatic `renderMetrics.enable()` alone.
  - `PI_TUI_METRICS=1` alone does not trigger automatic JSONL flush from `TUI.stop()`; it only enables in-memory metrics compatibility.

### MODIFY `packages/tui/src/tui.ts`

Before:

- `renderMetrics` records request sources, render durations, helper durations, gauges, and full redraw reasons.
- `stop()` is synchronous and does not flush perf rows.
- P1.5.1 expedited input render behavior is already present and must be preserved.

After:

- In the real `#doRender` path, insert one guarded metrics block immediately after final line composition — after `#truncateLinesToWidth(newLines, width)` and before full-render/diff branching or early returns. Every `#doRender` entry that reaches this anchor records:
  - `renderMetrics.recordCounter("tui.frame", "frame.count", 1)`.
  - `renderMetrics.recordCounter("tui.frame", "frame.lines", newLines.length)` after final line composition.
  - zero-valued placeholder events with `labels.placeholder === "true"`:
    - `renderMetrics.recordEvent("tui.frame", { "frame.emittedLines": 0 }, { placeholder: "true" })`.
    - `renderMetrics.recordEvent("tui.preparedLine", { "normalize.hit": 0, "normalize.miss": 0, "truncate.hit": 0, "truncate.miss": 0 }, { placeholder: "true" })`.
    - `renderMetrics.recordEvent("tui.text", { "wrap.calls": 0, "visibleWidth.calls": 0 }, { placeholder: "true" })`.
- Placeholder values are always zero in P2.0a and the three placeholder `recordEvent` calls fire on every anchored `#doRender` when metrics are enabled. Later slices replace them with real accounting.
- `TUI.stop()` calls `flushPerfEventsSync(renderMetrics)` only when metrics are enabled and explicit perf logging intent is present (`JWC_PERF=1` or `JWC_PERF_LOG` set).
- Do **not** change render scheduling, input-priority rendering, terminal clear/reset policy, viewport fill, scroll/fill/gap behavior, or welcome visuals.
- Do **not** move or rewrite `packages/tui/src/utils.ts` helper ownership in this slice; existing `recordHelper("text.visibleWidth", ...)` remains as-is.

### MODIFY `packages/tui/test/metrics.test.ts`

Add unit tests for:

- `isPerfMetricsEnabled({}) === false`.
- `JWC_PERF=1` enables metrics.
- `PI_TUI_METRICS=1` compatibility alias enables metrics.
- explicit `new RenderMetrics(false)` remains disabled.
- disabled `recordCounter()` / `recordEvent()` leave counters/events zeroed.
- enabled `recordCounter()` / `recordEvent()` produce source-qualified snapshot counters and bounded event summary.
- `serializePerfEvent()` emits one compact JSON object without newline; flush helpers add newline.
- `resolvePerfLogPath()` honors `JWC_PERF_LOG` and otherwise resolves to `path.join(getLogsDir(), "perf.jsonl")`.
- `reset()` clears the new event/counter fields while preserving enabled state.

### MODIFY `packages/tui/test/metrics-redteam.test.ts`

Add red-team tests for:

- High-volume dynamic source/counter/label names remain bounded and overflow to `other`.
- Event overflow increments `eventsDropped` after `MAX_PERF_EVENTS`.
- Disabled high-volume calls include `recordCounter()` and `recordEvent()` and leave snapshot counters/events zeroed (`counters: {}`, `eventsBuffered: 0`, `eventsDropped: 0`).
- `flushPerfEvents()` and `flushPerfEventsSync()` write compact UTF-8 JSONL, one object per line, trailing newline.
- Flush helpers do not call stdout/stderr; use spies around `process.stdout.write` / `process.stderr.write` or equivalent.
- Flush write errors do not throw in interactive mode and assert `snapshot().counters["perf.write.error"] === 1`.
- Event recording does not call `process.memoryUsage()`; RSS sampling remains explicit through `sampleRss()`.

### NEW `packages/tui/test/perf-events-p2_0.test.ts`

Add a TUI integration fixture proving the real render-path sink:

- Use the process-wide `renderMetrics` singleton, not a detached `new RenderMetrics(true)`.
- Enable it via the existing replay-harness-style `renderMetrics.enable()` / `renderMetrics.reset()` pattern or by setting env before importing `@gajae-code/tui/metrics`.
- Set `JWC_PERF_LOG` or an explicit helper path to an isolated temp file.
- Drive at least one real TUI render path using a minimal TUI fixture; do not use `runReplay` for this test.
- Assert flushed JSONL rows using the event shape, not snapshot-qualified keys:
  - every row has `schema: "jwc.perf-events/1"`.
  - every row has ISO-8601 UTC `ts`.
  - every row has `source`.
  - every row has compact `counters`.
  - frame rows are matched as two distinct rows: one row with `source === "tui.frame"` and `counters["frame.count"]`, and a separate row with `source === "tui.frame"` and `counters["frame.lines"]`.
  - placeholder frame row is matched as `source === "tui.frame"`, `counters["frame.emittedLines"] === 0`, and `labels.placeholder === "true"`.
  - prepared-line placeholder row is matched as `source === "tui.preparedLine"` with short keys `normalize.hit`, `normalize.miss`, `truncate.hit`, `truncate.miss`, all zero, and `labels.placeholder === "true"`.
  - text placeholder row is matched as `source === "tui.text"` with short keys `wrap.calls`, `visibleWidth.calls`, both zero, and `labels.placeholder === "true"`.
  - each anchored render produces at least five JSONL rows: two `recordCounter` rows (`frame.count`, `frame.lines`) plus three placeholder `recordEvent` rows (`tui.frame`, `tui.preparedLine`, `tui.text`).
- Do not compare placeholder `tui.text.*` JSONL rows to `snapshot().helperStats.text.visibleWidth`; P2.0a placeholders intentionally coexist with the existing helper timing owner.
- Assert `TUI.stop()` writes buffered rows through the sync flush path without a manual flush call when metrics are enabled and `JWC_PERF=1` or `JWC_PERF_LOG` is set.
- Assert disabled mode with a pre-created temp log appends zero bytes / zero new lines.
- Assert programmatic `renderMetrics.enable()` plus `TUI.stop()` without `JWC_PERF` / `JWC_PERF_LOG` appends zero bytes.
- Assert repeated stop/flush after a successful sync flush does not duplicate rows.

## Non-goals

- No coding-agent hooks in this cycle.
- No assistant-message counters in this cycle.
- No transcript overlay counters in this cycle.
- No session-manager or SDK counters in this cycle.
- No P2.2 prepared-line cache behavior.
- No P2.1 assistant child reuse behavior.
- No P2.3 lazy transcript behavior.
- No P3 session open single-load/path-only context behavior.
- Plan 70 coding-agent/session/sdk MODIFY blocks and registry rows are deferred to P2.0b and must not be implemented in P2.0a.

## Verification

Focused gates:

```bash
bun test packages/tui/test/metrics.test.ts packages/tui/test/metrics-redteam.test.ts packages/tui/test/perf-events-p2_0.test.ts
bun test packages/tui/test/input-render-latency.test.ts packages/tui/test/input-render-redteam.test.ts
bun --cwd=packages/tui run check
```

Done checklist:

- `JWC_PERF` unset: no JSONL append, no stdout/stderr noise, disabled counters/events stay zeroed.
- `JWC_PERF=1` or explicit singleton enablement buffers `jwc.perf-events/1` rows from the real TUI render path.
- On-disk JSONL emission happens through explicit flush helpers or `TUI.stop()` when metrics are enabled and `JWC_PERF=1` or `JWC_PERF_LOG` is set.
- All placeholder rows are emitted with `labels.placeholder === "true"`.
- Placeholder JSONL rows use zero-valued short counters under their `source` and `labels.placeholder === "true"`.
- `snapshot().counters["perf.write.error"] === 1` after a forced flush write failure.
- Successful flush drains the event buffer; repeated `TUI.stop()` / flush does not duplicate rows.
- Existing input render latency/redteam tests stay green.
- Package TUI check passes.

## Follow-up cycles

- P2.0b: coding-agent/session/sdk counters using the stable P2.0a sink.
- P2.2: replace prepared-line placeholders with real content-keyed cache accounting.
- P3.1: use P2.0b session counters to prove single-load open.
