# Implementation plan — shared session transcript component replay

Date: 2026-06-15

## Objective

Replace ctrl+t persisted-session string conversion with shared component replay so full transcript history uses the same component construction rules as normal chat history.

This is a hardening follow-up to the completed raw-JSON fix. The completed fix is sufficient for Bash/toolResult rendering, but this plan removes architectural drift.

## Proposed file changes

### 1. Add a replay helper module

New file:

- `packages/coding-agent/src/modes/utils/session-transcript-replay.ts`

Exports:

```ts
export type SessionTranscriptReplayDeps = { ... };
export type SessionTranscriptReplayOptions = {
  live?: boolean;
  markLiveToggleEligible?: boolean;
  minimizeHistoricalTools?: boolean;
};

export function buildSessionTranscriptComponents(
  sessionContext: SessionContext,
  deps: SessionTranscriptReplayDeps,
  options?: SessionTranscriptReplayOptions,
): Component[];
```

Core responsibilities:

- Iterate `sessionContext.messages` in order.
- Split assistant messages around tool calls.
- Build `AssistantMessageComponent` segments with the same thinking and usage behavior as `UiHelpers.renderSessionContext`.
- Build `ToolExecutionComponent` for non-read tools and pair later `toolResult` messages by `toolCallId`.
- Build `ReadToolGroupComponent` for read tool calls/results using `readArgsHaveTarget` and `readArgsTargetInternalUrl`.
- Build standard components for user/bash/python/custom/skill/branch/compaction messages.
- Mark returned historical components as not live-toggle eligible unless explicitly requested.
- Avoid direct access to `chatContainer`, `pendingTools`, `lastToolComponent`, or other mutable UI container state.

### 2. Refactor `UiHelpers.renderSessionContext`

File:

- `packages/coding-agent/src/modes/utils/ui-helpers.ts`

Current state:

- The replay logic is embedded directly in `renderSessionContext` and mutates `this.ctx.chatContainer`, `this.ctx.pendingTools`, and `this.ctx.lastToolComponent` during iteration.

Target state:

- `renderSessionContext` still owns container clearing/updating side effects.
- It calls `buildSessionTranscriptComponents(...)`.
- It adds each returned component to `this.ctx.chatContainer`.
- It preserves footer/history behavior (`updateFooter`, `populateHistory`) outside the helper.

Risk-control option:

- First extraction can keep `renderSessionContext` behavior unchanged by comparing output shape in tests before deleting old code.
- If too risky, make the helper initially share only the assistant/tool/read replay branch and let `addMessageToChat` handle non-tool roles.

### 3. Refactor ctrl+t source shape

Files:

- `packages/coding-agent/src/modes/components/full-transcript-overlay.ts`
- `packages/coding-agent/src/modes/controllers/input-controller.ts`

Current `FullTranscriptSource` session variant:

```ts
{ kind: "session"; sessionContext: SessionContext; liveItems: Component[] }
```

Target variant:

```ts
{ kind: "session"; historicalItems: Component[]; liveItems: Component[]; itemCount: number }
```

Rationale:

- Overlay should stay a dumb pager/renderer.
- Input controller already has access to the interactive context, current session, settings, cwd, and tool registry.
- Tests can pass fake components directly without needing a full session.

`FullTranscriptOverlayComponent.#transcriptLines(width)` becomes:

```ts
if (source.kind === "session") {
  for (const item of source.historicalItems) lines.push(...this.#renderComponent(item, width));
  lines.push(...this.#renderLiveTail(source.liveItems, width));
}
```

Then delete or narrow `sessionMessagesToTranscriptLines`.

### 4. Preserve ctrl+o / Alt+T semantics

- ctrl+o continues to toggle `liveToggleEligible` live components only.
- ctrl+t renders historical components with `renderFullTranscript(width)` but does not mutate live chat expansion state.
- Alt+T remains `ToolTranscriptOverlayComponent([toolComponents])` only.

## Acceptance criteria

- ctrl+t no longer has a persisted string switch for tool/bash/eval rendering.
- ctrl+t historical items are component arrays built by the shared helper.
- Normal chat session replay still renders the same ordering for assistant/tool/read/custom messages.
- Read tool grouping is preserved for normal chat and becomes available to ctrl+t historical replay.
- Assistant thinking in ctrl+t full transcript is visible through `AssistantMessageComponent.renderFullTranscript()`.
- ctrl+o focused tests remain green.
- Alt+T scoping test remains green.
- Existing full transcript bottom-open/scroll tests remain green.

## Implementation sequencing

1. Add helper and unit tests using a fake deps object.
2. Port only enough of `renderSessionContext` into the helper to produce identical component sequences.
3. Wire `UiHelpers.renderSessionContext` to helper output.
4. Wire `InputController.showFullTranscript` to prebuild `historicalItems` for the overlay.
5. Simplify `FullTranscriptOverlayComponent` session branch.
6. Run affected tests, package typecheck, then workspace check.

## Expected tests

- `session-transcript-replay.test.ts` for helper component ordering and pairing.
- `full-transcript-overlay.test.ts` for overlay rendering over `historicalItems + liveItems`.
- Existing controller/keybinding tests for ctrl+o/ctrl+t mappings.
- Existing `read-tool-group.test.ts` plus new replay-specific read group fixture.

## Rollback strategy

If helper extraction destabilizes normal session replay, keep the completed overlay-local rich fix and limit the follow-up to a helper used only by ctrl+t. That would still improve testability without risking visible chat replay.
