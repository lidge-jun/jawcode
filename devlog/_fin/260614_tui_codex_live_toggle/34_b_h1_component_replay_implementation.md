# B-stage implementation — H1 ctrl+t component replay hardening

Date: 2026-06-15

## Objective

Implement H1 for `ctrl+t` full transcript overlay: replay persisted session history as detached component objects, not as raw transcript strings, while preserving `ctrl+o` current-turn expansion and `Alt+T` tool transcript behavior.

## Implementation

### New side-effect-light replay builder

Added `packages/coding-agent/src/modes/utils/session-transcript-replay.ts`.

The builder exports `buildSessionTranscriptComponents(sessionContext, deps, { mode: "transcript" })` and converts persisted `SessionContext.messages` into historical `Component[]` items. It deliberately rejects `{ mode: "chat" }` so the first version cannot be accidentally reused for normal scrollback hydration without a separate audit.

Replay coverage implemented:

- user/developer messages via `UserMessageComponent`;
- assistant text/thinking segments via `AssistantMessageComponent`, split around tool calls so text → tool → text ordering is preserved;
- paired non-read tool calls/results via `ToolExecutionComponent`, with args completed and results applied;
- read tool calls/results via `ReadToolGroupComponent`, including grouped multi-read output and optional content preview;
- orphan tool results via compact non-JSON `Text` fallback;
- persisted `bashExecution` via `BashExecutionComponent`;
- persisted `pythonExecution` via `EvalExecutionComponent`;
- custom messages via `CustomMessageComponent`, skill prompt messages via `SkillMessageComponent`, async job summaries as compact text rows, and IRC rows as compact text rows;
- branch and compaction summaries via their existing rich components;
- file mentions as compact read rows.

All replay-created components are marked `markLiveToggleEligible(component, false)` so `ctrl+o` remains scoped to the live/current turn and cannot mutate historical detached replay objects.

### Full transcript overlay source model

Updated `packages/coding-agent/src/modes/components/full-transcript-overlay.ts`.

The overlay no longer owns active-session string rendering. Its source type is now either:

- `{ kind: "components", items }` for legacy/live component-only rendering; or
- `{ kind: "session", historicalItems, liveItems, itemCount }` for the H1 path.

Rendering now concatenates `historicalItems` and `liveItems`, preferring each component's `renderFullTranscript(width)` when available. Bottom-open scroll behavior, `g/G`, page scroll, `ctrl+t/q/esc` close behavior, and header item-count display remain in the overlay.

### Input controller wiring

Updated `packages/coding-agent/src/modes/controllers/input-controller.ts`.

`showFullTranscript()` now:

- collects live current-turn components from `chatContainer` when they are `liveToggleEligible`;
- appends live tool-container components without duplicating chat items;
- appends `streamingComponent` even when it is already present in `chatContainer`, so in-flight assistant text remains visible on the session-source `ctrl+t` path;
- builds persisted historical components from `session.buildDisplaySessionContext()` with the new replay builder;
- passes `{ kind: "session", historicalItems, liveItems, itemCount }` when persisted messages exist;
- preserves `{ kind: "components", items }` for component-only sessions;
- leaves `ctrl+o` live expansion/collapse implementation untouched.

### Regression tests

Updated/added:

- `packages/coding-agent/test/session-transcript-replay.test.ts`
  - assistant segmentation around tools;
  - rich paired tool/bash rendering with no raw `Tool call ... JSON` output;
  - read grouping and preview wiring;
  - orphan tool result fallback;
  - custom/skill/branch/compaction rendering and non-live eligibility;
  - bash/eval/thinking/long-line rendering;
  - explicit rejection of chat mode.
- `packages/coding-agent/test/full-transcript-overlay.test.ts`
  - session source now uses historical/live component arrays and explicit item counts.
- `packages/coding-agent/test/input-controller-keybindings.test.ts`
  - theme initialization added so the controller-level `ctrl+t` path can instantiate rich replay components in tests.
  - added a session-source live-tail regression that proves live chat, live tool, and streaming components render while committed chat components do not duplicate historical replay.

## Incidental check fixes

The full workspace gate exposed pre-existing/generated hygiene failures while verifying this slice. Fixed them as part of getting the verification gate green:

- `packages/coding-agent/src/modes/components/model-selector.ts`
  - removed an impossible role comparison that blocked `packages/coding-agent` typecheck.
- `packages/coding-agent/test/system-prompt-templates.test.ts`
- `packages/coding-agent/test/task-fork-context.test.ts`
  - applied Biome-only wrapping fixes surfaced by `bun run check`.
- `schemas/config.schema.json`
- `schemas/models.schema.json`
  - regenerated with `bun run generate-schemas` after `bun run check` reported stale schemas.
- `packages/coding-agent/src/session/session-manager.ts`
  - narrowed `prepareEntryForResidentSync()` back to `SessionMessageEntry` before assigning `.message`, fixing a typecheck failure in a pre-existing resident-entry sync helper.
- `packages/coding-agent/src/jwc-runtime/goal-mode-request.ts`
- `packages/coding-agent/src/jwc-runtime/goal-engine.ts`
- `packages/coding-agent/src/jwc-runtime/goal-cli.ts`
  - applied Biome/typecheck cleanup exposed by workspace verification in existing goal-mode code.

## Verification

Focused regression suite:

```bash
bun test packages/coding-agent/test/session-transcript-replay.test.ts packages/coding-agent/test/full-transcript-overlay.test.ts packages/coding-agent/test/input-controller-keybindings.test.ts packages/coding-agent/test/keybindings-display.test.ts packages/coding-agent/test/modes/controllers/command-controller-hotkeys.test.ts packages/coding-agent/test/thinking-collapse.test.ts packages/coding-agent/test/modes/components/tool-execution-minimize.test.ts packages/coding-agent/test/read-tool-group.test.ts packages/coding-agent/test/modes/utils/render-initial-messages-dedupe.test.ts
```

Result:

```text
87 pass
0 fail
360 expect() calls
```

Package typecheck:

```bash
bun --cwd=packages/coding-agent run check:types
```

Result:

```text
$ tsgo -p tsconfig.json --noEmit
```

Workspace check:

```bash
bun run check
```

Result:

```text
Checked 2275 files in 888ms. No fixes applied.
Rust scope check passed.
[OK] Node 20 baseline guard passed.
GJC UI redesign verification passed.
... package checks ...
Done in 6.16s
```

Verifier review:
 
```text
74-H1ComponentReplayVerifier initially returned NEEDS_FIX for missing session-source live tail.
The live-tail gap was fixed by collecting live-toggle-eligible chat components, live tool-container components, and streamingComponent into `liveItems`; the focused regression suite now includes that case.
```
A later C-stage adversarial review requested additional controller/replay coverage; the test suite was expanded accordingly:
- controller dependency wiring and `itemCount` header assertions;
- `showFullTranscript()` empty-historical replay with live-only tail;
- replay edge cases for synthetic error results, internal-URL reads, image-only reads, pending tool calls, file mentions, async job summaries, and IRC rows.

## Current assessment

H1 is implemented: `ctrl+t` full transcript no longer needs to replay persisted history through raw strings, and its session path can render historical tool/bash/eval/read/custom/skill/branch/compaction records through the same component families used by live UI rendering. `ctrl+o` remains live/current-turn-only because replay items are explicitly non-live. `Alt+T` remains the supplied-tool overlay path and was not widened to full-session transcript behavior.
