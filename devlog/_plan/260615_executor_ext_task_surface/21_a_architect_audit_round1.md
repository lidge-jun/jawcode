FAIL
[high] devlog/_plan/260615_executor_ext_task_surface/10_plan_executor_ext_task_surface.md §3.5/§3.10 — bundled executor_ext wiring can break first if the generated role is not protected by gate/test assertions that distinguish four prompt files from five callable roles — require tests/gates to verify loadBundledAgents() exposes visible executor_ext while prompts/agents/executor_ext.md remains absent.

The single point most likely to break first if the plan is implemented as written: §3.5 bundled executor_ext without §3.10 gate split and default-jwc-definitions four-role assertions.
