# Executor receipt addendum — ctrl+t component replay hardening

Date: 2026-06-15

## Purpose

This addendum incorporates the completed executor receipts that arrived after the initial external hardening document. It sharpens the implementation boundaries for the planned H1/H2 ctrl+t component replay work.

Receipts incorporated:

- `agent://56-ReplayExtractionPlanAudit`
- `agent://57-OverlayControllerPlanAudit`
- `agent://58-SessionReplayComponentAPIs`

## Consensus verdict

The plan direction is sound, but the rollout must remain staged:

1. H1: ctrl+t-only component replay helper and overlay/controller source-shape migration.
2. H2: later refactor of `UiHelpers.renderSessionContext` to consume the helper after parity tests prove the helper.

Do **not** combine H1 and H2 unless a dedicated PABCD plan accepts the larger regression surface.

## Blocking decisions for H1

### 1. Footer item count

Decision for H1:

- `FullTranscriptSource.kind === "session"` carries explicit `itemCount`.
- `itemCount = historicalItems.length + liveItems.length`.
- The scroll position remains line-based: `${scrollStart}–${scrollEnd}/${lineTotal}`.

Rationale:

- Raw `sessionContext.messages.length` becomes inaccurate once assistant segmentation/read grouping produce more or fewer components than messages.
- Component count is closer to what the overlay is rendering.

### 2. Unpaired assistant toolCall behavior

Decision for H1:

- No raw `JSON.stringify(arguments)` row is allowed.
- A non-read unpaired toolCall may render a pending `ToolExecutionComponent` if that matches normal replay behavior, but it must not dump raw JSON.
- An orphan `toolResult` without a known call keeps a compact non-JSON fallback only if the helper cannot pair it.

### 3. Tool lookup in H1

Decision for H1:

- `getToolByName(name)` is required in `SessionTranscriptReplayDeps`.
- H1 should pass the real session tool lookup from `InputController.showFullTranscript()`.

Rationale:

- This restores custom renderer parity where a live tool object is available.
- It improves over the completed interim patch, which reconstructs `ToolExecutionComponent` with `tool: undefined`.

### 4. Normal chat replay mutation

Decision for H1:

- The helper must not mutate `ctx.pendingTools`, `ctx.lastToolComponent`, or `chatContainer`.
- H1 does not refactor `UiHelpers.renderSessionContext()` unless strictly necessary.

Rationale:

- Executor audits identified these as hidden side effects and P0 regression risk.

## Exact source-shape contract

### `FullTranscriptSource`

Target shape:

```ts
export type FullTranscriptSource =
  | { kind: "components"; items: Component[] }
  | { kind: "session"; historicalItems: Component[]; liveItems: Component[]; itemCount: number };
```

### Overlay rendering

Target behavior:

- `components` path remains as today.
- `session` path renders:
  1. `historicalItems` via `#renderComponent`;
  2. `liveItems` via `#renderLiveTail`.
- Active session path no longer calls `sessionMessagesToTranscriptLines()`.
- `FullTranscriptOverlayComponent` should no longer need direct imports of `BashExecutionComponent`, `EvalExecutionComponent`, or `ToolExecutionComponent` for session history.

### Controller assembly

`InputController.showFullTranscript()` should use a single-source rule:

- persisted history = `buildSessionTranscriptComponents(buildDisplaySessionContext(), deps, { mode: "transcript" })`;
- live tail = `liveToolContainer.children` + deduped `streamingComponent`;
- do not concatenate `chatContainer.children` with rebuilt historical items when persisted messages exist.

## Helper dependency contract

Minimum H1 dependency interface:

```ts
type SessionTranscriptReplayDeps = {
  ui: TUI;
  cwd: string;
  hideThinkingBlock: boolean;
  toolOutputExpanded: boolean;
  retryAttempt: number;
  settings: { get: Settings["get"] };
  getToolByName(name: string): AgentTool | undefined;
  getUserMessageText?(message: AgentMessage): string;
  getMessageRenderer?(customType: string): MessageRenderer | undefined;
  requestRender(): void;
};
```

Executor audit added `toolOutputExpanded` as a missing dependency. H1 should decide whether transcript replay ignores current inline expansion state because overlay calls `renderFullTranscript()`, but the dependency should exist for H2 compatibility.

## Component API notes

### Shared full-transcript protocol

Components to rely on:

- `AssistantMessageComponent.renderFullTranscript(width)`
- `ToolExecutionComponent.renderFullTranscript(width)`
- `ReadToolGroupComponent.renderFullTranscript(width)`
- `BashExecutionComponent.renderFullTranscript(width)`
- `EvalExecutionComponent.renderFullTranscript(width)`

These methods force expanded/full rendering and restore previous state in `finally`.

### `AssistantMessageComponent`

Replay sequence:

1. Construct with persisted assistant segment and `hideThinkingBlock`.
2. `setThinkingExpanded(false)` for historical chat-style state if needed.
3. `setUsageInfo(message.usage)` for final segment.
4. `setToolResultImages(toolCallId, images)` when read result images should attach to the preceding assistant segment.
5. Overlay rendering calls `renderFullTranscript(width)` to show thinking body.

Async side effects:

- image conversion can call the render callback; H1 can use a no-op requestRender for detached transcript components.

### `ReadToolGroupComponent`

Replay sequence:

1. Construct with `{ showContentPreview: settings.get("read.toolResultPreview") }`.
2. `setExpanded(false)`.
3. `updateArgs(args, toolCallId)` per read call.
4. `updateResult(result, false, toolCallId)` per matching result.

Routing helpers:

- `readArgsHaveTarget(args)`
- `readArgsTargetInternalUrl(args)`

Internal URL reads must not group.

### `ToolExecutionComponent`

Replay sequence:

1. Construct with tool name, final args, options, live tool object, ui, cwd, toolCallId.
2. `setExpanded(false)`.
3. `setArgsComplete(toolCallId)`.
4. `updateResult({ content, details, isError }, false, toolCallId)` when result arrives.
5. Minimize predecessor tool in local `lastToolComponent` chain if preserving historical preview behavior.

Async side effects:

- edit preview diff;
- image conversion;
- spinner intervals for streaming states.

H1 must prefer completed historical states and avoid leaving replay components in streaming/pending states when result data exists.

### `BashExecutionComponent` / `EvalExecutionComponent`

Replay sequence:

1. Construct with command/code, ui, exclude flag.
2. `setComplete(exitCode, cancelled, { output, truncation })`.
3. Overlay rendering calls `renderFullTranscript(width)`.

No `appendOutput()` is needed for completed persisted replay.

## Risk-ranked tests to add

Priority 1:

- `session-transcript-replay.test.ts`: assistant segment order `text A → tool → text B`.
- `session-transcript-replay.test.ts`: paired toolCall/toolResult gives rich `ToolExecutionComponent` output and no raw JSON.
- `session-transcript-replay.test.ts`: read tool grouping for multiple path reads; internal URL excluded.
- `full-transcript-overlay.test.ts`: `historicalItems` render before `liveItems`.
- `full-transcript-overlay.test.ts`: compaction/user pre-compact marker appears in overlay render output.

Priority 2:

- thinking full transcript expansion.
- error/aborted stop pending tool error injection.
- custom/skill/branch/compaction components.
- explicit item-count header policy.
- bottom pin with long historical component replay.

Priority 3:

- controller prebuilds historicalItems via helper.
- ctrl+o live-only gating unchanged.
- Alt+T remains tool-only scope.
- assistant-only toolCall no JSON.

Priority 4:

- renderFullTranscript state restore.
- close keys: escape/q/ctrl+t.

## Updated PABCD-ready H1 objective

> Implement H1 ctrl+t component replay hardening: add a side-effect-light shared session transcript component builder, wire `InputController.showFullTranscript()` to pass `{ historicalItems, liveItems, itemCount }` to `FullTranscriptOverlayComponent`, remove the active ctrl+t session string-rendering path, preserve ctrl+o and Alt+T semantics, and verify read grouping, assistant segmentation, rich tool/bash/eval rendering, custom/skill/branch/compaction rendering, bottom-open scroll, and item-count behavior.

## H2 remains separate

H2 should refactor `UiHelpers.renderSessionContext()` to call the helper only after H1 proves component parity. H2 must include compaction rebuild, editor history, footer/status, and pending tool lifecycle tests.
