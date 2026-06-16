# C Check — ctrl+o/t follow-up

Date: 2026-06-15

## Mechanical gates

### Focused tests

Command:

```bash
bun test packages/coding-agent/test/full-transcript-overlay.test.ts packages/coding-agent/test/input-controller-keybindings.test.ts packages/coding-agent/test/modes/controllers/event-controller-message-start.test.ts packages/coding-agent/test/keybindings-display.test.ts packages/coding-agent/test/keybindings-migration.test.ts packages/coding-agent/test/modes/controllers/command-controller-hotkeys.test.ts packages/coding-agent/test/thinking-collapse.test.ts
```

Result:

```text
46 pass
0 fail
227 expect() calls
Ran 46 tests across 7 files.
```

### Package typecheck

Command:

```bash
bun --cwd=packages/coding-agent run check:types
```

Result:

```text
$ tsgo -p tsconfig.json --noEmit
```

Exit code: 0.

### Root check

Command:

```bash
bun run check
```

Result: exit code 0.

Notes:

- Biome reports existing `noUnusedVariables` warnings in `packages/coding-agent/src/task/index.ts` for unused actor-lifecycle helper functions, but the command exits successfully.
- Rust scope check, Node 20 baseline guard, JSON schema check, UI redesign/rebrand gates, package checks, and typechecks completed successfully.

## Acceptance audit

- AC1 `ctrl+t` opens at bottom/latest: PASS — `#scrollInitialized` first render sets `#scroll = maxScroll`; tests cover `line-59` visible and `line-0` absent on first render.
- AC2 offset preservation: PASS — same overlay instance preserves user-scrolled top position; fresh overlay re-pins bottom.
- AC3 scroll upward/close keys: PASS — tests cover `g` upward navigation and existing `escape`/`q`/`ctrl+t` close.
- AC4 `ctrl+o` eligible-only: PASS — chat and live-zone fake ineligible components are untouched.
- AC5 streaming `toolCall` eligibility: PASS — `event-controller.ts` marks streaming-created tool component live-toggle eligible.
- AC6 streaming regression test: PASS — `event-controller-message-start.test.ts` asserts `liveToggleEligible === true` on the created `ToolExecutionComponent`.
- AC7 expanded current turn commits as-is: PASS — focused test captures expanded render before marking ineligible and proves later `ctrl+o` does not collapse it.
- AC8 previous committed turns excluded: PASS — `setToolsExpanded()` gates both containers by `isLiveToggleEligible`; commit path marks components false.
- AC9 focused tests: PASS.
- AC10 package typecheck: PASS.
- AC11 root check: PASS.

## Residual risks

- `ctrl+o` remains bound to terminal scrollback realities: once a turn is committed, neither expand nor collapse is possible. This is intended and documented in `structure/31_scroll.md`.
- `packages/coding-agent/src/task/index.ts` contains pre-existing unused actor-lifecycle helper warnings. They do not fail the gate but remain cleanup debt outside this ctrl+o/t patch.
