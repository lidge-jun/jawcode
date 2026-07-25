# 020_omp_D06_vibe_mode

> Range: `7aa1d581c..b0d04e517` (subset)
> Cluster: D06 — vibe mode
> Sol priority: P2
> Model-related: no
> Card target: 20.057_vibe_mode
> Worker: OW4

## 커밋 전수 테이블

| # | hash | summary | JWC impact area |
|---|---|---|---|
| 1 | `408a92d91` | Enabled asynchronous background task execution | task executor and background lifecycle |
| 2 | `75bac085a` | Implemented persistent worker-session infrastructure | worker-backed task sessions |
| 3 | `1ab9c367e` | Integrated vibe mode with the interactive interface | interactive mode, status line, commands |
| 4 | `b60cbb83b` | Validated vibe runtime lifecycle and concurrency | runtime session tests |
| 5 | `514a8ca6c` | Updated status-line helpers for vibe mode | API/status-line test helpers |
| 6 | `acd893536` | Introduced vibe mode for persistent background agents | vibe tool and runtime |
| 7 | `aa2c580b2` | Added dynamic rendering and state synchronization | vibe tool rendering and shared state |
| 8 | `46fd8c557` | Hardened vibe tool lifecycle management | spawn/send/wait/kill lifecycle |

## 주제 분석

이 클러스터는 한 번 호출하고 끝나는 하위 작업을 지속형 background agent로 바꾼다. worker session이 살아 있는 동안 사용자는 목록을 보고, 메시지를 보내고, 결과를 기다리고, 종료할 수 있다. 인터랙티브 화면은 런타임 상태를 동적으로 반영해야 하며 동일 worker에 대한 중복 작업과 종료 경쟁을 제어해야 한다.

핵심은 UI보다 수명주기다. spawn 성공 뒤 상태 등록, 재사용 가능한 session identity, 동시 wait, 메시지 전달, 종료와 정리, 렌더 상태 동기화가 하나의 계약으로 움직여야 한다. background task 실행만 있다고 persistent agent가 되는 것은 아니다.

## Worktree 대조

현재 JWC에는 background task와 job 표시를 위한 `task/`, `background-row-model.ts`, `jobs-overlay-model.ts`가 있다. 그러나 OMP의 `src/vibe/runtime.ts`, `src/vibe/state.ts`, `tools/vibe.ts`에 대응하는 전용 vibe runtime과 명령 표면은 현재 트리에 없다.

따라서 이 클러스터는 단순 체리픽 후보가 아니라 제품 의미를 먼저 결정해야 하는 차이다. JWC의 기존 task/team/goal 수명주기와 중복되는지, persistent worker가 별도 공개 워크플로인지 내부 실행 기반인지 정한 뒤 비교해야 한다. 채택한다면 worker identity, 재접속, concurrency, kill cleanup, 상태 렌더 동기화를 acceptance contract로 둔다.

## 누락 커밋 보완 (2026-07-17)

범위 전체와 기존 분류 파일의 정확한 해시 차집합에서 확인한 누락 커밋을 추가한다.

| # | hash | git one-line summary | classification |
|---|---|---|---|
| 1 | `0a98aa252` | feat(coding-agent/modes): hardened tan fork isolation and session sync | vibe/downshift workflow |
| 2 | `2c161d2a8` | fix(coding-agent): preserved btw codex websocket routing | vibe/downshift workflow |
| 3 | `46ed33f27` | feat(coding-agent): initialized session metadata during tan creation | vibe/downshift workflow |
| 4 | `4d019e561` | feat(coding-agent): trigger downshift on post-plan todo initialization | vibe/downshift workflow |
| 5 | `585b9e437` | ux(mode): enabled user control over compacted transcript session collapse | vibe/downshift workflow |
| 6 | `590270ca2` | feat(coding-agent): gated downshift trigger on todo initialization | vibe/downshift workflow |
| 7 | `8b179ffc3` | fix(coding-agent): routed guided-goal oneshot through codex websocket transport | vibe/downshift workflow |
| 8 | `9269823d1` | fix(coding-agent): shared codex state for btw websockets | vibe/downshift workflow |
| 9 | `95ecc61bc` | feat(coding-agent): implemented downshift boomerang flow for context handoff | vibe/downshift workflow |
| 10 | `9b8ec997b` | fix(coding-agent): reused one codex side session per guided-goal interview | vibe/downshift workflow |
| 11 | `9f1ff90a3` | feat(coding-agent): implemented downshift and plan-yolo agent workflows | vibe/downshift workflow |
| 12 | `ac1625361` | wip: rslide (experimental) | vibe/downshift workflow |
| 13 | `d6f8c061b` | feat(config): introduced schema for collapsed transcript mode | vibe/downshift workflow |
| 14 | `eb52f6ea2` | feat(coding-agent): injected context-switch instructions into tangential agent forks | vibe/downshift workflow |
| 15 | `f405525bf` | feat: removed boomerang feature and associated validation workflows | vibe/downshift workflow |
