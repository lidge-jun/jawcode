# 10_p_plan — Background footer/manage UI (P-stage draft)

Date: 2026-06-15
Stage: PABCD P
Source MOC: `devlog/_plan/260615_background_terminal_tui/000_moc_background_terminal_tui.md`

## 1. Requirements locked in I-stage

- First implementation slice uses **Option C**: compact composer-footer right status plus a generalized manage overlay, not an inline Claude-style roster.
- Visible background scope includes all existing background work categories:
  - task subagents (`AsyncJob.type === "task"` and/or `AsyncJob.metadata.subagent`),
  - generic async bash (`AsyncJob.type === "bash"` with no monitor metadata),
  - monitor bash jobs (`AsyncJob.metadata.monitor === true`),
  - cron schedules.
- Keybindings:
  - `ctrl+x`: request foreground shell/subagent backgrounding through a safe foreground-detach handler. In the first slice, if no supported foreground-detach API exists, it must show a transient/no-op notice and must not background the whole interactive app.
  - `alt+x`: expand/manage the compact background footer/overlay.
  - Keep Ctrl+B/CtrlE as editor navigation; do not steal them.
- Footer priority: while background work exists or unacknowledged terminal work exists, the background status wins over the idle hint on the right/narrow side; idle help remains when no background work exists.
- Completion policy: Codex-style structured user-visible TUI/thread/overlay completion, not assistant-text injection. Completed, failed, and cancelled entries remain visible as structured overlay/footer state until acknowledgement or normal async-retention eviction.
- First slice surfaces existing background work and leaves `async.enabled` / auto-background policy opt-in. Real detached terminal/PTY semantics are a later phase.

## 2. Existing repo facts used by this plan

- `packages/coding-agent/src/modes/components/composer-footer.ts` currently renders exactly one line and has one priority stack: `transient > mode > hint`.
- `packages/coding-agent/src/modes/jobs-observer.ts` currently aggregates only monitor bash jobs plus cron jobs.
- `packages/coding-agent/src/modes/components/jobs-overlay-model.ts` currently models only `monitor | cron` refs.
- `packages/coding-agent/src/modes/components/jobs-overlay.ts` can already render list/detail/confirm flows and calls `acknowledgeFailures()` on open.
- `packages/coding-agent/src/config/keybindings.ts` currently binds `app.jobs.open` to `alt+j`; there is no `app.background.*` action.
- `packages/tui/src/keybindings.ts` already uses `ctrl+x` for nothing in repo defaults; `alt+x` is valid under `KeyId` and unused in repo defaults.
- `packages/coding-agent/src/modes/controllers/input-controller.ts` wires app-level key handlers through `editor.setCustomKeyHandler(...)`; this is the right integration point for `alt+x` and `ctrl+x`.
- `packages/coding-agent/src/modes/controllers/input-controller.ts::handleBackgroundCommand()` currently backgrounds the whole interactive app/session UI; `ctrl+x` must not call it directly for foreground-job detach. Add a safe wrapper that no-ops with a transient notice until real foreground shell/subagent detach exists.

## 3. Implementation plan

### Phase 1 — Expand and define background-work snapshot semantics

#### MODIFY `packages/coding-agent/src/modes/jobs-observer.ts`

Before:

```ts
export interface MonitorJobView { ... }
export interface CronJobView { ... }
export interface JobsSnapshot {
  monitors: MonitorJobView[];
  crons: CronJobView[];
  activeMonitorCount: number;
  activeCronCount: number;
  worstState: JobsWorstState;
  failedUnacknowledged: boolean;
}
#listMonitorJobs(): AsyncJob[] {
  return this.#manager.getAllJobs(filter).filter(job => job.type === "bash" && job.metadata?.monitor === true);
}
```

After:

```ts
export type BackgroundWorkKind = "bash" | "monitor" | "subagent" | "cron";
export type BackgroundAttentionState = "none" | "completed" | "attention";

export interface BackgroundAsyncJobView {
  kind: "bash" | "monitor" | "subagent";
  id: string;
  label: string;
  status: AsyncJob["status"];
  startTime: number;
  agent?: string;
  description?: string;
  terminalUnacknowledged: boolean;
}

export interface CronJobView { ... }

export interface JobsSnapshot {
  asyncJobs: BackgroundAsyncJobView[];
  crons: CronJobView[];
  activeAsyncCount: number;
  activeCronCount: number;
  unacknowledgedTerminalCount: number;
  totalActiveCount: number;
  footerVisibleCount: number;
  attentionState: BackgroundAttentionState;
  failedUnacknowledged: boolean;
  cancelledUnacknowledged: boolean;
}
```

Specific behavior:

- Replace `#listMonitorJobs()` with `#listAsyncJobs()`:
  - read `manager.getAllJobs(owner filter)`,
  - classify `type === "task" || metadata.subagent` as `kind: "subagent"` before bash/monitor classification,
  - classify remaining `type === "bash" && metadata.monitor === true` as `kind: "monitor"`,
  - classify remaining `type === "bash" && metadata.monitor !== true` as `kind: "bash"`.
- Preserve newest-first sorting by `startTime`.
- Define active async statuses as `running`, `paused`, and `queued`. Cron schedules count as active while they exist. Completed/failed/cancelled async jobs do not count as active after terminal transition.
- If queued subagents are not represented as live `AsyncJob` records, synthesize queued `BackgroundAsyncJobView` rows from the manager's subagent record/queue APIs so queued work is not silently omitted.
- Define `terminalUnacknowledged` for async jobs with `completed`, `failed`, or `cancelled` status that have not been acknowledged through the overlay. These rows remain in `asyncJobs` while the underlying manager still retains the job.
- Define `failedUnacknowledged` for failed terminal rows and `cancelledUnacknowledged` for cancelled terminal rows. `attentionState` is `"attention"` when failed/cancelled unacknowledged rows exist, `"completed"` when only completed unacknowledged rows exist, and `"none"` otherwise.
- Define `totalActiveCount = activeAsyncCount + activeCronCount`.
- Define `unacknowledgedTerminalCount` as the number of completed/failed/cancelled unacknowledged async rows.
- Define `footerVisibleCount = totalActiveCount + unacknowledgedTerminalCount`.
- Keep cron schedule handling unchanged.
- Keep owner scoping unchanged.
- Canonical acknowledgement API: implement `JobsObserver.acknowledgeTerminal()`. Existing `acknowledgeFailures()` may remain only as a compatibility wrapper during the same patch; new code and tests should call `acknowledgeTerminal()`.
- Rename `cancelMonitor(id)` to `cancelAsyncJob(id)` and update all callsites in the same patch.
- `getMonitorOutput(id)` becomes `getAsyncJobOutput(id)` and reads from `AsyncJobManager.readOutputSince(...)` for bash/monitor; subagent rows can initially show result/error text from the job snapshot rather than streaming output.

Compatibility note: if changing public test imports becomes too noisy, keep deprecated method names internally only in this package; do not expose new docs around the old names.

### Phase 2 — Extend overlay model to all background work

#### MODIFY `packages/coding-agent/src/modes/components/jobs-overlay-model.ts`

Before:

```ts
export type JobRefKind = "monitor" | "cron";
export function buildJobsListItems(snapshot: JobsSnapshot): SelectItem[] {
  for (const monitor of snapshot.monitors) { ... }
  for (const cron of snapshot.crons) { ... }
}
```

After:

```ts
export type JobRefKind = "bash" | "monitor" | "subagent" | "cron";

export function buildJobsListItems(snapshot: JobsSnapshot): SelectItem[] {
  for (const job of snapshot.asyncJobs) {
    items.push({
      value: `${job.kind}:${job.id}`,
      label: `${job.kind} · ${preview(job.description ?? job.label, 40)}`,
      description: job.status,
      hint: job.status === "failed" ? "failed" : undefined,
    });
  }
  for (const cron of snapshot.crons) { ... }
}
```

Specific behavior:

- `parseJobRef` accepts `bash`, `monitor`, `subagent`, and `cron`.
- Detail view for async jobs shows:
  - Status,
  - Label/description,
  - Agent kind for subagents when available,
  - Started relative time,
  - Output/result/error preview when available,
  - Cancel action only for `status === "running" || status === "paused" || status === "queued"` where the underlying manager supports cancellation. If the current manager only cancels running `AsyncJob`s, label paused/queued cancel as unavailable or omit it.
- Detail view for cron remains unchanged.
- Empty overlay text changes from `No active monitor or cron jobs` to `No background work`.
- Overlay list membership is active async rows + unacknowledged terminal async rows + cron rows. Acknowledged terminal rows may disappear immediately or when the manager's existing retention eviction removes them; do not invent separate durable history in this slice.

### Phase 3 — Extend overlay controller/callsites

#### MODIFY `packages/coding-agent/src/modes/components/jobs-overlay.ts`

Before:

```ts
export interface JobsOverlayController {
  acknowledgeFailures(): void;
  getSnapshot(): JobsSnapshot;
  getMonitorOutput(id: string): string;
  cancelMonitor(id: string): boolean;
  deleteCron(id: string): boolean;
}
```

After:

```ts
export interface JobsOverlayController {
  acknowledgeTerminal(): void;
  getSnapshot(): JobsSnapshot;
  getAsyncJobOutput(id: string): string;
  cancelAsyncJob(id: string): boolean;
  deleteCron(id: string): boolean;
}
```

Specific behavior:

- For non-cron refs, call `getAsyncJobOutput(ref.id)`.
- Confirm label changes from `cancel this monitor` to `cancel this background job`.
- Opening the overlay calls controller `acknowledgeTerminal()`, which delegates to `JobsObserver.acknowledgeTerminal()`, so completed/failed/cancelled footer latches clear after the user has had a chance to inspect the list.
- Keep cron delete behavior unchanged.

#### MODIFY `packages/coding-agent/src/modes/interactive-mode.ts`

Implementation target:

- Update the `JobsOverlayController` object passed to `JobsOverlayComponent` to use the renamed observer methods.
- When jobs observer changes, update both status line and composer footer background status.
- Do not change `packages/tui/src/tui.ts` or the viewport fill model.
- Update `packages/coding-agent/src/modes/components/status-line.ts` only to consume renamed `JobsSnapshot` fields safely; keep the existing status-line jobs segment as a compact monitor/cron legacy signal and make the composer footer the canonical all-background summary for this slice.

### Phase 4 — Composer footer right-slot background status

#### MODIFY `packages/coding-agent/src/modes/components/composer-footer.ts`

Before:

```ts
#hint: string | undefined;
setHint(text: string | undefined): void { ... }
render(width: number): string[] {
  let line = "";
  if (this.#transient) line = ...;
  else if (this.#mode) line = ...;
  else if (this.#hint) line = ...;
  return [line === "" ? "" : truncateToWidth(` ${line}`, width)];
}
```

After:

```ts
#hint: string | undefined;
#rightStatus: { text: string; color: ComposerFooterColor } | undefined;

setRightStatus(text: string | undefined, opts?: { color?: ComposerFooterColor }): void { ... }

render(width: number): string[] {
  const left = this.#resolveLeftText();
  const right = this.#rightStatus ? sanitizeStatusText(this.#rightStatus.text) : undefined;
  return [renderFooterLine(left, right, width)];
}
```

Specific behavior:

- Preserve the one-row invariant: `render()` still returns exactly one line while enabled.
- Transient/mode/hint continue to define the left slot.
- Right slot displays background status when active or unacknowledged terminal background work exists, e.g.:
  - `3 background jobs running · alt+x manage`,
  - `1 background job completed · alt+x manage`,
  - `2 background jobs need attention · alt+x manage`.
- If width fits both slots, render left and right separated by spaces with right text flush-right.
- If width is narrow and right status exists, right status wins; truncate/omit left hint first.
- Sanitize and truncate both left and right text.
- Color background right status:
  - `warning` for `attentionState === "attention"`,
  - `dim` or accent for normal running/completed state.
- Do not introduce multiline footer behavior.

### Phase 5 — Keybindings and input wiring

#### MODIFY `packages/coding-agent/src/config/keybindings.ts`

Before:

```ts
interface AppKeybindings {
  ...
  "app.jobs.open": true;
  ...
}
...
"app.jobs.open": {
  defaultKeys: "alt+j",
  description: "Open monitor/cron jobs overlay",
},
```

After:

```ts
interface AppKeybindings {
  ...
  "app.background.send": true;
  "app.background.manage": true;
  "app.jobs.open": true;
  ...
}
...
"app.background.send": {
  defaultKeys: "ctrl+x",
  description: "Send foreground job to background",
},
"app.background.manage": {
  defaultKeys: "alt+x",
  description: "Manage background jobs",
},
"app.jobs.open": {
  defaultKeys: "alt+j",
  description: "Open background jobs overlay",
},
```

Specific behavior:

- Keep `app.jobs.open` as a compatibility alias for the same overlay.
- Add migration entries only if old names existed; none are required for new actions.
- Run/display keybinding conflict tests.

#### MODIFY `packages/coding-agent/src/modes/controllers/input-controller.ts`

Before:

```ts
for (const key of this.ctx.keybindings.getKeys("app.jobs.open")) {
  this.ctx.editor.setCustomKeyHandler(key, () => this.ctx.showJobsOverlay());
}
```

After:

```ts
for (const key of this.ctx.keybindings.getKeys("app.background.manage")) {
  this.ctx.editor.setCustomKeyHandler(key, () => this.ctx.showJobsOverlay());
}
for (const key of this.ctx.keybindings.getKeys("app.jobs.open")) {
  this.ctx.editor.setCustomKeyHandler(key, () => this.ctx.showJobsOverlay());
}
for (const key of this.ctx.keybindings.getKeys("app.background.send")) {
  this.ctx.editor.setCustomKeyHandler(key, () => this.handleForegroundBackgroundCommand());
}
```

Specific behavior:

- `alt+x` opens the generalized overlay.
- `alt+j` remains an alias unless it creates conflicts.
- Add `InputController.handleForegroundBackgroundCommand()` for `ctrl+x`.
- In this slice, `handleForegroundBackgroundCommand()` must not call existing `handleBackgroundCommand()` because that method backgrounds the whole interactive app/session UI.
- If a supported foreground shell/subagent detach API is not present, show a footer transient/status warning such as `No foreground job to background` and return without mutating `ctx.isBackgrounded`.
- Later real foreground-detach work can replace the no-op branch behind this method without changing keybindings.

### Phase 6 — Footer status updates in interactive mode

#### MODIFY `packages/coding-agent/src/modes/interactive-mode.ts`

Add a helper near existing jobs/status refresh logic:

```ts
#updateBackgroundFooterStatus(): void {
  const snapshot = this.jobsObserver.getSnapshot();
  const count = snapshot.footerVisibleCount;
  if (count === 0) {
    this.composerFooter.setRightStatus(undefined);
    return;
  }
  const noun = count === 1 ? "background job" : "background jobs";
  const state =
    snapshot.attentionState === "attention"
      ? "need attention"
      : snapshot.attentionState === "completed" && snapshot.totalActiveCount === 0
        ? "completed"
        : "running";
  this.composerFooter.setRightStatus(`${count} ${noun} ${state} · alt+x manage`, {
    color: snapshot.attentionState === "attention" ? "warning" : "dim",
  });
}
```

Specific behavior:

- Call helper at initialization after `JobsObserver` creation.
- Call helper in the jobs observer change callback before/after status line update.
- Call helper after opening overlay/acknowledging terminal rows so completed/failed/cancelled latches can clear.
- Ensure footer row stays constant.
- Add/update `packages/coding-agent/src/modes/components/status-line.ts` tests only where field renames require it; do not make the status line a second all-background summary in this slice.

### Phase 7 — Tests

#### MODIFY `packages/coding-agent/test/jobs-observer.test.ts`

Add cases:

- generic async bash appears as `kind: "bash"`.
- monitor still appears as `kind: "monitor"`.
- subagent task appears as `kind: "subagent"` with agent/description fields.
- active counts include running/paused/queued async jobs + crons, while completed/failed/cancelled count only in `unacknowledgedTerminalCount`.
- completed, failed, and cancelled generic async/subagent jobs set terminal latches until overlay acknowledgement.
- queued subagent/background work appears as active/visible even when represented by subagent queue records rather than live `AsyncJob`s.
- metadata-only subagent classification (`metadata.subagent` on a non-`task` job) maps to `kind: "subagent"`.
- owner scoping still hides other-owner jobs.

#### MODIFY `packages/coding-agent/test/jobs-overlay-model.test.ts`

Add cases:

- list items render `bash`, `monitor`, `subagent`, and `cron` in deterministic order.
- `parseJobRef` accepts all four kinds.
- detail items for subagent include status/agent/description.
- empty state is `No background work`.
- overlay membership includes active rows and unacknowledged terminal rows, not already-acknowledged completed history.

#### MODIFY `packages/coding-agent/test/composer-footer.test.ts`

Add cases:

- left hint + right background status both render when width allows.
- right background status wins/truncates first on narrow width.
- `setRightStatus(undefined)` restores idle-only footer.
- render still returns exactly one line while enabled.
- right status sanitizes ANSI/control text.

#### MODIFY `packages/coding-agent/test/input-controller-keybindings.test.ts`

Add cases:

- `app.background.manage` (`alt+x`) calls `showJobsOverlay()`.
- `app.jobs.open` (`alt+j`) still calls `showJobsOverlay()`.
- `app.background.send` (`ctrl+x`) calls `handleForegroundBackgroundCommand()` and does not call app/session `handleBackgroundCommand()` when no foreground-detach API exists.
- the safe no-op branch emits a user-visible notice such as `No foreground job to background`.

#### MODIFY `packages/coding-agent/test/keybindings-display.test.ts` or `keybindings-migration.test.ts`

Add assertion that new default actions are present and conflict-free:

- `app.background.send` default contains `ctrl+x`.
- `app.background.manage` default contains `alt+x`.
- no default keybinding conflict is introduced with existing Ctrl+B/CtrlE editor navigation.

## 4. Verification commands

Run focused tests first:

```bash
bun test packages/coding-agent/test/jobs-observer.test.ts \
  packages/coding-agent/test/jobs-overlay-model.test.ts \
  packages/coding-agent/test/composer-footer.test.ts \
  packages/coding-agent/test/input-controller-keybindings.test.ts \
  packages/coding-agent/test/keybindings-display.test.ts
```

Then package check if focused tests pass:

```bash
bun --cwd=packages/coding-agent run check
```

Do not run `tsc` or `npx tsc`.

## 5. Non-goals

- Do not implement a real detached PTY/terminal manager in this slice.
- Do not add a below-composer roster or change composer/footer row count.
- Do not modify `packages/tui/src/tui.ts` scroll/fill behavior.
- Do not make background execution enabled by default.
- Do not inject background completion as assistant prose.
- Do not implement successful-completion assistant prose; successful completions are structured TUI/overlay/footer state only.

## 6. Risks and mitigations

- **Footer layout regression**: isolate right-slot rendering in `ComposerFooter`; test one-line invariant and narrow widths.
- **Over-broad job visibility**: preserve `ownerId` filters in `JobsObserver` and add tests.
- **Cancel semantics mismatch**: only expose cancel actions for jobs the manager can cancel; do not pretend queued/paused subagent cancellation exists if not supported by current APIs.
- **Keybinding surprise**: `ctrl+x` must not background the whole app accidentally. Use a new safe foreground-detach handler; if no foreground job detach API exists, show a no-op transient notice and test that `ctx.isBackgrounded` is unchanged.
- **Naming churn**: if renaming `monitor` methods causes large unrelated churn, keep compatibility wrappers and add new generalized names for new code.

## 7. Acceptance criteria

- Footer shows `N background job(s) running · alt+x manage`, `N background job(s) completed · alt+x manage`, or `N background job(s) need attention · alt+x manage` whenever active or unacknowledged terminal background work exists.
- On narrow width, background status remains visible before idle help text.
- `alt+x` opens the generalized background-work overlay; `alt+j` remains a compatibility alias.
- Overlay lists active async bash, monitor jobs, task/metadata subagents, cron schedules, and unacknowledged completed/failed/cancelled terminal rows.
- Completed/failed/cancelled rows remain visible until the user opens/manages the overlay or existing async retention evicts them.
- Queued background work is included in footer/overlay visibility.
- `ctrl+x` is wired to safe foreground-to-background handling without stealing Ctrl+B/CtrlE, breaking editor navigation, or invoking whole-app background mode when no foreground-detach API exists.
- Focused tests above pass.
