# System/Goal Prompt Discipline — Findings

Date: 2026-06-14

## User request

Add compact prompt guidance for:

- Before code implementation, confirm whether local/repo facts are current, read the relevant dev skill/docs, and use web search when current external facts could matter.
- Make AST tool selection more explicit.
- When plan context has no current-session plan folder, inspect git history/tree and search likely plan docs/Markdown before asking; if no authoritative folder is found, ask the user where the prior plan folder is.
- Goal/PABCD: when the user asks Goal work to run through PABCD, the agent must directly operate `jwc orchestrate <stage>` and advance phases rather than treating PABCD as optional prose.
- Keep prompt size growth small.

## Current source map

- Main system prompt template: `packages/coding-agent/src/prompts/system/system-prompt.md`
  - workflow routing: lines 76-89
  - AST guidance: lines 190-198
  - search mandate: lines 256-266
  - workflow scope/before-editing: lines 268-279
- System prompt renderer: `packages/coding-agent/src/system-prompt.ts`
  - imports templates at lines 14-16
  - composes/renders prompt data at lines 584-623
- Goal active prompt: `packages/coding-agent/src/prompts/goals/goal-mode-active.md`
- Goal continuation prompt: `packages/coding-agent/src/prompts/goals/goal-continuation.md`
- Goal planning start prompt/sentinel: `packages/coding-agent/src/goals/goal-planning-start.ts`
- Goal tool description: `packages/coding-agent/src/prompts/tools/goal.md`
- Goal skill prompt: `packages/coding-agent/src/defaults/jwc/skills/goal/SKILL.md`

## Existing coverage

Already present:

- repo/current/external search mandate in `system-prompt.md`.
- Context7-first library docs and web search for real-time/current facts.
- PABCD direct operation rule: user asks to run/advance PABCD → run `jwc orchestrate <stage>` via shell.
- Basic AST tool guidance.
- cli-jaw already has an explicit dev-skill rule in `/Users/jun/.cli-jaw/AGENTS.md`: lines 355-365 require reading `/Users/jun/.cli-jaw/skills/dev/SKILL.md` before any code, plus role-specific dev skills; lines 575-579 repeat active skill matching and dev-skill priority.

Gaps:

- JWC `system-prompt.md` has generic skill/rule reading, but not cli-jaw's explicit dev-skill-before-code contract; add a compact equivalent without hardcoding user-home paths.
- AST guidance lacks concrete use cases: callsites/imports/API rewrites vs text-only search.
- No explicit plan-folder recovery protocol using git log/tree + plan-doc Markdown search + user question when unresolved.
- Goal prompts mention refinement/checkpoints, but not that user-requested PABCD execution during Goal requires direct `jwc orchestrate` operation.

## Correction: workflow skills vs development skills

The earlier interpretation "`dev` cannot be named because JWC exposes exactly four workflow skills" was wrong.

- The four-item invariant is only the **public workflow surface**: `jaw-interview`, `plan`, `goal`, `team`.
- `system-prompt.md` also renders a separate dynamic `<skills>` section for visible skills. A loaded `dev` skill belongs to that guidance layer, not the workflow-surface list.
- Jaw-brand cli-jaw skill loading excludes only `memory` and `dev-pabcd` by default (`skills.ts:161-164`) because JWC owns native `jwc memory` and `jwc orchestrate`.
- Therefore a prompt patch may explicitly say "read the visible/available `dev` skill before code" without violating the four workflow-skill invariant.
- It must **not** tell JWC agents to read `dev-pabcd`; that skill is cli-jaw-specific and intentionally excluded. PABCD guidance in JWC should point to native `jwc orchestrate i|p|a|b|c|d` and the stage prompts.

New problem statement: the wording "four default workflow skills plus native orchestration" is correct but visually easy to misread as "only four skills exist." The prompt should separate these concepts more clearly and make `orchestrate i/p/a/b/c/d` more prominent.

## Recommended compact patch shape

Keep total growth small by adding short bullets only:

1. `system-prompt.md`
   - Clarify the opening workflow block: four default workflow **skills** plus a separate native IPABCD/PABCD **orchestrate** surface; do not imply these are all available skills.
   - Make `jwc orchestrate i|p|a|b|c|d` visibly first-class in routing: user asks for PABCD/phase/next stage → run the exact command and follow stdout.
   - Add one search-mandate bullet: before implementing code with potentially stale external/API/version assumptions, read the relevant dev skill/docs and use Context7/web search as appropriate.
   - Expand AST section with 2-3 concrete use-case bullets.
   - Add a compact plan-context recovery bullet under workflow scope or before-editing: inspect git status/log/tree, search plan docs under `.jwc/plans`, `devlog/_plan`, `structure`, and ask for the previous plan folder only after no authoritative folder is found.
   - Strengthen routing/goal wording: if Goal user asks for PABCD, operate `jwc orchestrate` directly through phases.
2. `goal-mode-active.md` and `goal-continuation.md`
   - Add a short Goal+PABCD sentence: when the objective/hint says to use PABCD, run/advance `jwc orchestrate <stage>` directly and preserve stage evidence in Goal updates.
3. Optional tests
   - Prompt snapshot/string tests likely live in `packages/coding-agent/test/default-jwc-definitions.test.ts` or prompt-render tests if present; run focused prompt/default tests plus Biome on touched markdown if applicable.

## Git context observed

- Worktree already has many unrelated modified/untracked files. Edits must be limited to prompt/devlog files unless explicitly expanded.
- Recent commits include prompt/workflow-relevant changes:
  - `12f4b02c` — jaw-interview guard, goal/slash tests, subagent devlog
  - `57d63ba6` — legacy workflow prompt cleanup
  - `0a1b979d` — goal plan slash aliases

## External/reference checks

- OpenAI Codex best-practices guidance supports keeping durable agent rules in `AGENTS.md`/skills, keeping guidance concise, planning first for complex tasks, and using tests/review for reliability: https://developers.openai.com/codex/learn/best-practices
- The same OpenAI guidance frames skills as reusable task-specific instruction packages and warns against overloading the base prompt; this supports a compact system prompt plus `dev` skill read-before-code routing instead of inlining dev-skill content.
- ast-grep's official introduction describes AST-based search/rewrite as precise structural code matching, useful for search, lint, and rewrite/codemod work across languages, supporting the planned concrete AST-tool use-case bullets: https://ast-grep.github.io/guide/introduction.html

## Executor verification

Executor `13-PromptPatchPlanReview` returned `OK` with no blockers.

Accepted recommendations:

- Do not imply `dev` is one of the four workflow skills or always present; phrase as "if a loaded/visible `dev` skill matches, read it before code."
- Add one clause to the workflow-surface opening that other skills may appear separately in the dynamic `<skills>` section.
- Do not mention/read `dev-pabcd`; it is excluded and native `jwc orchestrate i|p|a|b|c|d` owns PABCD guidance.
- Put plan-folder recovery under workflow scope/before-editing, not the search mandate, to keep prompt growth small.
- Goal+PABCD reminder should trigger only when the user/objective/hint explicitly requests PABCD/orchestration, not every goal session.

## Final patch list

1. `packages/coding-agent/src/prompts/system/system-prompt.md`
   - Clarify workflow surface: four default workflow skills are not the full dynamic skill inventory; visible skills can still appear later in `<skills>`.
   - Prominently show native `jwc orchestrate i|p|a|b|c|d` and the direct-operation rule.
   - Add dev-skill-before-code guidance: before implementation, read the loaded/visible `dev` skill and matching domain dev skills when present.
   - Add freshness guidance: before code depending on external APIs/framework versions/current behavior, use relevant dev/docs plus Context7/web search.
   - Tighten AST guidance with concrete triggers: structural call/import/type/codemod searches use `ast_grep`; repeated structural rewrites use `ast_edit`; regex only for plain text.
   - Add plan-folder recovery: inspect git status/log/tree and search `.jwc/plans`, `devlog/_plan`, `structure`, and root plan Markdown; ask the user for the prior plan folder only if unresolved.
2. `packages/coding-agent/src/prompts/goals/goal-mode-active.md`
   - Add one compact Goal+PABCD sentence: explicit PABCD objective/hint means operate `jwc orchestrate <stage>` directly and checkpoint evidence.
3. `packages/coding-agent/src/prompts/goals/goal-continuation.md`
   - Add the same compact continuation reminder.
4. `structure/20_prompt_flow.md`
   - Update the prompt-flow map after source prompt edits so docs reflect the new workflow-surface/dev-skill/orchestrate distinction.
5. No planned edits to `packages/coding-agent/src/extensibility/skills.ts`; it already excludes `memory` and `dev-pabcd` only.

## Additional valuable tool guidance candidates

Prompt growth should still stay small, but the patch should consider a compact "tool escalation" bullet because several high-value tools are easy to miss:

| Tool/surface | Why it matters | Prompt action |
|---|---|---|
| `search_tool_bm25` | Dynamic tool discovery/activation. It searches hidden MCP/built-in tool metadata and activates matched tools in-session. Live check in this session activated `eval`, `monitor`, `job`, `irc`, `lsp`, `recipe`, `debug`, and cron tools from the discoverable corpus. | Add one short discovery bullet: when a task may need a capability not in the visible active tool list (external systems, debugging, scheduling, app control, specialized readers), call `search_tool_bm25` before declaring no tool exists. |
| `lsp` | Safer symbol-aware code intelligence: definitions, references, hover, rename, code actions, diagnostics. Existing prompt already has an LSP block; keep it and maybe reference it from AST guidance: LSP for semantic symbols/refactors, AST for syntax-shape discovery/codemods. | No large new block; preserve existing LSP block and avoid duplicating. |
| `debug` | DAP launch/attach/breakpoints/stack/variables/evaluate. Valuable when a test/process hangs or runtime state matters more than output text. | Add at most one phrase under tool escalation or debugging: use debugger for breakpoints/state instead of print/log guessing. |
| `monitor` + `job` | Long-running logs, watchers, CI polling, and background event streams. Avoids blocking the main turn or losing async results. | Maybe mention only if editing tool-priority; not central to this patch. |
| `eval` | Persistent Python/JS cells for quick compute, JSON transforms, and structured analysis; better than shelling out to `python -c`/`node -e`. | Existing tool-priority already says quick compute → eval; no source prompt change needed unless shrinking bash misuse further. |
| `recipe` | Runs project task runners by known recipe names rather than ad-hoc shell commands. | Existing available when active; not worth new sysprom bytes for this patch. |
| `irc` | Coordination with live subagents; already covered in detached-subagents block. | No change. |

## GJC/upstream example check

- Upstream GJC `system-prompt.md` already has the same dynamic discovery pattern: when `mcpDiscoveryMode` is enabled, it says external/SaaS/chat/ticket/database/deployment/non-local tasks should call `search_tool_bm25` before concluding no tool exists (`devlog/_upstream_gjc/packages/coding-agent/src/prompts/system/system-prompt.md:149-152`).
- Upstream GJC also has the same LSP and AST blocks (`:155-176`) and the same concise tool-priority block (`:211-220`). JWC should not balloon beyond that style; add one or two sharper bullets rather than a long tool catalog.
- The current JWC prompt already includes the upstream discovery block, but only under `mcpDiscoveryMode`; if product intent is broader dynamic built-in discovery too, the wording can be generalized from "MCP servers" to "hidden discoverable tools / MCP servers" without adding many tokens.

## Revised patch-list additions

Append to the `system-prompt.md` patch scope:

- In `<discovery>` or `<tool-priority>`, make `search_tool_bm25` guidance apply to hidden built-ins as well as MCP/external systems: "Need a capability not visible? Search/activate tools first."
- Keep `lsp` as the symbol-aware semantic tool and `ast_grep`/`ast_edit` as syntax-shape tools; add a distinction sentence so the model does not substitute regex for either.
- Do not add a long list of every tool; `search_tool_bm25` is the compact gateway for dynamic tools.
