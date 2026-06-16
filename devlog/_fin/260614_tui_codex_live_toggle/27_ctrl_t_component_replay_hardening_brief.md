# Follow-up hardening brief — ctrl+t component replay parity

Date: 2026-06-15

## Why this exists

The completed ctrl+t fix removed the user-visible `Tool call bash { ... JSON ... }` failure and replays persisted Bash/Eval/toolResult messages through rich execution components. That patch is correct for the reported Bash/raw-JSON bug, but it is still an overlay-local reconstruction path.

A deeper hardening pass can make ctrl+t use the same historical transcript replay model as normal session rendering. That would reduce drift between:

- normal visible chat replay (`UiHelpers.renderSessionContext`), and
- full transcript overlay replay (`FullTranscriptOverlayComponent`).

## Current architecture

### Normal chat replay

File: `packages/coding-agent/src/modes/utils/ui-helpers.ts`

`UiHelpers.renderSessionContext(sessionContext, options)` walks `sessionContext.messages` and adds actual TUI components to the chat container:

- `AssistantMessageComponent` for assistant text/thinking segments.
- `ToolExecutionComponent` for general tool calls.
- `ReadToolGroupComponent` for grouped `read` tool calls/results.
- `BashExecutionComponent` for persisted shell execution messages via the standard `addMessageToChat` path.
- `EvalExecutionComponent` for persisted python/eval execution messages via the standard `addMessageToChat` path.
- `CustomMessageComponent`, `SkillMessageComponent`, `BranchSummaryMessageComponent`, and `CompactionSummaryMessageComponent` through the standard message path.

Important behavior in this loop:

- assistant messages are split at tool-call boundaries so text/thinking that appears before or after tool calls remains in correct order;
- read tool calls are batched into `ReadToolGroupComponent` when the target is a real path/URL rather than an internal URI;
- tool results are paired through `pendingTools` by `toolCallId`;
- assistant error/abort stops can synthesize tool error results for pending calls;
- historical tool blocks are marked non-live-toggle-eligible and minimized during replay;
- live replay can preserve current thinking expansion state, but historical replay collapses according to component defaults.

### ctrl+t overlay replay today

File: `packages/coding-agent/src/modes/components/full-transcript-overlay.ts`

The current completed fix still starts from `sessionMessagesToTranscriptLines(messages, width)` for persisted session messages. It now reconstructs rich execution components for key execution shapes:

- `bashExecution` → `BashExecutionComponent.renderFullTranscript(width)`
- `pythonExecution` → `EvalExecutionComponent.renderFullTranscript(width)`
- paired assistant `toolCall` + `toolResult` → `ToolExecutionComponent.renderFullTranscript(width)`

This solves the user-reported Bash/raw-JSON bug, but it does not fully share the normal chat replay loop.

## Desired hardening

Create a shared session transcript replay helper that returns historical `Component[]`. Then both normal chat replay and ctrl+t can consume the same component sequence.

Target shape:

```ts
buildSessionTranscriptComponents(sessionContext, deps): Component[]
```

where `deps` is narrow and injectable:

```ts
type SessionTranscriptReplayDeps = {
  ui: TUI;
  cwd: string;
  hideThinkingBlock: boolean;
  live?: boolean;
  thinkingExpanded?: boolean;
  retryAttempt: number;
  settings: Pick<Settings, "get">;
  getToolByName(name: string): AgentTool | undefined;
  requestRender(): void;
};
```

The helper should own message ordering, component construction, read grouping, pending tool pairing, and live-toggle eligibility markers. It should not mutate `chatContainer` directly.

## Why this is better

- One replay loop means fewer future ctrl+t vs normal-chat rendering drifts.
- Full transcript overlay can become a dumb renderer over component arrays.
- Read grouping, custom/skill/compaction components, and assistant segmentation become consistent without duplicating logic.
- Tests can target a pure component-producing helper instead of indirectly inspecting line strings only.

## Non-goals

- Do not change ctrl+o semantics. ctrl+o remains current live-turn inline expansion/collapse.
- Do not make Alt+T a full transcript view. Alt+T remains a supplied-tools-only transcript overlay.
- Do not rewrite viewport scroll model or welcome/TUI visual identity.
- Do not force a full terminal-scrollback implementation.

## Open design questions

1. Should `UiHelpers.renderSessionContext` call the helper and then add returned components, or should helper extraction remain overlay-only first?
2. Should the helper include the existing minimization behavior for historical chat replay, or should full transcript overlay explicitly render each component through `renderFullTranscript` so minimization is irrelevant there?
3. How much custom extension tool renderer parity is required when persisted history lacks a live `Tool` object?
4. Should item count in the ctrl+t footer count raw messages, historical components, or rendered blocks?
