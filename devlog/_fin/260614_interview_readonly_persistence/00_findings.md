# Jaw Interview read-only persistence boundary findings

Date: 2026-06-14
Scope: read-only rules and artifact persistence paths that affect jaw-interview, planning, role agents, and next-turn research continuity. This note records the current state only; it does not change product source or workflow prompts.

## User directive captured

- New behavior policy: when a concrete product/source edit path is found, do not immediately patch. First finish read-only investigation, explain the root cause, affected paths, intended patch shape, and verification plan, then wait for explicit user confirmation.
- Read-only workflow modes must not mutate product/source code, but planning/devlog/spec artifacts are not the same category as product source.
- Jaw Interview should be able to keep searching/researching across turns and record current situation in allowed planning/devlog/spec artifacts when needed.

## Paths inspected

### System and prompt policy

- `packages/coding-agent/src/prompts/system/system-prompt.md`
  - Current edit policy now requires an explicit confirmation checkpoint before product/source edits.
  - Current local-search policy points repository/code questions to `find`, `search`, `ast_grep`, LSP references/definitions, and `read`.
  - Current public workflow surface lists `jaw-interview`, `plan`, `goal`, `team`, and native `orchestrate`.

### Jaw Interview skill

- `packages/coding-agent/src/defaults/jwc/skills/jaw-interview/SKILL.md`
  - Purpose/boundary: writes specs before execution; execution remains gated through `jwc orchestrate p --spec-ref <spec>` and later explicit approval.
  - Auto-mode architects are read-only and currently say: no code edits, no `.jwc/` mutation, no workflow chaining, no formatters, no execution delegation.
  - Brownfield phase already says to consult prior planning knowledge from `.jwc/specs/jaw-interview-*.md`, legacy `.jwc/specs/deep-*.md`, and `.jwc/plans/*.md`.
  - Artifact discipline currently forbids direct `write`, `edit`, or `ast_edit` against `.jwc/specs`, `.jwc/plans`, `.jwc/state`, or other `.jwc/` paths unless force override is active.
  - Final spec persistence is allowed through the native jaw-interview write command at `.jwc/specs/jaw-interview-{slug}.md`.
  - State persistence is allowed through `jwc state write`.

### Legacy plan skill / plan artifact writer

- `packages/coding-agent/src/defaults/jwc/skills/ralplan/SKILL.md`
  - Legacy skill is superseded for new planning by native `jwc orchestrate p`.
  - Planning boundary explicitly allows inspecting context and drafting/updating plan/spec/proposal artifacts.
  - Before execution approval it forbids product-source mutation, mutation-oriented shell commands, commits, pushes, PRs, execution skills, and implementation delegation.
  - Durable plan artifacts must be persisted through `jwc ralplan --write`, not direct `.jwc/` file edits.

### Goal skill

- `packages/coding-agent/src/defaults/jwc/skills/ultragoal/SKILL.md`
  - Goal leader owns `.jwc/ultragoal/goals.json` and `.jwc/ultragoal/ledger.jsonl`.
  - Role agents return evidence and do not checkpoint or mutate goal state.
  - Internal ai-slop-cleaner fragment is read-only and must not edit code, write files, mutate `.jwc/`, checkpoint, call goal tools, or spawn workflows.

### Team skill

- `packages/coding-agent/src/defaults/jwc/skills/team/SKILL.md`
  - Team has explicit read-only status/list surfaces and mutating monitor/resume/claim/shutdown paths.
  - Workers do not own Ultragoal state or hidden goal mutation.

### Role agents

- `packages/coding-agent/src/prompts/agents/planner.md`
  - Read-only: never write/edit/format/commit/push/mutate files.
  - Exception: restricted `bash` may use `jwc ralplan --write` and `jwc state` workflow commands.
  - Durable plans must be persisted only through `jwc ralplan --write` inline artifact content.

- `packages/coding-agent/src/prompts/agents/architect.md`
  - Read-only: never write/edit/format/commit/push/mutate files.
  - Exception: restricted `bash` may use `jwc ralplan --write` and `jwc state` workflow commands.

- `packages/coding-agent/src/prompts/agents/critic.md`
  - Read-only: do not write/edit/format/commit/push/mutate files.
  - Exception: restricted `bash` may use `jwc ralplan --write` and `jwc state` workflow commands.

### Existing devlog precedent

- `devlog/_plan/260613_skill_consolidation/13_pabcd_state_leak_followup.md`
  - Existing example of a read-only investigation note under `devlog/_plan/`.

- `devlog/_plan/260613_skill_consolidation/20_workflow_state_isolation_plan.md`
  - Existing detailed plan under `devlog/_plan/` that maps product changes while not itself being product source.

## Boundary clarification needed

The current wording has a useful safety rule but conflates two different concepts in several places:

1. Product/source mutation — code, tests, runtime prompts, package source, committed product docs that alter behavior.
2. Workflow/planning persistence — `.jwc/specs`, `.jwc/plans/ralplan`, `.jwc/state`, `.jwc/ultragoal`, and `devlog/_plan/**` records.

For every read-only workflow surface, not only Jaw Interview, the desired boundary is not "write nothing". It is:

- Do not mutate product/source files or execute implementation before approval.
- Do persist workflow artifacts through sanctioned workflow commands.
- Plan/artifact writes are always allowed when they are the workflow's sanctioned persistence channel (`jwc ralplan --write`, native orchestrate/jaw-interview writers, `jwc state write`, goal/team ledger commands that the active workflow owns).
- Devlog/plan notes are allowed as planning records when the user asks for them or when needed to preserve continuity.
- Direct `.jwc/` edits should remain forbidden except force override; `.jwc` workflow artifacts should be written through the native CLI/state/writer commands.

## Proposed patch shape for a later confirmed edit

### 1. Global read-only surfaces

For all read-only surfaces, add/standardize the rule:

- Read-only means no product/source mutation.
- It does not block sanctioned plan/spec/state/ledger persistence.
- Plan write is not an implementation edit; it remains allowed through the appropriate workflow writer even in read-only planning/review/interview modes.
- Direct `.jwc/**` file edits remain forbidden unless an explicit force override is active.

### 2. `packages/coding-agent/src/defaults/jwc/skills/jaw-interview/SKILL.md`

Add a dedicated `Read-only and persistence boundary` section near `Execution_Policy` / `Internal_Auto_Mode_Protocol`:

- Jaw Interview is read-only with respect to product/source files.
- Allowed persistence:
  - `jwc state write` for interview state.
  - native jaw-interview `--write --stage final` for final specs.
  - sanctioned planning/devlog notes under `devlog/_plan/**` when the user explicitly asks for a durable investigation/plan note.
  - reading existing `.jwc/specs/**`, `.jwc/plans/**`, and devlog planning records to avoid re-asking known facts.
- Disallowed persistence:
  - direct edits to product/source files.
  - direct `write`/`edit`/`ast_edit` under `.jwc/**` unless force override is active.
  - execution delegation or workflow chaining before explicit user approval.

Update brownfield context step to include:

- `devlog/_plan/**/*.md` as durable planning knowledge, bounded to the 1-3 most relevant records.
- If a relevant devlog/plan record exists, summarize durable facts and open gaps for Round 1 and for next-turn continuation.

Update final checklist to verify:

- Product/source files were not edited.
- All allowed persistence went through sanctioned workflow commands or user-requested devlog planning notes.
- Local planning knowledge was consulted: `.jwc/specs`, `.jwc/plans`, and `devlog/_plan` when relevant.

### 3. `packages/coding-agent/src/prompts/system/system-prompt.md`

Consider adding a concise global distinction:

- "Read-only" means no product/source mutation unless the mode explicitly allows it; it does not forbid sanctioned workflow artifact persistence, state writes, specs/plans, or user-requested devlog notes.
- Before product/source edits, use the confirmation checkpoint.

### 4. Role-agent prompts

Planner/Architect/Critic currently allow `jwc ralplan --write` and `jwc state`; this matches the clarified rule that plan writes are always allowed through sanctioned workflow persistence even when the role is read-only. If these agents need to record user-requested devlog notes, their restricted tool contract would need an explicit new sanctioned path. Otherwise keep devlog writing owned by the main session, not read-only role agents.

## Verification plan for later confirmed edit

Focused tests to add/update:

- `packages/coding-agent/test/jaw-interview-skill-policy.test.ts`
  - asserts Jaw Interview says product/source edits are forbidden.
  - asserts sanctioned persistence is allowed for `jwc state write` and native final spec writer.
  - asserts direct `.jwc/**` edits remain forbidden.
  - asserts `devlog/_plan/**` is described as allowed planning record only when user-requested / continuity-needed, not as product-source mutation.

- `packages/coding-agent/test/system-prompt-templates.test.ts`
  - asserts global read-only wording distinguishes product/source mutation from sanctioned workflow artifact persistence.
  - asserts confirmation checkpoint remains required before product/source edits.

Likely verification command after confirmed patch:

```sh
bun test packages/coding-agent/test/jaw-interview-skill-policy.test.ts packages/coding-agent/test/system-prompt-templates.test.ts packages/coding-agent/test/default-jwc-definitions.test.ts
```

## Current recommendation

Do not patch the Jaw Interview skill immediately without confirmation. The concrete target is now identified. Recommended next edit, if approved, is a small prompt-policy patch to `packages/coding-agent/src/defaults/jwc/skills/jaw-interview/SKILL.md` plus tests in `jaw-interview-skill-policy.test.ts`, with an optional system-prompt clarification if the user wants the boundary global rather than interview-specific.

## 2026-06-14 addendum: precedence flip and legacy-name boundary

### Question investigated

The user asked whether the rule can be "flipped" so sanctioned plan/spec/state persistence is evaluated before the broad read-only prohibition, and whether the legacy `ralplan`/`ultragoal` names had already been renamed.

### Current product facts

- Public workflow names are already flipped to `plan` and `goal`:
  - `packages/coding-agent/src/defaults/jwc-defaults.ts` exports `DEFAULT_JWC_DEFINITION_NAMES = ["jaw-interview", "plan", "team", "goal"]`.
  - The same file maps public `plan` to `skills/ralplan/SKILL.md` and public `goal` to `skills/ultragoal/SKILL.md`.
  - `packages/coding-agent/src/defaults/jwc/skills/ralplan/SKILL.md` has frontmatter `name: plan`.
  - `packages/coding-agent/src/defaults/jwc/skills/ultragoal/SKILL.md` has frontmatter `name: goal`.
- Legacy names remain intentionally in internal or compatibility layers:
  - `jwc ralplan --write` is the active sanctioned artifact writer for orchestrate-p / planner / architect / critic persistence.
  - `.jwc/plans/ralplan/` is the persisted plan path and should not be renamed casually.
  - `jwc ultragoal` and `.jwc/ultragoal/` remain goal-engine compatibility/data-contract surfaces while the public agent-facing name is `goal`.
  - HUD display code maps legacy active state names to public labels: `ralplan: "plan"`, `ultragoal: "goal"`.
- Role agents already encode the desired exception, but as an exception after a broad read-only line:
  - `planner.md`, `architect.md`, and `critic.md` all say read-only first, then allow restricted `bash` only for `jwc ralplan --write` and `jwc state`.
  - The runtime enforces this mechanically through `bashAllowedPrefixes: ["jwc ralplan --write", "jwc state"]` and restricted bash command validation.
- `ralplan/SKILL.md` already states the durable artifact writer rule clearly: planning artifacts and stage handoffs must be persisted through `jwc ralplan --write`, and direct `.jwc/` file edits are forbidden unless force override is active.
- The current system prompt now lists public `<skill name="plan">` and `<skill name="goal">`, but it still has global read-only wording that can be misread as "no writes of any kind" before the persistence exception is seen.

### Answer: yes, the precedence can be flipped

The safer instruction model is:

1. First classify the action target.
2. If the target is sanctioned workflow persistence, allow it even inside read-only planning/review/interview modes.
3. If the target is product/source mutation, apply read-only prohibition and confirmation checkpoint.
4. If the target is direct `.jwc/**` file editing, forbid it unless explicit force override is active.
5. If the target is legacy public surface (`/skill:ralplan`, `/skill:ultragoal`) in user-facing prose, route/word it as public `plan` / `goal` while preserving legacy CLI/data names only where they are the actual compatibility channel.

This avoids the current cognitive bug where agents read "read-only: never write" and stop before seeing that plan writes are the authorized persistence path. The intended hierarchy is not "read-only beats plan write"; it is "product/source read-only, but workflow artifact persistence is explicitly outside that ban."

### Proposed wording pattern for a later confirmed product patch

Use a positive allowlist before the prohibition:

```md
Read-only workflow modes still MAY persist workflow artifacts through their sanctioned writers before returning:
- plan/review artifacts: `jwc ralplan --write ...` (legacy writer for public `plan` / `jwc orchestrate p`)
- workflow state: documented `jwc state ...` read/write/contract commands
- final interview specs: the native jaw-interview spec writer
- active goal/team ledgers: only the owning goal/team workflow commands

This permission is narrow. It does NOT allow product/source edits, formatter runs, commits, pushes, implementation delegation, or direct `write`/`edit`/`ast_edit` calls under `.jwc/**`.
```

### Likely patch targets after confirmation

- `packages/coding-agent/src/prompts/system/system-prompt.md`
  - Add global target-classification precedence near `skill-discipline` or `runtime-state`.
  - Keep public `plan` / `goal`; clarify that `jwc ralplan --write` is a legacy sanctioned writer, not a public workflow name to advertise.
- `packages/coding-agent/src/prompts/agents/planner.md`
- `packages/coding-agent/src/prompts/agents/architect.md`
- `packages/coding-agent/src/prompts/agents/critic.md`
  - Rewrite the constraint order so sanctioned persistence comes before the broad read-only prohibition.
  - Preserve the existing restricted bash allowlist and inline `--artifact` rule.
- `packages/coding-agent/src/defaults/jwc/skills/jaw-interview/SKILL.md`
  - Add the same precedence rule for interview state/spec/devlog/planning continuity.
  - Expand brownfield planning knowledge to include `devlog/_plan/**/*.md` and recursive `.jwc/plans/**/*.md`.
- Tests:
  - `packages/coding-agent/test/system-prompt-templates.test.ts`
  - `packages/coding-agent/test/jaw-interview-skill-policy.test.ts`
  - `packages/coding-agent/test/default-jwc-definitions.test.ts`

### Additional active-surface audit notes

A focused scan for `/skill:ralplan`, `/skill:ultragoal`, `$ralplan`, `$ultragoal`, `jwc ralplan`, and `jwc ultragoal` across active `packages/coding-agent/src`, tests, `AGENTS.md`, and `structure` found:

- Correct compatibility-only uses:
  - `packages/coding-agent/src/jwc-runtime/plan-writer.ts` documents `jwc ralplan` as the native plan writer and returns legacy `handoff=/skill:ralplan` for the compatibility loop.
  - `packages/coding-agent/src/tools/bash-allowed-prefixes.ts` only permits `jwc ralplan --write` for restricted role agents.
  - `packages/coding-agent/test/default-jwc-definitions.test.ts` verifies public role-agent allowlists still contain `jwc ralplan --write`.
  - Goal engine/runtime files still expose `jwc ultragoal` command strings where the compatibility CLI is the actual command surface.
- Likely user-facing stale prose to consider in a later rename/wording patch:
  - `packages/coding-agent/src/defaults/jwc/skills/jaw-interview/SKILL.md` still says execution handoff defaults to `/skill:ultragoal`.
  - `packages/coding-agent/src/defaults/jwc/skills/team/SKILL.md` still presents `$ultragoal` as the durable follow-up and dispatches `/skill:ultragoal`.
  - `packages/coding-agent/src/defaults/jwc/skills/ralplan/SKILL.md` is a legacy compatibility skill but still includes user examples for `/skill:ralplan`; because the skill is public-named `plan`, this should be carefully worded as legacy compatibility rather than the preferred entrypoint.
  - `packages/coding-agent/src/hooks/skill-keywords.ts` still maps `$ralplan` to `skill: "ralplan"` and `$ultragoal` to `skill: "ultragoal"` while guidance says use `jwc orchestrate p` / `jwc goal`; this is probably an actual routing mismatch unless the downstream activation layer normalizes aliases.
  - `packages/coding-agent/src/jwc-runtime/workflow-command-ref.ts` and `skill-state/active-state.ts` still describe handoff using `/skill:ralplan` / `/skill:ultragoal`; acceptable only if explicitly framed as internal legacy state owners, not public routing.
### Verification command after confirmed patch

```sh
bun test packages/coding-agent/test/jaw-interview-skill-policy.test.ts packages/coding-agent/test/system-prompt-templates.test.ts packages/coding-agent/test/default-jwc-definitions.test.ts packages/coding-agent/test/jwc-runtime/ralplan-runtime.test.ts
```
