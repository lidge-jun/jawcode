# WP12 — 20.027 omp chase: prompts · subagent · discovery rules (ADAPT, identity-sensitive)

> Card: `struct_har/chase/20.027_omp_chase_prompts_subagent_discovery_rules.md`
> Source: OMP `ca9f2847e..b6c9747d4` (v16.2.5→16.2.9), reference-only, **1:1 port ❌**.
> Interview decision (2026-07-01): discovery-rules/loop-guard 저위험 채택, subagent 이름 JWC 재작성, identity content **reject**.

## 6 Sub-feature Triage (P-phase research, evidence-backed)

| # | OMP feature | upstream | JWC reality | verdict |
|---|---|---|---|---|
| 1 | system prompt verification/delivery 단순화 | `213fdca79` | JWC `system-prompt.md` carries JWC-authored verification/delivery policy; OMP removes "no mocks / use tester agent" — JWC has no tester roster | **REJECT** (identity/policy; JWC keeps own verification stance) |
| 2 | bash 제약 완화 + critical instr 단순화 | `63ff563ec` | JWC security posture cards 10.043/10.047 (_fin) deliberately constrain bash | **DEFER** (security tradeoff; needs security review, not in this cycle) |
| 3 | oracle→tester subagent + quick_task→sonic | `720fb3f12`, `6c1152647` | JWC roster = executor/executor_ext/architect/planner/critic/explore/plan/reviewer/task. No oracle/quick_task/sonic exist | **N/A — DEFER** (no matching roster; renaming JWC roles to OMP names is forbidden by 008) |
| 4 | loop-guard redirect notice on thinking-loop retry | `6b7d7e6e7` | JWC has NO `AIError.Flag.ThinkingLoop` nor `model.loopGuard.enabled` infra (grep: 0 hits) | **DEFER** (missing upstream infra; would require porting AIError flag + loopGuard setting first) |
| 5 | agent param optional + default `task` | `9ccd83a13` | JWC has hidden `task` agent (`hide:true`, agents.ts:84) but `agent` is **required** `z.string()` in task schema; internal/programmatic callers must pass it | **ADOPT** (real JWC slice; make `agent` optional defaulting to `task`) |
| 6 | Go syntax/API discovery rules | `dcc7a1ce2` | JWC `discovery/` is tool-config discovery (agents.ts/codex.ts/cursor.ts...), NOT OMP language-AST `.md` rules. No `builtin-rules/` dir | **DEFER** (structural mismatch; JWC has no AST-rule subsystem to host them) |

**Net: 1 ADOPT (#5), 5 DEFER/REJECT** — all evidence-backed. OMP card is reference-only so DEFER/REJECT items are documented in card Closure, not coded.

## ADOPT slice — #5 agent param optional + default `task`

### Ground Truth (JWC)
- `packages/coding-agent/src/task/types.ts:121` — `agent: z.string().describe(...)` (required) in `createTaskSchema`.
- `packages/coding-agent/src/task/types.ts:160` (TaskParams) — `agent: string;` interface field.
- `packages/coding-agent/src/task/index.ts:518` — `const requestedAgentName = params.agent;` (assumes present).
- `packages/coding-agent/src/task/index.ts:987` — same in sync path (`const { agent: requestedAgentName, ... } = params;`).
- `packages/coding-agent/src/task/agents.ts:84-92` — bundled `task` agent (`name:"task"`, `hide:true`, general-purpose).

### Design (JWC-authored, zod — NOT arktype 1:1)
1. `types.ts` schema: `agent: z.string()` → `agent: z.string().optional()` in `createTaskSchema` (+ keep describe). Default applied at execute-time, not in schema, to keep zod parse behavior explicit.
2. `types.ts` TaskParams: `agent: string;` → `agent?: string;` with doc "defaults to `task` when omitted".
3. `index.ts`: add `const DEFAULT_TASK_AGENT = "task";` and normalize at both execute entry points:
   `const requestedAgentName = (typeof params.agent === "string" && params.agent.trim() !== "") ? params.agent : DEFAULT_TASK_AGENT;`
   (async path ~518 and sync path ~987).
4. No OMP roster renames (no quick_task/sonic — those literals must not appear).

### Invariants
- Explicit `agent` still honored (executor/executor_ext/planner/...).
- Omitted/blank `agent` resolves to hidden `task` agent (already visible to `getAgent`).
- `executor_ext`→`executor` lookup mapping unchanged.
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
