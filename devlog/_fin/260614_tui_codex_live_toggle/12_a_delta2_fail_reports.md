# 260614 — A-stage delta2 audit FAIL reports

## Planner delta2

Source: `agent://24-CtrlTPlannerDelta2`

FAIL

Findings summarized:

- Remove `ThinkingExpandableLike`; overlay must use only `renderFullTranscript(width)` / plain render.
- Make `renderFullTranscript(width)` required for all expandable transcript component types including `tool-execution.ts`.
- Add assistant-message/input-controller/thinking-collapse comment/doc updates.
- Include command-controller-hotkeys test in focused verification command.

## Architect delta2

Source: `agent://25-CtrlTArchitectDelta2`

FAIL

Findings summarized:

- Add explicit session-source renderer contract reusing/mirroring `ui-helpers.ts` display mapping and one test per parity row.
- Remove `ThinkingExpandableLike` helper.
- Update stale ctrl+t thinking comments/tests in `assistant-message.ts`, `input-controller.ts`, `thinking-collapse.test.ts`, and `command-controller-hotkeys.test.ts`.

Plan patched in `10_pabcd_ctrl_t_full_transcript_p_plan.md` after these findings.
