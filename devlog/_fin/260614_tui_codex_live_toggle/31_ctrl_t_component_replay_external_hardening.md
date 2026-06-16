# External + executor hardening — ctrl+t component replay plan

Date: 2026-06-15

## Purpose

Harden the follow-up plan for replacing ctrl+t persisted-session string rendering with component replay. This document combines:

- parallel executor research:
  - `agent://56-ReplayExtractionPlanAudit`
  - `agent://57-OverlayControllerPlanAudit`
  - `agent://58-SessionReplayComponentAPIs`
- earlier executor/architect research:
  - `agent://41-TranscriptRenderResearch`
  - `agent://54-ReplayHelperStructure`
  - `agent://55-ReplayParityGaps`
- external behavior references:
  - Claude Code transcript viewer docs: https://code.claude.com/docs/en/interactive-mode
  - Codex Ctrl+T transcript overlay issue #7454: https://github.com/openai/codex/issues/7454
  - Codex transcript footer issue #2782: https://github.com/openai/codex/issues/2782
  - Ink README: https://github.com/vadimdemedes/ink

## Context7 status

Attempted Context7 lookup for Ink terminal UI docs:

```text
mcp__context_resolve_library_id({ libraryName: "Ink", ... })
→ MCP error: Transport not connected
```

Because Context7 transport was unavailable, the external docs lane used primary web sources instead:

- official Ink README from GitHub;
- Claude Code official interactive-mode docs;
- Codex GitHub issues for transcript overlay behavior.

## External evidence and planning implications

### Claude Code

Claude Code documents `Ctrl+O` as the transcript viewer shortcut and says it shows detailed tool usage/execution and expands collapsed MCP calls. Inside the transcript viewer, Claude documents `Ctrl+E` for “show all content,” `[` for writing full conversation to terminal scrollback, `v` for opening transcript in `$VISUAL`/`$EDITOR`, and `q`/`Ctrl+C`/`Esc` for exit.

Planning implication for JWC:

- JWC’s product decision differs: `ctrl+t` is the full transcript overlay and `ctrl+o` remains current-turn inline expansion.
- Claude’s model supports a useful separation that JWC should preserve: transcript viewer is a read/review surface, not the same state mutation as live inline expansion.
- A future JWC hardening can add export/search/editor actions, but that is separate from component replay.

Source: https://code.claude.com/docs/en/interactive-mode

### Codex

Codex issues confirm that `Ctrl+T` transcript overlay is a real transcript surface with footer/close behavior concerns. Issue #7454 specifically reports long single-line truncation in the Ctrl+T transcript overlay and expects width-aware wrapping or an alternate inspection path. Issue #2782 documents that Ctrl+T and Ctrl+C close the transcript overlay and argues footer hints should mention them.

Planning implication for JWC:

- Opening ctrl+t at the bottom/latest and keeping close hints visible is correct.
- The replay helper should not silently hard-slice rich component lines in a way that makes long tool output unrecoverable.
- Width-aware wrapping/truncation should be treated as a hardening subtask, not hidden behind component replay.

Sources:

- https://github.com/openai/codex/issues/7454
- https://github.com/openai/codex/issues/2782

### Ink / terminal component architecture

Ink’s README describes the terminal UI model as component-based: CLI UI is built and tested using components, and the renderer maps components to terminal output. It also documents keyboard input hooks and controlled rendering patterns.

Planning implication for JWC:

- Component replay is the right direction: persisted transcript history should be rebuilt as display components, then rendered by the same overlay pager mechanism.
- Avoid a second string-rendering DSL in `FullTranscriptOverlayComponent`; string fallback should be only for explicitly unsupported legacy records.

Source: https://github.com/vadimdemedes/ink

## Hardened implementation stance

The previous plan offered two variants:

1. staged helper used by ctrl+t first;
2. full one-shot extraction where normal `UiHelpers.renderSessionContext` also consumes the helper.

After executor + external research, the hardened recommendation remains staged:

### Phase H1 — ctrl+t component replay helper only

- Add a shared helper module that builds historical transcript components from `SessionContext` using injected deps.
- Wire `InputController.showFullTranscript()` to prebuild `historicalItems` for ctrl+t.
- Simplify `FullTranscriptOverlayComponent` so its session path renders `historicalItems + liveItems` via `#renderComponent`.
- Keep normal `UiHelpers.renderSessionContext()` behavior unchanged in this phase.

Reason:

- This delivers user-visible parity for ctrl+t while avoiding immediate risk to normal chat replay, compaction rebuild, and editor history population.

### Phase H2 — deduplicate normal chat replay

- After H1 tests prove helper behavior, refactor `UiHelpers.renderSessionContext()` to use the helper as the single source of replay component construction.
- Preserve footer updates, editor history population, `ctx.pendingTools` cleanup, and `requestRender()` as `UiHelpers` responsibilities.

Reason:

- This removes duplicate logic only after component helper behavior is locked down.

## H1 helper contract

New file:

- `packages/coding-agent/src/modes/utils/session-transcript-replay.ts`

Exports:

```ts
export type SessionTranscriptReplayDeps = {
  ui: TUI;
  cwd: string;
  hideThinkingBlock: boolean;
  retryAttempt: number;
  settings: { get: Settings["get"] };
  getToolByName(name: string): AgentTool | undefined;
  getUserMessageText?(message: AgentMessage): string;
  getMessageRenderer?(customType: string): MessageRenderer | undefined;
  requestRender(): void;
};

export type SessionTranscriptReplayOptions = {
  mode: "transcript" | "chat";
  live?: boolean;
  readToolResultPreview?: boolean;
};

export function buildSessionTranscriptComponents(
  sessionContext: SessionContext,
  deps: SessionTranscriptReplayDeps,
  options: SessionTranscriptReplayOptions,
): Component[];
```

H1 can use only `mode: "transcript"`; `mode: "chat"` exists to prevent painting the design into a corner for H2.

## Required helper internals

Use local state only:

- `pendingTools: Map<string, ToolExecutionComponent | ReadToolGroupComponent>`
- `readToolCallArgs: Map<string, Record<string, unknown>>`
- `readToolCallAssistantComponents: Map<string, AssistantMessageComponent>`
- `readGroup: ReadToolGroupComponent | null`
- `lastToolComponent: { setMinimized?(value: boolean): void } | undefined`

No direct mutation of:

- `ctx.chatContainer`
- `ctx.pendingTools`
- `ctx.lastToolComponent`
- editor history
- status/footer state

## H1 source changes

### `full-transcript-overlay.ts`

Change source type:

```ts
export type FullTranscriptSource =
  | { kind: "components"; items: Component[] }
  | { kind: "session"; historicalItems: Component[]; liveItems: Component[]; itemCount: number };
```

Change rendering:

- delete or retire `sessionMessagesToTranscriptLines` from the active session path;
- session path renders `historicalItems` with `#renderComponent`, then `liveItems` with `#renderLiveTail`;
- footer count uses `itemCount` or `historicalItems.length + liveItems.length` consistently.

### `input-controller.ts`

In `showFullTranscript()`:

- build `sessionContext = session.buildDisplaySessionContext()` as today;
- build `liveItems` as today;
- if `sessionContext.messages.length > 0`, call `buildSessionTranscriptComponents(sessionContext, deps, { mode: "transcript" })`;
- pass `{ kind: "session", historicalItems, liveItems, itemCount }` to overlay.

Deps source should come from existing controller context:

- `ctx.ui`
- `ctx.session.getToolByName`
- `ctx.sessionManager.getCwd()`
- `ctx.hideThinkingBlock`
- `ctx.settings`
- `ctx.session.retryAttempt`
- `ctx.session.extensionRunner?.getMessageRenderer(...)` if accessible

### `ui-helpers.ts`

H1 should not refactor `renderSessionContext()` yet unless the helper code is copied/extracted with identical behavior and tests prove parity.

At minimum, export or share small primitives already used by the helper:

- `markLiveToggleEligible`
- silent abort handling utility imports
- standard component constructors

## H1 test hardening

Add or update:

- `packages/coding-agent/test/session-transcript-replay.test.ts`
- `packages/coding-agent/test/full-transcript-overlay.test.ts`

Required cases:

1. assistant text → toolCall → assistant text order.
2. paired toolCall/toolResult renders a `ToolExecutionComponent` without raw JSON.
3. read toolCalls group into `ReadToolGroupComponent` for filesystem targets.
4. internal URL read calls do not group.
5. custom/skill/branch/compaction messages construct rich components, not dim role-label fallback.
6. bashExecution/evalExecution still render through rich execution components.
7. bottom-open behavior remains correct with historicalItems.
8. ctrl+o and Alt+T tests remain green.
9. long single-line output is either wrapped or explicitly covered by a known-limit test and follow-up; do not silently regress to invisible truncation.

## Acceptance criteria for H1

- `FullTranscriptOverlayComponent` no longer imports `BashExecutionComponent`, `EvalExecutionComponent`, or `ToolExecutionComponent` directly for session history rendering.
- ctrl+t persisted history receives component arrays, not raw `SessionContext` string conversion.
- raw `Tool call ... JSON` is impossible in the main ctrl+t session path.
- read grouping, custom/skill/branch/compaction, bash/eval, and paired tool results are all represented by components.
- ctrl+o current-turn inline expansion is unchanged.
- Alt+T remains scoped to supplied tool components.
- focused tests and package/workspace gates pass.

## Residual H2 work

After H1:

- compare helper output to `UiHelpers.renderSessionContext()` output for representative sessions;
- move normal chat replay to the helper;
- remove duplicated logic;
- add regression tests around compaction rebuild and initial session render.
