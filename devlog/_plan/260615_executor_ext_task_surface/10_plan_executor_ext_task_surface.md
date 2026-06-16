# 260615 executor_ext callable task-role surface — P plan

> PABCD stage: P / planning draft
> Status: pending Critic review
> Source requirements: `00_moc_executor_ext_task_surface.md` plus final interview answers on executor/executor_ext/specialist routing.

## 1. Goal

Expose `executor_ext` as a first-class callable task role surface while preserving the existing runtime policy: it reuses executor behavior, but runs through the external/fresh/model-configurable executor lane.

The resulting agent-facing doctrine must be:

- `executor` = default general-purpose subagent for ordinary parallel implementation **and** research; normal execution-model fork lane.
- `executor_ext` = explicit external/fresh/model-diverse counterpart for executor-like implementation **and** research; model-configurable via per-task `model` and persistent `EXECUTOR_EXT` / `task.agentModelOverrides.executor_ext`.
- `planner`, `architect`, `critic` = PABCD-lifecycle-centered specialist roles; still directly callable when the user explicitly asks for that lens.
- Specialist lens wins over externality: “external architect review” remains `architect` + model hint/override, not `executor_ext`.
- Agent-facing model examples for `executor_ext` should prefer explicit `provider/modelId[:effort]`; resolver shorthands remain supported but secondary.
- Legacy compatibility stays: `agentModelOverrides.executor` remains fallback for `executor_ext`.

## 2. Non-goals

- Do not add a fifth public workflow skill. Public workflow definitions remain exactly `jaw-interview`, `plan`, `goal`, and `team`.
- Do not make `executor_ext` a separate implementation discipline from executor.
- Do not remove `agentModelOverrides.executor` fallback in this pass.
- Do not route specialist requests to `executor_ext` just because a model is external.
- Do not run project-wide checks from subagents.

## 3. Product/source patch plan

### 3.1 MODIFY `AGENTS.md`

Purpose: update repo-local contributor contract from four role agents to five callable task role agents, without changing the four workflow-skill invariant.

#### Current snippets

```md
JWC intentionally exposes exactly four default workflow definitions. Public names are `jaw-interview`, `plan`, `goal`, and `team`; bundled source directories use those canonical names. Do not add, document, install, or route to additional default workflow definitions without an explicit product decision and gate update. JWC also bundles exactly four source-defined task role agents for delegation; these are not workflow skills and are not committed repo-visible `.jwc` defaults.
```

```md
| `executor` | Bounded implementation/fix/refactor tasks. | `packages/coding-agent/src/prompts/agents/executor.md` |
| `architect` | Read-only architecture and code-review lane. | `packages/coding-agent/src/prompts/agents/architect.md` |
| `planner` | Read-only sequencing and handoff planning lane. | `packages/coding-agent/src/prompts/agents/planner.md` |
| `critic` | Read-only plan critique and actionability review. | `packages/coding-agent/src/prompts/agents/critic.md` |
```

#### Planned after

```md
JWC intentionally exposes exactly four default workflow definitions. Public names are `jaw-interview`, `plan`, `goal`, and `team`; bundled source directories use those canonical names. Do not add, document, install, or route to additional default workflow definitions without an explicit product decision and gate update. JWC also bundles five callable task role agents for delegation; these are not workflow skills and are not committed repo-visible `.jwc` defaults.
```

```md
| `executor` | Default general-purpose implementation/research subagent; normal execution-model fork lane. | `packages/coding-agent/src/prompts/agents/executor.md` |
| `executor_ext` | External/fresh/model-configurable executor lane for user-requested external implementation or research; reuses executor behavior. | `packages/coding-agent/src/prompts/agents/executor.md` via `packages/coding-agent/src/task/agents.ts` |
| `architect` | Read-only architecture and code-review lane, PABCD-lifecycle-centered but directly callable on request. | `packages/coding-agent/src/prompts/agents/architect.md` |
| `planner` | Read-only sequencing and handoff planning lane, PABCD-lifecycle-centered but directly callable on request. | `packages/coding-agent/src/prompts/agents/planner.md` |
| `critic` | Read-only plan critique and actionability review, PABCD-lifecycle-centered but directly callable on request. | `packages/coding-agent/src/prompts/agents/critic.md` |
```

Add a rule-level clarification after the role-agent loading rule:

```md
- `executor_ext` is a callable task role and model target, not a workflow skill. It reuses executor behavior but selects the external/fresh executor lane; prefer explicit `provider/modelId[:effort]` selectors when documenting or invoking its model.
```

### 3.2 MODIFY `packages/coding-agent/src/prompts/system/system-prompt.md`

Purpose: align the top-level agent contract with the five callable task roles and clarify routing.

#### Current snippets

```md
<role-agent-surface>
jwc also bundles four source-defined role agents for the task/sub-agent tool. These are not workflow skills and are not repo-visible `.jwc` defaults. They are implementation and review lanes loaded from source prompts.

<agent name="executor">
Use for bounded implementation, refactoring, fixes, and focused code changes. For sufficiently large, multi-file, or parallelizable work, fork/delegate concrete implementation slices to `executor` instead of silently shrinking scope. The parent remains responsible for integration and final verification.
</agent>

<agent name="planner">
Use for read-only sequencing, acceptance criteria, risk mapping, and execution handoff shape when a task needs planning but not full workflow-mode consensus.
</agent>
```

```md
- Large enough implementation work → delegate bounded slices to `executor` through the task/sub-agent tool when it improves quality or throughput.
- Planning/review lanes → use `planner`, `architect`, and `critic` as bounded role agents when a full workflow handoff is unnecessary.
```

```md
- Delegate rather than silently shrinking scope. Prefer `executor` for bounded implementation slices, `planner` for sequencing, `architect` for architecture/code-review lanes, and `critic` for plan critique.
```

#### Planned after

```md
<role-agent-surface>
jwc bundles five callable task role agents. These are not workflow skills and are not repo-visible `.jwc` defaults. They are general subagent and specialist review lanes loaded from source prompts/runtime policy.

<agent name="executor">
Default general-purpose subagent for ordinary parallel implementation, fixes, refactors, repository investigation, and read-only research. It uses the normal execution-model fork lane. Use it when the user asks for generic subagent parallelism or worker fan-out without requesting an external/fresh/model-diverse executor lane.
</agent>

<agent name="executor_ext">
External/fresh counterpart to `executor` for executor-like implementation or research when the user explicitly asks for external/ext subagents, independent executor workers, model-diverse executor work, or the configured `EXECUTOR_EXT` target. Prefer explicit per-task model selectors such as `provider/modelId[:effort]`. A model hint alone does not imply `executor_ext`; use specialist roles with model hints when the requested lens is planner, architect, or critic.
</agent>

<agent name="planner">
PABCD-lifecycle-centered read-only sequencing, acceptance criteria, risk mapping, and execution handoff role. It remains directly callable when the user explicitly requests a planner lens.
</agent>

<agent name="architect">
PABCD-lifecycle-centered read-only architecture and code-review role, including architectural status (`CLEAR`/`WATCH`/`BLOCK`) and severity-rated review concerns. It remains directly callable when the user explicitly requests an architect lens.
</agent>

<agent name="critic">
PABCD-lifecycle-centered read-only plan critique role. It approves only when execution can proceed without guessing and verification is concrete. It remains directly callable when the user explicitly requests a critic lens.
</agent>
```

Routing bullets become:

```md
- Large enough generic implementation/research work → delegate bounded slices to `executor` through the task/sub-agent tool when it improves quality or throughput.
- PABCD B-stage implementation slices → use normal `executor` actor/self-fork behavior unless the user explicitly requested the external executor lane.
- User explicitly requests external/ext/fresh/model-diverse executor workers → use `executor_ext`; put explicit selectors like `provider/modelId[:effort]` in task `.model` when a model is requested.
- Planning/review specialist lens → use `planner`, `architect`, and `critic`; they are PABCD-lifecycle-centered but directly callable when requested, and role choice wins over external model choice.
```

Decomposition bullet becomes:

```md
- Delegate rather than silently shrinking scope. Prefer `executor` for ordinary bounded implementation or research slices, `executor_ext` for user-requested external/fresh executor lanes, and `planner`/`architect`/`critic` for explicit specialist lifecycle/review lenses.
```

### 3.3 MODIFY `packages/coding-agent/src/prompts/tools/task.md`

Purpose: make the active TaskTool description agent-friendly so future model calls can select `executor_ext` and express model selection correctly.

#### Current snippets

```md
- `agent`: agent type for all tasks
```

```md
- `.model` (optional): model hint for this task. `"self"` or omitted = parent model. `"cheap:<provider>"` or `"best:<provider>"` = preset lookup (e.g. `"cheap:anthropic"` → sonnet). Direct model ID also accepted (e.g. `"claude-sonnet-4-6"`). Use cheap for exploratory/parsing tasks, best for quality-critical work.
```

#### Planned after

```md
- `agent`: callable task role for all tasks. Use `executor` for ordinary parallel implementation/research, `executor_ext` for explicit external/ext/fresh/model-diverse executor work, and `planner`/`architect`/`critic` for explicit specialist lenses.
```

```md
- `.model` (optional): model hint for this task. Prefer explicit `provider/modelId[:effort]` when the user names an external or specific model (especially with `executor_ext`), e.g. `openai/gpt-5.4:high`. `"self"` or omitted = parent model. `"cheap:<provider>"` or `"best:<provider>"` = preset lookup; bare/canonical/fuzzy ids may resolve but should not be used in examples for specific external-lane requests.
```

Insert after `<parameters>` a compact routing note:

```md
<agent-routing>
- Generic parallel implementation or research → `executor`.
- PABCD B-stage implementation slices → `executor` by default so actor/self-fork routing can apply.
- Explicit external/ext/fresh/model-diverse executor work → `executor_ext`; combine with `.model: "provider/modelId[:effort]"` for one-off external model selection.
- Research-only `executor_ext` assignments must explicitly say read-only/no product mutation in the task `assignment`.
- Specialist planning/architecture/critique lens → `planner`, `architect`, or `critic`; preserve that role and add `.model` when the user requests an external model for the specialist lens.
</agent-routing>
```

Add an agent-facing example immediately after `<agent-routing>`:

```md
External executor one-off model example:
`{ "agent": "executor_ext", "tasks": [{ "id": "ExternalReview", "description": "External review", "assignment": "Read-only investigation; do not edit files.", "model": "provider/modelId:effort" }] }`

Persistent external executor model target: `EXECUTOR_EXT = provider/modelId[:effort]` / `task.agentModelOverrides.executor_ext`.
```

Update the existing `.inheritContext` bullet to the full planned-after sentence:

```md
- `.inheritContext` (optional): fork-context mode for seeding the subagent with sanitized parent conversation. Omit it or set `"none"` for no copied context. `"receipt"` copies a minimal receipt-sized snapshot, `"last-turn"` copies only the latest exchange, `"bounded"` copies the bounded default snapshot, and `"full"` copies a larger snapshot up to the configured/model token cap. Non-`none` modes work only when global `task.forkContext.enabled` is true and the target agent declares `forkContext: allowed`; otherwise the call is rejected.
  Bundled agents that support it: `executor`, `executor_ext`, and `architect`.
  Use inherited context only when the subagent's value depends on parent context; cloned tokens are billed to the child as fresh input and surfaced in task receipts as fork-context cloned-token accounting.
```

### 3.4 MODIFY `packages/coding-agent/src/task/types.ts`

Purpose: ensure schema metadata matches the rendered tool prompt.

#### Current snippets

```ts
model: z
	.string()
	.optional()
	.describe(
		"model hint for this task: self (parent model), cheap:<provider> or best:<provider> (preset lookup), or a direct model ID",
	),
```

```ts
agent: z.string().describe("agent type"),
```

#### Planned after

```ts
model: z
	.string()
	.optional()
	.describe(
		"model hint for this task: prefer explicit provider/modelId[:effort] for specific external models; self uses the parent model; cheap:<provider> or best:<provider> are preset lookups; bare/canonical ids may resolve but are less explicit",
	),
```

```ts
agent: z
	.string()
	.describe(
		"callable task role: executor for ordinary parallel implementation/research, executor_ext for explicit external/fresh/model-diverse executor work, planner/architect/critic for specialist lenses",
	),
```

### 3.5 MODIFY `packages/coding-agent/src/task/agents.ts`

Purpose: make `executor_ext` visible in the bundled agent list and TaskTool `<agents>` section while keeping executor prompt reuse.

#### Current snippet

```ts
const EMBEDDED_AGENT_DEFS: EmbeddedAgentDef[] = [
	{ fileName: "executor.md", template: executorMd },
	{ fileName: "architect.md", template: architectMd },
	{ fileName: "planner.md", template: plannerMd },
	{ fileName: "critic.md", template: criticMd },
```

#### Planned after

Use an explicit generated-content branch so `executor_ext` is visible without adding a duplicate prompt file.

Replace the single-shape `EmbeddedAgentDef` interface with a discriminated union:

```ts
type EmbeddedAgentDef =
	| {
			fileName: string;
			frontmatter?: AgentFrontmatter;
			template: string;
	  }
	| {
			fileName: string;
			content: () => string;
	  };
```

Update `buildAgentContent` exactly at the current function boundary to render generated content lazily, preserving the current “computed lazily on first loadBundledAgents() call” behavior:

```ts
function buildAgentContent(def: EmbeddedAgentDef): string {
	if ("content" in def) return def.content();
	const body = prompt.render(def.template);
	if (!def.frontmatter) return body;
	return prompt.render(agentFrontmatterTemplate, { ...def.frontmatter, body });
}
```

This replaces the current `buildAgentContent` body at `packages/coding-agent/src/task/agents.ts`; it is not a pseudocode alternative.
Add a helper that derives `executor_ext` content from executor body instead of maintaining a duplicated prompt file:

```ts
function buildExecutorExtContent(): string {
	const { body } = parseFrontmatter(executorMd, {
		location: "embedded:executor.md",
		level: "fatal",
	});
	return prompt.render(agentFrontmatterTemplate, {
		name: "executor_ext",
		description:
			"External/fresh model-configurable executor lane for user-requested external implementation or research; reuses executor behavior",
		model: "self",
		thinkingLevel: Effort.Medium,
		forkContext: "allowed",
		body,
	});
}
```

Acceptance note: the derived prompt body may still say “You are Executor” because `executor_ext` intentionally reuses executor behavior. If product wants a visible identity difference, prepend a small lane banner in `buildExecutorExtContent()` before `body`; otherwise tests must assert that reuse is intentional rather than drift.

Then insert the derived role immediately after executor:

```ts
const EMBEDDED_AGENT_DEFS: EmbeddedAgentDef[] = [
	{ fileName: "executor.md", template: executorMd },
	{ fileName: "executor_ext.md", content: buildExecutorExtContent },
	{ fileName: "architect.md", template: architectMd },
	{ fileName: "planner.md", template: plannerMd },
	{ fileName: "critic.md", template: criticMd },
```

Do not add `packages/coding-agent/src/prompts/agents/executor_ext.md`. The on-disk prompt source remains shared with `executor`; the callable role is generated in `task/agents.ts`.

### 3.6 KEEP `packages/coding-agent/src/task/index.ts` runtime alias behavior, with comments only if needed

Purpose: preserve existing semantics.

Current behavior is already correct:

```ts
const agentName = requestedAgentName === "executor_ext" ? "executor_ext" : requestedAgentName;
const agentLookupName = requestedAgentName === "executor_ext" ? "executor" : requestedAgentName;
```

```ts
const settingsModelOverride =
	agentName === "executor"
		? undefined
		: agentName === "executor_ext"
			? (agentModelOverrides.executor_ext ?? agentModelOverrides.executor)
			: agentModelOverrides[agentName];
```

```ts
if (executionOverrides?.runMode || executionOverrides?.resumeMessage || agentName === "executor_ext") {
	return { kind: "none" };
}
```

```ts
agentName === "executor_ext" ? { affine: false, reason: "executor_ext" } : undefined;
```

Patch only if implementation review shows comments/help text need clarification. Do not remove the legacy fallback.

### 3.7 MODIFY `packages/coding-agent/src/prompts/system/executor-self-fork.md`

Purpose: likely no change required; current text already distinguishes default executor self-fork from executor_ext. If touched, keep it minimal.

Current text:

```md
You are running as the default executor self-fork lane. Inherit the parent model and reasoning policy, treat the forked parent-context snapshot as cache-affine background, and append this assignment as the current directive. Do not treat external executor model presets as applying to this lane; model-configurable executor work uses executor_ext instead.
```

Planned action: leave unchanged unless tests require a wording alignment.

### 3.8 MODIFY `docs/models.md`

Purpose: update model profile role documentation to include `executor_ext` and explicit selector requirements.

#### Current snippet

```md
`model_mapping` keys are role names (`default`, `executor`, `architect`, `planner`, `critic`). Each role maps to exactly one model selector in the form `provider/modelId[:effort]`; comma-separated fallback chains are not supported in a single role value.
```

#### Planned after

```md
`model_mapping` keys are role names (`default`, `executor`, `executor_ext`, `architect`, `planner`, `critic`). `executor` is accepted as a legacy compatibility key and resolves to the external executor model target; prefer `executor_ext` / `EXECUTOR_EXT` for new configs. Each role maps to exactly one model selector in the form `provider/modelId[:effort]`; comma-separated fallback chains are not supported in a single role value.
```

### 3.9 MODIFY `structure/20_prompt_flow.md`

Purpose: keep maintained architecture docs in sync.

#### Current snippet

```md
| `prompts/agents/*` | role agents prompt source. `architect`, `critic`, `executor`, `planner` 등. | ... |
```

#### Planned after

```md
| `prompts/agents/*` + `task/agents.ts` | callable task role-agent source. `executor` is the default general subagent; `executor_ext` is derived from executor as the external/fresh lane; `architect`, `critic`, and `planner` are lifecycle-centered specialist roles. | ... |
```
### 3.10 MODIFY definition-surface gate scripts

Purpose: keep mandatory gates passing while preserving the chosen design: four on-disk source prompt files for role prompts, five callable task roles at runtime.

#### MODIFY `scripts/check-visible-definitions.ts`

Current:

```ts
const expectedRoleAgents = ["architect", "critic", "executor", "planner"];
```

Planned:

```ts
const expectedRoleAgentPromptFiles = ["architect", "critic", "executor", "planner"];
const expectedCallableTaskRoles = ["architect", "critic", "executor", "executor_ext", "planner"];
```

Add a small shared assertion helper for gate scripts instead of three ad-hoc parsers:

```ts
// scripts/lib/callable-task-roles.ts
import { clearBundledAgentsCache, loadBundledAgents } from "../../packages/coding-agent/src/task/agents";

export function listCallableTaskRoles(): string[] {
	clearBundledAgentsCache();
	return loadBundledAgents()
		.filter(agent => !agent.hide)
		.map(agent => agent.name)
		.sort();
}

export async function assertCallableTaskRoles(expected: readonly string[], repoRoot = process.cwd()): Promise<string[]> {
	const actual = listCallableTaskRoles();
	const findings: string[] = [];
	if (JSON.stringify(actual) !== JSON.stringify([...expected].sort())) {
		findings.push(`callable task roles mismatch: expected ${[...expected].sort().join(", ")}, got ${actual.join(", ")}`);
	}
	if (await Bun.file(`${repoRoot}/packages/coding-agent/src/prompts/agents/executor_ext.md`).exists()) {
		findings.push("executor_ext must be generated from executor; prompts/agents/executor_ext.md must not exist");
	}
	return findings;
}
```

Use this helper from `scripts/check-visible-definitions.ts`, `scripts/verify-g002-gates.ts`, and `scripts/rebrand-inventory.ts`; keep prompt-file checks separate.
The three gate scripts must call `await assertCallableTaskRoles(EXPECTED_CALLABLE_TASK_ROLES, repoRoot)` in the same patch that adds the generated `executor_ext` role; do not land §3.5 without §3.10 and §4.1/§4.3.
Because `scripts/check-visible-definitions.ts` is currently synchronous, wrap its main body in an async `main()` / top-level await when calling the async helper.

Use `expectedRoleAgentPromptFiles` for `.md` file existence and gitignore checks. Use `loadBundledAgents()` as the single canonical callable-role mechanism and verify visible bundled agent names include exactly `architect`, `critic`, `executor`, `executor_ext`, and `planner` while `packages/coding-agent/src/prompts/agents/executor_ext.md` remains absent. Update output wording from “bundled role agents” to distinguish “role prompt files” and “callable task roles”.

#### MODIFY `scripts/verify-g002-gates.ts`

Current:

```ts
const EXPECTED_ROLE_AGENTS = ["architect", "critic", "executor", "planner"] as const;
```

Planned:

```ts
const EXPECTED_ROLE_AGENT_PROMPT_FILES = ["architect", "critic", "executor", "planner"] as const;
const EXPECTED_CALLABLE_TASK_ROLES = ["architect", "critic", "executor", "executor_ext", "planner"] as const;
```

Use prompt-file constants for public-definition-content scanning so forbidden-token checks still read real prompt files only. Use `loadBundledAgents()` as the single canonical callable-role mechanism and assert every callable task role exists, including generated `executor_ext`, and that no duplicate `prompts/agents/executor_ext.md` prompt file is present.

#### MODIFY `scripts/rebrand-inventory.ts`

Current:

```ts
const expectedBundledRoleAgents = ["architect", "critic", "executor", "planner"] as const;
```

Planned:

```ts
const expectedBundledRoleAgentPromptFiles = ["architect", "critic", "executor", "planner"] as const;
const expectedCallableTaskRoles = ["architect", "critic", "executor", "executor_ext", "planner"] as const;
```

Keep `listBundledRoleAgents()` focused on on-disk prompt files unless the inventory output is renamed. Add a separate callable-task-role inventory entry or detail sourced from `loadBundledAgents()` so strict inventory can detect missing `executor_ext`; also assert `packages/coding-agent/src/prompts/agents/executor_ext.md` remains absent. Do not implement a separate parser for `EMBEDDED_AGENT_DEFS`.

### 3.11 MODIFY `docs/tools/task.md`

Purpose: repo tool documentation appears stale relative to current task roles. If touched, update the bundled-agent section only, not a full rewrite.

Current stale snippet:

```md
- Bundled agent types
  - `explore` — read-only scout with structured handoff output.
  - `plan` — architecture/planning agent; may spawn `explore`.
  - `designer` — UI/UX specialist.
  - `reviewer` — review agent with `report_finding` extraction.
  - `task` — general-purpose worker with full capabilities.
```

Planned after:

```md
- Visible callable task roles
  - `executor` — default general-purpose implementation/research subagent; normal execution-model fork lane.
  - `executor_ext` — external/fresh/model-configurable executor lane; use when the user explicitly asks for external/ext/model-diverse executor work.
  - `planner` — PABCD-lifecycle-centered planning/handoff specialist; directly callable on request.
  - `architect` — PABCD-lifecycle-centered architecture/code-review specialist; directly callable on request.
  - `critic` — PABCD-lifecycle-centered plan critique specialist; directly callable on request.
- Hidden support agents such as `explore`, `plan`, `reviewer`, and `task` may remain resolvable internally but should not be presented as ordinary default roles.
```

## 4. Test patch plan

### 4.1 MODIFY `packages/coding-agent/test/default-jwc-definitions.test.ts`

Current:

```ts
const roleAgentNames = ["architect", "critic", "executor", "planner"] as const;
```

Planned:

```ts
const roleAgentNames = ["architect", "critic", "executor", "executor_ext", "planner"] as const;
```

Rename test:

```ts
it("keeps the five callable role agents bundled when project .jwc is absent", async () => {
```

Update role boundary assertions:

```ts
const executorExt = getBundledAgent("executor_ext");
expect(executorExt?.tools).toBeUndefined();
expect(executorExt?.model).toEqual(["self"]);
expect(executorExt?.systemPrompt).toContain("Convert a scoped task into a working, verified outcome");
expect(executorExt?.description).toContain("External");
```

Keep workflow skill assertions at exactly four.
Implementation ordering constraint: this test update lands atomically with §3.5 generated `executor_ext` and §3.10 gate helper changes. Do not land a five-callable-role `loadBundledAgents()` change while leaving this file's `roleAgentNames` at four.

### 4.2 MODIFY `packages/coding-agent/test/task/agent-visibility.test.ts`
Current:

```ts
expect(visibility.get("executor")).toBeUndefined();
expect(visibility.get("architect")).toBeUndefined();
expect(visibility.get("planner")).toBeUndefined();
expect(visibility.get("critic")).toBeUndefined();
```

Planned:

```ts
expect(visibility.get("executor")).toBeUndefined();
expect(visibility.get("executor_ext")).toBeUndefined();
expect(visibility.get("architect")).toBeUndefined();
expect(visibility.get("planner")).toBeUndefined();
expect(visibility.get("critic")).toBeUndefined();
```

Add a description test:

```ts
it("advertises executor_ext with explicit model guidance", async () => {
	const tool = await TaskTool.create(createSession());
	expect(tool.description).toContain("executor_ext");
	expect(tool.description).toContain("provider/modelId[:effort]");
	expect(tool.description).toContain("Generic parallel implementation or research");
	expect(tool.description).toContain("EXECUTOR_EXT");
	expect(tool.description).toContain("task.agentModelOverrides.executor_ext");
	expect(tool.description).toContain("Read-only investigation");
	expect(tool.description).toContain("read-only/no product mutation");
	expect(tool.description).toContain('"agent": "executor_ext"');
	expect(tool.description).toContain("ExternalReview");
});
```

### 4.3 MODIFY `packages/coding-agent/test/task-bundled-agent-surface.test.ts`

Purpose: protect the exact “derived visible role without duplicate prompt file” contract.

Current expected embedded files omit `executor_ext.md` and expected prompt files omit `executor_ext.md`.

Planned embedded-agent assertion:

```ts
expect(extractEmbeddedAgentFileNames(source)).toEqual([
	"architect.md",
	"critic.md",
	"executor.md",
	"executor_ext.md",
	"explore.md",
	"plan.md",
	"planner.md",
	"reviewer.md",
	"task.md",
]);
```

Planned prompt-file assertion keeps no duplicate prompt file:

```ts
expect(promptFiles).toEqual([
	"architect.md",
	"critic.md",
	"executor.md",
	"explore.md",
	"frontmatter.md",
	"init.md",
	"plan.md",
	"planner.md",
	"reviewer.md",
	"task.md",
]);
expect(promptFiles).not.toContain("executor_ext.md");
```

Rename the test to “ships five visible callable role agents plus retained hidden support agents”.
Implementation ordering constraint: this bundled-surface test update lands atomically with §3.5 generated `executor_ext` and §3.10 gate helper changes. Do not land a generated `executor_ext` role before this test protects both `executor_ext.md` in `EMBEDDED_AGENT_DEFS` and absence of `prompts/agents/executor_ext.md`.

### 4.4 ADD `packages/coding-agent/test/task/executor-ext-model-routing.test.ts`

Add a deterministic TaskTool harness test rather than leaving model precedence optional. The test should prove:

- `agent: "executor_ext"` uses `task.agentModelOverrides.executor_ext` when no per-task model exists.
- `tasks[].model = "openai/example-model:high"` wins over `task.agentModelOverrides.executor_ext`.
- `agentModelOverrides.executor` remains fallback when `executor_ext` is absent.
- result metadata still reports `agent: "executor_ext"` and `cacheAffinity.reason = "executor_ext"`.

Use the existing TaskTool mocking style from `task-fork-context.test.ts` / `task-workflow-actor-routing.test.ts`; keep the test focused and avoid broad integration fixtures.
Concrete file name: `packages/coding-agent/test/task/executor-ext-model-routing.test.ts`.

### 4.5 MODIFY `packages/coding-agent/test/task-workflow-actor-routing.test.ts`

Add a PABCD routing regression proving `agent: "executor_ext"` bypasses workflow actor resume/self-fork routing using the existing harness shape. First parameterize the local helper:

```ts
function createTool(agentName = "critic"): { tool: Promise<TaskTool>; options: CapturedCreateOptions[] } {
	vi.spyOn(discoveryModule, "discoverAgents").mockResolvedValue({
		agents: [agent(agentName)],
		projectAgentsDir: null,
	});
	// existing helper body unchanged
}
```

Then add the executor_ext test:

```ts
it("does not route executor_ext through PABCD workflow actors", async () => {
	const { tool } = createTool("executor");
	const taskTool = await tool;
	const openSpy = vi.spyOn(SessionManager, "open");
	const manager = new AsyncJobManager({ onJobComplete: async () => {} });
	AsyncJobManager.setInstance(manager);

	const result = await taskTool.execute("call-ext", {
		agent: "executor_ext",
		tasks: [{ id: "External", description: "external", assignment: "Do external work." }],
	});
	await manager.waitForAll();

	expect(openSpy).not.toHaveBeenCalled();
	expect((await readActorRegistry(cwd, sessionId)).actors).toHaveLength(0);
	expect(result.details?.results[0]?.agent).toBe("executor_ext");
	expect(result.details?.results[0]?.cacheAffinity).toEqual({ affine: false, reason: "executor_ext" });
	await manager.dispose({ timeoutMs: 100 });
});
```

The assertion must prove no compatible workflow actor is created or resumed for `executor_ext`.

### 4.6 MODIFY `packages/coding-agent/test/task-executor-self-fork.test.ts`
Keep the existing receipt assertion that covers `cacheAffinity.reason = "executor_ext"`. If the new focused TaskTool model precedence test also covers non-cache-affinity, do not duplicate runtime setup here.

### 4.7 MODIFY `packages/coding-agent/test/system-prompt-templates.test.ts`

Use a raw `system-prompt.md` static assertion as the authoritative minimum check; do not leave a rendered-vs-static choice. Required strings:

```ts
expect(systemPrompt).toContain("five callable task role agents");
expect(systemPrompt).toContain("executor_ext");
expect(systemPrompt).toContain("provider/modelId[:effort]");
expect(systemPrompt).toContain("role choice wins over external model choice");
expect(systemPrompt).toContain("PABCD B-stage implementation slices");
```

## 5. Verification plan

Focused tests after implementation:

```sh
bun test packages/coding-agent/test/default-jwc-definitions.test.ts packages/coding-agent/test/task/agent-visibility.test.ts packages/coding-agent/test/task-bundled-agent-surface.test.ts packages/coding-agent/test/task/executor-ext-model-routing.test.ts packages/coding-agent/test/task-workflow-actor-routing.test.ts packages/coding-agent/test/task-executor-self-fork.test.ts packages/coding-agent/test/system-prompt-templates.test.ts
```

Runtime/model routing regression tests if `task/index.ts` or model routing code changes:

```sh
bun test packages/coding-agent/test/task-workflow-actor-routing.test.ts packages/coding-agent/test/model-profile-activation.test.ts packages/coding-agent/test/model-profiles-schema.test.ts packages/coding-agent/test/model-selector-profiles.test.ts packages/coding-agent/test/model-selector-role-badge-thinking.test.ts
```

Workflow/default-surface gates because this changes role-agent surface and prompt guidance:

```sh
bun scripts/check-visible-definitions.ts
bun scripts/verify-g002-gates.ts
bun scripts/rebrand-inventory.ts --strict
bun test packages/coding-agent/test/default-jwc-definitions.test.ts
```

Type/lint gate:

```sh
bun --cwd=packages/coding-agent run check:types
bunx biome check AGENTS.md docs/models.md docs/tools/task.md structure/20_prompt_flow.md scripts/lib/callable-task-roles.ts packages/coding-agent/src/prompts/system/system-prompt.md packages/coding-agent/src/prompts/tools/task.md packages/coding-agent/src/task/agents.ts packages/coding-agent/src/task/types.ts packages/coding-agent/test/default-jwc-definitions.test.ts packages/coding-agent/test/task/agent-visibility.test.ts packages/coding-agent/test/task-bundled-agent-surface.test.ts packages/coding-agent/test/task/executor-ext-model-routing.test.ts packages/coding-agent/test/task-workflow-actor-routing.test.ts packages/coding-agent/test/task-executor-self-fork.test.ts packages/coding-agent/test/system-prompt-templates.test.ts
```

## 6. Acceptance criteria

- TaskTool description exposes `executor_ext` as a callable visible role.
- TaskTool description gives future agents unambiguous routing:
  - ordinary parallel implementation/research → `executor`;
  - explicit external/ext/fresh/model-diverse executor work → `executor_ext`;
  - specialist planning/architecture/critique → `planner`/`architect`/`critic` even with external model hints.
- `executor_ext` visible description and schema examples prefer `provider/modelId[:effort]`.
- `executor_ext` reuses executor behavior/prompt body; no duplicated divergent implementation prompt is introduced.
- Existing runtime semantics stay intact: `executor_ext` uses `agentModelOverrides.executor_ext ?? agentModelOverrides.executor`, bypasses workflow actor self-fork routing, and reports non-cache-affine diagnostics.
- Public workflow skill count remains exactly four.
- Callable visible task role count becomes five.
- Tests protect the distinction between public workflow skills, the default general `executor` lane, the external `executor_ext` lane, and PABCD-centered specialist lifecycle/review roles.
- Research-only `executor_ext` assignments require explicit read-only/no-product-mutation wording in the parent task assignment.
