DONE
Read-only inspection of the scoped files against `18_pabcd_ctrl_o_t_followup_p_plan.md` shows the implementation is present and consistent.

Evidence:
- `packages/coding-agent/src/modes/components/full-transcript-overlay.ts`: `#scrollInitialized` pins first render to bottom/maxScroll; later renders clamp without re-pinning. Tests cover bottom open, upward scroll, offset preservation, fresh instance re-pin, and close keys.
- `packages/coding-agent/src/modes/controllers/input-controller.ts`: `setToolsExpanded` gates both `chatContainer` and `liveToolContainer` children with `isLiveToggleEligible`; `thinkingExpanded` coupling remains.
- `packages/coding-agent/src/modes/controllers/event-controller.ts`: streaming `toolCall` path now marks `ToolExecutionComponent` live-toggle eligible after `setExpanded(this.ctx.toolOutputExpanded)`.
- `packages/coding-agent/src/task/index.ts`: `isPabcdActorStage()` is syntactically complete.
- `structure/31_scroll.md` and `19_b_followup_implementation.md`: canonical behavior and B evidence recorded.

Inspection note: AC7 is covered by a focused simulation of ineligibility after commit rather than directly invoking `commitFinalizedBacklog`; `ui-helpers.ts` still owns `markLiveToggleEligible(..., false)` on commit.
