# 010_gjc_C07_coordinator_mcp_session_reaper

> Range: `4a80bac9..3ddf26079` (subset)
> Cluster: C07 — coordinator MCP/session reaper
> Sol priority: P2
> Model-related: no
> Card target: 10.097_coordinator_mcp_session_reaper
> Worker: GW5

## 커밋 전수 테이블

| # | hash | summary | JWC impact area |
|---|---|---|---|
| 1 | `6fae7cc54` | fix(ci): isolate ACP and GC fixtures (#2203) | `packages/coding-agent/test` ACP/GC 격리 |
| 2 | `0155ef2da` | fix(coding-agent): stabilize coordinator MCP late-readiness test vs session-state write race (#2082) | coordinator MCP 상태 경합 테스트 |
| 3 | `1b85953a2` | docs(changelog): document coordinator idle session reaper + stop_session (#2080) | coding-agent 변경 기록 |
| 4 | `4f0d7aba2` | feat(coordinator-mcp): owner-proof idle session reaper + stop_session (#2080) | `packages/coding-agent/src/coordinator-mcp` 세션 수명주기 |
| 5 | `9201bf02e` | feat(acp): add fail-closed session deletion (#2074) | ACP 세션 삭제와 클라이언트 브리지 |
| 6 | `b8d6c8253` | fix(coding-agent): gate coordinator prompts on runtime readiness (#2045) | coordinator prompt readiness 게이트 |
| 7 | `e70f8362c` | Revert "feat(coordinator-mcp): owner-proof idle session reaper + stop_session (#2061)" | coordinator reaper 되돌림 이력 |
| 8 | `691b7c521` | feat(coordinator-mcp): owner-proof idle session reaper + stop_session (#2061) | coordinator reaper 초기 구현 |
| 9 | `c0933709d` | fix(coordinator-mcp): recognize tmux ≥3.7 'error connecting to' no-server diagnostic (deterministic delegate failure) (#2060) | tmux 무서버 판정과 delegate 실패 |
| 10 | `891361a07` | fix(coordinator-mcp): resilient tmux owner-server probe (transient spawn failures no longer abort delegate) (#2059) | tmux owner-server 생존 확인 |
| 11 | `33ec2ddee` | fix(coordinator-mcp): safe bounded concurrent stdio dispatch (addresses #1964 review) | coordinator stdio 동시성 경계 |
| 12 | `7ab091046` | fix(coding-agent): isolate tmux owner lifecycle (#2004) | JWC tmux owner 격리와 세션 스크립트 |

## 주제 분석

이 클러스터는 coordinator가 만든 세션의 소유권과 종료 권한을 명시적으로 묶는다. 유휴 세션을 지울 때 owner proof를 요구하고, `stop_session`을 같은 권한 경계에 둔다. tmux 3.7 이상의 무서버 진단을 정상적인 부재 상태로 해석하면서도 일시적인 owner-server 실행 실패는 delegate 전체 실패로 확대하지 않는다.

동시에 stdio 요청 수를 제한해 한꺼번에 들어온 호출이 coordinator를 고갈시키지 않게 한다. ACP 삭제는 세션 정체성과 권한이 확인되지 않으면 닫힌 방향으로 실패한다. JWC에는 이미 coordinator와 tmux 수명주기 코드가 있으므로 단순 복사보다 JWC mutation policy, `.jwc` 상태 경로, 세션 식별자 규칙에 맞춘 적응이 중요하다.

## Worktree 대조

현재 JWC의 `packages/coding-agent/src/coordinator-mcp/server.ts`는 `start_session`, prompt 전송, 상태·turn 조회, tmux 부재 시 turn terminalization을 제공한다. 하지만 집중 검색에서는 `stop_session` 도구와 owner-proof idle reaper가 확인되지 않았다. tmux probe도 `has-session` 중심이며 3.7의 `error connecting to` 진단과 일시적 spawn 실패를 분리하는 명시적 계약은 보이지 않는다.

`packages/coding-agent/src/modes/acp/`에는 ACP 세션 표면이 있고 coordinator에는 mutation policy가 적용된다. 다만 이 클러스터의 fail-closed 삭제 계약과 bounded stdio dispatch를 증명하는 대응 테스트는 아직 별도 확인이 필요하다. 따라서 현재 상태는 coordinator 기반은 존재하지만 세션 회수·명시 종료·probe 오류 분류가 남은 부분 대응이다.
