# 260614 — A-stage delta audit FAIL reports

## Planner delta

Source: `agent://22-CtrlTPlannerDelta`

FAIL

Findings summarized:

- Clarify `ToolTranscriptOverlayComponent` reuse as UX-only; do not subclass/wrap/call `Container.render()`.
- Remove optional assistant/tool overlay-side expansion fallback; require `renderFullTranscript(width)` protocol, especially `assistant-message.ts`.

## Architect delta

Source: `agent://23-CtrlTArchitectDelta`

FAIL

Findings summarized:

- Remove assistant overlay-local thinking expansion path; use component protocol only.
- Add session fallback parity matrix and release-blocking criteria.
- Update `assistant-message.ts` ctrl+t comments.
- Extend `command-controller-hotkeys.test.ts` for full transcript row and no stale thinking `Ctrl+T` copy.
- Make compaction overlay rendered-output marker test a hard gate.
- Clarify `ToolTranscriptOverlayComponent` reuse as pager UX only.
- Add ctrl+o live-only regression coverage.

Plan patched in `10_pabcd_ctrl_t_full_transcript_p_plan.md` after these findings.
