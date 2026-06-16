# 11 — P1.3/P1.4 critic round 2

Verdict: ITERATE

Blocking gaps:

- `applyStartupModelProfilesOrExit()` still exits via `process.exit(1)` after `createSession`; plan item 5 allowed alternatives instead of mandating a cleanup-safe path.
- Interactive `PI_TIMING === "x"` exits before `runInteractiveMode()` and was missing from the post-create early-exit inventory.

Required revisions:

- Mandate a single cleanup-safe `applyStartupModelProfiles` path in the non-ACP branch: catch errors, print the same error, dispose the session, set the disposal flag, call `postmortem.quit(1)`, and return.
- Document or patch `PI_TIMING === "x"` to dispose the session before exit.
- Clarify external-manager test as preset `sessionOptions.mcpManager` before CLI discovery.

Revision applied in devlog/_plan/260614_performance/09_p1_3_p1_4_execution_plan.md.
