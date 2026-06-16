# 70 — P2.0 measurement checkpoint plan

Date: 2026-06-15

## Objective

Complete the first implementation PABCD cycle for Bundle A / P2.0: add opt-in performance measurement that is off by default, emits no interactive noise, and writes bounded `jwc.perf-events/1` JSONL evidence when explicitly enabled. This cycle does **not** implement P2.2/P2.1/P3 optimizations; it only creates the measurement contract they will use.

## Requirements source

- Goal: execute measured performance optimization bundles under PABCD/goal tracking through D.
- Execution plan: [69_p2_p3_measured_execution_plan.md](./69_p2_p3_measured_execution_plan.md)
- Audit synthesis: [68_p2_p3_external_audit_synthesis.md](./68_p2_p3_external_audit_synthesis.md)
- Existing metrics surface: `packages/tui/src/metrics.ts`, `packages/tui/test/metrics.test.ts`, `packages/tui/test/metrics-redteam.test.ts`

## Critic revision summary

- Round 1 critic verdict was ITERATE (`70.1_p2_0_critic_round1.md`). This revision accepted the findings: JSONL persistence is now a wired deliverable, JSONL events are the primary P2.0 evidence contract, counter keys are registered below, and slice completion requires named unit/integration tests rather than API-only tests.
- Round 2 critic verdict was ITERATE (`70.2_p2_0_critic_round2.md`). This revision adds the missing TUI JSONL integration fixture, wrap/visible-width placeholder rows, flushed-JSONL assertions for each domain, and keeps `sdk.session.*` startup spans under integration coverage.
- Round 3 critic verdict was ITERATE (`70.3_p2_0_critic_round3.md`). This revision requires the TUI fixture to drive the real process-wide `renderMetrics` + render path and requires coding-agent JSONL coverage for `session.context.entries.materialized`.
- A-stage round 1 produced Planner PASS and Architect FAIL (`70.5_a_p2_0_planner_audit_r1.md`, `70.6_a_p2_0_architect_audit_r1.md`). The audit synthesis (`70.7_a_p2_0_audit_synthesis_r1.md`) accepted the integration findings and revised counter ownership to match real hook sites.
- A-stage delta round 2 produced Planner FAIL and Architect FAIL (`agent://49-P20PlannerDeltaR2`, `agent://50-P20ArchitectDeltaR2`). The second synthesis (`70.8_a_p2_0_audit_synthesis_r2.md`) fixes sync flush, singleton enable/reset test setup, disabled zero-append wording, and per-hook API wording.

## Scope
In scope:

- Metrics owner/API in `packages/tui/src/metrics.ts`.
- Runtime flush owner in `packages/tui/src/tui.ts`; shutdown flush path is `TUI.stop()` only plus explicit test helper calls.
- TUI frame and placeholder rows from the real process-wide `renderMetrics` sink.
- Coding-agent measurement hooks in existing functions only: assistant update, transcript overlay render/cache-miss/navigation input, session open/load/context build, and `createAgentSession()` startup spans.
- Tests named in this plan.

Out of scope:

- Any P2.2 prepared-line cache behavior, P2.1 child reuse behavior, P2.3 lazy transcript behavior, or P3 single-load/path-only context behavior.
- Moving existing `utils.ts` `recordHelper("text.visibleWidth", ...)` ownership in this slice.
- Adding new startup-flag modules or new prepared-line modules.


## P2.0 event and counter contract

Runtime perf events are separate from the benchmark corpus:

- `jwc.perf-events/1`: opt-in runtime JSONL event rows from this slice.
- `jwc.perf-corpus/1`: benchmark report schema from P1.5.5; unchanged by P2.0.

JSONL event model:

```ts
export const PERF_EVENT_SCHEMA = "jwc.perf-events/1" as const;

export interface PerfCounterEvent {
	schema: typeof PERF_EVENT_SCHEMA;
	ts: string; // ISO-8601 UTC
	source: string;
	counters: Record<string, number>;
	labels?: Record<string, string>;
}
```

Persistence contract:

- Default path: `~/.jwc/logs/perf.jsonl`.
- Override path: `JWC_PERF_LOG=/absolute/or/relative/path.jsonl`.
- Enable switch: `JWC_PERF=1`; `PI_TUI_METRICS=1` is compatibility alias through the same resolver.
- Writer behavior: UTF-8, append mode, one compact JSON object per line, trailing newline, parent directory created with Bun APIs, no pretty-print, no stdout/stderr fallback.
- Error policy: swallow write errors after recording a bounded in-memory `perf.write.error` counter; never crash the interactive session because perf logging failed.
- Flush triggers for this slice:
  - explicit `flushPerfEvents()` / `flushPerfEventsSync()` helper for tests and future lifecycle owners;
  - `TUI.stop()` flushes current `renderMetrics` events when enabled;
  - tests set `JWC_PERF_LOG` to an isolated temp path or pass an explicit temp path to the helper.
- JSONL events are the primary P2.0 evidence. `RenderMetricsSnapshot` exposes counters and an event summary (`eventsBuffered`, `eventsDropped`), not unbounded full event rows.

Caps:

- `MAX_PERF_EVENTS = 2048` buffered rows per `RenderMetrics` instance.
- Counter/source/label cardinality uses the existing `MAX_LABEL_MAP_ENTRIES` overflow policy and aggregates overflow under `other`.
- Disabled recording must return before allocating `PerfCounterEvent` objects.

Canonical counter registry:

| Source | Counter key | API | Hook site | Labels | Disabled behavior |
|---|---|---|---|---|---|
| `tui.frame` | `frame.count` | `recordCounter` | `TUI.#doRender` completion | none | no-op |
| `tui.frame` | `frame.lines` | `recordCounter` | `TUI.#doRender` after final line composition | none | no-op |
| `tui.frame` | `frame.emittedLines` | `recordEvent` | placeholder until a single diff/write-path owner is selected | `placeholder: "true"` | no-op |
| `tui.preparedLine` | `normalize.hit` | `recordEvent` | placeholder from TUI frame hook until P2.2 | `placeholder: "true"` | no-op |
| `tui.preparedLine` | `normalize.miss` | `recordEvent` | placeholder from TUI frame hook until P2.2 | `placeholder: "true"` | no-op |
| `tui.preparedLine` | `truncate.hit` | `recordEvent` | placeholder from TUI frame hook until P2.2 | `placeholder: "true"` | no-op |
| `tui.preparedLine` | `truncate.miss` | `recordEvent` | placeholder from TUI frame hook until P2.2 | `placeholder: "true"` | no-op |
| `tui.text` | `wrap.calls` | `recordEvent` | JSONL placeholder from TUI frame hook; existing helper owner remains unchanged | `placeholder: "true"` | no-op |
| `tui.text` | `visibleWidth.calls` | `recordEvent` | JSONL placeholder from TUI frame hook; existing `utils.ts` `recordHelper("text.visibleWidth")` remains unchanged | `placeholder: "true"` | no-op |
| `assistant.message` | `content.rebuild` | `recordCounter` | `AssistantMessageComponent.updateContent()` entry | none | no-op |
| `assistant.message` | `content.blocks` | `recordCounter` | same, count of current content blocks | none | no-op |
| `transcript.overlay` | `entries.rendered` | `recordCounter` | `FullTranscriptOverlayComponent.#transcriptLines()` cache-miss materialization path | `renderPhase: initial|unknown` | no-op |
| `transcript.overlay` | `lines.materialized` | `recordCounter` | same, line count produced | `renderPhase: initial|unknown` | no-op |
| `transcript.overlay` | `navigation.input` | `recordCounter` | `FullTranscriptOverlayComponent.handleInput()` accepted navigation branch | `renderPhase: navigation` | no-op |
| `session.open` | `headerProbe.file.load` | `recordCounter` | `SessionManager.open()` first `loadEntriesFromFile(filePath, storage)` header/cwd probe | none | no-op |
| `session.open` | `headerProbe.entries.loaded` | `recordCounter` | same, loaded entry count | none | no-op |
| `session.open` | `hydrate.file.load` | `recordCounter` | `setSessionFile()` / `#initSessionFile()` load path before P3.1 | none | no-op |
| `session.open` | `hydrate.entries.loaded` | `recordCounter` | same, loaded entry count | none | no-op |
| `session.context` | `entries.materialized` | `recordCounter` | `SessionManager.buildSessionContext()` around the current `getEntries()` materialization | none | no-op |
| `sdk.session` | `context.build` | `recordCounter` | `createAgentSession()` `logger.time("loadSessionContext", ...)` span | none | no-op |
| `sdk.session` | `branch.scan` | `recordCounter` | `createAgentSession()` `logger.time("getSessionBranch", ...)` span | none | no-op |
| `sdk.session` | `workspaceTree.start` | `recordCounter` | `createAgentSession()` workspace tree discovery kickoff span | none | no-op |
| `sdk.session` | `ttsr.discover` | `recordCounter` | `createAgentSession()` `logger.time("discoverTtsrRules", ...)` span | none | no-op |
| `perf.write` | `error` | `recordCounter` | JSONL flush write-error catch path | none | no-op |

Cross-package boundary:

- Coding-agent hooks may import `renderMetrics` / helpers from `@gajae-code/tui/metrics` as the process-wide perf sink. This is acceptable in this repo because `session-manager.ts` already imports `@gajae-code/tui` for terminal identity.
- Every hook must check the enabled sink through the metrics API and must not change control flow, data structures, persistence format, or render output.

### MODIFY `packages/tui/src/metrics.ts`

Before:

- `RenderMetrics` defaults to `$flag("PI_TUI_METRICS")`.
- Metrics are in-memory only via `RenderMetricsSnapshot`.
- Existing counters cover render duration, request source, full redraw/storms, RSS samples, owner/timer gauges, and helper stats.
- No stable JSONL event schema exists.

After:

- Add a documented enable resolver:
  - `export function isPerfMetricsEnabled(env = process.env): boolean`
  - returns true for `JWC_PERF=1` and treats `PI_TUI_METRICS=1` as a compatibility alias.
  - `RenderMetrics` constructor default changes from `$flag("PI_TUI_METRICS")` to `isPerfMetricsEnabled()`.
- Add stable JSONL event types:
  - `export const PERF_EVENT_SCHEMA = "jwc.perf-events/1" as const`
  - `export interface PerfCounterEvent { schema: typeof PERF_EVENT_SCHEMA; ts: string; source: string; counters: Record<string, number>; labels?: Record<string, string>; }`
- Add bounded counter/event collection methods to `RenderMetrics`:
  - `recordCounter(source: string, name: string, value?: number, labels?: Record<string, string>): void`
  - `recordEvent(source: string, counters: Record<string, number>, labels?: Record<string, string>): void`
  - disabled calls return before event object allocation.
  - event retention is capped at `MAX_PERF_EVENTS = 2048`; overflow increments `eventsDropped`.
- Extend `RenderMetricsSnapshot` with a chosen bounded shape:
  - `counters: Record<string, number>` using source-qualified keys such as `tui.frame.frame.count`.
  - `eventsBuffered: number`
  - `eventsDropped: number`
- Add JSONL serialization/persistence helpers:
  - `serializePerfEvent(event: PerfCounterEvent): string`
  - `resolvePerfLogPath(env?: NodeJS.ProcessEnv): string`
  - `flushPerfEvents(metrics?: RenderMetrics, path?: string): Promise<void>`
  - `flushPerfEventsSync(metrics?: RenderMetrics, path?: string): void`
  - helper writes UTF-8 compact JSONL with a trailing newline using Bun APIs, creates parent directories, never logs to stdout/stderr, and records a bounded write-error counter instead of throwing in interactive use.
- Keep disabled paths as a cheap boolean check; disabled recording must not allocate event objects.
- Do not print metrics to stdout/stderr.

### MODIFY `packages/tui/src/tui.ts`

Before:

- `renderMetrics` records request source, render duration, full redraw reasons, helper timings, and RSS in existing paths.
- No P2.0-specific event rows are emitted for frame line count or future prepared-line counters.

After:

- Record coarse TUI frame counters through the new metrics API while preserving existing behavior:
  - `tui.frame.frame.count`
  - `tui.frame.frame.lines`
  - zero-valued placeholder events for `tui.frame.frame.emittedLines`, `tui.preparedLine.normalize.hit`, `normalize.miss`, `truncate.hit`, `truncate.miss`, `tui.text.wrap.calls`, and `tui.text.visibleWidth.calls` with `placeholder: "true"` labels until later slices supply real accounting.
- Leave `packages/tui/src/utils.ts` helper timing ownership unchanged; `visibleWidth()` may continue using `recordHelper("text.visibleWidth", ...)`.
- Flush pending perf events from `TUI.stop()` when metrics are enabled. Tests must set `JWC_PERF_LOG` to a temp path or pass an explicit temp path.
- `TUI.stop()` must call the synchronous flush helper, not a fire-and-forget async flush.
- Do not alter render scheduling, P1.5.1 expedited input render behavior, terminal clear/reset behavior, viewport fill, or scroll model.

### MODIFY `packages/coding-agent/src/modes/components/assistant-message.ts`

Before:

- `updateContent()` rebuilds children; P2.1 will optimize this later.
- No measurement counter identifies rebuild frequency.

After:

- Add measurement-only counters at `AssistantMessageComponent.updateContent()` entry:
  - `assistant.message.content.rebuild`
  - `assistant.message.content.blocks`
- No behavior change to rendering, child lifecycle, spacer/header logic, or usage row behavior in this slice.
- API: use `recordCounter` for both counters.

### MODIFY `packages/coding-agent/src/modes/components/full-transcript-overlay.ts`

Before:

- Overlay line cache eagerly renders transcript items; P2.3 will optimize later.
- No counter records rendered entries/lines.

After:

- Add measurement-only counters in the current transcript overlay paths:
  - `transcript.overlay.entries.rendered` and `transcript.overlay.lines.materialized` in the `#transcriptLines()` cache-miss materialization path.
  - `labels.renderPhase` for materialization rows is `initial` when the first bottom-open render materializes lines, otherwise `unknown` if the current call path cannot cheaply distinguish.
  - `transcript.overlay.navigation.input` in `handleInput()` only after an accepted navigation key changes/request-renders the overlay; this row uses `labels.renderPhase = "navigation"`.
- No lazy rendering in this slice.
- API: use `recordCounter` for materialization and navigation rows.

### MODIFY `packages/coding-agent/src/session/session-manager.ts`

Before:

- P3 plan says `SessionManager.open()` double-load and context materialization need proof.
- Existing code has no P2.0 counter for session load/materialize count.

After:

- Add measurement-only counters at exact existing session hook sites:
  - `session.open.headerProbe.file.load` and `session.open.headerProbe.entries.loaded` at `SessionManager.open()`'s first header/cwd probe load.
  - `session.open.hydrate.file.load` and `session.open.hydrate.entries.loaded` at the current `setSessionFile()` / `#initSessionFile()` load path.
  - `session.context.entries.materialized` exactly in `SessionManager.buildSessionContext()` around the current `getEntries()` call.
- Instrument existing functions only; do not add preload paths, single-load logic, or path-only context behavior in this slice.
- API: use `recordCounter` for all session rows.
- No single-load or path-only context implementation in this slice.

### MODIFY `packages/coding-agent/src/sdk.ts`

Before:

- Resume startup builds context and calls branch/startup flag paths; P3 will optimize later.
- No P2.0 counter records context build/startup flag phase.

After:

- Add measurement-only counters around existing `createAgentSession()` startup spans:
  - `sdk.session.context.build` around the existing `logger.time("loadSessionContext", ...)` span.
  - `sdk.session.branch.scan` around the existing `logger.time("getSessionBranch", ...)` span.
  - `sdk.session.workspaceTree.start` at the same kickoff site that creates `logger.time("buildWorkspaceTree", ...)`.
  - `sdk.session.ttsr.discover` around the existing `logger.time("discoverTtsrRules", ...)` span.
- Do not change resume startup control flow, branch selection, context construction, or startup flag semantics in this slice.
- API: use `recordCounter` for all SDK rows.

### MODIFY `packages/tui/test/metrics.test.ts`

Add tests for:

- `isPerfMetricsEnabled()` returns false with no env flags.
- `JWC_PERF=1` enables the resolver.
- `PI_TUI_METRICS=1` remains a compatibility alias if retained.
- `RenderMetrics()` default uses the shared resolver, while explicit `new RenderMetrics(false)` remains disabled.
- `recordCounter()` / `recordEvent()` are no-ops when disabled.
- Enabled mode produces `jwc.perf-events/1` event rows with `{ schema, ts, source, counters }`.
- JSONL serialization round-trips one event per line.

### NEW `packages/tui/test/perf-events-p2_0.test.ts`

Add a TUI JSONL integration fixture:

- Enable the process-wide `renderMetrics` sink through env-before-import setup or the existing replay-harness-style `renderMetrics.enable()` / `renderMetrics.reset()` pattern; do not rely solely on a detached `new RenderMetrics(true)` with manual counters.
- Drive at least one real TUI render path using a minimal TUI fixture or the existing replay harness so the `packages/tui/src/tui.ts` hooks record into the process-wide sink.
- Ensure the render path records canonical `tui.frame.*`, `tui.preparedLine.*`, `tui.text.wrap.calls`, and `tui.text.visibleWidth.calls` counters; placeholder counters must include `labels.placeholder === "true"`.
- Call `flushPerfEvents()` to a temporary JSONL file.
- Read the JSONL file and parse every line.
- Assert every row has `schema: "jwc.perf-events/1"`, an ISO-8601 UTC `ts`, a `source`, and compact `counters`.
- Assert placeholder rows include `labels.placeholder === "true"` for `tui.frame.frame.emittedLines`, all `tui.preparedLine.*`, and both `tui.text.*` placeholder rows.
- Assert `TUI.stop()` writes the buffered rows to the temp `JWC_PERF_LOG` path without a manual flush call.
- Assert unset/disabled mode uses a pre-created isolated temp `JWC_PERF_LOG` file and appends zero bytes / zero new lines.

### NEW `packages/coding-agent/test/perf-events-p2_0.test.ts`

Add integration tests for the hooked coding-agent paths without relying on full interactive sessions:

- Enabled process-wide sink records canonical source/counter keys and `flushPerfEvents()` writes them to a temporary JSONL file.
- Test setup must use env-before-import or explicit `renderMetrics.enable()` / `renderMetrics.reset()` on the process-wide singleton.
- Tests parse flushed JSONL rows and assert `schema: "jwc.perf-events/1"` plus canonical counter keys, not only in-memory snapshots.
- Assistant `updateContent()` fixture records and flushes `assistant.message.content.rebuild` and `assistant.message.content.blocks`.
- Full transcript overlay fixture records and flushes `transcript.overlay.entries.rendered`, `transcript.overlay.lines.materialized`, `transcript.overlay.navigation.input`, and `labels.renderPhase`; cache-miss materialization rows may use `initial` or `unknown`, but navigation rows must use `navigation`.
- Session fixture records and flushes `session.open.headerProbe.file.load`, `session.open.headerProbe.entries.loaded`, `session.open.hydrate.file.load`, `session.open.hydrate.entries.loaded`, and `session.context.entries.materialized` without changing open/context semantics; `session.context.entries.materialized` must be non-zero under the fixture.
- SDK fixture records and flushes `sdk.session.context.build`, `sdk.session.branch.scan`, `sdk.session.workspaceTree.start`, and `sdk.session.ttsr.discover` from the real `createAgentSession()` startup path. No helper-only substitute is allowed without revising this plan.

### MODIFY `packages/tui/test/metrics-redteam.test.ts`

Add tests for:

- Event/counter cardinality is bounded under high-volume dynamic source/counter/label names.
- Disabled high-volume event recording leaves snapshot counters/events zeroed.
- JSONL serialization and flush do not write to stdout/stderr; use spies around `process.stdout.write` / `process.stderr.write` or equivalent.
- Flush writes UTF-8 compact JSONL with one object per line and a trailing newline.
- Flush write errors do not throw in interactive mode and increment a bounded write-error counter.
- `flushPerfEventsSync()` follows the same JSONL/no-stdout/error policy and is covered by the write-error test.
- No per-frame memory probe is introduced by event recording; RSS sampling remains explicit via `sampleRss()`.

### OPTIONAL MODIFY `devlog/_plan/260614_performance/69_p2_p3_measured_execution_plan.md`

Only if implementation discovers a better exact API name or test filename. Keep this as a plan correction, not product behavior.

## Non-goals

- Do not implement P2.2 prepared-line cache in this cycle.
- Do not implement P2.1 assistant child reuse in this cycle.
- Do not implement P2.3 lazy transcript rendering in this cycle.
- Do not implement P3 session open single-load or path-only context in this cycle.
- Do not change TUI welcome visuals, scroll/fill/gap behavior, terminal clear policy, or committed-history behavior.
- Do not add interactive logging.

## Verification

Focused gates for B/C:

```bash
bun test packages/tui/test/metrics.test.ts packages/tui/test/metrics-redteam.test.ts
bun test packages/tui/test/perf-events-p2_0.test.ts
bun test packages/coding-agent/test/perf-events-p2_0.test.ts
bun test packages/tui/test/input-render-latency.test.ts packages/tui/test/input-render-redteam.test.ts
bun --cwd=packages/tui run check
bun --cwd=packages/coding-agent run check
```

Done checklist:

- `JWC_PERF` unset: no JSONL writes, no stdout/stderr noise, disabled calls leave counters/events zeroed.
- `JWC_PERF=1`: `jwc.perf-events/1` JSONL rows are produced with ISO-8601 UTC timestamps and canonical registry keys.
- Each non-placeholder registry counter is non-zero under at least one focused fixture.
- Placeholder counters for `tui.frame.frame.emittedLines`, `tui.preparedLine.*`, and `tui.text.*` are present with `placeholder: "true"` until later slices replace them with real accounting.
- Event/counter cardinality stays bounded and overflow is visible in snapshot summary.
- `perf.write.error` is recorded in snapshot/counters when the flush helper hits a write error.
- `TUI.stop()` writes buffered perf events through the synchronous flush path when enabled.
- Disabled-mode tests use an isolated pre-created temp log and assert zero appended bytes / zero new lines.
- Flushed transcript navigation rows include `labels.renderPhase === "navigation"`.
- Runtime behavior remains unchanged in input render latency/redteam tests.

## Risk and rollback

- Risk: importing/using TUI metrics from coding-agent hot paths could add unwanted allocation. Mitigation: all recording methods must return immediately when disabled and avoid event object construction.
- Risk: dual flags (`JWC_PERF` and `PI_TUI_METRICS`) drift. Mitigation: one resolver function with explicit compatibility test.
- Risk: JSONL writer accidentally emits interactive noise. Mitigation: no console calls; tests spy on stdout/stderr or writer helper output path.
- Rollback: revert metric API additions and measurement hooks; no persisted session format or runtime behavior should depend on them.
