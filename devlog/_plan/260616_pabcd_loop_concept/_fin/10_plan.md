# Plan: PABCD Loop Concept — Prompt Layer (R3, post A-synthesis)

**Spec**: `.jwc/specs/jaw-interview-pabcd-loop-concept.md`

## Overview

4개 prompt 파일에 "loop" 개념을 추가한다. State schema 변경 없음.

---

## File 1: MODIFY `packages/coding-agent/src/prompts/system/system-prompt.md`

### Change 1A: orchestrate 설명에 loop 개념 추가

**Insert after line 45** (`- d (DONE): ...`, before `- reset:`):

```
- **Loop execution**: A single implementation goal may span multiple PABCD cycles. Each cycle implements one logical patch (phase) from a loop plan documented in `devlog/_plan/*/00_moc.md` — a Markdown table with columns Phase / Description / Status (`done|active|pending`) / Cycle ref. After D closes the cycle and returns to idle, check the loop plan: if `pending` phases remain, re-enter `orchestrate p` for the next phase. When a `jwc goal` is active (HOTL), continue automatically; otherwise (HITL), confirm with the user. The loop plan is written during interview, idle, or the first P entry.
```

### Change 1B: routing 섹션에 loop 라우팅 추가

**Insert after line 82** (`- Goal mode does not bypass PABCD: ...`):

```
- User asks to "loop", "루프 돌아", "다음 패치", "continue the loop", or references a multi-phase implementation goal → check `devlog/_plan/` for a loop plan MOC with `pending` phases. If found, run `jwc orchestrate p` for the next pending phase. If no loop plan exists, write one first: document the objective and phase breakdown in `devlog/_plan/<date>_<slug>/00_moc.md`, then enter P.
```

---

## File 2: MODIFY `packages/coding-agent/src/prompts/jaw/orchestrate-p.md`

### Change 2A: loop plan 참조 지침 추가

**Insert after Step 1** (after line 8):

```
   - **Loop-aware planning**: If a devlog loop plan exists (see system prompt for format), identify the first `pending` phase as this iteration's scope. Reference the loop plan path and "Phase N of M" in the plan draft. Consult prior iteration commits and WONDER/REFLECT from previous D-stages. Mark the phase `active` in the MOC when P begins.
```

---

## File 3: MODIFY `packages/coding-agent/src/prompts/jaw/orchestrate-d.md`

### Change 3A: loop continuation 판단 지침

**Replace line 28** (the `**Goal-mode continuation**` paragraph):

```
**Loop and goal continuation**: After closing and returning to idle:
1. If a devlog loop plan exists with `pending` phases: mark the just-completed phase `done` in the MOC, then re-enter `jwc orchestrate p` for the next `pending` phase. When a `jwc goal` is active, proceed automatically (HOTL); otherwise confirm with the user first.
2. If no loop plan exists but a `jwc goal` is active: check whether the goal objective is fully achieved. If work remains, re-enter planning with `jwc orchestrate p`. If the goal is complete, run `jwc goal done`.
3. If the goal is truly impossible or needs a direction change, pause and ask the user.
Do not treat IDLE as the end when loop phases or goal work remain.
```

---

## File 4: MODIFY `packages/coding-agent/src/defaults/jwc/skills/jaw-interview/SKILL.md`

### Change 4A: Phase 5 Option 1에 loop 안내 통합

Phase 5의 Option 1 ("Refine with the orchestrate plan stage") description을 확장하여 loop 안내를 포함합니다. 기존 Phase 5 execution options 구조와 Phase 5b handoff 흐름을 유지합니다.

**In Phase 5, modify Option 1's description** (현재: "Plan-refine this spec through the native orchestrate P stage, then stop for explicit execution approval. Maximum quality. Prefer this unless the spec is already implementation-ready and trivially simple."):

**After** (expanded):
```
"Plan-refine this spec through the native orchestrate P stage, then stop for explicit execution approval. Maximum quality. Prefer this unless the spec is already implementation-ready and trivially simple. **Loop execution**: if the spec covers multiple independent patches, the agent will propose a loop plan (phase breakdown in `devlog/_plan/`) before entering P — each phase runs a separate PABCD cycle."
```

**Additionally, insert before the execution options question** (after the `--research-setup` override check):

```
**Loop assessment**: Before presenting the execution options below, assess whether the spec describes work that should be split into multiple PABCD cycles. If so, note it in the question preamble so the user can make an informed choice. Do not bypass the execution options — loop is a mode of Option 1, not a separate gate.
```

This ensures loop flows through the standard Phase 5 → Phase 5b → orchestrate P path without contradicting Phase 5 invariants.

---

## Acceptance Criteria

| AC | Change | Verification |
|----|--------|--------------|
| AC1 | 1A | system-prompt.md orchestrate description includes loop + MOC format |
| AC2 | 1B | system-prompt.md routing has loop routing |
| AC3 | 2A | orchestrate-p.md references loop plan for scoping |
| AC4 | 3A | orchestrate-d.md has loop continuation logic |
| AC5 | — | orchestrate-state.ts unchanged |
| AC6 | 4A | jaw-interview SKILL.md Option 1 includes loop guidance, assessment note added |
