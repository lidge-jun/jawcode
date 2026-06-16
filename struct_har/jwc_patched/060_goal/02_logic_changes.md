# 060_goal — 02 logic changes (jwc_patched)

> jwc_patched: fork **실제 로직**. git `upstream/main..HEAD` + [fork_logic_changelog.md](../../../structure/40_fork-delta.md).
> worktree @ `d60b78223d5d5f5b3f82b3d0ccfe95620f754eb5`.

## 런타임·표면

- `packages/coding-agent/src/commands/goal.ts` — public `jwc goal` (aliases `ultragoal` on legacy CLI table).
- `packages/coding-agent/src/jwc-runtime/goal-cli.ts` + `goal-engine.ts` — durable plan under **`.jwc/goal/`** (`brief.md`, `goals.json`, `ledger.jsonl`).
- Public **`goal`** skill: `defaults/jwc/skills/goal/SKILL.md` (bundled via `jwc-defaults.ts`).
- `packages/coding-agent/src/jwc-runtime/goal-mode-request.ts` — pending goal-mode request + session env (`JWC_SESSION_ID`, `JWC_SESSION_FILE`, …) for scoped session writes.

## 세션 스코프

- Goal mode state is written against the current session file when env/session id is available (`writeCurrentSessionGoalModeState`, `consumePendingGoalModeRequest` with `currentSessionId`).
- Orchestrate transitions do not require manual `jwc goal checkpoint` for pipeline bookkeeping when a goal is active — see **99.08-B** below.

## 99.08 PABCD–goal 융합

- **99.08-A**: `buildPabcdStageContent` co-displays truncated goal objective in the per-turn `pabcd-stage-context` header (`session/pabcd-stage-header.ts:12`–`17`, `workflow-readers.truncateObjective`).
- **99.08-B**: `orchestrate-runtime.ts` `persist` transition path calls `recordGoalCheckpointForTransition` (internal `checkpointGoal` / `readGoalPlan`) so each IPABCD stage advance appends ledger evidence when a non-terminal goal exists (`orchestrate-runtime.ts:399`+). Verdict-only recordings are excluded by construction.

## 커밋

`0207d326` (+ 99.08 fusion per `structure/21_extensibility.md`)

## 정본

- 횡단: [structure/40_fork-delta.md](../../../structure/40_fork-delta.md)
- 파일 단위: [structure/40_fork-delta.md](../../../structure/40_fork-delta.md)
- 앵커 경로: [02_code_facts.md](./02_code_facts.md)