# D-stage done summary — H1 ctrl+t component replay hardening

Date: 2026-06-15

## PABCD cycle summary

- P: Planned H1 replay hardening so `ctrl+t` full transcript renders persisted session history as component arrays instead of raw `Tool call ... JSON` strings while keeping `ctrl+o` live-turn-only and `Alt+T` scoped to tool transcript overlay.
- A: Initial planner/architect audit failed; plan was hardened with explicit replay builder scope, no active-session string rendering, live tail, item-count, and edge-case test requirements.
- B: Built `buildSessionTranscriptComponents()`, rewired full transcript overlay to `{ historicalItems, liveItems, itemCount }`, wired controller live tail/deps, and added expanded regression coverage.
- C: Mechanical gates passed and final adversarial review `78-CStageAdversarialPassCheck` returned `PASS` / `CLEAR` / `APPROVE`.

## Relevant files changed

Primary H1 implementation:

- `packages/coding-agent/src/modes/utils/session-transcript-replay.ts`
  - new side-effect-light persisted session replay builder;
  - converts session messages into detached rich components;
  - marks replay output non-live for `ctrl+o` safety;
  - rejects non-transcript mode.
- `packages/coding-agent/src/modes/components/full-transcript-overlay.ts`
  - removed active session raw string rendering;
  - renders component sources only;
  - session source concatenates `historicalItems` + `liveItems` and uses explicit `itemCount`.
- `packages/coding-agent/src/modes/controllers/input-controller.ts`
  - `ctrl+t` now builds historical replay components from `buildDisplaySessionContext()`;
  - live tail includes live-toggle-eligible chat components, deduped live tool components, and `streamingComponent`;
  - passes replay deps including `getUserMessageText`, tool lookup, custom renderer lookup, image/read/edit settings.

Primary H1 tests:

- `packages/coding-agent/test/session-transcript-replay.test.ts`
  - assistant segmentation, read grouping, tool/bash/eval rendering, custom/skill/branch/compaction rendering;
  - synthetic error result, internal-URL read exclusion, image-only read handoff, pending tool call, file mention, async result, IRC rows;
  - chat-mode rejection and non-live historical eligibility.
- `packages/coding-agent/test/full-transcript-overlay.test.ts`
  - session source arrays, bottom-open scroll, explicit item counts.
- `packages/coding-agent/test/input-controller-keybindings.test.ts`
  - full transcript controller path, live tail, dependency wiring, item-count header, empty historical replay via `showFullTranscript()`, and existing `ctrl+o` eligibility behavior.

Verification/hygiene fixes surfaced by gates:

- `packages/coding-agent/src/modes/components/model-selector.ts`
- `packages/coding-agent/src/session/session-manager.ts`
- `packages/coding-agent/src/commands/goal.ts`
- `packages/coding-agent/src/commands/orchestrate.ts`
- `packages/coding-agent/src/jwc-runtime/goal-cli.ts`
- `packages/coding-agent/src/jwc-runtime/goal-engine.ts`
- `packages/coding-agent/src/jwc-runtime/goal-mode-request.ts`
- `packages/coding-agent/src/jwc-runtime/orchestrate-runtime.ts`
- `packages/coding-agent/test/jwc-runtime/goal-mode-request.test.ts`
- `packages/coding-agent/test/jwc-runtime/goal-runtime.test.ts`
- `packages/coding-agent/test/system-prompt-templates.test.ts`
- `packages/coding-agent/test/task-fork-context.test.ts`
- `schemas/models.schema.json`

## Acceptance criteria status

- `ctrl+t` persisted history uses rich component rendering: met.
- Active session raw string rendering removed from full transcript overlay: met.
- `historicalItems` / `liveItems` component arrays wired through controller: met.
- Current live/streaming tail remains visible in session-source `ctrl+t`: met.
- `ctrl+o` remains current-turn/live-only: met; replay components are explicitly non-live.
- `Alt+T` remains scoped to supplied tool components: met; `ToolTranscriptOverlayComponent` path unchanged.
- Read grouping, assistant segmentation, rich tool/bash/eval, custom/skill/branch/compaction rendering: met by focused tests.
- Bottom-open scroll and item-count behavior: met by focused tests.

## Verification

- Focused tests: `87 pass / 0 fail / 360 expect() calls`.
- Package typecheck: `bun --cwd=packages/coding-agent run check:types` passed.
- Workspace gate: `bun run check` passed (`Done in 6.16s`).
- Final adversarial review: `78-CStageAdversarialPassCheck` returned `PASS`.

## WONDER — still missing / assumptions / risks

- No real terminal screenshot test was added; coverage is component/controller rendering, not pixel-level Ghostty validation.
- `SessionTranscriptReplayDeps.toolOutputExpanded` remains a low-priority unused dependency; full transcript expansion comes from `renderFullTranscript()` today.
- Custom extension tools whose rich rendering requires a live `AgentTool` object remain dependent on `session.getToolByName()` availability during replay.
- Significant unrelated workflow/goal hygiene issues surfaced during gates; they were fixed to get green verification, but they should be separated into their own audit if this patch is split for review.

## REFLECT — spec improvements

- P-plan acceptance should explicitly require controller-level dependency wiring assertions, not just component-output assertions.
- Empty historical replay must be specified at the `showFullTranscript()` integration boundary, because overlay-only tests do not prove controller fallback behavior.
- Image-only read handoff and internal-URL read exclusion deserve first-class acceptance rows in the replay matrix.
- The stage prompt's `/skill:dev-testing` requirement should degrade gracefully when the skill is not installed; this repo currently only has historical compatibility references for that skill.

## Completion

H1 ctrl+t component replay hardening is complete and verified. The next possible cleanup is removing or wiring `toolOutputExpanded` in replay deps, but it is not blocking H1 behavior.
