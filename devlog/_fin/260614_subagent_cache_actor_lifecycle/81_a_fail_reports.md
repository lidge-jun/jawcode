# 81 — A-stage audit fail reports

> Stage: A audit round 1
> Plan audited: `80_pabcd_phase_execution_plan.md`
> Outcome: FAIL from both planner and architect lenses.

## Planner lens

FAIL

[high] 80_pabcd §1 + all phases — actor records independent of AsyncJob/SubagentRecord completion is stated but not assigned — add lifecycle hooks and tests proving job completion leaves actor idle/resumable.
[high] 40_phase1 §4 / 00_moc + 80 §2 — session/process-scoped resume lacks restart behavior acceptance — add simulated restart acceptance that automatic resume is not silently claimed after process restart.
[high] 70_executor_ext §1.1 + 80 §3.2 — executor parallel fork lanes lack non-overlap enforcement work item — add Phase 2 overlap policy and tests.
[high] 50_phase2 §7 / 70 §3 + 80 §3.2 — cache-fork fallback signaling missing — add allow/deny fallback tests and non-cache-affine metadata.
[medium] 80 §2.4 — same-lane busy behavior ambiguous — choose deterministic busy error or queue; plan must specify one.
[medium] 60_pabcd §2–3 + 80 §4.2–4.3 — stage lane map incomplete — add per-stage lane table and tests for C rerun/stage retirement.
[medium] 70_executor_ext §6–7 + 80 §5 — executor_ext routing is a runtime decision but hidden routing does not mention it — map external executor model intents to executor_ext before UI phase.
[medium] 10_execution_scaffold §F + 80 §3.3/§7.2 — provider/cache acceptance lacks OpenAI/Codex-level test hook — extend task-cache-key/fork tests.
[medium] 80 §2.1 vs §4.1 — prompt files scheduled in both Phase 1 and Phase 3 without sequencing — separate minimal stubs from full alignment.
[low] 80 §4.3/§5.3 — prompt-doc parity and prewarm degradation not mechanical enough — add snapshot/grep and failure-injection tests.
[low] 00_moc §6.1 + 80 absent — cli-jaw parity has no phase owner — add pre-implementation checklist.
[low] 80 §6.1 — Phase 5 file targets unresolved — add pre-step to enumerate exact symbols.

Most likely misread: Treating the confirmed-requirements bullet list as fully scheduled work when several locked decisions never appear as phase tasks or testable acceptance.

## Architect lens

FAIL

[CRITICAL] packages/coding-agent/src/task/index.ts:642 — `frozenForkSeeds` pre-builds fork context before batch dispatch; Phase 2 requires `buildForkContextSeed()` at fork dispatch only — gate self-fork/cache lanes out of batch prefreeze or build seed synchronously at spawn.
[CRITICAL] packages/coding-agent/src/task/index.ts — TaskTool never reads PABCD state or actor registry; hidden routing is unspecified in code — inject `readPabcdStateWithFallback(cwd, getSessionId())` + actor-registry resolve/allocate before choosing `runMode`/`sessionFile`.
[HIGH] packages/coding-agent/src/jwc-runtime/orchestrate-state.ts:40 — `PabcdCtx` lacks `actor_namespace_id`; add field to ctx + schema write/read path; mint on new `i`/`p` cycle.
[HIGH] packages/coding-agent/src/jwc-runtime/orchestrate-runtime.ts:211 — `nextCtxFor` copies ctx without actor retirement or namespace rotation — on stage transitions call retireStageActors(fromStage) and exclude retired keys from lookup.
[HIGH] packages/coding-agent/src/jwc-runtime/orchestrate-runtime.ts:426 — `resetPabcdState` deletes only `pabcd-state.json`; actors.json lookup can outlive reset — retire all active actors for session and drop active namespace on reset/complete.
[HIGH] packages/coding-agent/src/prompts/jaw/orchestrate-p.md:13 — `Fresh spawn` for Critic conflicts with resume semantics — update after routing lands.
[HIGH] packages/coding-agent/src/prompts/jaw/orchestrate-a.md:9 — `Fresh spawn` for auditors conflicts with A-lane retry resume — update after routing lands.
[MEDIUM] packages/coding-agent/src/jwc-runtime/plan-writer.ts:316 — `planner_subagent_id` is a second resume owner — fold into actors.json or document non-overlap.
[MEDIUM] 80_pabcd_phase_execution_plan.md §2.3 — PABCD hook needs ToolSession cwd + session id consistently.
[MEDIUM] packages/coding-agent/src/config/model-registry.ts:79 — four public role targets; executor_ext must stay internal policy alias.
[LOW] packages/coding-agent/test/default-jwc-definitions.test.ts:5 — four bundled role agents enforced.

Most likely break first: packages/coding-agent/src/task/index.ts — adding PABCD actor routing without namespace + busy-lane rules will either keep fresh-spawning or resume the wrong sessionFile across stage/cycle boundaries.
