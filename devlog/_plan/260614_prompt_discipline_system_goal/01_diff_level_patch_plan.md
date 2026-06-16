# Diff-level Patch Plan — System/Goal Prompt Discipline

Date: 2026-06-14
Status: implemented; focused prompt tests and package typecheck passed.

## Objective

Patch JWC prompt guidance compactly so agents:

1. Do not confuse the four public workflow skills with the dynamic visible skill inventory.
2. Treat native `jwc orchestrate i|p|a|b|c|d` as first-class PABCD/IPABCD control, including inside Goal mode when the user/objective asks for PABCD.
3. Read loaded/visible development skills before implementation when available, especially `dev`, while never instructing JWC to read excluded cli-jaw-only `dev-pabcd`.
4. Use Context7/web search for freshness-sensitive code work.
5. Use LSP vs AST vs regex with clearer boundaries.
6. Recover previous plan folders by inspecting git + plan docs before asking the user.
7. Use `search_tool_bm25` as the compact gateway for hidden/dynamic tools instead of bloating the prompt with a tool catalog.

## Source facts

- Four public workflow skills: `jaw-interview`, `plan`, `goal`, `team` — `AGENTS.md`, `system-prompt.md` workflow surface.
- Dynamic visible skills are rendered separately under `{{#if skills.length}} <skills> ...`; they are not the workflow-surface invariant.
- Jaw-brand skill loader excludes only `memory` and `dev-pabcd` by default: `packages/coding-agent/src/extensibility/skills.ts:161-164`.
- cli-jaw `dev` skill exists and is not excluded; it contains development-task guidance but references `dev-pabcd`, so JWC prompt must avoid telling agents to read `dev-pabcd` directly.
- `applyCliJawDevVocabularyMap()` maps cli-jaw command vocabulary to JWC at skill prompt build time; it preserves path literals.
- Upstream GJC already has concise discovery/LSP/AST/tool-priority blocks; use same style.

## Files to edit

1. `packages/coding-agent/src/prompts/system/system-prompt.md`
2. `packages/coding-agent/src/prompts/goals/goal-mode-active.md`
3. `packages/coding-agent/src/prompts/goals/goal-continuation.md`
4. `structure/20_prompt_flow.md`
5. Tests: likely `packages/coding-agent/test/goals/goal-runtime.test.ts`, plus focused prompt/default tests if source prompt string assertions are added.

No edit planned:

- `packages/coding-agent/src/extensibility/skills.ts` — current exclusion list is correct.
- `packages/coding-agent/src/jwc-runtime/cli-jaw-vocab.ts` — no new vocabulary mapping needed for prompt text. Optional follow-up only if tests reveal dev-skill body still says to read `dev-pabcd` after mapping.

## Patch 1 — workflow-surface wording

### Target

`packages/coding-agent/src/prompts/system/system-prompt.md`, opening of `<public-workflow-surface>` around current line 21.

### Current shape

```md
jwc exposes four default workflow skills plus the native IPABCD orchestration surface. Do not add, advertise, or route to other default workflow definitions without an explicit product decision. (This document is the product decision authorizing the orchestrate surface — 99.03.00.)
```

### Replace with

```md
jwc exposes four default workflow **skills** (`jaw-interview`, `plan`, `goal`, `team`) plus the separate native IPABCD/PABCD orchestration surface: `jwc orchestrate i|p|a|b|c|d`. This four-skill invariant is the public workflow surface only; additional loaded skills may appear later in the dynamic `<skills>` section. Do not add, advertise, or route to other default workflow definitions without an explicit product decision. (This document is the product decision authorizing the orchestrate surface — 99.03.00.)
```

### Rationale

Prevents the exact confusion seen in review: `dev` is a dynamic skill, not a fifth public workflow skill. Makes `orchestrate` visible before the skill list.

### Risk

Slight line length/token increase. Keep as one paragraph; do not add a new section.

## Patch 2 — native orchestrate prominence

### Target

`packages/coding-agent/src/prompts/system/system-prompt.md`, `<native-workflow>` block around current lines 40-52.

### Current shape

```md
<native-workflow name="orchestrate" user-entrypoint="/orchestrate <i|p|a|b|c|d>" cli-runtime="native: jwc orchestrate" alias="pabcd">
The IPABCD orchestration surface is a native workflow engine for end-to-end project execution across six stages:
```

### Replace with

```md
<native-workflow name="orchestrate" user-entrypoint="/orchestrate <i|p|a|b|c|d>" cli-runtime="native: jwc orchestrate i|p|a|b|c|d" alias="pabcd">
The IPABCD/PABCD orchestration surface is a native workflow engine for end-to-end project execution. Operate it by running the exact shell command `jwc orchestrate <stage>` where `<stage>` is one of `i`, `p`, `a`, `b`, `c`, or `d`:
```

### Rationale

Makes exact lowercase stage vocabulary prominent and product-surface consistent.

### Risk

None; current routing already says exact command. This just clarifies.

## Patch 3 — routing Goal + PABCD

### Target

`packages/coding-agent/src/prompts/system/system-prompt.md`, `<routing>` block after current PABCD direct-operation bullet.

### Insert after current line like

```md
- YOU advance IPABCD phases by running the exact `jwc orchestrate <stage>` command via the shell tool. No other method. Do not simulate or paraphrase the stage prompt.
```

### New bullet

```md
- Goal mode does not bypass PABCD: if the user/objective/hint says to use PABCD, run and advance `jwc orchestrate i|p|a|b|c|d` directly, follow each stage stdout immediately, and keep goal evidence/checkpoints aligned with the stage work.
```

### Rationale

Addresses repeated failure mode where agents in Goal mode execute directly and ignore user-requested PABCD.

### Risk

Could over-trigger if phrased broadly. Keep trigger bound to user/objective/hint explicitly saying PABCD/orchestrate.

## Patch 4 — dynamic tool discovery

### Target

`packages/coding-agent/src/prompts/system/system-prompt.md`, `<discovery>` block inside `{{#if mcpDiscoveryMode}}`, current line around 170-175.

### Current shape

```md
<discovery>
{{#if hasMCPDiscoveryServers}}Discoverable MCP servers in this session: {{#list mcpDiscoveryServerSummaries join=", "}}{{this}}{{/list}}.{{/if}}
If the task may involve external systems, SaaS APIs, chat, tickets, databases, deployments, or other non-local integrations, you SHOULD call `{{toolRefs.search_tool_bm25}}` before concluding no such tool exists.
</discovery>
```

### Replace with

```md
<discovery>
{{#if hasMCPDiscoveryServers}}Discoverable MCP servers in this session: {{#list mcpDiscoveryServerSummaries join=", "}}{{this}}{{/list}}.{{/if}}
Use `{{toolRefs.search_tool_bm25}}` to search and activate hidden built-in or MCP tools when the task needs a capability not already visible (external systems, SaaS APIs, chat/tickets/databases/deployments, scheduling, debugging, app control, or specialized readers). Do this before concluding no such tool exists.
</discovery>
```

### Rationale

Uses one compact gateway instead of listing all hidden tools. Covers dynamic loading and `lsp/debug/monitor/eval/cron` discoverability without sysprom bloat.

### Risk

This block only renders when `mcpDiscoveryMode` is true in current template; name may be legacy. If product wants hidden built-ins guidance even without MCP discovery mode, a follow-up may move this to unconditional tools section guarded by `{{#has tools "search_tool_bm25"}}`. Initial patch should be low-risk: edit existing block only.

## Patch 5 — AST/LSP distinction

### Target

`packages/coding-agent/src/prompts/system/system-prompt.md`, `<ast-tools>` block around current lines 190-198.

### Current shape

```md
<ast-tools>
Use syntax-aware tools before text hacks:
{{#has tools "ast_grep"}}- `{{toolRefs.ast_grep}}` for structural discovery.{{/has}}
{{#has tools "ast_edit"}}- `{{toolRefs.ast_edit}}` for codemods.{{/has}}
- Use regex search only when structure is irrelevant.
- Patterns match AST structure, not text. `$X` binds one node, `$_` ignores one node, `$$$X` binds zero or more nodes, and `$$$` ignores zero or more nodes.
- Metavariable names are uppercase. Reusing a name requires identical matched code.
</ast-tools>
```

### Replace with

```md
<ast-tools>
Use syntax-aware tools before text hacks:
{{#has tools "ast_grep"}}- `{{toolRefs.ast_grep}}` for syntax-shaped discovery: calls, imports, declarations, JSX/TS props, control-flow shapes, or repeated API usage.{{/has}}
{{#has tools "ast_edit"}}- `{{toolRefs.ast_edit}}` for repeated structural rewrites/codemods after the shape is known.{{/has}}
{{#has tools "lsp"}}- Use `{{toolRefs.lsp}}` for semantic symbol operations (definition/references/rename/code actions); use AST tools for syntax shape.{{/has}}
- Use regex search only when structure is irrelevant plain text.
- Patterns match AST structure, not text. `$X` binds one node, `$_` ignores one node, `$$$X` binds zero or more nodes, and `$$$` ignores zero or more nodes.
- Metavariable names are uppercase. Reusing a name requires identical matched code.
</ast-tools>
```

### Rationale

Clearer boundary: LSP semantic, AST syntactic, regex textual.

### Risk

Slight duplication with LSP block but prevents misuse.

## Patch 6 — search/freshness before code

### Target

`packages/coding-agent/src/prompts/system/system-prompt.md`, `<search-mandate>` block after library/framework docs bullet or after web/real-time/news bullet.

### Insert bullet

```md
- **Freshness before implementation**: before writing code that depends on external APIs, library/framework versions, platform behavior, pricing/plan limits, or current error semantics, read the relevant dev skill/docs first, then use Context7/official docs or `web_search` as appropriate. Do not implement from stale memory.
```

### Rationale

Matches user request and external guidance: current docs/search should be used when facts can be stale.

### Risk

Avoid making every local bugfix use web search. Trigger is external/current dependency.

## Patch 7 — dev skill before code

### Target

`packages/coding-agent/src/prompts/system/system-prompt.md`, `<workflow><scope>` block around current lines 269-272.

### Current shape

```md
<scope>
- Read relevant jwc skills/rules before using them.
- For multi-file work, plan before editing and research existing conventions before writing new code.
</scope>
```

### Replace with

```md
<scope>
- Read relevant jwc skills/rules before using them.
- Before implementation work, if a loaded/visible `dev` skill or matching development-domain skill is present, read it before editing; do not read excluded cli-jaw-only `dev-pabcd` in JWC — native `jwc orchestrate` owns PABCD guidance.
- For multi-file work, plan before editing and research existing conventions before writing new code.
</scope>
```

### Rationale

Restores cli-jaw dev-skill-before-code behavior without violating JWC four workflow-skill surface and without hardcoding `/Users/jun/.cli-jaw`.

### Risk

Could be too much process for C0 typo edits. "implementation work" is narrower than every task; dev skill itself has C0/C1 fast-path rules.

## Patch 8 — plan-folder recovery

### Target

`packages/coding-agent/src/prompts/system/system-prompt.md`, `<before-editing>` block around current lines 274-279, or `<scope>` if tighter.

### Insert after re-read/tool failure bullet

```md
- When continuing prior plan work and no current-session plan folder is known, inspect the git tree/status/log and search plan Markdown under `.jwc/plans`, `devlog/_plan`, `structure`, and the repo root before asking. If no authoritative plan folder is found, ask the user for the previous plan folder path.
```

### Rationale

Addresses user request and avoids blind asks; also forces git tree/commit-log awareness.

### Risk

Need to avoid shell `grep/find` in actual agent behavior; prompt says inspect/search, tool rules already force `find`/`search`/`read` and bash only for `git` terminal operations.

## Patch 9 — active Goal prompt PABCD reminder

### Target

`packages/coding-agent/src/prompts/goals/goal-mode-active.md`, near final `Jaw goal surface` sentence.

### Current shape

```md
Jaw goal surface: record milestones with `jwc goal update "<summary>" --evidence "<proof>"` (evidence is mandatory). Agent-initiated pauses go through the 2-tap audit gate (`jwc goal pause --agent --audit "<summary>"`). If the objective is the plan-mode sentinel "(AI-driven goal planning pending refinement)", refine it first with `jwc goal refine`.
```

### Replace with

```md
Jaw goal surface: record milestones with `jwc goal update "<summary>" --evidence "<proof>"` (evidence is mandatory). If the user/objective/hint requires PABCD, run and advance the native `jwc orchestrate <stage>` commands directly and record stage evidence in goal updates. Agent-initiated pauses go through the 2-tap audit gate (`jwc goal pause --agent --audit "<summary>"`). If the objective is the plan-mode sentinel "(AI-driven goal planning pending refinement)", refine it first with `jwc goal refine`.
```

### Rationale

Keeps reminder in Goal-specific context where failure occurs.

### Risk

One long line. Could split into two sentences/lines for readability.

## Patch 10 — continuation Goal prompt PABCD reminder

### Target

`packages/coding-agent/src/prompts/goals/goal-continuation.md`, under `## Jaw goal contract (jwc goal surface)` before Plan mode bullet.

### Insert bullet

```md
- **PABCD requested**: if the user/objective/hint requires PABCD or `orchestrate`, run and advance the native `jwc orchestrate <stage>` commands directly, follow each stage prompt, and record stage evidence with `jwc goal update`.
```

### Rationale

Continuation turns are where autonomous Goal mode often drifts away from requested PABCD.

### Risk

None if trigger stays explicit.

## Patch 11 — structure doc update

### Target

`structure/20_prompt_flow.md`

### Minimal changes

1. In template table row for `system-prompt.md`, mention it now distinguishes:
   - public workflow skills,
   - native `jwc orchestrate i|p|a|b|c|d`,
   - dynamic visible skills.
2. In prompt directories / goal rail section, mention goal prompts now carry the explicit PABCD requested reminder.
3. In per-turn injection rail table row #3 or implementation status, mention active Goal prompt includes PABCD requested → native orchestrate instruction.

### Example doc diff text

Add to the `system-prompt.md` row:

```md
It explicitly separates the four public workflow skills from the native `jwc orchestrate i|p|a|b|c|d` surface and the later dynamic `<skills>` inventory.
```

Add under rail #3 description:

```md
Goal prompts also remind the agent that explicit PABCD objectives/hints are executed through native `jwc orchestrate <stage>` commands with goal evidence checkpoints.
```

## Tests / verification plan

Focused checks after patch:

1. Prompt string / goal render tests:

```sh
bun test packages/coding-agent/test/goals/goal-runtime.test.ts
```

Add/update assertions:

- active prompt contains `jwc orchestrate <stage>` or `jwc orchestrate`.
- continuation prompt contains `PABCD requested` or equivalent.
- prompt still escapes objective XML (`goal-runtime.test.ts` already covers this; ensure new text does not break it).

2. Skill discovery regression:

```sh
bun test packages/coding-agent/test/skills-discovery-jaw.test.ts packages/coding-agent/test/extensibility/skill-brand-compat.test.ts
```

Existing tests should confirm:

- `memory`, `dev-pabcd` excluded.
- cli-jaw command vocabulary maps to `jwc orchestrate i` etc.

3. Default definitions / prompt bundle smoke:

```sh
bun test packages/coding-agent/test/default-jwc-definitions.test.ts
```

4. Type/format focused:

```sh
bunx biome check packages/coding-agent/src/prompts/system/system-prompt.md packages/coding-agent/src/prompts/goals/goal-mode-active.md packages/coding-agent/src/prompts/goals/goal-continuation.md structure/20_prompt_flow.md devlog/_plan/260614_prompt_discipline_system_goal/01_diff_level_patch_plan.md
```

If Biome does not process markdown in this repo, note that explicitly and run the relevant prompt tests only.

5. Optional package gate if tests touch TS:

```sh
bun run --cwd=packages/coding-agent check:types
```

## Acceptance criteria

- System prompt no longer implies dynamic `dev` skill conflicts with the four public workflow skills.
- Prompt names native PABCD as `jwc orchestrate i|p|a|b|c|d` prominently.
- No instruction tells JWC to read excluded `dev-pabcd`.
- Goal prompts remind agents to operate native PABCD when the objective/hint/user asks for it.
- AST/LSP/search-tool boundaries are clearer without a long tool catalog.
- `search_tool_bm25` is presented as the compact dynamic-tool gateway.
- Plan-folder recovery path includes git tree/status/log and plan-doc Markdown search before asking the user.
## Implementation evidence

Changed files:
- `packages/coding-agent/src/prompts/system/system-prompt.md`
  - separates four public workflow skills from native `jwc orchestrate i|p|a|b|c|d` and dynamic `<skills>`;
  - adds explicit Goal+PABCD direct-operation routing;
  - tightens discovery, AST/LSP/regex, freshness-before-implementation, dev-skill, and plan-folder recovery guidance.
- `packages/coding-agent/src/prompts/goals/goal-mode-active.md`
- `packages/coding-agent/src/prompts/goals/goal-continuation.md`
  - add explicit PABCD/orchestrate objective/hint reminders.
- `packages/coding-agent/src/session/pabcd-stage-header.ts`
  - makes D-stage close hint use the primary `jwc orchestrate d` shorthand.
- `structure/20_prompt_flow.md`
  - documents the prompt-flow changes.
- `packages/coding-agent/test/system-prompt-templates.test.ts`
- `packages/coding-agent/test/goals/goal-runtime.test.ts`
  - add prompt rendering regressions.

Verification:
```sh
bun test packages/coding-agent/test/system-prompt-templates.test.ts packages/coding-agent/test/goals/goal-runtime.test.ts packages/coding-agent/test/pabcd-stage-header.test.ts
# 46 pass, 0 fail, 234 expect() calls

bunx biome check packages/coding-agent/src/prompts/system/system-prompt.md packages/coding-agent/src/prompts/goals/goal-mode-active.md packages/coding-agent/src/prompts/goals/goal-continuation.md structure/20_prompt_flow.md packages/coding-agent/src/session/pabcd-stage-header.ts packages/coding-agent/test/system-prompt-templates.test.ts packages/coding-agent/test/goals/goal-runtime.test.ts packages/coding-agent/test/pabcd-stage-header.test.ts
# Checked 4 files in 30ms. No fixes applied. (Markdown paths are ignored by this Biome configuration.)

bun --cwd=packages/coding-agent run check:types
# tsgo -p tsconfig.json --noEmit passed
```
