# WP12 — 20.027 omp chase: prompts · subagent · discovery rules (ADAPT, identity-sensitive)

> Card: `struct_har/chase/20.027_omp_chase_prompts_subagent_discovery_rules.md`
> Source: OMP `ca9f2847e..b6c9747d4` (v16.2.5→16.2.9), reference-only, **1:1 port ❌**.
> Interview decision (2026-07-01): discovery-rules/loop-guard 저위험 채택, subagent 이름 JWC 재작성, identity content **reject**.

## 6 Sub-feature Triage (P-phase research, evidence-backed)

| # | OMP feature | upstream | JWC reality | verdict |
|---|---|---|---|---|
| 1 | system prompt verification/delivery 단순화 | `213fdca79` | JWC `system-prompt.md` carries JWC-authored verification/delivery policy; OMP removes "no mocks / use tester agent" — JWC has no tester roster | **REJECT** (identity/policy; JWC keeps own verification stance) |
| 2 | bash 제약 완화 + critical instr 단순화 | `63ff563ec` | JWC security posture cards 10.043/10.047 (_fin) deliberately constrain bash | **DEFER** (security tradeoff; needs security review, not in this cycle) |
| 3 | oracle→tester subagent + quick_task→sonic | `720fb3f12`, `6c1152647` | JWC public task roster = executor/executor_ext/architect/planner/critic (+ hidden task). No oracle/sonic in code; `quick_task` survives only as legacy commit-agentic literals (`commit/agentic/agent.ts:44`, `tools/analyze-file.ts:60,80`), not the public task roster | **N/A — DEFER** (no matching public roster; renaming JWC roles to OMP names forbidden by 008; legacy quick_task is a separate commit-agentic subsystem out of scope) |
| 4 | loop-guard redirect notice on thinking-loop retry | `6b7d7e6e7` | JWC has NO `AIError.Flag.ThinkingLoop` nor `model.loopGuard.enabled` infra (grep: 0 hits) | **DEFER** (missing upstream infra; would require porting AIError flag + loopGuard setting first) |
| 5 | agent param optional + default `task` | `9ccd83a13` | JWC has hidden `task` agent (`hide:true`, agents.ts:84) but `agent` is **required** `z.string()` in task schema; internal/programmatic callers must pass it | **ADOPT** (real JWC slice; make `agent` optional defaulting to `task`) |
| 6 | Go syntax/API discovery rules | `dcc7a1ce2` | JWC HAS a markdown rules subsystem (`discovery/index.ts:15`, `discovery/agents.ts:90,108,111`, `discovery/builtin.ts:358,373`) + rulebook matching pipeline, BUT only metadata/advisory matching — no AST-aware automatic matching (`docs/rulebook-matching-pipeline.md:198`). OMP Go rules rely on AST conditions | **DEFER** (rules content/advisory layer is ADAPT-able later, but AST-aware auto-matching infra is absent; out of scope for this cycle) |

**Net: 1 ADOPT (#5), 5 DEFER/REJECT** — all evidence-backed (auditor Lagrange gpt-5.4 FAIL→revised: #3/#6 wording corrected, #5 design widened to single-point normalization). OMP card is reference-only so DEFER/REJECT items are documented in card Closure, not coded.

## ADOPT slice — #5 agent param optional + default `task`

### Ground Truth (JWC)
- `packages/coding-agent/src/task/types.ts:121` — `agent: z.string().describe(...)` (required) in `createTaskSchema`.
- `packages/coding-agent/src/task/types.ts:160` (TaskParams) — `agent: string;` interface field.
- `packages/coding-agent/src/task/index.ts:518` — `const requestedAgentName = params.agent;` (assumes present).
- `packages/coding-agent/src/task/index.ts:987` — same in sync path (`const { agent: requestedAgentName, ... } = params;`).
- `packages/coding-agent/src/task/agents.ts:84-92` — bundled `task` agent (`name:"task"`, `hide:true`, general-purpose).

### Contract decision (auditor-flagged)
Making `agent` optional widens the public task tool: the published callable roles are executor/executor_ext/architect/planner/critic (AGENTS.md:19, docs/codebase-overview.md:35), and `task` is a hidden internal agent (agents.ts:89). **Decision: ACCEPT the widening** — defaulting an omitted `agent` to the hidden general-purpose `task` worker matches OMP intent (support direct/programmatic callers) and is non-breaking (every existing explicit `agent` value still works). The hidden `task` agent stays hidden in the roster listing; it just becomes the implicit default. The tool prompt doc (`prompts/tools/task.md:22`) is updated to state the default.

### Design (JWC-authored, zod — NOT arktype 1:1; SINGLE-POINT normalization)
Auditor confirmed `params.agent` is read at many sites (index.ts:541,555,613,621,698,710,870,959 + render.ts:481), so patching two reads is insufficient. Instead normalize `params` ONCE at each execute entry so every downstream read sees the resolved agent:
1. `types.ts` schema: `agent: z.string()` → `agent: z.string().optional()` in `createTaskSchema` (keep describe, note default `task`). Applies to all 4 schema variants if separately defined.
2. `types.ts` TaskParams: `agent: string;` → `agent?: string;` doc "defaults to `task` when omitted".
3. `index.ts`: add `const DEFAULT_TASK_AGENT = "task";` and at the TOP of `execute()` (after `const params = rawParams as TaskParams;`, ~line 517) replace `params` with a normalized copy:
   `const params = (typeof raw.agent === "string" && raw.agent.trim() !== "") ? raw : { ...raw, agent: DEFAULT_TASK_AGENT };`
   so 518/541/555/613/621/698/710/870/959 all read the resolved value. Do the same normalization at the top of `#executeSync()` (~line 983, before destructuring `agent` out of `params`) for the internal/batch callers that build params directly.
4. `prompts/tools/task.md:22`: note that `agent` defaults to the general-purpose worker when omitted.
5. No OMP roster renames (no quick_task/sonic — those literals must not appear in added lines).

### Invariants
- Explicit `agent` still honored (executor/executor_ext/planner/...).
- Omitted/blank `agent` resolves to hidden `task` agent (resolves via `getAgent`, discovery.ts:134 ignores `hide`).
- All downstream reads (progress/metadata/render/start-text) see the SAME normalized agent (single-point fix).
- `executor_ext`→`executor` lookup mapping unchanged.
- Legacy commit-agentic `quick_task` subsystem untouched (out of scope).
- No new OMP/pi/oracle/sonic/quick_task literals in added lines.

### Acceptance
| check | expectation |
|---|---|
| schema parse without `agent` | succeeds, resolves to `task` |
| explicit `agent:"executor"` | unchanged behavior |
| blank `agent:"  "` | normalizes to `task` |
| `bun test` task schema/index | green (+ new regression test) |
| `bun run check:types` | EXIT 0 |
| naming scan | 0 new gjc/omp/pi/oracle/sonic/quick_task literals |

### Verification
- `bun test packages/coding-agent/test/task/` (focused on schema/agent-default)
- `cd packages/coding-agent && bun run check:types`
- `git diff --check`

## PABCD plan
- **P**: this doc (committed).
- **A**: independent gpt-5.4 explorer audit of triage + #5 slice feasibility/regression.
- **B**: implement #5 (types.ts + index.ts + regression test), independent reviewer PASS, atomic commit.
- **C**: focused test + tsgo EXIT 0 + naming scan + diff --check.
- **D**: attest → IDLE → card closure (1 ADOPT coded, 5 DEFER/REJECT documented) → `_fin/20`.

## Depends / feeds
- Depends: card 008 naming contract, 10.065 (_fin, prompt identity), 10.022 (_fin, loop guard — #4 cross-ref), 10.043/10.047 (_fin, bash security — #2 cross-ref).
- Feeds: slice-map ledger WP12 closed; OMP MOC reviewed-through already at b6c9747d4.
