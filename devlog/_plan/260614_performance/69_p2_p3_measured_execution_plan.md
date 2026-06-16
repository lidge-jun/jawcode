# 69 — P2/P3 measured execution plan

Date: 2026-06-15

## Objective

Reduce the remaining sustained `bun.exe` CPU/RSS pressure after P1.5 by landing measured, behavior-preserving P2/P3 slices. The first implementation must prove the measurement path before changing hot code.

## Source-of-truth inputs

- Roadmap: [02_patch_roadmap.md](./02_patch_roadmap.md)
- Hardening constraints: [07_hardening_addendum.md](./07_hardening_addendum.md)
- P2/P3 external audit synthesis: [68_p2_p3_external_audit_synthesis.md](./68_p2_p3_external_audit_synthesis.md)
- P1.5 completion audit: [67_p1_5_goal_completion_audit.md](./67_p1_5_goal_completion_audit.md)

External audit refs:

- `agent://35-P22TuiLineCacheAudit`
- `agent://36-P21AssistantReuseAudit`
- `agent://37-P23TranscriptLazyAudit`
- `agent://38-P3SessionRssAudit`
- `agent://39-P2P3RoadmapDocAudit`
- `agent://40-P2ImplementationPlanAudit`
- `agent://41-P3ImplementationPlanAudit`
- `agent://42-P2P3FinalPlanAudit`

## Execution order
> **Status update (post cycles):** Slice 1 landed as P2.0a for TUI metrics only; Slices 2 and 3 landed together in [72.14_d_p2_2_p3_1_done_summary.md](./72.14_d_p2_2_p3_1_done_summary.md). Remaining queue starts at Slice 4 (P2.1), then Slice 5 (P3.2+P3.3), with Slice 6 (P2.3) still measure-gated.

### Slice 1 — P2.0 measurement checkpoint
> Status: **P2.0a complete, P2.0b pending.** TUI frame/prepared-line/text JSONL metrics landed; coding-agent/session/sdk counters listed below remain future instrumentation or bundle-local measurement work.

Purpose: make the next optimization measurable without changing normal runtime output.

Targets to inspect before coding:

- `packages/tui/src/metrics.ts`
- `packages/tui/src/tui.ts`
- `packages/coding-agent/src/modes/components/assistant-message.ts`
- `packages/coding-agent/src/modes/components/full-transcript-overlay.ts`
- `packages/coding-agent/src/session/session-manager.ts`
- `packages/coding-agent/src/sdk.ts`

Implementation constraints:

- Use `JWC_PERF=1` as the documented opt-in for this pass.
- Keep `PI_TUI_METRICS` only as a compatibility alias resolved by the same metrics enable helper, or remove it from the P2 path; do not leave two independent undocumented enable switches.
- Write bounded JSONL to `~/.jwc/logs/perf.jsonl` or an explicit artifact path.
- Emit no interactive stdout/stderr noise.
- Avoid per-frame full `process.memoryUsage()`; RSS checkpoints only at coarse phase boundaries.
- Add or extend `packages/tui/test/metrics.test.ts` and `packages/tui/test/metrics-redteam.test.ts` for the P2.0 JSONL/off-by-default contract.
- Use a stable `jwc.perf-events/1` JSONL event shape with at least `{ schema, ts, source, counters }`; source-specific fields may live under `counters`.

Counters required before P2.2/P2.1/P2.3/P3 claims:

- TUI frame duration and line count.
- Prepared-line normalization/truncation hit/miss counts.
- Wrap/visible-width call counts or durations where already cheap to collect.
- Markdown child construction/rebuild count during assistant streaming updates.
- ctrl+t overlay entries/lines rendered on initial open and navigation.
- Session open file-load count and active-path materialization count.

Focused verification:

- `packages/tui/test/metrics.test.ts`: `JWC_PERF` unset keeps metrics disabled/no-op and `JWC_PERF=1` enables the shared resolver.
- `packages/tui/test/metrics-redteam.test.ts`: no interactive stdout/stderr output and bounded label/event cardinality.
- New or extended JSONL fixture assertion: enabled mode writes `jwc.perf-events/1` rows containing the required counter fields for TUI frame, prepared-line, Markdown rebuild, ctrl+t, and session-open/materialization counters.
- Existing TUI input latency/redteam tests stay green.

### Slice 2 — P2.2 revised TUI prepared-line cache
> Status: **complete.** Landed as part of the P2.2/P3.1 adjacent cycle; keep this slice as regression context.

Purpose: reduce live-frame CPU from repeated line normalization, width checks, resets, and truncation.

Targets:

- `packages/tui/src/tui.ts`
- `packages/tui/src/utils.ts` if `isPrintableAscii` or equivalent helper is missing

Implementation constraints:

- Content-keyed cache only. Index-keyed line cache is forbidden.
- Normalization cache key: raw component line string.
- Truncation cache key: render width plus normalized/terminated line.
- Route `#doRender` and `commitLines` through one preparation path.
- Clear caches on forced render, stop, and width change.
- Bound cache growth under streaming unique lines.
- Preserve image-line skip, OSC 8 terminator policy, no-3J-after-committed-history behavior, and P1.5.1 expedited input scheduling.
- Do not touch `#expandViewportFill`, `compactViewportFill()`, sticky gap, composer pin, welcome visuals, or scroll/fill/gap behavior.

Focused verification:

- Existing: `packages/tui/test/render-goldens.test.ts`
- Existing: `packages/tui/test/input-render-latency.test.ts`
- Existing: `packages/tui/test/input-render-redteam.test.ts`
- Existing: `packages/tui/test/commit-lane.test.ts`
- Existing: `packages/tui/test/viewport-fill.test.ts`
- Existing: `packages/tui/test/above-viewport-repaint.test.ts`
- New/extended: prepared-line byte oracle for ASCII, ANSI, OSC 8, wide Unicode, combining marks, tabs, and normalization-sensitive scripts.
- New/extended: bounded cache growth under streaming unique lines.
- New/extended: `commitLines` prepared bytes match `#doRender` prepared bytes at the same width.

### Slice 3 — P3.1 session open single-load
> Status: **complete.** `SessionManager.open()` single-load landed as part of the P2.2/P3.1 adjacent cycle; remaining P3 work starts at Slice 5.

Purpose: remove the most local confirmed resume waste without touching active-path context semantics.

Targets:

- `packages/coding-agent/src/session/session-manager.ts`

Implementation constraints:

- `SessionManager.open(path)` must read/parse the target JSONL once.
- Preserve current migration, persisted blob resolution, resident reset, and resident re-externalization order.
- Prefer one internal loaded-entries path over open-only divergent logic.
- Do not change instance `buildSessionContext()` or `sdk.ts` startup behavior in this slice.

Focused verification:

- New/extended open test proving exactly one session-file load/read for a valid resident-heavy fixture.
- Existing P1.5.2 resident lifecycle/cache/ownership tests stay green.

### Slice 4 — P2.1 assistant streaming child reuse

Purpose: reduce streaming update CPU and allocation churn from full assistant-message child rebuilds.

Targets:

- `packages/coding-agent/src/modes/components/assistant-message.ts`

Implementation constraints:

- Split usage/footer/error/abort/tool-image rows from content block sync.
- Reuse unchanged prefix content children within the current segment only.
- Cache keys use local segment index/fingerprint, block kind, style profile, and derived thinking presentation mode.
- Structural children such as spacers/header visibility must reconcile when neighboring blocks change.
- `invalidate()` invalidates reused children instead of unconditionally rebuilding the entire tree.

Focused verification:

- Streaming append only rebuilds changed tail child/children.
- Usage row update does not recreate stable Markdown prefix.
- Thinking expanded/collapsed/streaming-tail/hidden-label outputs remain stable.
- Block insert/remove updates structural spacer/header children correctly.

### Slice 5 — P3.2 + P3.3 path-only context and startup flag dedupe

Purpose: avoid materializing abandoned branches for LLM context and avoid the second startup materialization pass.

Targets:

- `packages/coding-agent/src/session/session-manager.ts`
- `packages/coding-agent/src/sdk.ts`

Implementation constraints:

- Ship P3.2 and P3.3 together; P3.2 alone leaves resume startup paying `getBranch()` materialization.
- Preserve exported pure `buildSessionContext(entries, leafId?, byId?)` API.
- Instance context build should walk `#byId` from `#leafId` and materialize only active-path entries with one materialize cache per build.
- Startup flags for thinking/service-tier/MCP/TTSR must come from the built context or a lightweight active-path scan.
- Full-tree APIs remain intentionally expensive and unchanged.

Focused verification:

- Active-path context equals full-materialization oracle.
- Huge abandoned branch resident blobs are not hydrated for LLM context or startup flags.
- SDK resume startup does not do a second full `getBranch()` materialization pass.
- P1.5.2 resident tests stay green.
- `session-memory.bench.ts` has or uses an abandoned-branch fixture for before/after RSS evidence.

### Slice 6 — P2.3 ctrl+t lazy tail render

Purpose: reduce ctrl+t open/navigation latency only if P2.0 shows transcript overlay is a top pain.

Targets:

- `packages/coding-agent/src/modes/components/full-transcript-overlay.ts`
- `packages/coding-agent/src/modes/controllers/input-controller.ts`

Implementation constraints:

- Entry/component-granular lazy rendering using `renderFullTranscript(width)` where available.
- Initial open renders tail-first until viewport + overscan is filled.
- Older entries render only on upward navigation.
- Eager `showFullTranscript()` replay component construction must be measured; overlay-only lazy rendering is not enough to claim open-latency improvement.
- Preserve bottom-open, fresh-open re-pin, pageUp/pageDown, `g`/`G`, close keys, live-tail dedupe, and width invalidation.

Focused verification:

- Eager reference vs lazy viewport byte parity at bottom, pageUp, top, and mid-scroll.
- Initial bottom-open renders only tail entries needed for viewport + overscan.
- Live tail append updates without historical rerender or duplicate assistant blocks.

## Gate policy

- Source mutation for already-landed TUI/P3.1 slices used P2.0a plus bundle-local focused proof; future coding-agent/session/sdk performance claims should add P2.0b counters or equivalent bundle-local measurement.
- Each slice closes with focused tests for its touched files plus the relevant regression suites named above.
- Workspace-wide `bun run check` is a merge hygiene gate after a coherent multi-slice batch, not a substitute for focused proof.
- No commit while unrelated worktree changes remain mixed unless explicitly instructed.
