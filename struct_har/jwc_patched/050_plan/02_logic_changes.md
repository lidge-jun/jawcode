# 050_plan — 02 logic changes (jwc_patched)

> jwc_patched: fork **실제 로직**. git `upstream/main..HEAD` + [fork_logic_changelog.md](../../../structure/40_fork-delta.md).
> worktree @ `d60b78223d5d5f5b3f82b3d0ccfe95620f754eb5`.

## 런타임·표면

- `packages/coding-agent/src/jwc-runtime/orchestrate-state.ts` + `orchestrate-runtime.ts` — native IPABCD `i|p|a|b|c|d`, `status`, `verdict`, `audit-prompt`, **`reset`**.
- `packages/coding-agent/src/commands/orchestrate.ts`, `/orchestrate` (jaw brand), aliases `pabcd`.
- `packages/coding-agent/src/prompts/jaw/orchestrate-*.md` — stage prompt stdout pull.
- Public **`plan`** skill: `defaults/jwc/skills/plan/SKILL.md` (SUPERSEDED → `jwc orchestrate p`); legacy CLI `jwc ralplan` / `jwc planphase` for planphase artifacts under `.jwc/plans/planphase/`.

## IPABCD 세션 스코프 (99.03)

- State: `.jwc/state/sessions/<session-id>/pabcd-state.json` (`orchestrate-state.ts`).
- `parseArgs`: `--session-id` 없으면 bash env `JWC_SESSION_ID` / `GJC_SESSION_ID`를 기본으로 씀 — shell `jwc orchestrate <stage>` self-transition이 공유 경로에 쓰지 않게 함 (`orchestrate-runtime.ts:117`–`124`).
- `jwc orchestrate reset`: any phase → idle by deleting scoped `pabcd-state.json` only; goal ledger 불가침 (`resetPabcdState`, 99.07-U1).

## 99.03 discovery (모델 표면)

- **M1**: `system-prompt.md` native `<native-workflow name="orchestrate">` block (`workflow-surface-orchestrate.test.ts`).
- **M2**: 매 턴 `pabcd-stage-context` via `buildPabcdStageContent` (`session/pabcd-stage-header.ts`, `agent-session.ts`).

## Critic / verdict (stage p)

- `jwc orchestrate verdict` on stage **p** uses critic vocabulary **OKAY|ITERATE|REJECT** (`parseCriticVerdict` in `orchestrate-state.ts:151`); sets `ctx.p_review_passed` when verdict is `okay` (`orchestrate-runtime.ts:247`–`261`). Other stages use worker **PASS|FAIL|DONE|NEEDS_FIX**.

## 99.08-B ↔ goal (cross-band)

- Each successful stage **transition** (not verdict-only path) calls `recordGoalCheckpointForTransition` → `goal-engine.checkpointGoal` when a durable goal plan is active (`orchestrate-runtime.ts:384`–`388`, `399`+). Best-effort: ledger failure must not fail the transition.

## 커밋

`595350bf`–`09c76c23` (+ 99.03/99.08 bands per `structure/21_extensibility.md`)

## 정본

- 횡단: [structure/40_fork-delta.md](../../../structure/40_fork-delta.md)
- 파일 단위: [structure/40_fork-delta.md](../../../structure/40_fork-delta.md)
- 앵커 경로: [02_code_facts.md](./02_code_facts.md)