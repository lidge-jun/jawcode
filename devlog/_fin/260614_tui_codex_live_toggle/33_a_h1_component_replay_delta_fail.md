FAIL

Planner delta unresolved findings:
- long single-line output test missing from numbered helper/overlay cases — added Required P2 case #20.
- isSilentAbort/SKILL_PROMPT imports missing from helper checklist — added import requirement for session/messages path.
- non-read ToolExecution wording said exact renderSessionContext despite H1 setArgsComplete divergence — reworded as constructor parity plus H1 finalization.

Architect delta unresolved findings:
- non-read toolCall missing readGroup = null — added explicit non-read reset before ToolExecution construction.
- read toolResult missing isReadGroupResult gate — added pendingReadComponent/isReadGroupResult snippet.
- lazy read-group creation missing items.push and pendingTools.set — added snippet.
- abort/error construction was checklist-only — added inline isSilentAbort/hasErrorStop/errorMessage algorithm.
- non-assistant role replay underspecified — added Standard-role replay helper table.

Single point most likely to break first before patch: incomplete manual port of UiHelpers.renderSessionContext assistant/read/toolResult state machine.
