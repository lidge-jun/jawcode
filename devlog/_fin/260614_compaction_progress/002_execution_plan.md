# 002 — Compaction progress execution plan

> **Status**: implemented; focused verification green; chase 10.004 `_fin` closeout recorded
> **Date**: 2026-06-14  
> **Goal**: implement heuristic, user-visible compaction progress for manual `/compact` and automatic context-full maintenance without claiming provider-side streaming progress.

## Scope

Implement the hardened design from `000_moc.md` and `001_heuristic_progress_plan.md`:

- Backend/session emit only real phase-boundary `compaction_progress` snapshots.
- Interactive UI owns the predicted-time percent bar and updates the existing `Loader` line through `setMessage(...)`.
- Timer ticks are UI-local only; they are not session events, wire events, sidecar state, extension events, or transcript rows.
- Manual `/compact` and automatic context-full maintenance both show the text bar; completed summaries still use `CompactionSummaryMessageComponent`.
- Wire/ACP exhaustive surfaces remain type-safe, with ACP intentionally mapping progress to no notification.

## Planned file changes

### MODIFY `packages/agent/src/compaction/compaction.ts`

Add exported progress types near compaction types:

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
	percent: number;
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

Extend `SummaryOptions`:

```diff
 export interface SummaryOptions {
 	...
+	onProgress?: CompactionProgressBoundaryCallback;
 }
```

Inside `compact(...)`:

```diff
 const summaryOptions: SummaryOptions = {
 	...
+	onProgress: options?.onProgress,
 };
```

Add safe helper(s):

```ts
function emitCompactionProgress(options: SummaryOptions | undefined, update: CompactionProgressUpdate): void {
	// agent-core emits raw boundary snapshots only;
	// session sink owns trigger/defaultMode merge and global monotonic clamp;
	// call options?.onProgress(update); catch/log sync and async failures.
}
```

Emit boundary snapshots:

- Before OpenAI remote call: `remote_summarization`, `percent: 15`, `segment: "remote_await"`, `backend: "openai_remote"`, `indeterminate: true`.
- Before generic remote endpoint call in `generateSummary`: `remote_summarization`, `percent: 15`, `segment: "remote_await"`, `backend: "generic_remote"`, `indeterminate: true`; before generic remote endpoint call in `generateShortSummary`: `summarizing_short`, `percent: 82`, `segment: "short_summary"`, `backend: "generic_remote"`, `indeterminate: true`.
- Before local history summary: `summarizing_history`, `percent: 30`, `segment: "local_summary"`, `backend: "local_llm"`, `indeterminate: true`.
- Before split-turn prefix summary: `summarizing_turn_prefix`, `percent: 30`, `segment: "parallel_local_summaries"`, `backend: "local_llm"`, `indeterminate: true`.
- Before short summary: `summarizing_short`, `percent: 82`, `segment: "short_summary"`, `indeterminate: true`.
Agent-core does not know `trigger`; it emits partial updates with phase/segment/message/backend, and `AgentSession` merges trigger/mode before emitting session/wire progress.

Do not emit timer ticks from this package.

### MODIFY `packages/agent/src/compaction.ts` or relevant barrel

Export the new progress types if callers import compaction from the barrel:

```diff
 export * from "./compaction/compaction";
```

If the existing barrel already star-exports the module, no change.

### MODIFY `packages/coding-agent/src/extensibility/extensions/types.ts`

Extend `CompactOptions` as a session-level callback, not an extension event:

```diff
 export interface CompactOptions {
 	onComplete?: (result: CompactionResult) => void;
 	onError?: (error: Error) => void;
+	onProgress?: CompactionProgressCallback;
 }
```

Use a top-level type import for `CompactionProgressCallback`; no inline imports. Agent-core imports/exports the boundary callback, while coding-agent session events and `CompactOptions` use the trigger-enriched `CompactionProgressCallback`.

### MODIFY `packages/coding-agent/src/session/agent-session.ts`

Extend `AgentSessionEvent`:

```diff
 	| { type: "auto_compaction_end"; ... }
+	| { type: "compaction_progress"; update: CompactionProgressUpdate }
```

Add session helper:

```ts
#createCompactionProgressSink(
	trigger: CompactionProgressTrigger,
	defaultMode: CompactionProgressUpdate["mode"],
	options?: CompactOptions,
): CompactionProgressCallback {
	// clamp percent; keep max boundary percent; catch callback/listener errors;
	// each update carries mode, defaulting to defaultMode when omitted by local callsites;
	// forward options?.onProgress; emit compaction_progress for wire/RPC; do not fan out to extensions.
	// manual interactive UI consumes options.onProgress directly;
	// event-controller ignores update.trigger === "manual" so the manual loader is not double-driven.
}
```

Manual `compact(...)` path:

- Create sink with `trigger: "manual"`, `defaultMode: "context-full"`; hook-provided updates pass `mode: "hook-provided"` on the update itself.
- Emit session-only phases: `preparing`, `awaiting_hooks`, `customizing_prompt`, `finalizing`, `persisting`, `completed`.
- Pass the sink into `#compactWithFallbackModel(...)` / agent-core `compact(...)` options.
- Inside `#compactWithFallbackModel(...)` retries, preserve the max boundary percent across model candidates; retry progress may update message/backend but must not reset the visible or boundary percent.
- For hook-provided compaction, skip summarization phases and emit `finalizing` with `mode: "hook-provided"` and `skippedPhases`.
- On cancel/failure, emit one frozen `cancelled`/`failed` update and keep existing status/error behavior.
- Terminal updates use the sink's last boundary percent; the UI presenter freezes its current smoothed display percent locally before cleanup.

Auto `#runAutoCompaction()` path:

- Map reason to trigger: `threshold -> auto_threshold`, `overflow -> auto_overflow`, `idle -> auto_idle`.
- Use the same sink for context-full maintenance in threshold/overflow/idle compaction branches.
- Auto handoff is out of scope for v1 progress: it keeps the existing static `Auto-handoff… (esc to cancel)` loader/bookend events and emits no `compaction_progress` until a follow-up explicitly extends `mode: "handoff"`.

Extension/sidecar behavior:

- `compaction_progress` must not be sent to extension hooks in this first slice.
- `packages/coding-agent/src/jwc-runtime/session-state-sidecar.ts` must explicitly map `compaction_progress` to no state transition; add a direct assertion in `packages/coding-agent/test/session-state-sidecar.test.ts`.

### NEW `packages/coding-agent/src/modes/utils/compaction-progress.ts`

Create a pure UI helper module:

```ts
export interface CompactionProgressPresenterOptions {
	setMessage: (message: string) => void;
	getWidth: () => number;
	prefix: string;
	cancelHint: string;
}

export function formatCompactionLoaderLine(...): string;

export class CompactionProgressPresenter {
	update(update: CompactionProgressUpdate): void;
	stop(): void;
}
```

Behavior:

- Defines and uses a shipped `COMPACTION_PROGRESS_TIMING` constant in this module, copied from `001_heuristic_progress_plan.md`; runtime code must not import or depend on devlog content.
- Starts the local presenter immediately in `setup_prepare` (`0 → 4`) when the loader is created, then moves to `setup_hooks` (`5 → 14`) on `preparing` / `awaiting_hooks`.
- Smooths displayed percent with `predictedPercent(start, hold, elapsedMs, predictedMs)`.
- Holds at boundary-minus-one until next real event.
- Never displays `100%` until `completed`.
- Shrinks text bar on narrow terminals.
- Preserves `(esc to cancel)` by ellipsizing status text before the cancel hint.
- Sanitizes/truncates visible width using existing TUI/string utilities.
- Owns and clears its interval; refuses stale writes after `stop()`.

### MODIFY `packages/coding-agent/src/modes/controllers/command-controller.ts`

Manual `/compact` UI:

```diff
 const compactingLoader = new Loader(...);
+const progressPresenter = new CompactionProgressPresenter({ ... });
 ...
-await this.ctx.session.compact(instructions, options);
+await this.ctx.session.compact(instructions, {
+	...options,
+	onProgress: update => progressPresenter.update(update),
+});
 ... finally {
+	progressPresenter.stop();
 	compactingLoader.stop();
 }
```

Keep existing escape handling, `rebuildChatFromMessages()`, status invalidation, and summary rendering unchanged.

### MODIFY `packages/coding-agent/src/modes/controllers/event-controller.ts`

Auto maintenance UI:

- Add `compaction_progress` to the event handler map.
- Add `autoCompactionProgressPresenter` to `packages/coding-agent/src/modes/types.ts` and `packages/coding-agent/src/modes/interactive-mode.ts`, stored alongside `ctx.autoCompactionLoader`.
- On `auto_compaction_start`, create loader and presenter.
- On `compaction_progress`, update `ctx.autoCompactionLoader` through the presenter.
- `#handleCompactionProgress` must ignore `update.trigger === "manual"` and ignore events when no `ctx.autoCompactionProgressPresenter` exists; manual progress events are for wire/RPC observers, not the auto loader.
- Handler ordering: create presenter synchronously on `auto_compaction_start`; apply terminal `compaction_progress` before `auto_compaction_end` teardown; make `auto_compaction_end` idempotent cleanup if no presenter exists.
- On `auto_compaction_end`, stop presenter, stop loader, restore escape handler, and keep existing success/failure behavior.
- On `auto_compaction_end`, `cancelled`, or `failed`, clear `ctx.autoCompactionProgressPresenter` after stopping it.

### MODIFY `packages/coding-agent/src/modes/types.ts` and `packages/coding-agent/src/modes/interactive-mode.ts`

Add typed storage:

```ts
autoCompactionProgressPresenter: CompactionProgressPresenter | undefined;
```


### MODIFY `packages/coding-agent/src/modes/shared/agent-wire/event-contract.ts`

Add registry entry:

```diff
 	auto_compaction_end: true,
+	compaction_progress: true,
 	auto_retry_start: true,
```

### MODIFY `packages/coding-agent/src/modes/shared/agent-wire/event-envelope.ts`

Add `compaction_progress` to the exhaustive `agentSessionEventType(...)` switch.

### MODIFY `packages/coding-agent/src/modes/shared/agent-wire/event-observation.ts`

Add bounded observation for `compaction_progress`:

- `kind`: `rpc_compaction`.
- `signal`: `"streaming"` while phase is non-terminal; `"completed"` for `completed`; `"error"` for `failed`; `null` for `cancelled`.
- `evidence`: bounded fields only (`phase`, `percent`, `segment`, `trigger`, `mode`, `backend`, `indeterminate`).
- `severity`: `"info"` for normal/cancelled/completed, `"warn"` for failed.
- `semantic`: `false`.
- `coalesceKey`: `"compaction:progress"`.

### MODIFY `packages/coding-agent/src/modes/acp/acp-event-mapper.ts`

Map `compaction_progress` to no ACP notification, matching the plan’s non-goal of user-facing ACP progress.

### MODIFY tests/fixtures

Update exact test files discovered by type/test failures, expected likely paths:

- `packages/coding-agent/test/agent-wire/fixtures.ts`
- `packages/coding-agent/test/agent-wire-conformance.test.ts`
- `packages/coding-agent/test/acp/acp-canonical-payload.redteam.test.ts`

Add fixture coverage for the new event and no-op ACP mapping.

### NEW tests

Add focused tests where current test layout supports them:

- Agent-core progress callback order for local, remote-attempt-then-local, generic remote, and split-turn paths.
- Session hook-provided path: no summarization phases, `skippedPhases`, jump to `92%`.
- Presenter formatting: percent smoothing, flat-boundary segment switch (`15%` setup → remote), hold-at-boundary-minus-one, no 100 before completed, narrow terminal cancel-hint preservation, stop clears interval.
- Manual controller: `/compact` passes `onProgress`, emits session progress for wire/RPC, ignores event-controller delivery, and stops presenter in `finally`.
- Auto controller: context-full threshold/overflow/idle updates loader; handoff remains static/out of scope; terminal progress is applied before teardown.

## Acceptance criteria

- Manual `/compact` visibly updates one status loader line with a text progress bar, percent, message, and `(esc to cancel)`.
- Automatic context-full maintenance visibly updates the existing auto loader with the same style.
- Auto handoff remains unchanged/static in v1 and is explicitly not part of the progress-bar acceptance surface.
- The completed compaction transcript remains unchanged except for existing summary rebuild behavior.
- Agent-core/session emit only phase-boundary progress snapshots.
- UI timer ticks are local only and do not create wire/session/sidecar/transcript churn.
- `100%` is displayed only after successful completion.
- Cancellation and failure restore escape handlers, clear timers, and keep existing user-visible status/error behavior.
- ACP receives no progress notification.
- Agent-wire exhaustive registry/envelope/fixtures compile and test green.
- Hook-provided, retry, wire-boundary, and cancel/fail cases have direct focused coverage.
- Manual-trigger progress events are ignored by the auto event-controller path.
- Sidecar mapping explicitly returns no state transition for `compaction_progress`.
- Required terminal `cancelled`/`failed` updates are emitted with the sink's last boundary percent; the presenter freezes the current smoothed display percent locally.
- `compaction_progress` is not fanned out to extension hooks.

## Verification plan

Run focused tests first:

```bash
bun test packages/agent/test/compaction-progress.test.ts
bun test packages/coding-agent/test/compaction-progress.test.ts
bun test packages/coding-agent/test/session-state-sidecar.test.ts
bun test packages/coding-agent/test/modes/utils/compaction-progress.test.ts
bun test packages/coding-agent/test/modes/controllers/command-controller-compaction.test.ts
bun test packages/coding-agent/test/modes/controllers/event-controller-compaction-progress.test.ts
bun test packages/coding-agent/test/agent-wire-conformance.test.ts \
  packages/coding-agent/test/acp/acp-canonical-payload.redteam.test.ts
bun test packages/coding-agent/test/compaction.test.ts
bun test packages/agent/test/compaction-telemetry.test.ts packages/agent/test/remote-compaction.test.ts
```
Focused assertions:
- `packages/agent/test/compaction-progress.test.ts`: agent-core callback order / monotonic percent for local, remote-attempt-then-local, generic remote, and split-turn paths.
- `packages/coding-agent/test/compaction-progress.test.ts`: session hook-provided path emits no summarization phases and includes `skippedPhases`; required terminal updates use the sink's last boundary percent.
- `packages/coding-agent/test/session-state-sidecar.test.ts`: `compaction_progress` maps to no coordinator state transition.
- `packages/coding-agent/test/modes/utils/compaction-progress.test.ts`: presenter holds at boundary-minus-one, never shows 100 before completed, preserves cancel hint on narrow terminals, uses `replaceTabs`, `truncateToWidth`, and `visibleWidth`, and clears intervals on stop.
- `packages/coding-agent/test/modes/controllers/command-controller-compaction.test.ts`: manual `/compact` passes `onProgress`, ignores event-controller delivery, and stops presenter in `finally`.
- `packages/coding-agent/test/modes/controllers/event-controller-compaction-progress.test.ts`: auto path updates only non-manual progress, ignores manual-trigger events, and stops/clears `ctx.autoCompactionProgressPresenter` on terminal events.
- `packages/coding-agent/test/agent-wire-conformance.test.ts` plus `packages/coding-agent/test/acp/acp-canonical-payload.redteam.test.ts`: wire subscribers receive only phase-boundary events and bounded coalesced observations; ACP receives no progress notification.
- `pending-approval.md` is refreshed from this full execution plan after every P/A plan patch so B-stage gates inherit verification commands and risks, not just acceptance bullets.

Run type/schema gates if touched surfaces require them:

```bash
bun run check:schemas
bun run check:ts
```

## Risks and controls

- **False precision**: label as estimated UI progress; keep provider phases `indeterminate`.
- **Event storms**: timer ticks never leave UI presenter.
- **Timer leaks**: presenter has explicit `stop()` and terminal-path tests.
- **Remote path mismatch**: v1 reflects current code where OpenAI remote preserve data does not short-circuit local summary.
- **Extension API churn**: progress is not extension-visible in this slice.
