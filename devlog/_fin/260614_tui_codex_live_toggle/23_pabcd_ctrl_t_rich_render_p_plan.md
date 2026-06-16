# PABCD P Plan — ctrl+t rich transcript rendering

Date: 2026-06-15

## Objective

Fix the remaining `ctrl+t` full transcript overlay rendering bug observed in screenshots:

- `ctrl+o` currently renders expected rich inline Bash/tool boxes for the current live turn.
- `ctrl+t` opens at the correct bottom/latest position, but persisted session history is rendered as raw script text, including `Tool call bash { ... JSON ... }` rows.
- The fix must make `ctrl+t` session-history rendering use rich component-style rendering for persisted Bash/tool execution output where possible, while preserving:
  - `ctrl+t` bottom-start and scroll-offset behavior from the previous PABCD cycle.
  - `ctrl+o` current-live-turn-only semantics.
  - `alt+t` tool-only transcript behavior.

## Current root cause

File: `packages/coding-agent/src/modes/components/full-transcript-overlay.ts`

Current session-source render path:

```ts
if (this.#source.kind === "components") {
  for (const item of this.#source.items) {
    lines.push(...this.#renderComponent(item, width));
  }
} else {
  lines.push(...sessionMessagesToTranscriptLines(this.#source.sessionContext.messages, width));
  lines.push(...this.#renderLiveTail(this.#source.liveItems, width));
}
```

`sessionMessagesToTranscriptLines()` manually converts persisted `AgentMessage` values to plain strings. For assistant tool calls it currently emits:

```ts
const args = toolCall.arguments === undefined ? "" : ` ${JSON.stringify(toolCall.arguments)}`;
lines.push(theme.fg("toolTitle", `Tool call ${toolCall.name}${args}`));
```

That is why the `ctrl+t` screenshot shows raw `Tool call bash {...}` JSON instead of rich Bash/tool output.

## Design decision

Keep `ctrl+t` as a TUI pager overlay, not an external window. Fix only the session-history rendering layer.

The fix must cover both persisted execution-message history and normal agent tool-call history:

1. Stop dumping raw assistant `toolCall` JSON in the default transcript.
2. Render persisted `bashExecution` messages with `BashExecutionComponent.renderFullTranscript(width)`.
3. Render persisted `pythonExecution` messages with `EvalExecutionComponent.renderFullTranscript(width)`.
4. Render normal assistant `toolCall` + persisted `toolResult` pairs through `ToolExecutionComponent.renderFullTranscript(width)` when assistant call arguments are available.
5. For orphan `toolResult` messages without a preceding assistant `toolCall`, keep a compact formatted fallback (`Tool <name>`, text output) but no raw call-args JSON dump.
6. Suppress assistant `toolCall` blocks by default in session transcript rendering; the visible execution/result messages are the user-facing transcript rows.
7. Assistant-only tool calls with no matching result are intentionally invisible in the default full transcript rather than rendering noisy raw args.

This directly addresses the user's screenshot: normal agent bash tool history is persisted as assistant `toolCall` plus `toolResult`, while local shell commands are persisted as `bashExecution`. Both visible shapes must render without raw `Tool call ... JSON` dumps.

## Diff-level plan

### MODIFY `packages/coding-agent/src/modes/components/full-transcript-overlay.ts`

#### Imports

Add component imports:

```ts
import { BashExecutionComponent } from "./bash-execution";
import { EvalExecutionComponent } from "./eval-execution";
import { ToolExecutionComponent } from "./tool-execution";
```

Add or use a narrow render-safe TUI adapter type if constructor typing requires it:

```ts
import type { TUI } from "@gajae-code/tui";
```

`ToolCall` is already imported in the current file from `@gajae-code/ai`; keep that type import because the shared pairing map is typed as `Map<string, ToolCall>`.

#### Add a render-safe TUI adapter

`BashExecutionComponent` and `EvalExecutionComponent` constructors need a `TUI`. The transcript overlay does not need a live renderer, so add a tiny adapter local to this file:

```ts
const TRANSCRIPT_RENDER_UI = {
  requestRender() {},
} as unknown as TUI;
```

This adapter is only used for temporary transcript components. It must not be exported.

#### Add message type guards/helpers

Add local structural helpers rather than broad `any`:

```ts
type BashTranscriptMessage = Extract<AgentMessage, { role: "bashExecution" }>;
type PythonTranscriptMessage = Extract<AgentMessage, { role: "pythonExecution" }>;
```

If `Extract` is not useful because `AgentMessage` is externally widened, use narrow structural helper functions with explicit field checks.

#### Render bashExecution via component

Before:

```ts
case "bashExecution":
  lines.push(theme.fg("toolTitle", `Bash $ ${message.command}`));
  if (message.output) lines.push(...message.output.split("\n"));
  break;
```

After:

```ts
case "bashExecution": {
  const component = new BashExecutionComponent(message.command, TRANSCRIPT_RENDER_UI, message.excludeFromContext);
  component.setComplete(message.exitCode, message.cancelled, {
    output: message.output,
    truncation: message.meta?.truncation,
  });
  lines.push(...component.renderFullTranscript(width));
  break;
}
```

Notes:

- Use `setComplete(..., { output })` rather than `appendOutput()` so the transcript receives the final full output without streaming throttling.
- Pass `message.meta?.truncation` if present.
- Keep `excludeFromContext` for no-context shell styling.

#### Render pythonExecution via component

Before:

```ts
case "pythonExecution":
  lines.push(theme.fg("toolTitle", "Eval"));
  if (message.output) lines.push(...message.output.split("\n"));
  break;
```

After:

```ts
case "pythonExecution": {
  const component = new EvalExecutionComponent(message.code, TRANSCRIPT_RENDER_UI, message.excludeFromContext);
  component.setComplete(message.exitCode, message.cancelled, {
    output: message.output,
    truncation: message.meta?.truncation,
  });
  lines.push(...component.renderFullTranscript(width));
  break;
}
```

`EvalExecutionComponent.setComplete(exitCode, cancelled, { output, truncation })` matches `BashExecutionComponent.setComplete`; implement the python path with that exact call shape.

#### Render paired toolResult via ToolExecutionComponent

Replace the top of `sessionMessagesToTranscriptLines()` with a shared pairing map in the same function body as both the assistant and `toolResult` branches:

Before:

```ts
function sessionMessagesToTranscriptLines(messages: AgentMessage[], width: number): string[] {
  const lines: string[] = [];
  for (const message of messages) {
    switch (message.role) {
      // existing cases
    }
  }
}
```

After:

```ts
function sessionMessagesToTranscriptLines(messages: AgentMessage[], width: number): string[] {
  const lines: string[] = [];
  const toolCallsById = new Map<string, ToolCall>();
  for (const message of messages) {
    switch (message.role) {
      case "assistant": {
        // existing thinking/text handling stays
        const toolCalls = content.filter((item): item is ToolCall => {
          // existing type guard stays
        });
        for (const toolCall of toolCalls) {
          toolCallsById.set(toolCall.id, toolCall);
        }
        // no visible toolCall rows
        break;
      }
      case "toolResult": {
        const call = toolCallsById.get(message.toolCallId);
        // paired ToolExecutionComponent branch shown below
        break;
      }
      // existing cases
    }
  }
}
```

The key invariant is map scope: `toolCallsById` is declared once before the message loop and is read by later `toolResult` cases in the same loop.

Before current `toolResult` branch:

```ts
case "toolResult": {
  lines.push(theme.fg("toolTitle", `Tool ${message.toolName}`));
  for (const part of message.content) {
    if (part.type === "text" && part.text) lines.push(...part.text.split("\n"));
  }
  break;
}
```

After:

```ts
case "toolResult": {
  const call = toolCallsById.get(message.toolCallId);
  if (call) {
    const component = new ToolExecutionComponent(
      message.toolName || call.name,
      call.arguments ?? {},
      { showImages: false },
      undefined,
      TRANSCRIPT_RENDER_UI,
      process.cwd(),
      message.toolCallId,
    );
    component.setArgsComplete(message.toolCallId);
    component.updateResult(
      { content: message.content, details: message.details, isError: message.isError },
      false,
      message.toolCallId,
    );
    lines.push(...component.renderFullTranscript(width));
    break;
  }

  // Orphan fallback: no args available, still avoid raw call JSON.
  lines.push(theme.fg("toolTitle", `Tool ${message.toolName}`));
  for (const part of message.content) {
    if (part.type === "text" && part.text) lines.push(...part.text.split("\n"));
  }
  break;
}
```

This branch is mandatory because the screenshot failure path for regular agent bash tools is assistant `toolCall` + `toolResult`, not only `bashExecution`.

`tool` is intentionally passed as `undefined` in this first pass. Built-in `toolRenderers` still apply by `toolName` (including `bash`), which covers the screenshot failure. Extension/custom `tool.renderCall` / `tool.renderResult` registry replay is a follow-up and is outside this patch's acceptance criteria.

#### Remove raw assistant toolCall JSON dump

Before:

```ts
for (const toolCall of toolCalls) {
  const args = toolCall.arguments === undefined ? "" : ` ${JSON.stringify(toolCall.arguments)}`;
  lines.push(theme.fg("toolTitle", `Tool call ${toolCall.name}${args}`));
}
```

After:

```ts
for (const toolCall of toolCalls) {
  toolCallsById.set(toolCall.id, toolCall);
}
```

This is map-only suppression: assistant `toolCall` blocks are implementation events, so the session transcript stores them for later `toolResult` replay but emits no visible call row and no no-op loop. Assistant text and thinking blocks still render normally.

#### Keep bottom-scroll behavior untouched

Do not modify:

- `#scrollInitialized`
- initial `#scroll = maxScroll`
- user scroll offset preservation
- `handleInput()` bindings

### MODIFY `packages/coding-agent/test/full-transcript-overlay.test.ts`

Add tests:

1. `renders session bash executions with rich component output`
   - Build a session source with one `bashExecution` message:

```ts
{
  role: "bashExecution",
  command: "printf 'tool-use-test-04\\n'",
  output: "tool-use-test-04\n",
  exitCode: 0,
  cancelled: false,
  truncated: false,
  timestamp: Date.now(),
}

```

The `truncated` boolean is included because it is part of `BashExecutionMessage`; truncation rendering is driven by `meta?.truncation` only when a test specifically constructs truncation metadata.

   - Render overlay.
   - Assert output contains:
     - `Bash` or `shell` label from component rendering.
     - `$ printf 'tool-use-test-04\\n'` or command text.
     - `tool-use-test-04`.
   - Assert output does not contain `Tool call bash {`.

2. `does not dump assistant toolCall JSON or noisy call markers in session transcript`
   - Build a session source with an assistant message containing a `toolCall` with args.
   - Render overlay.
   - Assert output does not contain `Tool call bash`.
   - Assert output does not contain JSON fields like `"command":"printf` or `{` args dump.

3. `combined assistant toolCall plus bashExecution renders only the rich execution block`
   - Build a session source with an assistant message containing a bash `toolCall` followed by the corresponding `bashExecution` message.
   - Render overlay.
   - Assert output contains the rich Bash execution output and command.
   - Assert output does not contain `Tool call bash`, raw JSON args, or duplicate call-marker noise.

4. `renders paired assistant toolCall plus toolResult through ToolExecutionComponent`
   - Build a session source with assistant `toolCall` `{ id: "tool-1", name: "bash", arguments: { command: "printf 'tool-use-test-04\\n'" } }` followed by `toolResult` with matching `toolCallId`, `toolName: "bash"`, and text output `tool-use-test-04`.
   - Render overlay.
   - Assert output contains a rich tool block title (`Bash` or `bash`), the command, and `tool-use-test-04`.
   - Assert output does not contain `Tool call bash`, raw JSON args, or duplicate call-marker noise.

5. `assistant-only toolCall remains invisible and non-JSON`
   - Build a session source with an assistant message containing a `toolCall` and no following `toolResult`/execution message.
   - Assert no `Tool call ...` marker and no raw JSON args are rendered.
   - This documents the intentional invisibility decision for implementation-only events with no visible result.

6. `orphan toolResult keeps compact non-JSON fallback`
   - Build a session source with a lone `toolResult` and no preceding assistant `toolCall`.
   - Assert output contains `Tool <name>` and the text result.
   - Assert output does not contain raw call-args JSON.



7. `renders session python executions with rich component output`
   - Build a session source with one `pythonExecution` message containing code/output/exit status.
   - Render overlay.
   - Assert output contains an eval/python title, the code or evaluator label, and the actual output.
   - Assert output is not just the old plain `Eval` + raw output fallback.

8. `keeps bottom-start behavior with rich session rendering`
   - Use a deterministic long session with 60 `bashExecution` messages where each message has exactly one unique output line: `rich-bottom-00` through `rich-bottom-59`.
   - Render at fixed width.
   - Assert first render contains `rich-bottom-59`.
   - Assert first render does not contain `rich-bottom-00`.
   - Do not rely on Bash frame line counts for the assertion; the unique one-line marker per message is the stable viewport sentinel.
   - This mirrors the existing line-0/line-59 viewport tests but proves the component-based session renderer still honors bottom-start.

Keep existing tests and ensure they still run in the focused command:

- committed component direct rendering.
- `renderFullTranscript` protocol and state restore.
- close keys.
- session-before-live-tail order.
- bottom-start/upward-scroll/offset/fresh-instance tests from the prior cycle; for rich session rendering, use a deterministic long transcript (for example 60 bash messages) and assert latest output appears while earliest output is outside the first viewport.
- `input-controller-keybindings.test.ts` remains in the focused command as the named `ctrl+o` unchanged scenario.
- `alt+t` behavior is guarded by `keybindings-display.test.ts` and `packages/coding-agent/test/modes/components/tool-execution-minimize.test.ts`: assert `app.tools.transcript` remains `Alt+T`, `app.transcript.full` remains `Ctrl+T`, and `ToolTranscriptOverlayComponent` still renders tool-only transcript content independent of full transcript.
- Add or retain an assertion in `packages/coding-agent/test/modes/components/tool-execution-minimize.test.ts` that `ToolTranscriptOverlayComponent` renders only the supplied `ToolExecutionComponent[]`; it must not read session messages or include full transcript rows.

### MODIFY `devlog/_plan/260614_tui_codex_live_toggle/22_followup_ctrl_t_rendering_gap.md`

Append an implementation status section after B/C:

- Code files changed.
- Tests added.
- Verification commands/results.

### NEW `devlog/_plan/260614_tui_codex_live_toggle/24_b_ctrl_t_rich_render_implementation.md`

B-stage evidence:

- Exact implementation summary.
- Rich renderer behavior.
- Before/after UX statement.

### NEW `devlog/_plan/260614_tui_codex_live_toggle/25_c_ctrl_t_rich_render_check.md`

C-stage evidence:

- Focused test command/result.
- Typecheck/root-check result.
- Acceptance criteria audit.

## Non-goals

- Do not change `ctrl+o` expand/collapse behavior.
- Do not change `ctrl+t` keybinding or bottom-start scroll behavior.
- Do not implement an external OS window/transcript viewer in this patch.
- Do not attempt full custom tool reconstruction for every possible tool in this first rich-rendering pass.
- Do not emit raw tool args JSON in the default full transcript view.

## Acceptance criteria

1. `ctrl+t` still opens at bottom/latest.
2. Persisted `bashExecution` messages render with rich component-style output rather than plain `Bash $ ...` rows.
3. Persisted `pythonExecution` messages render through `EvalExecutionComponent.renderFullTranscript(width)` using the real `setComplete(exitCode, cancelled, { output, truncation })` signature from `eval-execution.ts`.
4. Paired assistant `toolCall` + `toolResult` history renders through `ToolExecutionComponent.renderFullTranscript(width)` when call args are available.
5. Orphan `toolResult` messages keep a compact fallback and do not dump raw call args JSON.
6. Assistant `toolCall` content no longer dumps raw JSON args in the full transcript overlay.
7. Assistant-only `toolCall` markers are suppressed by default so rich execution/result blocks are not duplicated by noisy call rows.
8. The user's screenshot failure shape (`Tool call bash {"_i":...}` raw JSON lines) is covered by a regression test.
9. `ctrl+o` tests remain green and behavior unchanged (`input-controller-keybindings.test.ts` focused scenario).
10. `alt+t` tool-only transcript mapping/behavior remains unchanged (`app.tools.transcript` stays `Alt+T`; `ToolTranscriptOverlayComponent` remains supplied-tools-only).
11. Focused `full-transcript-overlay` tests pass.
12. Focused related TUI/keybinding tests pass.
13. `bun --cwd=packages/coding-agent run check:types` passes.
14. `bun run check` must pass. If an unrelated pre-existing warning appears but the command exits 0, record it; a non-zero exit is not acceptable for completion.

## Verification plan

Run focused tests:

```bash
bun test \
  packages/coding-agent/test/full-transcript-overlay.test.ts \
  packages/coding-agent/test/input-controller-keybindings.test.ts \
  packages/coding-agent/test/modes/controllers/event-controller-message-start.test.ts \
  packages/coding-agent/test/keybindings-display.test.ts \
  packages/coding-agent/test/keybindings-migration.test.ts \
  packages/coding-agent/test/modes/controllers/command-controller-hotkeys.test.ts \
  packages/coding-agent/test/thinking-collapse.test.ts \
  packages/coding-agent/test/modes/components/tool-execution-minimize.test.ts
```

The final focused command intentionally includes `packages/coding-agent/test/modes/components/tool-execution-minimize.test.ts` because that file covers `ToolTranscriptOverlayComponent`, the `alt+t` tool-only transcript surface.

Run package typecheck:

```bash
bun --cwd=packages/coding-agent run check:types
```

Run root gate:

```bash
bun run check
```

## Risks and mitigations

- Risk: `BashExecutionComponent`/`EvalExecutionComponent` constructors expect a real `TUI`.
  - Mitigation: use a narrow `TRANSCRIPT_RENDER_UI` adapter with `requestRender()` only, then run focused tests and typecheck. If constructors require more, add only the minimal no-op members required.
- Risk: assistant toolCall markers could create visual clutter next to rich execution blocks.
  - Mitigation: suppress assistant toolCall markers by default in the session transcript and require tests to prove no `Tool call bash` marker or raw JSON is emitted for the combined assistant-toolCall + bashExecution fixture.
- Risk: recreating components in `#transcriptLines()` has cost for very large histories.
  - Mitigation: overlay already caches rendered lines by width; component reconstruction happens only on cache miss.
