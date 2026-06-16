# 51 Reopen — bottom-start Ctrl+T tail expansion fix

## Trigger

The previous top-start experiment was wrong: Ctrl+T full transcript should remain pinned to the latest/bottom by default. The user confirmed Ctrl+T enters the overlay, but the bottom/latest viewport still looked like Ctrl+O scope with collapsed rows such as `Thinking … +N lines` and `Bash: command=...`.

## External review input

ChatGPT Pro adversarial review identified three likely runtime leaks while preserving bottom-start behavior:

1. `buildSessionTranscriptComponents()` can replay assistant `toolCall` stubs and later first-class `bashExecution` / `pythonExecution` messages as separate rows.
2. `InputController.showFullTranscript()` appends live surfaces after historical replay; committed/frozen tail rows can dominate the bottom viewport.
3. `FullTranscriptOverlayComponent` should pad its body to the requested overlay height so old base/scrollback pixels are not visually confused with overlay content.

## Patch

- `packages/coding-agent/src/modes/utils/session-transcript-replay.ts`
  - Changed replay loop to index-based traversal.
  - Added conservative matching for assistant `bash`/`eval` tool calls followed by a matching dedicated `bashExecution`/`pythonExecution` message before the next assistant/user/developer boundary.
  - Renders the rich dedicated execution at the original tool-call position and consumes the later dedicated message to prevent duplicate/stub rows.
  - Keeps normal `toolResult` pairs on the existing `ToolExecutionComponent` path.
- `packages/coding-agent/src/modes/controllers/input-controller.ts`
  - Filters committed components out of Ctrl+T session live tail (`liveToolContainer`, hidden-history fallback chat tail, and streaming component).
  - Leaves non-session component fallback and Ctrl+O behavior unchanged.
- `packages/coding-agent/src/modes/components/full-transcript-overlay.ts`
  - Keeps initial scroll at `maxScroll`.
  - Pads short overlay bodies to the supplied full-screen height.
- Tests:
  - Strengthened full transcript tests against screenshot-style `Bash: command=` stubs.
  - Asserted dedicated toolCall + bashExecution collapses to a single rich replay entry.
  - Added committed live-tail exclusion through the real `InputController.showFullTranscript()` path.
  - Added overlay height padding coverage.

## Verification

- Focused suites:
  - `bun test packages/coding-agent/test/full-transcript-overlay.test.ts packages/coding-agent/test/input-controller-keybindings.test.ts packages/coding-agent/test/session-transcript-replay.test.ts`
  - Result: 58 pass, 0 fail, 248 expect calls.
- Changed-file check:
  - `bunx biome check packages/coding-agent/src/modes/components/full-transcript-overlay.ts packages/coding-agent/src/modes/controllers/input-controller.ts packages/coding-agent/src/modes/utils/session-transcript-replay.ts packages/coding-agent/test/full-transcript-overlay.test.ts packages/coding-agent/test/input-controller-keybindings.test.ts`
  - Result: OK.
- Package check:
  - `bun --cwd=packages/coding-agent run check`
  - Result: Biome checked 1659 files; `tsgo -p tsconfig.json --noEmit` passed.
- Current-session replay probe after patch:
  - Header stayed bottom-start: `Full transcript (..., 39184–39211/39211)`.
  - `Thinking … +N lines`: false.
  - `Bash: command=` stub count: 0.
  - `ctrl+o to expand`: false.

## Manual QA expectation

Ctrl+T should still open at the latest/bottom. The visible bottom viewport should no longer be polluted by committed/frozen Ctrl+O-style rows or duplicate generic bash/eval tool-call stubs. Ctrl+O remains current-turn-only.
