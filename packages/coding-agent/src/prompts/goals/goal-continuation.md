<!-- Hidden continuation steer. role=user, suppressed from visible transcript. -->

Continue work on the active goal.

<objective>
{{objective}}
</objective>

Usage:
- Tokens used: {{tokensUsed}}
- Time used: {{timeUsedSeconds}} seconds

This is an autonomous continuation. The objective persists across turns; do not redefine success around a smaller, easier, or already-completed subset.

Before calling `goal({op:"complete"})`, you MUST perform a completion audit against the current repo state:

1. **Restate the objective as concrete deliverables.** What files, behaviors, tests, gates, or artifacts must exist for the objective to be true? Write them down (todo_write, or in your reasoning).
2. **Map each deliverable to evidence.** For every requirement, identify the authoritative source that would prove it: a file's contents, a command's output, a test's pass status, a PR/issue state.
3. **Inspect the actual current state.** Read the files. Run the commands. Check the tests. Do not rely on memory of earlier work in this session — the repo may have changed.
4. **Match verification scope to claim scope.** A narrow check (one file passes its unit test) does not prove a broad claim (the feature works end-to-end).
5. **Treat uncertainty as not-yet-achieved.** Indirect evidence, partial coverage, missing artifacts, or "looks right" without inspection mean continue working. Gather stronger evidence or do more work.

Call `goal({op:"complete"})` only when every deliverable has direct, current-state evidence proving it is satisfied. The completion call is a load-bearing claim; it ends the autonomous loop and surfaces a "done" report to the user.

If the work is not done, keep working. Brief progress/commentary is allowed when it reports observed facts, current focus, a concrete finding, or a real blocker; do not emit empty "continuing" announcements.

## Jaw goal contract (jwc goal surface)

- **PABCD requested**: if the user/objective/hint requires PABCD or `orchestrate`, run and advance the native `jwc orchestrate <stage>` commands directly, follow each stage prompt, and record stage evidence with `jwc goal update`.
- **Plan mode**: if the objective above is the pending sentinel "(AI-driven goal planning pending refinement)", do NOT start implementation work. First derive the real objective from the conversation, repo state, and any hint line, then run `jwc goal refine "<specific objective>"` and continue under the refined objective.
- **Checkpoint evidence bundle**: at every milestone record progress with `jwc goal update "<summary>" --evidence "<fresh command/test output or changed file path>"`. A development checkpoint needs the full bundle — documentation evidence (devlog/structure path), implementation evidence (changed source/test paths), verification evidence (fresh command output). Placeholder evidence (todo, tbd, stub) is forbidden; checkpoints without `--evidence` are rejected.
- **Verification tiers** — scale verification to change scope: LIGHT (<5 files: diagnostics clean), STANDARD (default: diagnostics + build + affected tests), THOROUGH (>20 files or security/architectural: full review + all tests).
- **Agent-initiated pause (2-tap gate)**: never pause merely because work is hard, slow, or uncertain. Before any agent-initiated pause, run an independent stop audit (re-derive the outstanding requirements; check whether any viable approach is untried). Only then run `jwc goal pause --agent --audit "<independent reviewer summary>"` — a first `jwc goal pause --agent` without `--audit` records the attempt and does NOT pause.
