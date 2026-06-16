DONE

Verifier: architect subagent `9-GoalSlashVerifier`.

Summary: implementation satisfies the slash planning-alias contract. Shared helper keeps hints directional; TUI and ACP/text dispatch route `/goal plan`, `/goalplan`, and `/goal-plan` to sentinel planning path; direct `/goal <text>` remains direct objective creation; active-goal refusal happens before durable planning writes.

Evidence:
- Subagent receipt: `agent://9-GoalSlashVerifier`
- Detailed review receipt: `.jwc/plans/planphase/2026-06-14-1443-a05a/stage-01-architect.md`
- Focused tests after final regression addition: `bun test packages/coding-agent/test/goals/goal-mode-integration.test.ts packages/coding-agent/test/acp-builtins.test.ts` => 66 pass, 0 fail, 289 expect() calls.
