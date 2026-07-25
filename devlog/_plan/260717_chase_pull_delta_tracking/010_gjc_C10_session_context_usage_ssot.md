# 010_gjc_C10_session_context_usage_ssot

> Range: `4a80bac9..3ddf26079` (subset)
> Cluster: C10 — session context-usage SSOT
> Sol priority: P2
> Model-related: no
> Card target: 10.100_session_context_usage_ssot
> Worker: GW6

## 커밋 전수 테이블

| # | hash | summary | JWC impact area |
|---|---|---|---|
| 1 | `a8b46f0b1` | test(status-line): exercise context cache through SSOT | status-line context cache 테스트 |
| 2 | `7fd976f93` | style(coding-agent): apply Biome formatting to SSOT changes | context SSOT 구현·테스트 형식 정리 |
| 3 | `32ef39422` | fix(agent): Agent-owned context revision for the context-usage snapshot cache | agent context revision과 snapshot cache |
| 4 | `8487b7f13` | perf(coding-agent): cache the session context-usage snapshot; retire duplicate status-line heuristic total | session snapshot cache와 status-line |
| 5 | `555c94ce6` | fix(coding-agent): resolve SSOT review blockers (anchor selection, nullable totals, provenance) | context usage anchor, nullable total, RPC provenance |
| 6 | `96f487934` | fix(coding-agent): make provider-reported usage the SSOT for context tokens/% | session usage, status-line, RPC |
| 7 | `b47e8d282` | fix(coding-agent): anchor pre-prompt context estimates on total usage (#2040) | pre-prompt context 추정 |
| 8 | `93b59da7e` | fix(session): attribute cache misses by evidence, not a blanket user-side cause (#2020) (#2048) | usage cache miss attribution |

## 주제 분석

이 클러스터는 context token 수치의 기준을 provider가 보고한 usage로 통일한다. 상태줄, `/context`, RPC가 서로 다른 휴리스틱을 다시 계산하지 않고 같은 snapshot을 읽는다. 새 prompt가 아직 provider 응답을 받지 못한 구간만 마지막 total usage를 anchor로 삼아 후행 메시지 비용을 추정한다.

snapshot에는 revision과 provenance가 있어 어떤 메시지 상태에서 계산됐는지, total이 실제 보고값인지 nullable인지 구분한다. cache miss 원인도 무조건 사용자 입력으로 돌리지 않고 관측된 cache read/write와 메시지 변화에 근거해 분류한다. 이 구조는 표시값 흔들림과 compaction 판단 오해를 줄인다.

## Worktree 대조

현재 JWC의 `AgentSession.getContextUsage()`는 마지막 assistant usage를 찾은 뒤 후행 메시지 휴리스틱과 전체 메시지 휴리스틱을 계산하고 `Math.max`로 합친다. provider usage를 사용하지만 표시 수치의 유일한 SSOT는 아니며, provider 값과 추정값의 provenance를 반환하지 않는다. `Usage.estimated` 필드는 provider가 추정치를 보낸 경우를 구분할 수 있게 이미 존재한다.

status-line은 `getCachedContextBreakdown()`을 사용해 `/context` 계열 계산을 캐시하지만, upstream의 agent-owned revision snapshot과 동일한 invalidation 계약은 확인되지 않았다. 따라서 JWC에는 cache와 provider usage 기반이 있으나 duplicate heuristic retirement, nullable totals, anchor/provenance 계약은 아직 차이가 남는다.
