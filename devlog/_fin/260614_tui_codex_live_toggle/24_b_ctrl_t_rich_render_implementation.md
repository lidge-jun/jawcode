# B-stage implementation — ctrl+t rich transcript rendering

Date: 2026-06-15

## Scope

Implemented the PABCD B-stage fix for `ctrl+t` full transcript overlay rendering:

- persisted `bashExecution` messages now render through `BashExecutionComponent.renderFullTranscript()`;
- persisted `pythonExecution` messages now render through `EvalExecutionComponent.renderFullTranscript()`;
- paired assistant `toolCall` + `toolResult` messages now render through `ToolExecutionComponent.renderFullTranscript()` instead of dumping raw `Tool call ... JSON` rows;
- assistant-only `toolCall` records are stored for later pairing and are not printed as raw JSON by themselves;
- orphan `toolResult` messages keep a compact non-JSON fallback;
- `ctrl+t` bottom-pin / scroll behavior remains unchanged;
- `ctrl+o` current-turn component rendering remains separate and unchanged.

## Changed files

- `packages/coding-agent/src/modes/components/full-transcript-overlay.ts`
  - added transcript-safe component replay for persisted session messages.
  - added a narrow no-op `TUI` adapter used only for rendering reconstructed transcript components.
  - retained the existing live component path for `ctrl+o`/live-tail behavior.
- `packages/coding-agent/test/full-transcript-overlay.test.ts`
  - added session-source regression coverage for rich Bash rendering, paired toolCall/toolResult replay, assistant-only toolCall suppression, orphan toolResult fallback, Eval rendering, and bottom-start behavior with rich session rows.
- `packages/coding-agent/test/modes/components/tool-execution-minimize.test.ts`
  - added coverage that the `Alt+T` tool transcript overlay remains scoped to supplied tool components and does not become the full session transcript.

## Focused verification

Ran:

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

Result:

```text
59 pass
0 fail
275 expect() calls
```

## Notes

`ToolExecutionComponent` is reconstructed with `tool` as `undefined`; built-in renderers still apply by `toolName` for known tools such as `bash`. Custom extension tool renderers that require a live `Tool` object remain a possible future hardening point, but the user-reported Bash/raw-JSON failure is fixed at the persisted transcript source.
