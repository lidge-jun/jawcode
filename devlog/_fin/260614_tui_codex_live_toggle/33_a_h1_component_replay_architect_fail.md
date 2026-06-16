FAIL

[CRITICAL] 33 plan assistant mapping — omitted per-assistant-message lastToolComponent batch close before readGroup reset — added explicit close/reset snippet.
[HIGH] 33 plan vs ui-helpers flushSegment — direct AssistantMessageComponent construction divergence was underspecified — added ui-helpers-aligned segmentStart/flushSegment snippet and documented direct construction as H1 detached replay.
[HIGH] 33 plan toolResult/read — missing isReadGroupResult/lazy ReadToolGroup creation and readToolCallArgs updateArgs/pendingTools.set — added read deferred bookkeeping, lazy group creation, cleanup, and image-only early continue.
[HIGH] 33 plan non-read toolCall — missing readGroup=null before each non-read tool — assistant/read reset and non-read sequence clarified.
[MEDIUM] overlay item count — tests must assert new itemCount semantics — added header assertion.
[MEDIUM] overlay fixtures — sessionContext shape tests must migrate same PR — plan requires historicalItems fixtures.
[MEDIUM] deps.settings — unused settings dependency — removed settings from H1 deps and controller/test wiring.
[LOW] overlay theme import — plan said remove theme if unused, but overlay still uses it — corrected to keep theme.
[MEDIUM] duplication risk — H1 still duplicates renderSessionContext state machine — accepted as staged H1 with expanded parity checklist and H2 deferred.
[MEDIUM] imports/signatures — noted as checked; AgentTool/MessageRenderer exact names may adjust to real exports.

Single point most likely to break first: incomplete manual port of UiHelpers.renderSessionContext assistant/read/toolResult state machine.
