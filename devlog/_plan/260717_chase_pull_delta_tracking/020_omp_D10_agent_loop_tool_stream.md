# 020_omp_D10_agent_loop_tool_stream

> Range: `7aa1d581c..b0d04e517` (subset)
> Cluster: D10 — agent-loop tool stream recovery
> Sol priority: P2
> Model-related: yes (partial)
> Card target: 20.062_agent_loop_tool_stream
> Worker: OW6

## 커밋 전수 테이블

| # | hash | summary | JWC impact area |
|---|---|---|---|
| 1 | `e28197c69` | revert empty toolUse retry reclassification | `packages/agent/src/agent-loop.ts` |
| 2 | `1df790a5d` | revert incomplete sibling tool-call discard | `packages/agent/src/agent-loop.ts` |
| 3 | `7a2e34988` | discard incomplete sibling tool calls | `packages/agent/src/agent-loop.ts` |
| 4 | `4200dec04` | strip incomplete tool calls on empty toolUse stop | `packages/agent/src/agent-loop.ts` |
| 5 | `94fc54859` | reclassify empty toolUse in result-only completion | `packages/agent/src/agent-loop.ts` |
| 6 | `f64a17c52` | classify empty toolUse stop as retryable | `packages/agent/src/agent-loop.ts` |
| 7 | `9e72202b4` | gate custom eager streaming on compat provenance | `packages/ai/src/providers/anthropic.ts` |
| 8 | `33bbf69f1` | derive eager streaming from the effective endpoint | `packages/ai/src/providers/anthropic.ts` |
| 9 | `4b3ec660f` | disable eager streaming for custom Anthropic | catalog compat; model config |
| 10 | `d00e5548e` | drop incomplete failed tool calls | `packages/agent/src/agent.ts` |
| 11 | `5a7f10780` | preserve Cursor results on stream failure | `packages/agent/src/agent.ts` |
| 12 | `408641822` | pair tool calls/results on failed partial streams | `packages/agent/src/{agent-loop.ts,agent.ts}` |
| 13 | `b3145170a` | surface provider stream failures | `packages/agent/src/agent.ts` |
| 14 | `8c6b2fb45` | resolve agent slash URLs for nested subagent output | `packages/coding-agent/src/internal-urls/agent-protocol.ts` |
| 15 | `0b9bdaaed` | recover malformed tool arguments automatically | AI dialect validation |
| 16 | `54af1c03f` | surface provider errors to ACP clients | ACP agent/event mapper |
| 17 | `51cc34ac6` | surface exhausted empty-stop retries | `packages/coding-agent/src/session/agent-session.ts` |
| 18 | `fabded89e` | classify empty provider responses as retryable | `packages/ai/src/error/provider.ts` |

## 주제 분석

이 클러스터는 provider stream이 tool call을 완성하기 전에 끊기거나 `toolUse` stop만 남기는 경우의 복구 계약을 정리한다. 완성되지 않은 sibling call은 실행 후보에서 제거하고, 이미 완성된 call과 result의 짝은 보존한다. 빈 stop은 정상 종료로 숨기지 않고 제한된 retry 또는 최종 오류로 승격한다.

custom Anthropic endpoint에서는 eager streaming 가능 여부를 모델 이름이 아니라 실제 endpoint와 compat provenance로 판단한다. 이 부분은 provider/model 설정과 agent-loop가 맞닿는 model-related 영역이다. nested subagent 출력의 `agent://` 해석, malformed argument 복구, ACP 오류 전달은 동일 실패를 CLI·ACP·subagent 소비자가 서로 다르게 보지 않도록 만든다.

## Worktree 대조

JWC에는 `packages/agent/src/agent-loop.ts`와 `packages/agent/src/agent.ts`가 있고, `agent://` 처리는 `packages/coding-agent/src/internal-urls/agent-protocol.ts`가 담당한다. 그러나 현재 소스에서 OMP의 “empty toolUse”, “incomplete sibling”, “malformed tool argument” 표식은 확인되지 않는다. provider 오류와 partial tool pairing은 JWC의 수정 중인 agent/provider stream 경로와 겹치므로, 포팅 전 현재 dirty worktree의 stream recovery 변경과 충돌 여부를 먼저 분리해야 한다.

## 누락 커밋 보완 (2026-07-17)

범위 전체와 기존 분류 파일의 정확한 해시 차집합에서 확인한 누락 커밋을 추가한다.

| # | hash | git one-line summary | classification |
|---|---|---|---|
| 1 | `1be025bb7` | fix(cursor): propagated returned tool error status | agent loop/tool stream |
| 2 | `33b6774aa` | feat(coding-agent): implemented resumable subagent yielding for tasks | agent loop/tool stream |
| 3 | `42d81f189` | feat(coding-agent): redesigned agent hub layout for task clarity | agent loop/tool stream |
| 4 | `5b20a7dea` | feat(coding-agent): implemented persistence for tool calls during rebuilds | agent loop/tool stream |
| 5 | `5e71fac65` | fix(session): retried bare Request was aborted error-stop turns | agent loop/tool stream |
| 6 | `64dfb98c2` | feat: stabilized runner lifecycle and output processing for agent operations | agent loop/tool stream |
| 7 | `6c292b97c` | refactor(coding-agent): preserved completed and abandoned tasks in session | agent loop/tool stream |
| 8 | `74c63fa6c` | fix(agent): labeled system steering skips accurately | agent loop/tool stream |
| 9 | `87a64b2f6` | feat(coding-agent): improved background job lifecycle and display | agent loop/tool stream |
| 10 | `9831386de` | fix(agent): escaped harmony compaction markers | agent loop/tool stream |
| 11 | `9a868d2e7` | feat: introduced agent suspension mechanism with pause command and ui | agent loop/tool stream |
| 12 | `a3117c284` | feat(agent): migrated async-drain utility to shared package for reuse | agent loop/tool stream |
| 13 | `a34d99c6a` | fix(agent): aborted repeated empty yield loops | agent loop/tool stream |
| 14 | `a420dd11e` | fix(session): preserve terminal failed tool turns | agent loop/tool stream |
| 15 | `b591f3d05` | fix(agent): kept completed tool results from false skipped placeholder | agent loop/tool stream |
