# MOC: PABCD Loop Concept

**Date**: 2026-06-16  
**Status**: Interview complete → spec at `.jwc/specs/jaw-interview-pabcd-loop-concept.md`
**Spec**: `.jwc/specs/jaw-interview-pabcd-loop-concept.md`

## Summary

PABCD orchestrate에 "loop" 개념 도입. 하나의 구현 목표를 N개의 논리적 패치(phase)로 분할하여 각 phase를 하나의 PABCD 사이클(P→A→B→C→D)로 실행하는 구조를 prompt layer에 반영한다.

## Key Decisions (Interview R0-R6)

1. **D = idle 복귀**: d→p 직행 transition 불필요. D 완료 → idle → agent가 loop plan/goal 확인 → 재진입
2. **State schema 변경 최소**: PabcdEnvelope에 loop 필드 불필요. devlog 문서 + 세션 메모리로 충분
3. **Loop plan = devlog 문서**: `devlog/_plan/` 아래 MOC에 phase별 분할 작성. P-stage가 참조
4. **Loop objective 소유자**: 유저 or agent — 둘 다 가능
5. **Loop 재진입 자동화**: HITL/HOTL 설정에 따름
6. **Interview→P gate**: spec 완성 시 "loop인지 단일 패치인지" 유저 확인 필수 (자동 P 넘김 방지)

## Affected Files (Prompt Layer Only)

| File | Change |
|---|---|
| `packages/coding-agent/src/prompts/system/system-prompt.md` | orchestrate 설명(40-52행)에 loop 개념 + routing(80-98행)에 loop 라우팅 |
| `packages/coding-agent/src/prompts/jaw/orchestrate-p.md` | loop plan 참조 지침 |
| `packages/coding-agent/src/prompts/jaw/orchestrate-d.md` | loop continuation 판단 지침 |
| `packages/coding-agent/src/defaults/jwc/skills/jaw-interview/SKILL.md` | Phase 5 loop/단일패치 gate |

## Phases (Loop Plan for Implementation)

이 작업 자체도 PABCD loop으로 구현 가능하나 규모가 작아 단일 PABCD 사이클로 충분:

- **Phase 1**: system-prompt.md 수정 (AC1, AC2)
- **Phase 2**: orchestrate-p.md + orchestrate-d.md 수정 (AC3, AC4)
- **Phase 3**: jaw-interview SKILL.md Phase 5 gate 수정 (AC6)
- **Phase 4**: AC5 검증 (state 변경 없음 확인)
