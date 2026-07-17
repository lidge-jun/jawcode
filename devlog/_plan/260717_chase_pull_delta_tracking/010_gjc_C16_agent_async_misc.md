# 010_gjc_C16_agent_async_misc

> Range: `4a80bac9..3ddf26079`
> Cluster: C16 — agent async/misc
> Sol priority: P3
> Model-related: ✗
> Card target: 10.088_agent_async_misc
> Worker: GW1

이 클러스터는 async resume, queued epoch, deferred settlement가 세션의 실제 turn authority에 결박되도록 만든다. session directory 충돌, tools-only MCP 설정, Python admission 종료처럼 같은 세션 경계에서 발생하는 잡다한 race도 함께 추적한다.

## 커밋 전수 테이블

| # | hash | summary | JWC impact area |
|---|---|---|---|
| 1 | `9feb609b5` | fix(coding-agent): isolate lifecycle subscribers | session lifecycle subscribers |
| 2 | `c97f13e50` | fix(coding-agent): dedupe worker integration settlement | worker settlement |
| 3 | `5979253d1` | fix(coding-agent): await deferred agent_end settlement | deferred agent settlement |
| 4 | `c0c315a66` | fix(coding-agent): align queued epochs with turn lifecycle | message queue epochs |
| 5 | `e7f50d2bf` | fix(coding-agent): bind queued intent to message epochs | queued intent authority |
| 6 | `128bcf630` | fix(coding-agent): prevent managed session directory collisions | session storage path identity |
| 7 | `672890d37` | fix(async): bind resume authority per descriptor (#2303) (#2313) | async job manager |
| 8 | `0afb4e958` | fix(coding-agent): preserve subagents on interrupted await (#2301) | subagent await lifecycle |
| 9 | `6e37e7093` | feat(mcp): add explicit tools-only config for one session (#2274) | session MCP config |
| 10 | `3bba5be1e` | fix(coding-agent): settle resumed retries before idle | retry/idle transition |
| 11 | `c439e8514` | fix(session): close Python admission before disposal (#2208) | Python RPC session disposal |
| 12 | `b12fb2573` | fix(coding-agent): serialize prompt and model admission (#2204) | prompt/model admission |
| 13 | `366c1d150` | fix(sdk): fence stale websocket callbacks (#2174) | SDK session callbacks |

## 주제 분석

공통 원인은 비동기 작업의 완료 신호가 현재 turn 또는 현재 session의 소유임을 증명하지 못하는 데 있다. epoch와 descriptor를 authority token처럼 사용하고, idle 전환 전에 deferred settlement를 기다려야 한다. storage path, MCP config, Python/WebSocket 종료도 stale callback이 새 세션에 들어오지 못하도록 같은 원칙을 적용한다.

## model/ 교차 참조

직접 model-related로 분류하지 않는다. `serialize prompt and model admission`은 모델 카탈로그를 바꾸는 기능이 아니라 turn admission 순서를 고정하는 세션 무결성 변경이다.

## Worktree 대조

JWC에는 `packages/coding-agent/src/async/job-manager.ts`와 `session/agent-session.ts`가 있고 후자는 현재 작업 트리에서 수정 중이다. 카드 작성 시 현재 변경을 덮지 말고 queued turn, subagent await, RPC disposal 각각의 authority 필드를 먼저 대조해야 한다.

