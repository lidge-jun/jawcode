# 010_gjc_C09_deep_interview_goal_ultragoal

> Range: `4a80bac9..3ddf26079` (subset)
> Cluster: C09 — deep-interview/goal/ultragoal
> Sol priority: P2
> Model-related: no
> Card target: 10.099_deep_interview_goal_ultragoal
> Worker: GW5

## 커밋 전수 테이블

| # | hash | summary | JWC impact area |
|---|---|---|---|
| 1 | `24381ca3c` | test(coding-agent): await terminal settlement in goal loops | goal loop terminal settlement 테스트 |
| 2 | `f2957b46f` | fix(coding-agent): prevent stale goal reminder suppression | goal reminder 세대·중복 억제 |
| 3 | `bfcc012b1` | test(coding-agent): prove deep-interview continuation races | deep-interview continuation 경합 테스트 |
| 4 | `d33646132` | fix(coding-agent): fence deep-interview continuation ownership | deep-interview continuation owner fencing |
| 5 | `9551981b7` | fix(deep-interview): resume incomplete rounds | interview round 복구와 재개 |
| 6 | `671d1bd1d` | fix(goal): hold repeated timeout continuations | goal timeout continuation 보류 |
| 7 | `fd9ab3456` | fix(ultragoal): re-mint final-aggregate receipts instead of deadlocking on stale ones (red-team hardened) (#2298) | ultragoal 최종 aggregate receipt |
| 8 | `ee814a467` | fix(ci): await goal context turn idle (#2209) | goal context idle 전이 테스트 |

## 주제 분석

이 클러스터는 장기 워크플로가 스스로 다음 turn을 시작할 때 생기는 소유권 경합을 막는다. deep-interview continuation은 자신이 이어야 할 round와 message epoch를 확인하고, 중간에 사용자 입력이나 새 continuation이 끼면 오래된 작업이 진행하지 못하게 한다. 불완전 round는 상태를 버리지 않고 재개한다.

goal 쪽은 같은 timeout continuation을 반복 제출하지 않고 보류한다. stale reminder가 새 reminder까지 막지 않도록 세대와 완료 상태를 구분한다. ultragoal은 오래된 final-aggregate receipt 때문에 완료 경로가 교착되면 유효한 새 receipt를 재발급해 종료 가능성을 회복한다.

## Worktree 대조

JWC는 해당 워크플로를 `jaw-interview`와 `goal`로 재명명했다. `packages/coding-agent/src/jwc-runtime/jaw-interview-runtime.ts`, `goal-engine.ts`, `goal-guard.ts`가 상태와 receipt를 소유한다. `agent-session.ts`에는 마지막 goal reminder의 assistant timestamp를 기억해 동일 메시지에 대한 중복 reminder를 억제하는 코드가 있고, goal integration 테스트는 busy/compaction/interrupt 중 continuation 재무장을 다룬다.

또한 goal 테스트에는 fresh final aggregate receipt 요구가 존재해 ultragoal 교착 문제와 유사한 안전 경계가 일부 반영되어 있다. 다만 GJC의 deep-interview continuation owner fencing과 incomplete-round resume를 JWC의 jaw-interview 상태 모델에서 동등하게 증명하는 테스트는 확인되지 않았다. timeout 반복 보류와 stale reminder 세대 전환도 정확한 동작 대조가 필요하므로 현재 상태는 부분 동등이다.
