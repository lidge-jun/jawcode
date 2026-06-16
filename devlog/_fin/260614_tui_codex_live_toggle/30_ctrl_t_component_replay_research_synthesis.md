# Research synthesis — ctrl+t shared replay helper

Date: 2026-06-15

## Inputs

- Prior architect research: `agent://41-TranscriptRenderResearch`
- Executor research A: `agent://54-ReplayHelperStructure`
- Executor research B: `agent://55-ReplayParityGaps`
- Current implementation/devlog baseline:
  - `22_followup_ctrl_t_rendering_gap.md`
  - `24_b_ctrl_t_rich_render_implementation.md`
  - `25_c_ctrl_t_rich_render_check.md`
  - `26_d_ctrl_t_rich_render_done_summary.md`

## Research consensus

All research lanes agree on the same structural conclusion:

- the completed ctrl+t patch fixes the immediate raw Bash/tool JSON issue;
- the deeper architectural issue is duplicated replay logic;
- normal chat history replay lives in `UiHelpers.renderSessionContext`;
- ctrl+t persisted history still has its own session-message conversion path;
- the hardening fix is to extract a shared persisted-message-to-component replay helper and make ctrl+t consume component arrays.

## Key files

- `packages/coding-agent/src/modes/utils/ui-helpers.ts`
  - authoritative current replay logic.
  - owns assistant segmentation, pending tool pairing, read grouping, error/abort injection, and standard message component mapping.
- `packages/coding-agent/src/modes/components/full-transcript-overlay.ts`
  - should become a dumb component pager for both historical and live items.
  - should stop importing execution components directly after full extraction.
- `packages/coding-agent/src/modes/controllers/input-controller.ts`
  - `showFullTranscript()` should prebuild historical components because it has access to session/tools/settings/cwd.
- `packages/coding-agent/test/full-transcript-overlay.test.ts`
  - should move from raw session-message fixtures to historical component/source fixtures plus integration with replay helper.
- New likely file: `packages/coding-agent/src/modes/utils/session-transcript-replay.ts`
  - shared helper.

## Highest-value parity gaps

### 1. Read tool grouping

Severity: high.

Normal replay groups read tool calls through `ReadToolGroupComponent`; ctrl+t session path does not fully share that grouping. A shared helper would make ctrl+t read-heavy sessions look like normal chat history.

### 2. Custom/skill/branch/compaction components

Severity: high.

Normal replay has specific components:

- `CustomMessageComponent`
- `SkillMessageComponent`
- `BranchSummaryMessageComponent`
- `CompactionSummaryMessageComponent`

The local ctrl+t session conversion degrades these toward dim role labels/text fallback. Component replay fixes this.

### 3. Assistant segmentation

Severity: medium.

Normal replay splits assistant content around tool calls; ctrl+t should follow the same segment ordering so text before and after tools stays in the same visual order as chat history.

### 4. Tool renderer parity

Severity: medium.

The completed patch reconstructs `ToolExecutionComponent` without a live `Tool` object. Shared replay can use `session.getToolByName(name)` from controller deps, restoring custom renderers where available.

## Recommended implementation contract

Introduce a side-effect-light builder:

```ts
buildSessionTranscriptComponents(sessionContext, deps, options): Component[]
```

The builder uses local state:

- local `pendingTools` map;
- local `lastToolComponent` reference;
- local read-group bookkeeping;
- local assistant component references for read result images.

It must not mutate:

- `ctx.chatContainer`;
- `ctx.pendingTools`;
- `ctx.lastToolComponent`;
- editor history;
- footer/status state.

`UiHelpers.renderSessionContext()` can then become the mutating adapter: call builder, add returned components to chat, update footer/history, request render.

`InputController.showFullTranscript()` can call builder in transcript mode and pass returned `historicalItems` to the overlay.

## Implementation risk

This is a bigger patch than the completed raw-JSON fix because it touches the normal session replay path if we fully deduplicate `renderSessionContext`.

The safer staged version:

1. Add helper and tests.
2. Use helper for ctrl+t historical replay first.
3. Keep `UiHelpers.renderSessionContext` unchanged until helper parity is proven.
4. In a second commit/cycle, refactor `renderSessionContext` to consume the helper.

The cleaner version:

1. Extract helper.
2. Immediately refactor both ctrl+t and `renderSessionContext` to use it.
3. Rely on broader tests to catch visible chat regressions.

Recommendation: use the safer staged version unless the user explicitly prefers the larger one-shot refactor.

## Documentation produced

- `27_ctrl_t_component_replay_hardening_brief.md`
- `28_ctrl_t_component_replay_extraction_plan.md`
- `29_ctrl_t_component_replay_test_matrix.md`
- `30_ctrl_t_component_replay_research_synthesis.md`

## Next PABCD-ready objective

Implement a staged ctrl+t replay hardening pass:

> Add a shared session transcript component replay helper and wire ctrl+t full transcript historical rendering to it, preserving the completed Bash/raw-JSON fix, ctrl+o behavior, Alt+T scoping, and bottom-open scroll behavior. Keep normal `UiHelpers.renderSessionContext` behavior unchanged in this phase except for shared helper extraction where tests prove parity.
