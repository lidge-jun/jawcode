FAIL
[medium] devlog/_plan/260615_executor_ext_task_surface/10_plan_executor_ext_task_surface.md §3.5 — Lazy-load blocker remains if `buildExecutorExtContent()` is called while constructing `EMBEDDED_AGENT_DEFS`; generated content should be a thunk and rendered inside `buildAgentContent()` during `loadBundledAgents()`.

The single point most likely to break first if the plan is implemented as written: §3.5 bundled executor_ext before §3.10 gates and §4.1/§4.3 tests on four on-disk-prompt contract.
