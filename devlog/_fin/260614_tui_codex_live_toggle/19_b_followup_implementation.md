# B Implementation — ctrl+o/t follow-up

Date: 2026-06-15

## Implemented source changes

- `packages/coding-agent/src/modes/components/full-transcript-overlay.ts`
  - Added `#scrollInitialized`.
  - First render pins the full transcript pager to `maxScroll` (latest/bottom).
  - Later renders preserve user scroll offset and only clamp to the available range.
- `packages/coding-agent/src/modes/controllers/input-controller.ts`
  - `setToolsExpanded()` now gates `liveToolContainer.children` with `isLiveToggleEligible(child)` before calling `setExpanded()`.
  - `ctrl+o` remains current-live-turn-only; previous committed turns are not expanded or collapsed.
  - Existing `thinkingExpanded` coupling remains intact.
- `packages/coding-agent/src/modes/controllers/event-controller.ts`
  - Streaming `toolCall` components created inside `#handleMessageUpdate()` now call `markLiveToggleEligible(component, true)` immediately after `setExpanded(this.ctx.toolOutputExpanded)`.
- `structure/31_scroll.md`
  - Canonicalized `ctrl+o` as current live turn only, excluding prior committed turns from both expand and collapse.
  - Canonicalized `ctrl+t` as full transcript pager opening at latest/bottom and preserving user scroll offset while open.
- `packages/coding-agent/src/task/index.ts`
  - Fixed an unrelated syntax break in `isPabcdActorStage()` (`c`/`d` stages missing and function body unterminated). This was required because focused tests could not parse the package while the file was broken.

## Implemented tests

- `packages/coding-agent/test/full-transcript-overlay.test.ts`
  - Opens long transcript at bottom.
  - Scrolls upward after bottom open.
  - Preserves user scroll offset after initial bottom pin.
  - Fresh overlay instance re-pins to bottom.
  - Existing close-key coverage (`escape`, `q`, `ctrl+t`) remains.
- `packages/coding-agent/test/input-controller-keybindings.test.ts`
  - `ctrl+o` toggles only `liveToggleEligible` current-turn chat/live-zone components.
  - Ineligible previous/committed components are not touched.
  - Expanded output remains expanded when a simulated commit boundary marks it ineligible; later `ctrl+o` does not collapse it.
- `packages/coding-agent/test/modes/controllers/event-controller-message-start.test.ts`
  - Dedicated streaming assistant `toolCall` regression verifies the `#handleMessageUpdate()` path creates a `ToolExecutionComponent` with `liveToggleEligible === true`.

## Pre-merge live marker audit

Search command performed with repository search tool:

```text
pattern: setExpanded\(this\.ctx\.toolOutputExpanded\)
path: packages/coding-agent/src/modes/controllers/event-controller.ts
```

Results:

- `#getReadGroup()` line ~145: `markLiveToggleEligible(group, true)` immediately before `group.setExpanded(...)` — PASS.
- `#handleMessageUpdate()` streaming `toolCall` line ~491: `component.setExpanded(...)` immediately followed by `markLiveToggleEligible(component, true)` — PASS.
- `#handleToolExecutionStart()` line ~623: `component.setExpanded(...)` immediately followed by `markLiveToggleEligible(component, true)` — PASS.
- `#handleTtsrTriggered()` line ~927: `component.setExpanded(...)` immediately followed by `markLiveToggleEligible(component, true)` — PASS.

## Focused verification

Command:

```bash
bun test packages/coding-agent/test/full-transcript-overlay.test.ts packages/coding-agent/test/input-controller-keybindings.test.ts packages/coding-agent/test/modes/controllers/event-controller-message-start.test.ts packages/coding-agent/test/keybindings-display.test.ts packages/coding-agent/test/keybindings-migration.test.ts packages/coding-agent/test/modes/controllers/command-controller-hotkeys.test.ts packages/coding-agent/test/thinking-collapse.test.ts
```

Result:

```text
46 pass
0 fail
227 expect() calls
Ran 46 tests across 7 files.
```
