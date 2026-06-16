# Follow-up — ctrl+t full transcript rendering gap

Date: 2026-06-15

## User-observed behavior

After the ctrl+o/ctrl+t follow-up patch, live testing with 10 tool uses showed:

- `ctrl+o` behaves as expected.
  - It expands the current live turn inline.
  - Tool output renders with the existing rich TUI component style: boxed Bash blocks, title line, output divider, timeout/status rows.
- `ctrl+t` opens at the correct bottom/latest position, but the rendering is not acceptable.
  - It renders session history as raw script-like lines:
    - `Assistant`
    - `Tool call bash { ... JSON ... }`
    - `Tool bash`
    - raw output text
  - It does not reuse the rich tool/assistant component renderers, so it lacks the visual structure users expect from `ctrl+o`.

Screenshot evidence supplied by user:

- Screenshot 1 (`ctrl+t`): raw transcript-style rendering with `Tool call bash {...}` JSON lines.
- Screenshot 2 (`ctrl+o`): expected rich boxed Bash rendering.

## Root cause

File: `packages/coding-agent/src/modes/components/full-transcript-overlay.ts`

The current `FullTranscriptOverlayComponent` has two render paths:

1. `components` source
   - Uses actual TUI components.
   - Calls `renderFullTranscript(width)` when available, otherwise `render(width)`.
   - This path can preserve rich rendering.
2. `session` source
   - Calls `sessionMessagesToTranscriptLines(sessionContext.messages, width)`.
   - That function manually converts persisted `AgentMessage` objects to plain strings.
   - For assistant tool calls, it emits raw JSON-ish `Tool call ${name} ${JSON.stringify(args)}` lines.
   - For tool results/bash executions, it emits simplified text rows.

Therefore `ctrl+t` is bottom-correct but visually wrong whenever it relies on persisted `sessionContext.messages` rather than live component objects.

## Desired behavior

`ctrl+t` should remain a full transcript pager, but session-history rendering should be component-based or component-equivalent:

- Bash/tool executions should render like the `ctrl+o` expanded view where possible:
  - boxed tool block
  - tool title (`✓ Bash` etc.)
  - command line
  - `Output` section
  - timeout/status metadata where available
- Assistant text/thinking should avoid raw implementation labels where possible.
- Raw `Tool call ... {JSON}` lines should not be the default user-facing transcript rendering.
- The overlay should still open at bottom/latest and preserve scroll offset while open.
- `ctrl+o` current-turn behavior should remain unchanged.

## Proposed implementation direction

### Primary approach: replay persisted messages into render components for overlay rendering

Modify `full-transcript-overlay.ts` so the session source does not render via `sessionMessagesToTranscriptLines()` directly for renderable message types.

Possible design:

1. Add a helper that converts `AgentMessage` to temporary transcript components:
   - `assistant` → `AssistantMessageComponent`
     - call `updateContent(message)`
     - call `setStreaming(false)`
     - call `renderFullTranscript(width)` if present
   - `bashExecution` → `BashExecutionComponent`
     - construct with command/exclude flag/ui-like renderer context as needed
     - append output
     - set complete state
     - render full/expanded transcript
   - `pythonExecution` → `EvalExecutionComponent`
   - `toolResult` / generic tool messages → `ToolExecutionComponent` when enough metadata exists, otherwise formatted fallback
   - `custom` / `hookMessage` / `branchSummary` / `compactionSummary` → existing message components where possible
2. Use component renderers in the full transcript overlay cache.
3. Keep a conservative fallback for unsupported persisted message shapes, but make it prettier than raw JSON:
   - hide raw `Tool call` JSON by default
   - show `Tool call <name>` only when no rendered result exists
   - optionally include args only in a dim/compact line, not as a giant raw JSON row

### Important constraints

- Do not route `ctrl+t` through `ctrl+o` or mutate live chat state.
- Do not make `ctrl+t` operate on terminal scrollback pixels.
- Do not change `ctrl+o` semantics; it remains current-live-turn-only.
- Avoid requiring real `InteractiveModeContext` inside overlay components unless unavoidable. If component constructors need `ui`, pass a narrow render-safe adapter or add pure transcript render helpers to the components.
- Preserve scroll behavior implemented in the previous patch:
  - first render bottom-pins
  - user offset preserved
  - fresh overlay re-pins bottom

## Test plan for the rendering fix

Add/extend tests in `packages/coding-agent/test/full-transcript-overlay.test.ts`:

1. Session-source bash execution renders rich transcript output
   - Build a session context containing a `bashExecution` message with command/output/exit code.
   - Render `FullTranscriptOverlayComponent` with `kind: "session"`.
   - Assert output contains rich tool markers like `Bash`, command, `Output`, and actual output.
   - Assert output does **not** contain raw `Tool call bash {` JSON.

2. Session-source assistant tool call avoids raw JSON by default
   - Build assistant message with `toolCall` content plus matching tool result or bash execution.
   - Assert default transcript view does not dump raw JSON args as the primary row.

3. Existing bottom-start tests remain green
   - `opens long transcripts at the bottom`
   - `can scroll upward after opening at the bottom`
   - `preserves user scroll offset`
   - `fresh overlay instances re-pin to bottom`

4. Existing `ctrl+o` tests remain green
   - Ensure this rendering refactor does not touch `InputController.toggleToolOutputExpansion()` semantics.

## Acceptance criteria

- `ctrl+t` opens at bottom/latest as before.
- `ctrl+t` session history renders tool/bash output in a rich component-style format, not raw `Tool call ... JSON` dumps.
- `ctrl+o` current live-turn inline rendering remains unchanged.
- Tests prove the session-source renderer output shape.
- Focused tests and package typecheck pass.

## Status

Implemented in the follow-up PABCD B-stage.

Evidence:

- Implementation record: `devlog/_plan/260614_tui_codex_live_toggle/24_b_ctrl_t_rich_render_implementation.md`
- Source: `packages/coding-agent/src/modes/components/full-transcript-overlay.ts`
- Tests: `packages/coding-agent/test/full-transcript-overlay.test.ts`, `packages/coding-agent/test/modes/components/tool-execution-minimize.test.ts`
- Focused test result: `59 pass / 0 fail / 275 expect() calls` for the ctrl+t/ctrl+o/keybinding/tool-overlay regression set.

The remaining C-stage work is package/root gate verification and adversarial review.
