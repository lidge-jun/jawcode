# 21_cycle1_footer_below_panel — Cycle 1 executable plan (a-r6-fixed)

Parent roadmap: `20_p_plan_revised.md`
A-stage syntheses: `21.7_a_synthesis_round1.md`, `21.10_a_synthesis_round2_cap.md`, `31.2_p_synthesis_post_audit.md`, `31.7_a_synthesis_round1.md`, `31.10_a_synthesis_round2.md`
Goal: real footer-below background visibility panel connected to existing background work state, while preserving existing jobs overlay/status compatibility.

## 1. Product behavior

- Compact footer text replaces the idle footer text while visible background work exists.
  - Normal example: `bg 3sub 1sh 1cron · alt+x`.
  - Latched terminal attention example: `bg 1sh! · alt+x`.
  - If no visible background work exists, keep existing idle hint: `? for shortcuts · /help for commands`.
- Compact grammar is normative:
  - prefix `bg`, then space-separated `<count><kind>` tokens in order `sub sh mon cron q`, then ` · alt+x`.
  - `!` suffix attaches to a kind token when any visible row of that kind is failed/cancelled and latched, e.g. `2sub!`.
  - counts include active rows plus latched failed/cancelled rows; successful completed rows are omitted.
- `alt+x` expands/collapses a footer-below panel mounted after `ComposerFooter` in TUI child order.
- Expanded panel has exactly three visible rows. If more rows exist, selection can move and the panel scrolls within those three rows.
- Rows are selectable. `Enter` opens a read-only detail surface for the selected row.
- While the panel is expanded, `InputController` consumes up/down/Enter through expand-lifetime handlers before editor navigation/history, and consumes Esc through `editor.onInterruptPriority` or an `onEscape` guard because CustomEditor handles Esc before custom key handlers. Focus remains on the editor; the panel is not the focused TUI component.
- Successful completed rows disappear automatically.
- Failed/cancelled rows remain visible after terminal status. They receive a `visibleSinceUserMessageSeq` marker once the footer/panel refresh has made them visible. They clear only when a later real user-agent prompt increments the sequence.
- Slash/local commands, bash/python commands, empty continuation, extension-handled input, and other non-agent submissions must not clear failed/cancelled terminal rows.
- Completion remains structured TUI state only; do not append assistant text.

## 2. File-level plan

### NEW `packages/coding-agent/src/modes/components/background-footer-panel-model.ts`

Purpose: pure, unit-testable view model builder for compact footer text and three-row panel rows.

Content outline:

```ts
import type { SelectItem } from "@gajae-code/tui";
import type { BackgroundRowView, BackgroundWorkKind, JobsSnapshot } from "../jobs-observer";

export interface BackgroundFooterRow {
  id: string;
  kind: BackgroundWorkKind;
  label: string;
  status: BackgroundRowView["status"];
  hint?: string;
  attention: boolean;
}

export interface BackgroundFooterModel {
  compactText: string | undefined;
  rows: BackgroundFooterRow[];
  attention: boolean;
  totalVisible: number;
}

export function buildBackgroundFooterModel(snapshot: JobsSnapshot): BackgroundFooterModel;
export function buildBackgroundDetailItems(snapshot: JobsSnapshot, rowId: string): SelectItem[];
```

Rules:

- `snapshot.backgroundRows` is the single canonical iterator for footer and panel rows.
- `backgroundCounts`, if kept on the snapshot, is observer-derived from `backgroundRows`; `buildBackgroundFooterModel()` computes compact tokens from `backgroundRows` only and must not trust a divergent counts map.
- Build compact text in the model as the canonical string, including ` · alt+x`.
- Count order: `sub`, `sh`, `mon`, `cron`, `q`.
- Omit zero-count kinds.
- Attach `!` to any kind with one or more visible failed/cancelled latched rows.
- When only latched failed/cancelled terminal rows exist and no active jobs remain, keep compact text visible with attention suffix, e.g. `bg 1sh! · alt+x`.
- Row ordering: attention rows first, then running/queued, then paused, then cron/scheduled rows, newest-first within each status group.
- Successful completed rows are not included in `backgroundRows`, so they are not counted.
- Detail items must reuse or extend formatting from `jobs-overlay-model.ts` where practical; do not duplicate divergent preview/relative-time rules.

### NEW `packages/coding-agent/src/modes/components/background-footer-panel.ts`

Purpose: render the footer-below three-row panel and store selection/scroll state. It is not a focus target.

Content outline:

```ts
import { type Component } from "@gajae-code/tui";
import type { BackgroundFooterModel } from "./background-footer-panel-model";

export interface BackgroundFooterPanelCallbacks {
  openDetail(rowId: string): void;
  requestRender(): void;
}

export class BackgroundFooterPanel implements Component {
  setExpanded(expanded: boolean): void;
  isExpanded(): boolean;
  setModel(model: BackgroundFooterModel): void;
  moveSelection(delta: -1 | 1): void;
  openSelected(): void;
  collapse(): void;
  render(width: number): string[];
}
```

Behavior:

- `render()` returns `[]` when collapsed or when no rows exist.
- `render()` returns exactly up to three rows when expanded.
- `moveSelection()` updates selected row and scroll window.
- `openSelected()` calls callback `openDetail(rowId)` for the selected row.
- `collapse()` sets expanded false and requests render.
- No destructive cancel/stop actions in cycle 1.
- Sanitize labels/hints and truncate to width using existing shared utilities.

### NEW `packages/coding-agent/src/modes/components/background-footer-detail.ts`

Purpose: cycle-1 read-only detail surface for `Enter` on a panel row.

Content outline:

```ts
import { Container, SelectList, type SelectItem } from "@gajae-code/tui";

export class BackgroundFooterDetailComponent extends Container {
  constructor(items: SelectItem[], onClose: () => void);
  getFocus(): SelectList;
}
```

Behavior:

- Host follows existing selector-controller/editorContainer overlay pattern used by jobs overlay: replace/show a selector-like component, focus its `SelectList`, close on Esc/back.
- Minimum detail fields: kind, label/description, status, age or next schedule, last output/result/error preview when available.
- Read-only only: no cancel/delete/stop action rows in cycle 1.
- `Enter` on a non-action/detail row is a no-op or closes detail; Esc/back closes detail and restores editor focus.
- Dedicated tests must verify Esc/back closes detail, restores editor focus, and does not clear terminal latches.
- If detail is open, Esc/back is owned by the detail surface first; the background panel interrupt wrapper must no-op/chain so detail closes before panel collapse.
- Build field rows through `buildBackgroundDetailItems()` in `background-footer-panel-model.ts`, reusing `jobs-overlay-model.ts` helpers where practical.

### MODIFY `packages/coding-agent/src/modes/jobs-observer.ts`

Before:

```ts
export interface JobsSnapshot {
  monitors: MonitorJobView[];
  crons: CronJobView[];
  activeMonitorCount: number;
  activeCronCount: number;
  worstState: JobsWorstState;
  failedUnacknowledged: boolean;
}
```

After: preserve legacy fields and add canonical footer/panel fields.

```ts
export type BackgroundWorkKind = "sub" | "sh" | "mon" | "cron" | "q";
export type BackgroundRowStatus = "running" | "queued" | "paused" | "failed" | "cancelled" | "scheduled";
export type BackgroundTerminalState = "none" | "attention";

export interface BackgroundRowView {
  id: string;
  kind: BackgroundWorkKind;
  label: string;
  status: BackgroundRowStatus;
  startTime?: number;
  nextFireAt?: number;
  terminalLatched: boolean;
  visibleSinceUserMessageSeq?: number;
  description?: string;
  outputPreview?: string;
  errorPreview?: string;
  resultPreview?: string;
}

export interface JobsSnapshot {
  // New canonical footer/panel source.
  backgroundRows: BackgroundRowView[];
  backgroundCounts: Record<BackgroundWorkKind, number>;
  /** Derived from backgroundRows; compatibility/cache only, not authoritative. */
  totalVisible: number;
  terminalState: BackgroundTerminalState;
  failedOrCancelledLatched: boolean;

  // Legacy compatibility retained through cycle 1.
  monitors: MonitorJobView[];
  crons: CronJobView[];
  activeMonitorCount: number;
  activeCronCount: number;
  worstState: JobsWorstState;
  failedUnacknowledged: boolean;
}
```

Implementation details:

- Preserve owner scoping.
- `backgroundRows` is canonical for `buildBackgroundFooterModel()` and `BackgroundFooterPanel`; legacy `monitors`/`crons` remain for jobs overlay/status compatibility.
- Include generic async bash as `kind: "sh"`.
- Include monitor jobs as `kind: "mon"`.
- Include task/subagent or `metadata.subagent` jobs as `kind: "sub"`.
- Include queued subagents from `SubagentRecord.status === "queued"` if exposed by `AsyncJobManager` APIs. If no public accessor exists in implementation, add one narrowly in `AsyncJobManager`; do not use `q` as a fake substitute for known subagent kind.
- `q` is only for truly unclassified queued work, not for queued subagents.
- Include cron schedules as `backgroundRows` with `kind: "cron"`, `status: "scheduled"`, and `nextFireAt`; also keep raw `crons` for compatibility.
- Running, queued, and paused rows count under their concrete kind. `backgroundCounts` is derived from `backgroundRows` after retained rows are merged; do not maintain a separate divergent count source.
- Failed/cancelled rows remain emitted with `terminalLatched: true` until cleared and count under their concrete kind with `!` compact suffix.
- Maintain `#retainedTerminalRows` (id-keyed) inside `JobsObserver`. Populate it when a job transitions to failed/cancelled. Merge retained rows into `backgroundRows` on every recompute so failed/cancelled rows survive AsyncJobManager retention eviction until acknowledgement.
- Retained rows store a denormalized `BackgroundRowView` snapshot plus `outputPreview`/`errorPreview`/`resultPreview` at terminal transition so detail remains useful after AsyncJobManager output eviction.
- Successful completed jobs are not emitted as visible rows.
- Add `markTerminalRowsVisible(userMessageSeq: number)`: stamps `visibleSinceUserMessageSeq` on currently latched failed/cancelled rows that do not already have it.
- Add `acknowledgeTerminalAfterUserMessage(userMessageSeq: number)`: clears only latched rows whose `visibleSinceUserMessageSeq` is defined and lower than `userMessageSeq`.
- Legacy `worstState`/`failedUnacknowledged` should derive from monitor/cron compatibility plus new terminal latch as needed so existing status-line/tests do not break.

### MODIFY `packages/coding-agent/src/modes/components/composer-footer.ts`

Before:

```ts
#hint: string | undefined;
setHint(text: string | undefined): void;
render(width: number): string[] { ... }
```

After:

```ts
#hint: string | undefined;
#backgroundText: string | undefined;
setBackgroundText(text: string | undefined): void;
render(width: number): string[] { ... }
```

Behavior:

- Preserve one-line render for the footer itself.
- Priority stack becomes: transient > mode > backgroundText > hint.
- `backgroundText` is already canonical compact text from the model, e.g. `bg 3sub 1sh 1cron · alt+x`.
- Expanded panel is separate and renders below this component; do not make `ComposerFooter` multiline.

### MODIFY `packages/coding-agent/src/config/keybindings.ts`

Add app action:

```ts
"app.background.expand": true;
...
"app.background.expand": {
  defaultKeys: "alt+x",
  description: "Expand background footer panel",
},
```

Keep `app.jobs.open` / `alt+j` unchanged for existing jobs overlay.

### MODIFY `packages/coding-agent/src/modes/types.ts`

Add context fields/methods:

```ts
backgroundFooterPanel: BackgroundFooterPanel;
toggleBackgroundFooterPanel(): void;
openBackgroundFooterDetail(rowId: string): void;
handleBackgroundFooterPanelKey(action: "up" | "down" | "enter" | "escape"): boolean;
isBackgroundFooterDetailOpen(): boolean;
```

Do **not** expose a generic boolean `Component.handleInput()` contract for the panel.

### MODIFY `packages/coding-agent/src/modes/controllers/input-controller.ts`

Keybinding wiring:

```ts
for (const key of this.ctx.keybindings.getKeys("app.background.expand")) {
  this.ctx.editor.setCustomKeyHandler(key, () => this.ctx.toggleBackgroundFooterPanel());
}
```

Expanded-panel key routing:

- `InteractiveMode.toggleBackgroundFooterPanel()` is the single lifecycle owner for panel key handling.
- On expand, `InteractiveMode` calls `InputController.installBackgroundFooterPanelHandlers()`.
- On collapse, `InteractiveMode` calls `InputController.removeBackgroundFooterPanelHandlers()`.
- `InputController` installs up/down/Enter handlers only for the expanded lifetime; those handlers call `ctx.handleBackgroundFooterPanelKey(...)` and prevent editor history/cursor movement or prompt submit.
- Esc is not installed through `setCustomKeyHandler("escape")`. `installBackgroundFooterPanelHandlers()` wraps the current `editor.onInterruptPriority`; `removeBackgroundFooterPanelHandlers()` restores the previous handler.
- Esc wrapper precedence: if background detail is open, return false/chain so detail owns Esc; else if panel expanded, collapse panel and return true; else call the previous interrupt-priority handler so BTW/tool-focus behavior is preserved.
- If tool-focus mode is active, `alt+x` panel expansion is blocked with a transient/status notice; do not install competing up/down/Enter handlers over tool-focus handlers in cycle 1.

Terminal latch clearing:

- Do **not** clear in the early `setupEditorSubmitHandler()` branch after `if (!text) return;`.
- Add a named shared helper in `InteractiveMode`, e.g. `#prepareRealUserAgentPromptSubmission()`, that increments `#userAgentMessageSeq`, calls `jobsObserver.acknowledgeTerminalAfterUserMessage(seq)`, refreshes footer/panel, and returns the seq.
- Call that helper from every real user-agent prompt path: `withLocalSubmission`, follow-up/queued/streaming prompt paths, and compaction-resume/direct `recordLocalSubmission + session.prompt` paths. If the compaction path lives in `packages/coding-agent/src/modes/utils/ui-helpers.ts`, either route it through `withLocalSubmission` or modify `ui-helpers.ts` to call the shared helper through an explicit callback parameter. Do not call the helper from slash/local/bash/python/extension-handled/empty continuation paths.
- Normal idle composer submit through `main.ts` `submitInteractiveInput -> session.prompt` must also invoke this helper before `session.prompt`, either by routing through an `InteractiveMode` callback/method or by adding an explicit pre-prompt callback in the submit path.

### MODIFY `packages/coding-agent/src/modes/interactive-mode.ts`

Mount order:

Before:

```ts
this.ui.addChild(this.composerFooter);
this.ui.setFocus(this.editor);
```

After:

```ts
this.ui.addChild(this.composerFooter);
this.ui.addChild(this.backgroundFooterPanel);
this.ui.setFocus(this.editor);
```

Implementation details:

- Add `#userAgentMessageSeq = 0`.
- Add `#prepareRealUserAgentPromptSubmission()` as the only code path allowed to increment `#userAgentMessageSeq` and call `acknowledgeTerminalAfterUserMessage`.
- `withLocalSubmission` and every direct real-prompt path call `#prepareRealUserAgentPromptSubmission()`; they must not inline sequence increment or observer acknowledgement.
- Direct prompt helpers outside `InteractiveMode` (notably compaction-resume code in `modes/utils/ui-helpers.ts` if still direct) receive/use a callback to this helper or are routed through `withLocalSubmission`.
- Add `#refreshBackgroundFooterModel()`:
  1. call `jobsObserver.markTerminalRowsVisible(this.#userAgentMessageSeq)`,
  2. get updated snapshot,
  3. build model via `buildBackgroundFooterModel(snapshot)`,
  4. call `composerFooter.setBackgroundText(model.compactText)`,
  5. call `backgroundFooterPanel.setModel(model)`,
  6. call `statusLine.setJobs(snapshot)` for legacy fields,
  7. request render.
- Call `#refreshBackgroundFooterModel()` at initialization after `JobsObserver` creation and on observer changes.
- Instantiate `BackgroundFooterPanel` with callbacks:
  - `openDetail(rowId)` opens `BackgroundFooterDetailComponent` through the selector/editorContainer overlay pattern.
  - `requestRender()` calls `ui.requestRender()`.
- `toggleBackgroundFooterPanel()` owns install/remove lifecycle: it calls `InputController.installBackgroundFooterPanelHandlers()` on expand and `InputController.removeBackgroundFooterPanelHandlers()` on collapse, then requests render.
- `handleBackgroundFooterPanelKey(action)` delegates to panel methods and returns true only when expanded and consumed. Esc reaches this method through interrupt-priority/onEscape, not through a static custom key handler.
- `InteractiveMode.toggleBackgroundFooterPanel()` is the only place that installs/removes panel handlers; `InputController` only exposes helper methods.
- Add explicit detail-open state (`isBackgroundFooterDetailOpen()` or equivalent private state exposed through context) so interrupt-priority can detect detail precedence.
- `openBackgroundFooterDetail(rowId)` opens a read-only detail surface with minimum fields from `buildBackgroundDetailItems()`.
- Update comments near lines 573-579 that currently claim composer footer is always the frame's last line. New invariant: composer footer may be followed by the background footer panel, which is zero rows when collapsed and up to three rows when expanded.

### MODIFY `packages/coding-agent/src/modes/utils/ui-helpers.ts`

- For compaction-resume or direct first-prompt paths that currently call `recordLocalSubmission + session.prompt` outside `InteractiveMode.withLocalSubmission`, accept/use an explicit callback to `#prepareRealUserAgentPromptSubmission()` or route the path through `withLocalSubmission`.
- Do not duplicate sequence logic in this utility; `InteractiveMode` remains the owner of `#userAgentMessageSeq`.

### MODIFY `packages/coding-agent/src/main.ts`

- Ensure the normal idle composer submit path (`submitInteractiveInput -> session.prompt`) invokes the same real-user-agent prompt preparation helper before `session.prompt`.
- Do not duplicate sequence/acknowledgement logic in `main.ts`; route through an `InteractiveMode` method/callback.

### MODIFY `packages/coding-agent/src/modes/components/status-line.ts`

Cycle-1 ownership rule:

- Composer footer/panel owns all-background compact counts.
- Status line remains legacy monitor/cron/status signal only.
- Suppress/remove the existing non-monitor async `N jobs running` status-line block whenever `composerFooter` background text is set / `backgroundRows` has visible `sh` or `sub` rows. Do not display duplicate generic async/subagent counts in the status line.
- Update field access to work with legacy-compatible `JobsSnapshot` after observer changes.

### MODIFY `packages/coding-agent/src/modes/components/status-line/segments.ts`

- Preserve existing jobs segment behavior using legacy compatibility fields (`activeMonitorCount`, `activeCronCount`, `worstState`, `failedUnacknowledged`).
- Do not render the new `backgroundRows` counts here in cycle 1.
- Repeat the same suppression rule in segment-layer code if it owns or formats the relevant block; do not leave generic async `N jobs running` visible beside footer `bg ...sh/sub`.

### MODIFY `packages/coding-agent/src/modes/components/jobs-overlay-model.ts`

- Keep existing `/jobs` overlay behavior working with legacy `monitors`/`crons` fields.
- Reuse/extend its preview/relative-time helpers from `background-footer-panel-model.ts` rather than duplicating formatting rules.
- Do not migrate `/jobs` overlay to all background kinds in cycle 1; footer row `Enter` detail is the cycle-1 all-background detail path.

## 3. Tests

### ADD `packages/coding-agent/test/background-footer-panel-model.test.ts`

Cases:

- `buildBackgroundFooterModel()` produces `bg 3sub 1sh 1cron · alt+x` in fixed kind order.
- zero rows return `compactText: undefined` and empty rows.
- latched-only failed/cancelled rows produce compact text such as `bg 1sh! · alt+x`.
- failed/cancelled rows sort before running/queued rows and set `attention: true`.
- paused rows count under their concrete kind and sort after running/queued before cron.
- successful completed rows are omitted.
- cron rows are included and counted from `backgroundRows`.
- detail items include kind, label/description, status, age/schedule, and output/result/error preview when present.
- compact text is computed from `backgroundRows` even when `backgroundCounts` is present and stale/divergent in a fixture.

### ADD `packages/coding-agent/test/background-footer-panel.test.ts`

Cases:

- collapsed panel renders `[]`.
- expanded panel renders at most three rows.
- selection moves with up/down methods and scrolls within three visible rows.
- `openSelected()` calls `openDetail(rowId)` for selected row.
- `collapse()` hides the panel.
- labels are sanitized/truncated.
- detail Esc/back closes the detail surface, restores editor focus, and does not clear terminal latches.

### MODIFY `packages/coding-agent/test/jobs-observer.test.ts`

Cases:

- async bash -> `sh` row.
- monitor -> `mon` row and legacy monitor fields still populated.
- task or metadata subagent -> `sub` row.
- queued subagent records -> `sub` queued row, or explicit accessor test if adding accessor.
- cron -> `cron` row and legacy `crons` still populated.
- successful completed job disappears.
- failed/cancelled job remains until `markTerminalRowsVisible(seq)` then `acknowledgeTerminalAfterUserMessage(laterSeq)`.
- failed/cancelled job does not clear before visible marker.
- owner scoping still applies.
- retained failed/cancelled row survives AsyncJobManager eviction and remains in `backgroundRows` until `acknowledgeTerminalAfterUserMessage(laterSeq)`.

### MODIFY `packages/coding-agent/test/composer-footer.test.ts`

Cases:

- backgroundText wins over idle hint but loses to transient/mode.
- footer remains exactly one line.
- clearing backgroundText restores idle hint.

### MODIFY `packages/coding-agent/test/input-controller-keybindings.test.ts`

Cases:

- `alt+x` calls `toggleBackgroundFooterPanel()`.
- while expanded, up/down/Enter use expand-lifetime handlers and Esc uses interrupt-priority/onEscape; none trigger editor history, prompt submit, or normal interrupt.
- when collapsed, existing key behavior remains unchanged.
- slash commands, local commands, extension-handled input, and empty continuation do not clear terminal rows.
- expand handlers are removed/disabled on collapse.
- when tool-focus mode is active, `alt+x` does not install panel handlers and shows a user-visible blocked notice.
- with detail open over an expanded panel, Esc closes detail only, restores editor focus, does not clear latches, and leaves panel collapse to a later Esc.

### MODIFY focused prompt submission tests near `withLocalSubmission` coverage

Cases:

- real agent prompt increments `#userAgentMessageSeq` and calls observer acknowledgement.
- follow-up/queued/streaming prompt paths also pass through the centralized acknowledgement path.
- bash/python/slash/local paths do not acknowledge terminal latches.
- compaction-resume/direct `recordLocalSubmission + session.prompt` path uses `#prepareRealUserAgentPromptSubmission()` via callback/routing.
- normal idle composer Enter path through `main.ts` invokes `#prepareRealUserAgentPromptSubmission()` before `session.prompt`.

### MODIFY `packages/coding-agent/test/keybindings-display.test.ts`

Cases:

- `app.background.expand` exists and defaults to `alt+x`.
- no conflict with existing defaults.

### MODIFY `packages/coding-agent/test/jobs-segment.test.ts`

Cases:

- status line remains compatible with reshaped `JobsSnapshot` legacy fields.
- status line does not render new all-background counts; footer/panel owns them.
- status line suppresses the legacy non-monitor async `N jobs running` block when footer background text is active / visible `sh` or `sub` rows exist.

### MODIFY `packages/coding-agent/test/jobs-overlay-model.test.ts`

Cases:

- existing `/jobs` overlay still works with legacy monitor/cron fields.
- helper reuse does not duplicate/diverge preview/relative-time behavior.

## 4. Verification commands

Focused tests:

```bash
bun test packages/coding-agent/test/background-footer-panel-model.test.ts \
  packages/coding-agent/test/background-footer-panel.test.ts \
  packages/coding-agent/test/jobs-observer.test.ts \
  packages/coding-agent/test/composer-footer.test.ts \
  packages/coding-agent/test/input-controller-keybindings.test.ts \
  packages/coding-agent/test/keybindings-display.test.ts \
  packages/coding-agent/test/jobs-segment.test.ts \
  packages/coding-agent/test/jobs-overlay-model.test.ts
```

Then package check:

```bash
bun --cwd=packages/coding-agent run check
```

## 5. Acceptance criteria

- With visible background work, footer shows compact left copy like `bg 3sub 1sh 1cron · alt+x` instead of idle help.
- Latched-only failed/cancelled rows keep footer visible with `!`, e.g. `bg 1sh! · alt+x`.
- Pressing `alt+x` expands/collapses a real footer-below panel at the bottom of the terminal.
- Expanded panel shows at most three rows and supports row selection plus `Enter` read-only detail.
- Detail view shows kind, label/description, status, age/schedule, and output/result/error preview when present, with no destructive actions.
- Detail Esc/back closes detail, restores editor focus, and does not clear terminal latches.
- If detail is open over an expanded panel, Esc/back closes detail first and must not collapse the panel in the same keypress.
- Successful completed background rows disappear automatically.
- Failed/cancelled rows remain visible until they have been rendered/marked visible and the user submits a later real user-agent prompt; slash/local/bash/python/empty continuation paths do not clear them.
- Existing `/jobs` overlay and status-line monitor/cron behavior remain compatible.
- Status line does not duplicate generic async/subagent counts while footer background text is active.
- Tool-focus mode blocks `alt+x` panel expansion with a user-visible notice and does not install competing panel handlers.
- Normal idle composer Enter path through `main.ts` invokes the shared real-user-agent prompt helper before `session.prompt`.
- Expanded-panel handlers are installed only on expand and removed/disabled on collapse.
- No assistant text is injected for background completion.
- Existing composer footer remains one line; only the new panel adds footer-below rows.
