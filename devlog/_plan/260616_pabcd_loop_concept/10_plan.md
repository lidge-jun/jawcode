# Plan: PABCD Loop Concept (Prompt Layer)

**Spec**: `.jwc/specs/jaw-interview-pabcd-loop-concept.md`

## Overview

4개 prompt 파일에 "loop" 개념을 추가한다. State schema(orchestrate-state.ts) 변경 없음.

---

## File 1: MODIFY `packages/coding-agent/src/prompts/system/system-prompt.md`

### Change 1A: orchestrate 설명에 loop 개념 추가 (line 45-46 사이 삽입)

현재 `d` 설명 다음에 loop 개념 단락을 추가한다.

**Insert after line 45** (`- d (DONE): ...`):

```markdown
- **Loop execution**: A single implementation goal may span multiple PABCD cycles. Each cycle implements one logical patch (phase) from a loop plan documented in `devlog/_plan/`. After D closes the cycle and returns to idle, check the devlog loop plan and goal objective: if phases remain, re-enter `orchestrate p` for the next phase (HOTL: automatically; HITL: after user confirmation). The loop plan is written during interview or idle before the first P entry.
```

### Change 1B: routing 섹션에 loop 라우팅 추가 (line 82 다음 삽입)

**Insert after line 82** (`- Goal mode does not bypass PABCD: ...`):

```markdown
- User asks to "loop", "루프 돌아", "다음 패치", "continue the loop", or references a multi-phase implementation goal → check `devlog/_plan/` for a loop plan MOC with remaining phases. If found, run `jwc orchestrate p` for the next phase. If no loop plan exists, ask whether the user wants to create one (document phase breakdown in devlog) before entering P.
```

---

## File 2: MODIFY `packages/coding-agent/src/prompts/jaw/orchestrate-p.md`

### Change 2A: loop plan 참조 지침 추가

**Insert after Step 1** (line 8, after the `spec_ref` paragraph), before Step 2:

```markdown
   - **Loop-aware planning**: If a devlog loop plan exists (`devlog/_plan/*/00_moc.md` with phase breakdown), identify the current iteration's phase and scope this plan to that phase only. Reference the loop plan MOC path and iteration number in the plan draft. Prior iteration commits and WONDER/REFLECT from previous D-stages provide context for this phase — consult them before planning.
```

---

## File 3: MODIFY `packages/coding-agent/src/prompts/jaw/orchestrate-d.md`

### Change 3A: loop continuation 판단 지침 추가

**Replace the "Goal-mode continuation" paragraph** (line 28):

**Before**:
```markdown
**Goal-mode continuation**: After closing, if a `jwc goal` is active, check whether the goal objective is fully achieved. If work remains, re-enter planning with `jwc orchestrate p` for the next piece — do not treat IDLE as the end. If the goal is complete, run `jwc goal done`. If the goal is truly impossible or needs a direction change, pause and ask the user.
```

**After**:
```markdown
**Loop and goal continuation**: After closing and returning to idle:
1. Check if a devlog loop plan exists (`devlog/_plan/*/00_moc.md` with remaining phases). If phases remain, this is a loop iteration boundary — re-enter `jwc orchestrate p` for the next phase. In HOTL mode, proceed automatically; in HITL mode, confirm with the user first ("다음 phase N으로 진행할까요?").
2. If no loop plan exists but a `jwc goal` is active, check whether the goal objective is fully achieved. If work remains, re-enter planning with `jwc orchestrate p` for the next piece. If the goal is complete, run `jwc goal done`.
3. If the goal is truly impossible or needs a direction change, pause and ask the user.
Do not treat IDLE as the end when loop phases or goal work remain.
```

---

## File 4: MODIFY `packages/coding-agent/src/defaults/jwc/skills/jaw-interview/SKILL.md`

### Change 4A: Phase 5 execution bridge에 loop vs 단일 패치 확인 gate 추가

Phase 5의 execution options 질문 **앞에** (현재 "Your spec is ready" 문구 전), loop 판단 gate를 삽입:

**Insert before the "Your spec is ready" question** in Phase 5:

```markdown
**Loop assessment gate**: Before presenting execution options, assess whether the spec describes work that should be split into multiple PABCD cycles (loop) or can be completed in a single cycle. Consider: number of files affected, number of independent behavioral changes, cross-cutting concerns. If the agent judges this is loop-scale work, present the user with:

> "이 구현은 N개의 논리적 패치로 분할하여 loop으로 실행하는 것이 적절해 보입니다. Loop plan을 devlog에 작성하고 진행할까요, 아니면 단일 PABCD 사이클로 진행할까요?"
> Options: [Loop으로 분할 실행] [단일 사이클로 진행] [추가 인터뷰]

If the user selects loop, write the loop plan MOC to `devlog/_plan/<date>_<slug>/00_moc.md` with phase breakdown before proceeding to the orchestrate P stage. The first P entry then scopes to Phase 1 of the loop plan.

If the agent judges this is single-cycle scale, skip this gate and proceed directly to the existing execution options.
```

---

## Acceptance Criteria Mapping

| AC | Change | Verification |
|----|--------|--------------|
| AC1 | 1A | system-prompt.md contains loop concept in orchestrate description |
| AC2 | 1B | system-prompt.md routing has loop routing entry |
| AC3 | 2A | orchestrate-p.md has loop-aware planning instruction |
| AC4 | 3A | orchestrate-d.md has loop continuation judgment |
| AC5 | — | No changes to orchestrate-state.ts (verify no diff) |
| AC6 | 4A | jaw-interview SKILL.md has loop assessment gate in Phase 5 |

## Files Summary

| File | Action | Lines Changed |
|------|--------|--------------|
| `packages/coding-agent/src/prompts/system/system-prompt.md` | INSERT 2 blocks | ~4 lines added |
| `packages/coding-agent/src/prompts/jaw/orchestrate-p.md` | INSERT 1 block | ~2 lines added |
| `packages/coding-agent/src/prompts/jaw/orchestrate-d.md` | REPLACE 1 block | ~8 lines (replace 2) |
| `packages/coding-agent/src/defaults/jwc/skills/jaw-interview/SKILL.md` | INSERT 1 block | ~10 lines added |
| `packages/coding-agent/src/jwc-runtime/orchestrate-state.ts` | NO CHANGE | — |
