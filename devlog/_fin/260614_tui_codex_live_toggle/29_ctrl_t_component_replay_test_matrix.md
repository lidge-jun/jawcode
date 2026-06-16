# Test matrix — ctrl+t shared component replay hardening

Date: 2026-06-15

## Purpose

This matrix defines verification for the deeper ctrl+t replay hardening pass: persisted session history should be converted to actual transcript components before the overlay renders it.

The matrix intentionally goes beyond the completed Bash/raw-JSON fix.

## Unit tests for the replay helper

Target file:

- `packages/coding-agent/test/session-transcript-replay.test.ts`

### 1. Assistant text before and after tool calls keeps order

Fixture:

- assistant message content: text A, toolCall, text B
- matching toolResult after assistant

Assertions:

- returned components order is assistant segment A → tool component → assistant segment B.
- no raw JSON strings are produced by helper.

### 2. Paired toolCall/toolResult creates ToolExecutionComponent

Fixture:

- assistant toolCall `{ id: "tool-1", name: "bash", arguments: { command: "printf 'x\\n'" } }`
- toolResult `{ toolCallId: "tool-1", toolName: "bash", content: [{ type: "text", text: "x\n" }] }`

Assertions:

- component array contains a tool execution component.
- rendering via `renderFullTranscript(width)` contains tool title, command marker, and output.
- rendering does not contain `Tool call bash {` or raw compact JSON args.

### 3. Assistant-only toolCall does not dump JSON

Fixture:

- assistant message with only toolCall and no result.

Assertions:

- helper may return a pending/incomplete tool component or no visible component depending on chosen behavior, but it must not render raw JSON.
- no arbitrary `JSON.stringify(arguments)` row appears.

### 4. Read tool grouping parity

Fixture:

- assistant message with two `read` toolCalls targeting filesystem paths.
- two matching toolResult messages.

Assertions:

- returned components include a `ReadToolGroupComponent` or equivalent grouped render.
- both read targets/results are represented.
- internal URI read calls are excluded from grouping when `readArgsTargetInternalUrl` returns true.

### 5. Assistant thinking full transcript expansion

Fixture:

- assistant message with thinking block and text block.

Assertions:

- `renderFullTranscript(width)` output includes the thinking body.
- historical replay does not depend on current live `thinkingExpanded` state unless `options.live === true`.

### 6. Error/abort stop synthesizes pending tool result

Fixture:

- assistant message with toolCall and `stopReason: "error"` or non-silent `aborted`.

Assertions:

- helper updates the pending tool component with an error result.
- silent abort remains silent when `isSilentAbort(errorMessage)` applies.

### 7. Custom/skill/branch/compaction messages preserve components

Fixture:

- `custom`, skill prompt marker, `branchSummary`, and `compactionSummary` messages.

Assertions:

- helper returns the same component classes as normal `addMessageToChat` path.
- full transcript rendering contains expected display text without degrading to dim raw role labels.

## Overlay tests

Target file:

- `packages/coding-agent/test/full-transcript-overlay.test.ts`

### 1. Session source renders historicalItems before liveItems

Fixture:

- `historicalItems: [fakeComponent(["HISTORICAL_COMPONENT"])]`
- `liveItems: [fakeComponent(["LIVE_COMPONENT"])]`

Assertions:

- output contains both.
- historical marker appears before live marker.

### 2. Bottom-open behavior with historical component replay

Fixture:

- 60 historical rich components or replayed tool components.

Assertions:

- first render contains latest/bottom marker.
- first render does not contain earliest marker.
- `g` scroll moves to top.
- fresh overlay instance re-pins bottom.

### 3. Overlay remains dumb renderer

Assertions:

- `FullTranscriptOverlayComponent` no longer imports execution component classes directly after full extraction.
- overlay source does not accept raw `SessionContext` unless a migration fallback remains intentionally documented.

## Controller/keybinding tests

Existing files:

- `packages/coding-agent/test/input-controller-keybindings.test.ts`
- `packages/coding-agent/test/keybindings-display.test.ts`
- `packages/coding-agent/test/modes/controllers/command-controller-hotkeys.test.ts`
- `packages/coding-agent/test/thinking-collapse.test.ts`

Assertions to preserve:

- `ctrl+t` opens/closes full transcript overlay.
- `ctrl+o` toggles current live-turn output only.
- thinking key mapping remains removed/empty if current product decision stays in force.
- `Alt+T` remains separate tool transcript overlay.

## Manual QA

Recommended TUI scenario:

1. Start a fresh JWC TUI session.
2. Run a prompt that triggers 10 bash tool calls.
3. Press `ctrl+o` during/current turn and confirm rich inline tool blocks remain unchanged.
4. Press `ctrl+t` after completion and confirm:
   - overlay opens at bottom/latest;
   - Bash blocks render as rich boxed components;
   - no `Tool call bash { ... }` JSON lines appear;
   - page up/g/G navigation works;
   - closing with `ctrl+t`, `q`, and `esc` works.
5. Run a read-heavy prompt and confirm read outputs group similarly to normal chat.

## Gate commands

Focused tests:

```bash
bun test \
  packages/coding-agent/test/session-transcript-replay.test.ts \
  packages/coding-agent/test/full-transcript-overlay.test.ts \
  packages/coding-agent/test/input-controller-keybindings.test.ts \
  packages/coding-agent/test/keybindings-display.test.ts \
  packages/coding-agent/test/modes/controllers/command-controller-hotkeys.test.ts \
  packages/coding-agent/test/thinking-collapse.test.ts \
  packages/coding-agent/test/modes/components/tool-execution-minimize.test.ts \
  packages/coding-agent/test/read-tool-group.test.ts
```

Package check:

```bash
bun --cwd=packages/coding-agent run check:types
```

Workspace check:

```bash
bun run check
```
