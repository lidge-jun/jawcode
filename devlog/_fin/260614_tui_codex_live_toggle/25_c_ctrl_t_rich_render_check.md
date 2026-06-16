# C-stage check — ctrl+t rich transcript rendering

Date: 2026-06-15

## Mechanical gates

### Affected regression tests

Command:

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

### Package typecheck

Command:

```bash
bun --cwd=packages/coding-agent run check:types
```

Result: passed (`tsgo -p tsconfig.json --noEmit`).

### Workspace check

Command:

```bash
bun run check
```

Result: passed.

Evidence highlights:

```text
Checked 2267 files in 1367ms. No fixes applied.
Node 20 baseline guard passed.
GJC UI redesign verification passed.
Rebrand inventory ... unexpected: []
Rust scope check passed
@gajae-code/coding-agent check: Exited with code 0
Done in 9.21s
```

## Adversarial review

Reviewed the relevant diff against the P-stage acceptance criteria:

- `ctrl+t` persisted `bashExecution` rows now reconstruct `BashExecutionComponent` and call `renderFullTranscript(width)`.
- paired assistant `toolCall` + `toolResult` rows now reconstruct `ToolExecutionComponent`; the raw `Tool call bash { ... }` dump was removed from the session renderer.
- assistant-only `toolCall` rows are stored in a map for later pairing and are not emitted as raw JSON.
- orphan `toolResult` rows use a compact `Tool <name>` fallback plus text output only.
- persisted `pythonExecution` rows now reconstruct `EvalExecutionComponent` and call `renderFullTranscript(width)`.
- `ctrl+t` bottom-start behavior remains covered by component-source and rich session-source tests.
- `ctrl+o` current-turn behavior remains on the separate live component path and focused keybinding/controller tests still pass.
- `Alt+T` remains a scoped tool transcript overlay; added regression coverage prevents it from becoming a full-session transcript.

## Residual risks

- Custom extension tool renderers that require a live `Tool` object are not fully replayed from persisted session messages. Built-in `bash` rendering, which caused the user-visible bug, is covered by tests and the verifier accepted this as a future hardening point.

## Verdict

C-stage check is green. Proceed to D-stage closeout.
