# 001 — Heuristic compaction progress plan

> **Status**: draft plan — implementation not started  
> **Date**: 2026-06-14  
> **Scope**: manual `/compact`, automatic context-full maintenance, event/wire compatibility, focused tests.

## Objective

Implement a visible progress surface for compaction that reflects real pipeline phase boundaries while honestly treating LLM and remote compaction calls as indeterminate one-shot work.

Current behavior:

- Manual `/compact` shows a static `Loader` label: `Compacting context... (esc to cancel)`.
- Auto maintenance shows a static `Loader` label such as `Auto context-full maintenance… (esc to cancel)`.
- Backend compaction is real: it prepares a cut point, runs hooks/context collection, calls local/remote summarization, appends a compaction entry, and replaces live agent messages.
- There is no progress event or progress callback today.

Target behavior:

- In-flight manual and auto compaction update the existing loader line with a visible percent + filling text bar.
- Phase names remain internal/event metadata; user-facing copy shows percent, bar, and a short human message.
- Completed compaction still rebuilds chat and renders the existing collapsed/expandable compaction summary.
- Wire/RPC subscribers can observe the new progress event; ACP and extension hooks do not receive high-frequency progress by default.

## Current-state facts

### Backend

- `packages/coding-agent/src/session/agent-session.ts`
  - `AgentSessionEvent` contains `auto_compaction_start` and `auto_compaction_end`, but no progress event.
  - `compact()` handles manual compaction: aborts active work, prepares compaction, runs `session_before_compact`, calls compaction, appends the entry, rebuilds model context, emits `session_compact`.
  - `#runAutoCompaction()` emits auto start/end, then runs handoff or context-full compaction.
- `packages/agent/src/compaction/compaction.ts`
  - `SummaryOptions` has telemetry/auth/model options but no `onProgress`.
  - `compact()` may try OpenAI remote compaction, then summary generation, short summary generation, file-operation tag merge, and return `CompactionResult`.
  - `generateSummary`, `generateShortSummary`, `generateTurnPrefixSummary`, and remote compaction requests are one-shot awaits.

### UI

- `packages/coding-agent/src/modes/controllers/command-controller.ts`
  - Manual `/compact` owns a local `Loader` and escape handler.
- `packages/coding-agent/src/modes/controllers/event-controller.ts`
  - Auto maintenance owns `ctx.autoCompactionLoader` and escape handler.
  - Existing retry loader proves `Loader.setMessage(...)` is an accepted dynamic-status pattern.
- `packages/tui/src/components/loader.ts`
  - Supports message updates with `setMessage(message)`.
  - No native progress-bar API; first implementation should render the bar as sanitized text inside the loader message.
- `packages/coding-agent/src/modes/components/compaction-summary-message.ts`
  - Completed compaction already has collapsed and expanded render states with `ctrl+o to expand` copy.

### Wire/compatibility

- `packages/coding-agent/src/modes/shared/agent-wire/event-contract.ts`
  - Event type registry is exhaustive.
- `packages/coding-agent/src/modes/shared/agent-wire/event-envelope.ts`
  - Event type switch is exhaustive.
- `packages/coding-agent/src/modes/shared/agent-wire/event-observation.ts`
  - Owner-observation switch is exhaustive.
- `packages/coding-agent/src/modes/acp/acp-event-mapper.ts`
  - Many internal session events intentionally map to no ACP notification.
- `packages/coding-agent/src/extensibility/shared-events.ts` and `sdk.ts`
  - Extension hook/event surfaces already expose auto compaction bookends. Do not add progress there unless a later product decision wants extension-visible ticks.

## Proposed API

### Agent-core compaction progress type

Add a small exported type near compaction types, or in a dedicated `progress.ts` exported by the compaction barrel:

```ts
export type CompactionProgressPhase =
	| "preparing"
	| "awaiting_hooks"
	| "customizing_prompt"
	| "remote_summarization"
	| "summarizing_history"
	| "summarizing_turn_prefix"
	| "summarizing_short"
	| "finalizing"
	| "persisting"
	| "completed"
	| "cancelled"
	| "failed";

export type CompactionProgressTrigger = "manual" | "auto_threshold" | "auto_overflow" | "auto_idle"; // coding-agent/session only
export type CompactionProgressSegment =
	| "setup_prepare"
	| "setup_hooks"
	| "remote_await"
	| "local_summary"
	| "parallel_local_summaries"
	| "short_summary"
	| "finalize"
	| "persist"
	| "terminal";

export interface CompactionProgressBoundaryUpdate {
	phase: CompactionProgressPhase;
	/** Backend/session boundary percent. UI smoothing derives display percent separately. */
	percent: number;
	/** Active smoothing segment for the interactive presenter. */
	segment: CompactionProgressSegment;
	message: string;
	indeterminate?: boolean;
	backend?: "local_llm" | "openai_remote" | "generic_remote";
	skippedPhases?: CompactionProgressPhase[];
}

export interface CompactionProgressUpdate extends CompactionProgressBoundaryUpdate {
	trigger: CompactionProgressTrigger;
	mode: "context-full" | "hook-provided" | "handoff";
}

export type CompactionProgressBoundaryCallback = (update: CompactionProgressBoundaryUpdate) => void | Promise<void>;
export type CompactionProgressCallback = (update: CompactionProgressUpdate) => void | Promise<void>;
```

Extend:

```ts
export interface SummaryOptions {
	// existing fields...
	onProgress?: CompactionProgressBoundaryCallback;
}
```

Extend coding-agent compact options:

```ts
export interface CompactOptions {
	onComplete?: (result: CompactionResult) => void;
	onError?: (error: Error) => void;
	onProgress?: CompactionProgressCallback;
}
```

### AgentSessionEvent

Add:

```ts
| {
		type: "compaction_progress";
		update: CompactionProgressUpdate;
	}
```

Keep this event out of extension/hook public registration in the first slice.

## User-facing display contract

The visible UI is a percent loader, not a phase list. The internal event may carry `phase`, but the formatter should hide raw phase names unless they are needed for debugging.

Recommended one-line shape:

```text
Compacting context  ███████████░░░░░░░░ 55%  Summarizing conversation… (esc to cancel)
```

Rules:

- Use a fixed-width text bar so `Loader.setMessage(...)` can update in place without a new TUI component.
- Clamp percent to `[0, 100]` and round to an integer for display.
- Keep the copy honest during one-shot awaits: the bar advances only at known boundaries or bounded time-smoothing ranges, not because provider progress is known.
- Keep escape/cancel text visible.
- Later polish may replace the text formatter with a dedicated `ProgressLoader`, but B1–B5 should not require a new TUI primitive.

## Progress ownership

There is one source of backend truth and one source of animated display state:

- **Agent-core/session progress** emits phase-boundary snapshots only. These updates are safe to persist/observe as events because they happen at real code boundaries.
- **Interactive UI progress** owns the local timer that turns a boundary update into a smooth visible percent bar. Timer ticks call only `Loader.setMessage(...)`; they are not re-emitted as `AgentSessionEvent`, wire events, sidecar state, extension events, or transcript rows.
- `CompactionProgressUpdate.percent` is the boundary/floor percent associated with the latest real event. The displayed percent may be higher while the UI presenter is smoothing inside that event's `segment`, but it must never cross the segment hold point.
- `indeterminate: true` means no provider-backed progress exists. The UI may still show estimated time progress, but wire/RPC consumers must not treat the percent as authoritative provider completion.
- Manual `/compact` may receive `CompactOptions.onProgress` directly from `session.compact(...)`; automatic maintenance updates through `compaction_progress` events. Do not drive the same loader from both paths.
- A phase change may keep the same boundary percent while switching segments, e.g. `customizing_prompt` at `15%` to `remote_summarization` at `15%`; the presenter must reset the active segment/timing budget without lowering or advancing the displayed percent solely because the boundary is flat.

## Time-smoothing prediction

The percent bar is a predicted-time UI, not provider telemetry. The implementation should combine real phase-boundary events with a local presenter timer that advances inside each phase's reserved percent band.

Principle:

- When a new phase starts, jump to that phase's boundary/floor percent.
- While a one-shot await is pending, keep moving conservatively inside the active segment with an ease-out curve.
- Reserve the final boundary percent for the real phase-complete event; for example, setup may creep from `5%` to `14%`, then wait at `14%` until the event that unlocks `15%`.
- Never display a boundary percent that implies the next phase has started until the backend actually emits that next phase.
- If the await finishes early, jump forward to the next phase floor.
- If the await runs long, crawl toward the boundary-minus-one hold point, then wait there with spinner/message alive.
- Never show `100%` until compaction succeeded and the loader is about to clear.

Default time budget for normal context-full compaction:

| Segment key | Moving band while pending | Boundary unlock | Predicted duration | Notes |
|---|---:|---:|---:|---|
| `setup_prepare` | 0 → 4 | 5% | 300 ms | Presenter starts here immediately when the loader is created, before the first backend boundary event. |
| `setup_hooks` | 5 → 14 | 15% | 2 s | Starts at `preparing`/`awaiting_hooks`; covers hooks, `session_before_compact`, memory/extension context. |
| `remote_await` | 15 → 29 | 30% | 60 s | Optional OpenAI `/responses/compact` or generic remote call; current code still proceeds to local summary afterward. |
| `local_summary` | 30 → 81 | 82% | 90 s | Main fallback/default LLM summary; usually the longest path. |
| `parallel_local_summaries` | 30 → 81 | 82% | 90 s | Split-turn mode: history and turn-prefix summaries run together; one visible message wins. |
| `short_summary` | 82 → 91 | 92% | 15 s | Small LLM call for title/short display summary. |
| `finalize` | 92 → 94 | 95% | 1 s | Merge tags, shape result. |
| `persist` | 95 → 99 | 100% | 2 s | Append compaction and replace live messages; display unlocks `100%` only at `completed`. |

Path-specific allocation:

- **Local/default path**: `0 → 15` setup, `30 → 82` local summary, `82 → 92` short summary, `92 → 100` finalize/persist.
- **Remote-attempt path in current code**: `0 → 15` setup, `15 → 30` remote await, then still `30 → 82` local or split summary, `82 → 92` short summary, `92 → 100` finalize/persist.
- **Future remote-short-circuit path**: out of scope for v1 unless implementation changes `compact()` to skip `generateSummary(...)` after a usable remote result; do not document `15 → 74 → 90` behavior until that branch exists.
- **Hook-provided result path**: `0 → 15` setup, cancel active interpolation, jump to `92%` finalizing boundary, run `92 → 99`, unlock `100%` only on `completed`; include skipped summarization phases in metadata.
- **Cancelled/failed path**: stop the timer at the current displayed percent, optionally emit one terminal `cancelled`/`failed` update with `segment: "terminal"`, remove the loader, then show the existing cancellation/error status. Do not emit `completed` on abort.

Initial constants can be deliberately boring:

```ts
const COMPACTION_PROGRESS_TIMING = {
	prepareMs: 300,
	hooksMs: 2_000,
	remoteAwaitMs: 60_000,
	localSummaryMs: 90_000,
	splitTurnSummaryMs: 90_000,
	shortSummaryMs: 15_000,
	finalizeMs: 1_000,
	persistMs: 2_000,
} as const;
```

Later calibration can use real elapsed timings from compaction telemetry, but the first implementation should keep these as local UI constants so progress rendering does not become part of backend correctness.

Recommended interpolation:

```ts
function predictedPercent(start: number, hold: number, elapsedMs: number, predictedMs: number): number {
	const ratio = Math.min(1, elapsedMs / predictedMs);
	const eased = 1 - Math.pow(1 - ratio, 2);
	return Math.min(hold, start + (hold - start) * eased);
}
```

This keeps the bar alive without lying about the next boundary: long awaits visibly crawl, then hold at `boundary - 1` until the backend confirms completion.

## Boundary event table

`percent` below is the backend/session boundary snapshot. It is not the UI presenter's smoothed display percent.

| Phase | Segment | Boundary percent | Message | Indeterminate | Emit point |
|---|---|---:|---|---|---|
| `preparing` | `setup_prepare` | 0 | Preparing compaction… | false | before `prepareCompaction` starts |
| `awaiting_hooks` | `setup_hooks` | 5 | Running compaction hooks… | false | after `prepareCompaction`, before `session_before_compact` and hook memory/context collection |
| `customizing_prompt` | `setup_hooks` | 15 | Applying compaction context… | false | after hook/memory context collection |
| `remote_summarization` | `remote_await` | 15 | Remote summarization… | true | before OpenAI or generic remote compaction attempt |
| `summarizing_history` | `local_summary` | 30 | Summarizing conversation… | true | before local history `generateSummary` |
| `summarizing_turn_prefix` | `parallel_local_summaries` | 30 | Summarizing split turn… | true | split-turn only; presenter keeps one visible combined local-summary segment |
| `summarizing_short` | `short_summary` | 82 | Generating short summary… | true | before `generateShortSummary` |
| `finalizing` | `finalize` | 92 | Finalizing summary… | false | after agent-core `compact()` returns or hook result is selected |
| `persisting` | `persist` | 95 | Saving compaction… | false | while appending/rebuilding session context |
| `completed` | `terminal` | 100 | Compaction complete | false | immediately before successful end/return |
| `cancelled` | `terminal` | current | Compaction cancelled | false | required terminal event before existing cancellation status |
| `failed` | `terminal` | current | Compaction failed | false | required terminal event before existing error status |

Rules:

- Backend/session code must not emit timer-driven intermediate percent ticks during one-shot LLM/HTTP awaits; the UI presenter may interpolate locally inside the active segment.
- If remote compaction fails and falls back to local summarization, keep percent monotonic and update only message/backend/segment when moving to `summarizing_history`.
- Current code uses OpenAI remote compaction for preserve data and still generates local summaries; v1 progress must represent that actual path.
- If hooks provide a full compaction result, skip summarization phases and jump to `finalizing` with `mode: "hook-provided"` and `skippedPhases`.
- In split-turn compaction, history and turn-prefix summarization are concurrent; emit boundary snapshots for both if useful for observers, but the presenter must treat both as the same `parallel_local_summaries` segment, keep the first local-summary message until both awaits settle, and ignore same-percent message swaps to avoid flapping.
- Handoff can use the same event later with `mode: "handoff"`, but this plan keeps first implementation focused on context-full compaction.

## Implementation sequence

### B1 — Add backend progress callback types

Files:

- `packages/agent/src/compaction/compaction.ts`
- `packages/agent/src/compaction.ts` or the relevant compaction export barrel
- `packages/coding-agent/src/extensibility/extensions/types.ts`

Steps:

1. Add `CompactionProgressBoundaryUpdate`, `CompactionProgressUpdate`, and related types, including `segment`.
2. Extend agent-core `SummaryOptions` with boundary-only `onProgress`.
3. Extend coding-agent `CompactOptions` with session-level `onProgress`; this is not an extension event registration.
4. Add an agent-core safe helper that clamps percent to `[0, 100]` and catches callback errors so UI progress cannot break compaction; global monotonic and retry max-percent enforcement belongs to the coding-agent session sink, not agent-core.

Acceptance:

- Existing compaction callers compile unchanged when `onProgress` is omitted.
- Callback errors are swallowed/logged and do not abort compaction.

### B2 — Emit progress from agent-core compaction

File:

- `packages/agent/src/compaction/compaction.ts`

Steps:

1. Emit `remote_summarization` before OpenAI remote compaction and before generic `remoteEndpoint` compaction.
2. Emit `summarizing_history` before history `generateSummary`.
3. Emit `summarizing_turn_prefix` before turn-prefix summary when split-turn compaction is active, but let the UI presenter collapse split-turn history/prefix into one `parallel_local_summaries` segment.
4. Emit `summarizing_short` before `generateShortSummary`.
5. Emit boundary snapshots only; no agent-core timer ticks during LLM/HTTP awaits.

Acceptance:

- A focused unit test can assert callback call order for local, remote-attempt-then-local, generic remote, and split-turn shapes.
- Percent order is monotonic per single agent-core compaction attempt; cross-candidate retry monotonicity is enforced in B3 by the session sink.

### B3 — Wire AgentSession progress events

File:

- `packages/coding-agent/src/session/agent-session.ts`

Steps:

1. Add `compaction_progress` to `AgentSessionEvent`.
2. Add an internal `#createCompactionProgressSink(trigger, defaultMode, options)` adapter that clamps/guards percent, swallows callback/listener errors, forwards `CompactOptions.onProgress`, and emits `compaction_progress`; each update carries its own `mode`, so hook-provided updates can override the default context-full mode.
3. Manual `compact()` emits `preparing`, `awaiting_hooks`, `customizing_prompt`, `finalizing`, `persisting`, `completed`, and passes the sink into `#compactWithFallbackModel`.
4. Auto `#runAutoCompaction()` maps reason to trigger (`threshold` → `auto_threshold`, `overflow` → `auto_overflow`, `idle` → `auto_idle`), emits the same context-full phases, and passes the sink into the inline `compact(...)` call.
5. Hook-provided compaction emits setup/customization, skips summarization phases with `mode: "hook-provided"`, then jumps to finalizing/persisting/completed.
6. Model fallback retries in `#compactWithFallbackModel` must not reset the percent; preserve the max boundary percent and update only message/backend when retrying.
7. Cancellation/failure paths emit one frozen terminal update without masking the original error, then use existing status/error UI.
8. Exclude `compaction_progress` from extension runner fan-out and coordinator sidecar state.

Acceptance:

- Manual and auto compaction events include the same update shape and trigger mapping.
- Existing `auto_compaction_start/end` remain unchanged.
- Hook-provided compaction emits no summarization phases.
- Progress callback/listener failures do not abort compaction.

### B4 — Update wire/event exhaustive surfaces

Files:

- `packages/coding-agent/src/modes/shared/agent-wire/event-contract.ts`
- `packages/coding-agent/src/modes/shared/agent-wire/event-envelope.ts`
- `packages/coding-agent/src/modes/shared/agent-wire/event-observation.ts`
- `packages/coding-agent/src/modes/acp/acp-event-mapper.ts`
- `packages/coding-agent/test/agent-wire/fixtures.ts`
- ACP/conformance redteam fixtures as required by compile/test failures.

Steps:

1. Add `compaction_progress` to the wire event registry.
2. Add event-envelope identity mapping.
3. Add bounded owner observation using existing `rpc_compaction` kind or a bounded evidence object, with `coalesceKey: "compaction:progress"` if observation coalescing applies.
4. Add ACP empty mapping; ACP does not surface heuristic progress.
5. Ensure wire/RPC surfaces receive phase-boundary events only, not UI timer ticks.
6. Add `EVENT_FIXTURES`/conformance/redteam fixture updates.

Acceptance:

- Agent-wire conformance tests pass.
- ACP canonical payload tests continue to treat compaction progress as intentionally empty.
- Wire subscribers do not receive 60fps or timer-driven UI percent updates.

### B5 — Reuse existing UI loader for progress

Files:

- `packages/coding-agent/src/modes/controllers/event-controller.ts`
- `packages/coding-agent/src/modes/controllers/command-controller.ts`
- Optional helper: `packages/coding-agent/src/modes/utils/compaction-progress.ts`

Steps:

1. Add a pure `formatCompactionLoaderLine(...)` and a `CompactionProgressPresenter` helper:
   - Manual: `Compacting context  ███████████░░░░░░░░ 55%  Summarizing conversation… (esc to cancel)`
   - Auto threshold: `Running context maintenance  ███████████░░░░░░░░ 55%  Summarizing conversation… (esc to cancel)`
   - Auto overflow: `Recovering from context overflow  ███████████░░░░░░░░ 55%  Summarizing conversation… (esc to cancel)`
   - Auto idle: `Running idle context maintenance  ███████████░░░░░░░░ 55%  Summarizing conversation… (esc to cancel)`
2. Formatter must preserve the cancel hint, shrink the bar on narrow terminals, ellipsize the message before the cancel hint, and sanitize/truncate visible width.
3. Auto path: add `compaction_progress` to the event-controller handler map and implement `#handleCompactionProgress` that updates `ctx.autoCompactionLoader?.setMessage(...)` through `ctx.autoCompactionProgressPresenter`.
4. Manual path: pass `onProgress` into `session.compact(...)` and drive only the local presenter/loader from that callback; manual still emits `compaction_progress` for wire/RPC observers, but the interactive manual loader must not also consume those events.
5. Presenter owns the smoothing interval; stop it in manual `finally`, `#handleAutoCompactionEnd`, cancellation, and failure. Do not call `setMessage` after `loader.stop()`.
6. Keep the existing escape handlers and final cleanup unchanged.
7. Do not add transcript rows for in-flight progress.

Acceptance:

- Manual and auto loaders update in-place with a visible text bar.
- Cancellation still restores the previous escape handler and clears presenter intervals.
- Completed summary still comes from `CompactionSummaryMessageComponent` after `rebuildChatFromMessages()`.
- Narrow-terminal formatting keeps `(esc to cancel)` visible.

## Tests

Focused tests to add/update:

```bash
bun test packages/coding-agent/test/compaction-progress.test.ts
bun test packages/coding-agent/test/modes/controllers/command-controller-compaction.test.ts
bun test packages/coding-agent/test/modes/controllers/event-controller-compaction-progress.test.ts
bun test packages/coding-agent/test/agent-wire-conformance.test.ts \
  packages/coding-agent/test/acp/acp-canonical-payload.redteam.test.ts
```

Existing regression tests to keep green:

```bash
bun test packages/coding-agent/test/compaction.test.ts
bun test packages/agent/test/compaction-telemetry.test.ts packages/agent/test/remote-compaction.test.ts
```

Type/schema gate if public config or generated schemas are touched:

```bash
bun run check:schemas
bun run check:ts
```

## Risks and mitigations

1. **False precision**
   - Mitigation: mark one-shot phases `indeterminate: true`; document percent as estimated time progress; keep backend percent as boundary snapshots only.
2. **Public extension churn**
   - Mitigation: do not add `compaction_progress` to extension/hook APIs in B1–B5.
3. **Wire exhaustiveness failures**
   - Mitigation: update registry, envelope, observation, ACP empty mapping, and fixtures in the same slice.
4. **Wire/event storms**
   - Mitigation: UI timer ticks never become session/wire events; wire receives phase-boundary snapshots only.
5. **Duplicate manual/auto loader logic**
   - Mitigation: extract `formatCompactionLoaderLine(...)` and `CompactionProgressPresenter`; manual and auto share presenter logic but have separate ownership paths.
6. **Progress callback throwing**
   - Mitigation: callback wrapper catches/logs and compaction proceeds.
7. **Split-turn parallel summarization**
   - Mitigation: use one `parallel_local_summaries` presenter segment and avoid message flapping while concurrent awaits settle.
8. **Timer leaks / stale loader writes**
   - Mitigation: presenter interval is stopped in every terminal path and refuses `setMessage` after loader cleanup.
9. **Sidecar state churn**
   - Mitigation: `compaction_progress` is excluded from coordinator sidecar state and transcript persistence.

## Recommended execution shape

- Implement B1–B2 first in `packages/agent` with unit tests.
- Implement B3–B4 next so event propagation compiles and wire tests guide exhaustive updates.
- Implement B5 last, reusing existing `Loader` and `CompactionSummaryMessageComponent`.
- Run focused tests after each slice; run type check after the wire/event slice.
