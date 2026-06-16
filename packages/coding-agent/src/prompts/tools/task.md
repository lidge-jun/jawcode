Launches subagents to parallelize workflows.

- Results are delivered automatically when complete.
- The tool result lists the assigned task ids (e.g. `0-AuthLoader`) — those are the live agent ids.
- Long-running subagent work appears as background work. After launch, use the `background` tool to list, inspect, follow, or cancel background rows instead of fabricating status.
- The TUI footer rows (`bg … · ctrl+j`) and `background` tool rows are the same conceptual background work surface.
{{#if ircEnabled}}
- Coordinate with running tasks via `irc` using those ids. `subagent` cancel terminates a task and **cannot carry a message** — never cancel because an await timed out; cancel only when the task has actually failed, gone off-track, or become unrecoverably wrong.
- If genuinely blocked on completion, wait with `subagent` action `await` and a timeout; timeout only bounds your wait and does not stop or fail the subagent.
{{else}}
- If genuinely blocked on completion, wait with `subagent` action `await` and a timeout; timeout only bounds your wait and does not stop or fail the subagent.
- Use `subagent` action `inspect` or `list` to snapshot manager state; `cancel` only when a task has actually failed, gone off-track, or become unrecoverably wrong.
{{/if}}

{{#if ircEnabled}}
Subagents have no conversation history, but they can reach you and their siblings live via the `irc` tool. Front-load every fact, file path, and direction they need in {{#if contextEnabled}}`context` or `assignment`{{else}}each `assignment`{{/if}}.
{{else}}
Subagents have no conversation history. Every fact, file path, and direction they need MUST be explicit in {{#if contextEnabled}}`context` or `assignment`{{else}}each `assignment`{{/if}}.
{{/if}}

<parameters>
- `agent`: callable task role for all tasks. Use `executor` for ordinary parallel implementation/research, `executor_ext` for explicit external/ext/fresh/model-diverse executor work, and `planner`/`architect`/`critic` for explicit specialist lenses.
- `tasks`: tasks to execute in parallel
 - `.id`: CamelCase, ≤32 chars
 - `.description`: UI label only — subagent never sees it
 - `.assignment`: complete self-contained instructions; one-liners and missing acceptance criteria are PROHIBITED
{{#if contextEnabled}}- `context`: shared background prepended to every assignment; session-specific only{{/if}}
- `.model` (optional): model hint for this task. Prefer explicit `provider/modelId[:effort]` when the user names an external or specific model (especially with `executor_ext`), e.g. `openai/gpt-5.4:high`. For `executor_ext`, omitted or empty `.model` means use the configured `EXECUTOR_EXT` / `task.agentModelOverrides.executor_ext` target; only set `.model` for one-off model overrides. For other agents, `"self"` or omitted = parent model. `"cheap:<provider>"` or `"best:<provider>"` = preset lookup; bare/canonical/fuzzy ids may resolve but should not be used in examples for specific external-lane requests.
{{#if contextEnabled}}
- `.inheritContext` (optional): fork-context mode for seeding the subagent with sanitized parent conversation. Omit it or set `"none"` for no copied context. `"receipt"` copies a minimal receipt-sized snapshot, `"last-turn"` copies only the latest exchange, `"bounded"` copies the bounded default snapshot, and `"full"` copies a larger snapshot up to the configured/model token cap. Non-`none` modes work only when global `task.forkContext.enabled` is true and the target agent declares `forkContext: allowed`; otherwise the call is rejected. Bundled agents that support it: `executor`, `executor_ext`, and `architect`. Use inherited context only when the subagent's value depends on parent context; cloned tokens are billed to the child as fresh input and surfaced in task receipts as fork-context cloned-token accounting.
{{/if}}
{{#if independentMode}}- `.inheritContext`: independent mode cannot inherit parent conversation. Omit it or set `"none"`; any non-`none` value is rejected before scheduling.{{/if}}
{{#if customSchemaEnabled}}- `schema`: JTD schema for expected structured output (do not put format rules in assignments){{/if}}
- `spawnPlan` (optional): required before any batch with more than 4 tasks, and before a reviewer agent spawns `explore`; include whyParallel, whyNotLocal, independence, expectedReceiptShape, and maxInlineTokens.
{{#if isolationEnabled}}- `isolated`: run in isolated env; use when tasks edit overlapping files{{/if}}
</parameters>

<agent-routing>
- Generic parallel implementation or research → `executor`.
- PABCD B-stage implementation slices → `executor` by default so actor/self-fork routing can apply.
- Generic subagent/worker + named model/version → `executor_ext`, not `executor`; set each task `.model` explicitly as `provider/modelId[:effort]` (infer effort by task risk when omitted), never rely on the `EXECUTOR_EXT` default for that named-model request.
- Explicit external/ext/fresh/model-diverse executor work with no named model → `executor_ext` with `.model` omitted so the configured `EXECUTOR_EXT` target is used.
- Explicit external/ext/fresh/model-diverse executor work with a named one-off model → `executor_ext` with `.model: "provider/modelId[:effort]"`.
- Research-only `executor_ext` assignments must explicitly say read-only/no product mutation in the task `assignment`.
- Specialist planning/architecture/critique lens → `planner`, `architect`, or `critic`; preserve that role and add `.model` when the user requests an external model for the specialist lens.
</agent-routing>

External executor one-off model example:
`{ "agent": "executor_ext", "tasks": [{ "id": "ExternalReview", "description": "External review", "assignment": "Read-only investigation; do not edit files; read-only/no product mutation.", "model": "provider/modelId:effort" }] }`
Configured external executor example:
`{ "agent": "executor_ext", "tasks": [{ "id": "ExternalReview", "description": "External review", "assignment": "Read-only investigation; do not edit files; read-only/no product mutation." }] }`

Persistent external executor model target: `EXECUTOR_EXT = provider/modelId[:effort]` / `task.agentModelOverrides.executor_ext`.

<rules>
- HARD runtime gate: calls with more than 4 tasks are rejected before any child launches unless `spawnPlan` is complete.
- Reviewer→explore gate: a `reviewer` spawning `explore` is rejected before launch unless `spawnPlan` is complete, even for a single task.
- NEVER assign tasks to run project-wide build/test/lint. Caller verifies after the batch.
- **Subagents do not verify, lint, or format.** Every assignment MUST instruct the subagent to skip all gates and formatters. You run them once at the end across the union of changed files — avoids redundant runs and racing formatter passes.
{{#if ircEnabled}}
- Each task: ≤3–5 explicit files. Overlapping file sets are tolerable when peers can coordinate via `irc`, but still fan out to a cluster when the scopes are cleanly separable.
- No globs, no "update all", no package-wide scope.
{{else}}
- Each task: ≤3–5 explicit files. No globs, no "update all", no package-wide scope. Fan out to a cluster instead.
{{/if}}
- Pass large payloads via `local://<path>` URIs, not inline.
{{#if contextEnabled}}- Put shared constraints in `context` once; do not duplicate across assignments.{{/if}}
- Prefer agents that investigate **and** edit in one pass; only spin a read-only discovery step when affected files are genuinely unknown.
</rules>

<parallelization>
{{#if ircEnabled}}
Test: can task B run correctly without seeing A's output? If no, sequence A → B — **unless** B can reasonably ask A for the missing piece over `irc`. Live coordination beats a serial waterfall when the contract is small and easy to describe in a DM.
Still sequence when one task produces a large, evolving contract (generated types, schema migration, core module API) the other consumes wholesale — IRC round-trips do not replace a finished artifact.
Parallel when tasks touch disjoint files, are independent refactors/tests, or only need occasional clarification that can be resolved peer-to-peer.
{{else}}
Test: can task B run correctly without seeing A's output? If no, sequence A → B.
Sequential when one task produces a contract (types, API, schema, core module) the other consumes.
Parallel when tasks touch disjoint files or are independent refactors/tests.
{{/if}}
</parallelization>

{{#if contextEnabled}}
<context-fmt>
# Goal         ← one sentence: what the batch accomplishes
# Constraints  ← MUST/NEVER rules and session decisions
# Contract     ← exact types/signatures if tasks share an interface
</context-fmt>
{{/if}}

<assignment-fmt>
# Target       ← exact files and symbols; explicit non-goals
# Change       ← step-by-step add/remove/rename; APIs and patterns
# Acceptance   ← observable result; no project-wide commands
</assignment-fmt>

<agents>
{{#if spawningDisabled}}
Agent spawning is disabled for this context.
{{else}}
{{#list agents join="\n"}}
# {{name}}
{{description}}
{{/list}}
{{/if}}
</agents>
