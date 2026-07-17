# 020_omp_D16_collab_web_extension

> Range: `7aa1d581c..b0d04e517` (subset)
> Cluster: D16 — collab-web/extension integration
> Sol priority: P3
> Model-related: no
> Card target: 20.068_collab_web_extension
> Worker: OW9

## 커밋 전수 테이블

| # | hash | summary | JWC impact area |
|---|---|---|---|
| 1 | `707046b68` | collab transcript의 user/custom message를 Markdown으로 렌더링 | `packages/collab-web/src/components/transcript/` |
| 2 | `8480a84b3` | active transcript에서 진행 중 tool arguments 보존 | collab transcript component/tests |
| 3 | `70316a7f8` | active transcript tool 행 중복 제거 | collab transcript, workflow notice |
| 4 | `33c161d9d` | plugin system과 binary/dist build 흐름 재구성 | coding-agent extensibility/build scripts |
| 5 | `24960899a` | compiled extension module을 lazy load하도록 legacy 호환층 수정 | legacy-pi virtual modules/compat |
| 6 | `5303c3852` | extension `tool_result` hook가 thrown failure content도 rewrite 가능하게 수정 | extension wrapper/tests |
| 7 | `e7955ddf3` | interactive input의 순차 message queue와 queue 명령 도입 | input controller, queue-input, editor |
| 8 | `d179968bb` | bundle 생성을 CLI 호출에서 `Bun.build` API로 이전 | coding-agent build scripts |

## 주제 분석

이 클러스터는 협업 transcript의 표시 정확도와 extension 실행 계약을 함께 묶는다. transcript 쪽 세 커밋은 진행 중 tool call을 갱신할 때 arguments를 잃거나 같은 도구를 두 번 그리는 문제를 막는다. extension 쪽은 build 시점의 plugin 포함 방식, compiled module 로딩 시점, 실패한 tool result의 rewrite 가능 범위를 정리한다.

extension `sendUserMessage`의 streaming steer 구현 자체는 이 범위의 기준 커밋 이전 이력에 이미 존재한다. 이번 범위에서는 순차 queue 기반(`e7955ddf3`)과 build/extension 후속 정리가 핵심 delta다. 따라서 카드에서는 기준선의 `sendUserMessage` 계약과 이번 queue 변경을 합쳐 현재 JWC의 steer/follow-up 동작과 비교해야 한다.

## Worktree 대조

현재 JWC에는 독립 `packages/collab-web` 패키지가 없으므로 세 transcript 커밋은 직접 포트 대상보다 협업·export UI의 표시 계약 참고에 가깝다. 반면 `packages/coding-agent/src/session/agent-session.ts`에는 `sendUserMessage`와 `streamingBehavior` 분기가 있고, extension/plugin 호환층도 존재한다.

JWC는 자체 bridge·RPC와 workflow queue를 운영한다. queue 동작을 가져올 때는 기존 steer/follow-up 순서, tool-use/tool-result adjacency, RPC extension dialog의 stdin 생명주기를 깨지 않는지 확인해야 한다. plugin build 변경은 JWC의 Bun shim과 현재 배포 전략에 맞춰 adapt 대상으로 분류한다.

## 누락 커밋 보완 (2026-07-17)

범위 전체와 기존 분류 파일의 정확한 해시 차집합에서 확인한 누락 커밋을 추가한다.

| # | hash | git one-line summary | classification |
|---|---|---|---|
| 1 | `21446db15` | fix(coding-agent): resolve continued ids before extension flags | collab/RPC/extension |
| 2 | `39290eade` | fix(coding-agent): deferred continue normalization past extension flags | collab/RPC/extension |
| 3 | `3bbeaa400` | fix(rpc): failed closed host tools after rpc eof | collab/RPC/extension |
| 4 | `583963150` | fix(rpc): retain malformed frame errors | collab/RPC/extension |
| 5 | `59ecd2a4d` | refactor(coding-agent/modes): added ACP type guards for elicitation narrowing | collab/RPC/extension |
| 6 | `953859d95` | fix(acp): awaited teardown on stdio disconnect | collab/RPC/extension |
| 7 | `99a65c787` | fix(rpc): kept stdin live during extension ui dialogs | collab/RPC/extension |
