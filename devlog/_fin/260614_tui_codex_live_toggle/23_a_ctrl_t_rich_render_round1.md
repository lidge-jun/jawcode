# Stage A Round 1 — ctrl+t rich render plan audits

## Planner lens

FAIL

[medium] Plan Design decision §4 — Persisted `toolResult` rows were promised as compact formatted fallback, but diff-level plan did not list a `toolResult` branch hunk — fixed by adding paired `toolCall` + `toolResult` replay through `ToolExecutionComponent` plus orphan fallback.

[medium] Plan Test plan §2–3 — Tests asserted suppression when paired with execution, but no assistant-only `toolCall` fixture existed — fixed by documenting intentional invisibility and adding a test requirement.

[low] Plan pythonExecution — Plan hedged on `EvalExecutionComponent.setComplete` signature despite AC3 — fixed by pinning exact signature.

[low] Plan AC12 — Root check wording allowed non-zero failure if unrelated — fixed by requiring `bun run check` pass; only exit-0 warnings may be recorded.

[low] Plan alt+t — Tool-only overlay behavior needed explicit assertion — fixed by adding ToolTranscriptOverlay supplied-tools-only assertion requirement.

## Architect lens

FAIL

[HIGH] Plan lines 47-55 — Normal agent bash tool history is assistant `toolCall` + `toolResult`, not `bashExecution`; fixed by adding `ToolExecutionComponent` replay for paired `toolResult`.

[HIGH] Plan lines 268-274 — Bottom-start rich test could be unstable with multi-line Bash frames; fixed by using one unique sentinel output per message and asserting by sentinel visibility.

[MEDIUM] Plan line 291 — Ctrl+o guard citation was weak; retained focused `input-controller-keybindings.test.ts` for ctrl+o and clarified related coverage.

[MEDIUM] Plan line 293 — Alt+t guard needed actual overlay behavior; fixed by requiring ToolTranscriptOverlay supplied-tools-only assertion.

[MEDIUM] full-transcript-overlay.ts planned no-op loop — later implementation should skip toolCall content blocks without a no-op loop.

Most likely break: implementing only `bashExecution`/`pythonExecution` would leave normal agent bash tool sessions as plain `Tool bash` + raw result text.
