# Stage A Round 1 Audits — ctrl+o/t follow-up

## Planner lens

FAIL

[medium] 18_pabcd_ctrl_o_t_followup_p_plan.md — Acceptance criteria §AC2 — No work item maps AC2 (“preserves user scroll offset after first render; re-pins only on fresh overlay”) to an automated or scripted check; only overlay scroll-init code and prose assert it — Add a `full-transcript-overlay.test.ts` case: render at bottom, `pageDown`/`down` then re-`render()` without new instance and assert offset unchanged; second case: new `FullTranscriptOverlayComponent` re-initializes at `maxScroll`.

[medium] 18_pabcd_ctrl_o_t_followup_p_plan.md — Diff-level file plan §MODIFY structure/31_scroll.md — Canonical ctrl+t bottom-start rule is listed only under an optional doc touch; Objective §3 and AC1–3 are not gated on updating scroll docs — Make doc update a concrete work item when `structure/31_scroll.md` lacks “opens at latest/bottom” (it currently contrasts ctrl+o vs ctrl+t overlay but not initial scroll position).

[low] 18_pabcd_ctrl_o_t_followup_p_plan.md — Acceptance criteria §AC4 vs `input-controller.ts` `toggleToolOutputExpansion()` — AC4 names only `liveToggleEligible` components; plan omits that ctrl+o also flips `thinkingExpanded` today, so a reader may over-narrow the behavior under test — Note in test plan that existing thinking coupling stays unless explicitly removed, and keep `thinking-collapse.test.ts` in verification for regression only.

[low] 18_pabcd_ctrl_o_t_followup_p_plan.md — Verification plan — Four extra test files are required with no AC linkage — Add one line per file (e.g. keybindings regression for ctrl+t/ctrl+o bindings unchanged).

[low] 18_pabcd_ctrl_o_t_followup_p_plan.md — Objective §1 “all expandable Jaw/tool output” — Coverage is one `markLiveToggleEligible` line plus an audit bullet list, not a repeatable audit step — Add a short pre-merge grep/ast check: every `setExpanded(this.ctx.toolOutputExpanded)` in live `#handleMessageUpdate` paths is immediately followed by `markLiveToggleEligible(..., true)` except replay paths.

The single statement an implementer would most likely misread: that fixing the streaming `toolCall` gap requires broadening `setToolsExpanded()` (or ctrl+o) to update every expandable `chatContainer` child instead of only calling `markLiveToggleEligible(component, true)` on the `#handleMessageUpdate()` path.

## Architect lens

PASS

[HIGH] packages/coding-agent/src/modes/controllers/event-controller.ts:491 — #handleMessageUpdate streaming toolCall creates ToolExecutionComponent with setExpanded only; markLiveToggleEligible is present on tool_execution_start (623) but absent here, so ctrl+o skips embedded assistant tools — add markLiveToggleEligible(component, true) immediately after setExpanded per plan.

[MEDIUM] packages/coding-agent/src/modes/controllers/input-controller.ts:1146 — setToolsExpanded gates chatContainer children with isLiveToggleEligible (1139-1140) but expands all expandable liveToolContainer children without that gate; AC4 “eligible only” can drift for commit-fold live previews — apply the same isLiveToggleEligible guard or amend AC/plan.

[MEDIUM] packages/coding-agent/test/modes/controllers/event-controller-message-start.test.ts:23 — createContext lacks chatContainer, session.getToolByName, settings.get, pendingTools, and streaming fields required by the planned message_update regression — add a dedicated streaming-tool fixture factory before pasting plan assertions.

[LOW] packages/coding-agent/src/modes/components/full-transcript-overlay.ts:141-212 — #scroll starts at 0 and render only clamps; plan’s #scrollInitialized patch matches showFullTranscript’s fresh overlay instance (input-controller.ts ~1114) — implement as written; tests need line count > #viewportRows() ((process.stdout.rows ?? 30) - 8).

[LOW] packages/coding-agent/test/input-controller-keybindings.test.ts — no ctrl+o eligibility or commitFinalizedBacklog tests yet; plan additions are valid but must import commitFinalizedBacklog from modes/utils/ui-helpers and stub ctx.ui.commitLines for commit-lane paths.

[LOW] structure/31_scroll.md:47-48 — documents ctrl+o sweep and ctrl+t overlay but not bottom-start pager behavior; optional doc update in plan is appropriate, not blocking.

Single point most likely to break first if implemented as written: shipping markLiveToggleEligible at event-controller.ts:491 without extending event-controller-message-start.test.ts’s createContext — the streaming toolCall regression will not compile or will exercise the wrong handler path, while the production bug (ctrl+o missing streaming tools) would remain unguarded in CI.
