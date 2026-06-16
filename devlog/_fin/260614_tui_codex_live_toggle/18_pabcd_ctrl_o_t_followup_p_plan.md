# PABCD P Plan — ctrl+o live-turn toggle + ctrl+t bottom-start transcript follow-up

Date: 2026-06-15

## Objective

Implement the follow-up UX contract from the user discussion:

1. `ctrl+o` remains an inline live-turn expand/collapse control only.
   - It MUST NOT expand or collapse previous turns once they have been committed to terminal scrollback.
   - It MUST affect all expandable Jaw/tool output that still belongs to the current live turn, including streaming-tool components created from assistant `toolCall` content.
   - If the user leaves `ctrl+o` expanded and submits the next message, the expanded pixels are committed and cannot be collapsed later. This is intentional.
2. `ctrl+t` remains the full transcript pager/overlay.
   - It MUST open at the bottom/latest transcript position, Claude-style.
   - The user scrolls upward with `up`/`pageUp`/`g` to inspect older content.
3. Preserve the previous PABCD result: `ctrl+t` is not mapped to thinking; `alt+t` remains tool-only transcript; compaction-visible history is sourced from `buildDisplaySessionContext()`.

## Current diagnosis

### `ctrl+t` bottom-start bug

File: `packages/coding-agent/src/modes/components/full-transcript-overlay.ts`

Current state:

```ts
#scroll = 0;
...
override render(width: number): string[] {
  const lines = this.#transcriptLines(width);
  const rows = this.#viewportRows();
  const maxScroll = Math.max(0, lines.length - rows);
  this.#scroll = Math.min(this.#scroll, maxScroll);
  ... lines.slice(this.#scroll, this.#scroll + rows)
}
```

Problem: first render always starts at row 0/top. Full transcript UX should start at latest/bottom.

Patch shape:

- Add a private initialization flag, e.g. `#scrollInitialized = false`.
- In `render(width)`, after computing `maxScroll`, when `!#scrollInitialized`, set `#scroll = maxScroll` and then mark initialized.
- Preserve explicit navigation after first render (`g`, `G`, arrows, pages).
- Keep `ctrl+t`, `q`, `esc` close behavior.

Expected after:

```ts
if (!this.#scrollInitialized) {
  this.#scroll = maxScroll;
  this.#scrollInitialized = true;
} else {
  this.#scroll = Math.min(this.#scroll, maxScroll);
}
```

### `ctrl+o` last live-turn incomplete expansion bug

Files:

- `packages/coding-agent/src/modes/controllers/event-controller.ts`
- `packages/coding-agent/src/modes/controllers/input-controller.ts`
- `packages/coding-agent/src/modes/utils/ui-helpers.ts`

Current intended model:

- `commitFinalizedBacklog(ctx)` commits a finalized prefix at the next prompt submit and calls `markLiveToggleEligible(child, false)` for committed components.
- `InputController.setToolsExpanded(expanded)` only touches components for which `isLiveToggleEligible(child)` returns true.
- Therefore previous turns are intentionally excluded from both expanding and collapsing.

Observed gap:

In `event-controller.ts`, streaming assistant handling creates tool components from `toolCall` content inside `#handleMessageUpdate()`:

```ts
const component = new ToolExecutionComponent(...);
component.setExpanded(this.ctx.toolOutputExpanded);
this.ctx.lastToolComponent?.setMinimized?.(true);
this.ctx.lastToolComponent = component;
this.ctx.chatContainer.addChild(component);
this.ctx.pendingTools.set(content.id, component);
```

This path does not mark the component live-toggle eligible. As a result, `ctrl+o` can miss current-turn tool/Jaw blocks even before the next user submission.

Patch shape:

- In `#handleMessageUpdate()`, immediately after `component.setExpanded(this.ctx.toolOutputExpanded)`, call:

```ts
markLiveToggleEligible(component, true);
```

- Audit existing live-turn constructors in the same file:
  - assistant streaming component already marked true at message start and post-tool segment creation.
  - live-zone `tool_execution_start` component already marked true.
  - read group from `#getReadGroup()` already marked true.
  - `ttsr_triggered` already marked true.
- Do not change `commitFinalizedBacklog()` semantics: committed previous turns remain ineligible.
- Do not broaden `setToolsExpanded()` to all chat children; that would reintroduce the old bug where previous-turn objects can change state without rewriting committed scrollback pixels.
- Also gate `liveToolContainer` expansion with `isLiveToggleEligible()` so the same eligibility rule applies to both chat-container live components and commit-fold live preview components. This preserves the user rule that only the current live turn is affected.

## Diff-level file plan

### MODIFY `packages/coding-agent/src/modes/components/full-transcript-overlay.ts`

Before:

```ts
#scroll = 0;
#cache?: { width: number; lines: string[] };
```

After:

```ts
#scroll = 0;
#scrollInitialized = false;
#cache?: { width: number; lines: string[] };
```

Before:

```ts
const maxScroll = Math.max(0, lines.length - rows);
this.#scroll = Math.min(this.#scroll, maxScroll);
```

After:

```ts
const maxScroll = Math.max(0, lines.length - rows);
if (!this.#scrollInitialized) {
  this.#scroll = maxScroll;
  this.#scrollInitialized = true;
} else {
  this.#scroll = Math.min(this.#scroll, maxScroll);
}
```

Scroll-growth rule: the initial open pins to bottom once. After the user scrolls, the overlay preserves the user's explicit offset and only clamps to the new `maxScroll` if content shrinks or the viewport changes. Because `ctrl+t` opens a fresh overlay instance each time, closing and reopening re-pins to latest/bottom.

No public API change.
### MODIFY `packages/coding-agent/src/modes/controllers/input-controller.ts`

Before in `setToolsExpanded(expanded)` live-tool loop:

```ts
for (const child of this.ctx.liveToolContainer.children) {
  if (isExpandable(child)) {
    child.setExpanded(expanded);
  }
}
```

After:

```ts
for (const child of this.ctx.liveToolContainer.children) {
  if (!isLiveToggleEligible(child)) continue;
  if (isExpandable(child)) {
    child.setExpanded(expanded);
  }
}
```

Keep the existing `this.ctx.thinkingExpanded = expanded;` behavior in `toggleToolOutputExpansion()`. `ctrl+o` still updates assistant thinking expansion state for current/live assistant components; the follow-up fix does not remove that coupling.


### MODIFY `packages/coding-agent/src/modes/controllers/event-controller.ts`

Before in streaming toolCall component construction inside `#handleMessageUpdate()`:

```ts
component.setExpanded(this.ctx.toolOutputExpanded);
// 083.1: a new tool starting collapses the previous one to a one-line summary
this.ctx.lastToolComponent?.setMinimized?.(true);
```

After:

```ts
component.setExpanded(this.ctx.toolOutputExpanded);
markLiveToggleEligible(component, true);
// 083.1: a new tool starting collapses the previous one to a one-line summary
this.ctx.lastToolComponent?.setMinimized?.(true);
```

No change to historical replay/renderSessionContext components; those remain `false`.

### MODIFY `packages/coding-agent/test/full-transcript-overlay.test.ts`

Add tests:

1. `opens at the bottom of a long transcript`
   - Set `process.stdout.rows` with a temporary descriptor or use enough lines and assert the render contains latest marker, not oldest marker.
   - Construct component source with e.g. `line-0` through `line-39`.
   - Assert first render contains `line-39` and does not contain `line-0` when viewport rows are smaller than transcript.
2. `can scroll upward after opening at the bottom`
   - First render initializes bottom.
   - Send `pageUp` or `g` via `handleInput()`.
   - Assert older marker appears.
3. `preserves user scroll offset after initial bottom pin`
   - Render a long transcript once so it initializes at bottom.
   - Send `pageUp` or `up`.
   - Render again on the same overlay instance and assert the older marker remains visible rather than re-pinning to bottom.
4. `fresh overlay instances re-pin to bottom`
   - Create a second `FullTranscriptOverlayComponent` over the same source.
   - Assert the first render starts at bottom/latest again.
5. Keep/extend the existing close-key test so AC 3 remains directly covered:
   - `escape`, `q`, and `ctrl+t` close the overlay.

Implementation note: if `process.stdout.rows` is difficult to patch portably, create enough lines relative to the default fallback (`30 - 8 = 22`) and assert bottom markers appear while top marker does not.

### MODIFY `packages/coding-agent/test/input-controller-keybindings.test.ts`

Add focused controller tests for `ctrl+o` eligibility and turn-boundary contract:

1. `ctrl+o expands/collapses only live-toggle eligible components`
   - Build a fake expandable component with `setExpanded` spy and `liveToggleEligible = true`.
   - Build a second fake expandable component with `liveToggleEligible = false`.
   - Put both in `chatContainer.children`.
   - Call `controller.toggleToolOutputExpansion()` twice.
   - Assert only the live component receives `setExpanded(true)` then `setExpanded(false)`.
   - Assert the previous/committed component is untouched both times.

2. `expanded current turn is committed as-is on next submit`
   - Use a fake live component with `renderCommitted()` or `render()` output that changes based on `setExpanded`.
   - Ensure the fake context satisfies `commitLaneEnabled()` and exposes `ui.commitLines` as a collector returning `true`.
   - Toggle `ctrl+o` to expanded.
   - Call `commitFinalizedBacklog(ctx)`.
   - Assert committed lines contain the expanded marker.
   - Assert the component is marked ineligible after commit.
   - Call `controller.toggleToolOutputExpansion()` again and assert the committed child is not touched, proving AC 8 directly.

This proves the user contract: previous turns (`false`) are neither expanded nor collapsed; the current turn (`true`) is toggled only until it is committed in its current state.

### MODIFY `packages/coding-agent/test/modes/controllers/event-controller-message-start.test.ts`

Add a required regression test for the streaming `toolCall` path, not a code-review fallback. Extend this file because it already imports `EventController`, `InteractiveModeContext`, `Container`, and theme initialization.

Minimum fixture requirements:

- Context:
  - `isInitialized: true`
  - `chatContainer: new Container()`
  - `ui.requestRender = vi.fn()`
  - `statusLine.invalidate = vi.fn()`
  - `updateEditorTopBorder = vi.fn()`
  - `settings.get(...)` returns defaults needed by `ToolExecutionComponent` (`terminal.showImages`, edit options) or falsy safe values.
  - `session.getToolByName = vi.fn(() => undefined)` so the generic tool component path is used.
  - `pendingTools = new Map()`
  - `lastToolComponent`, `streamingComponent`, and `streamingMessage` fields initialized as needed by the controller.
  - `sessionManager.getCwd = vi.fn(() => process.cwd())`
- Event sequence:
  - `message_start` with an assistant message containing empty content.
  - `message_update` with the same assistant message plus one non-`read` `toolCall`, e.g. `{ type: "toolCall", id: "tool-1", name: "bash", arguments: { command: "echo ok" } }`.
- Assertion:
  - Find the created `ToolExecutionComponent` in `chatContainer.children`.
  - Assert `(toolComponent as { liveToggleEligible?: boolean }).liveToggleEligible === true`.
  - This must exercise the `#handleMessageUpdate()` streaming-tool construction path near the current `component.setExpanded(this.ctx.toolOutputExpanded)` line, not the separate `tool_execution_start` path that is already marked true.

Add the pre-merge audit check to the build note: inspect every `setExpanded(this.ctx.toolOutputExpanded)` in `event-controller.ts` live paths and verify live-created components are followed by `markLiveToggleEligible(..., true)`. Replay/renderSessionContext paths remain intentionally ineligible.
### MODIFY `structure/31_scroll.md`

Update the canonical scroll/shortcut rule unconditionally:

- `ctrl+o`: current live turn only, both expand and collapse; committed previous turns are excluded from both.
- `ctrl+o` also keeps the existing current-turn thinking expansion coupling through `thinkingExpanded`.
- `ctrl+t`: full transcript pager, opens at latest/bottom, preserves user scroll offset while open, and scrolls up for history.

### NEW `devlog/_plan/260614_tui_codex_live_toggle/19_b_followup_implementation.md`

Build-stage implementation note after edits:

- Record exact source/test changes.
- Record why previous turns are excluded from both expand and collapse.
- Record verification commands.

### NEW `devlog/_plan/260614_tui_codex_live_toggle/20_c_followup_check.md`

Check-stage evidence after tests/checks:

- Focused test command and output.
- Type/check command output.

## Non-goals

- Do not make `ctrl+o` open an external window.
- Do not make `ctrl+o` operate on full session history.
- Do not reassign `alt+t`.
- Do not restore `ctrl+t` thinking mapping.
- Do not rewrite the commit-lane/terminal scrollback model.
- Do not touch visual welcome/banner/viewport fill logic except through existing `compactViewportFill()` side effect already present.

## Acceptance criteria

1. `ctrl+t` opens full transcript at bottom/latest position.
2. `ctrl+t` preserves user scroll offset after the first render and only re-pins to bottom when a fresh overlay is opened.
3. `ctrl+t` can scroll upward to older transcript content and close with `ctrl+t`/`q`/`esc`.
4. `ctrl+o` expands/collapses only `liveToggleEligible` components.
5. Streaming tool components created from assistant `toolCall` content are marked live-toggle eligible before turn commit.
6. A focused regression test proves the streaming `toolCall` component is live-toggle eligible.
7. A focused regression test proves expanded current-turn output is committed as-is on next submit and is not collapsed later.
8. Previous committed turns remain excluded from both expanding and collapsing.
9. Focused tests pass.
10. `bun --cwd=packages/coding-agent run check:types` passes or any failure is proven unrelated and recorded.
11. Root `bun run check` passes or any failure is proven unrelated and recorded.

## Verification plan

Run focused tests first:

```bash
bun test \
  packages/coding-agent/test/full-transcript-overlay.test.ts \
  packages/coding-agent/test/input-controller-keybindings.test.ts \
  packages/coding-agent/test/modes/controllers/event-controller-message-start.test.ts \
  packages/coding-agent/test/keybindings-display.test.ts \
  packages/coding-agent/test/keybindings-migration.test.ts \
  packages/coding-agent/test/modes/controllers/command-controller-hotkeys.test.ts \
  packages/coding-agent/test/thinking-collapse.test.ts
```


Focused-test linkage:
- `full-transcript-overlay.test.ts`: AC1–3 (`ctrl+t` bottom, offset preservation, close keys).
- `input-controller-keybindings.test.ts`: AC4, AC7, AC8 (`ctrl+o` eligibility, commit-as-is, previous turn exclusion).
- `event-controller-message-start.test.ts`: AC5–6 (streaming `toolCall` component is live-toggle eligible).
- `keybindings-display.test.ts` and `keybindings-migration.test.ts`: guard `ctrl+t` full-transcript mapping and legacy thinking sanitization.
- `command-controller-hotkeys.test.ts`: guard user-visible hotkey docs.
- `thinking-collapse.test.ts`: regression guard for retained `thinkingExpanded` coupling.

Then run package type check:

```bash
bun --cwd=packages/coding-agent run check:types
```

Then run root gate:

```bash
bun run check
```

## Risk controls

- Preserve user/concurrent changes: edit only the listed files unless tests reveal a direct dependency.
- Use narrow patches.
- Do not mutate previous-turn eligibility rules; only fix the missing current-turn eligibility marker.
- Keep `ctrl+t` bottom initialization local to overlay render state so it cannot affect transcript contents or session hydration.
