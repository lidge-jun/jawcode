# 010_gjc_C12_codex_reasoning_thinking_sdk

> Range: `4a80bac9..3ddf26079` (subset)
> Cluster: C12 — Codex reasoning/thinking/SDK
> Sol priority: P1
> Model-related: yes
> Card target: 10.093_codex_reasoning_thinking_sdk
> Worker: GW3

## 커밋 전수 테이블

| # | hash | summary | JWC impact area |
|---|---|---|---|
| 1 | `f912eddcf` | fix(security): close Codex reasoning and summary queue races | AI auth gateways와 session message queue |
| 2 | `9036b594e` | fix(ai): fail closed for unmarked Responses reasoning | AI gateway Responses reasoning 필터 |
| 3 | `cf94f8804` | fix(ai,agent): explicit invalid_prompt classification + bounded circuit breaker (#2282) (#2314) | Responses transport와 agent-loop breaker |
| 4 | `1a3d04649` | fix(sdk): expose model thinking capabilities (#2180) | AI model type, SDK query/host, package smoke |
| 5 | `41c8e1f76` | fix(sdk): preserve durable thinking in model selection | SDK model.set, session default selection |

## 주제 분석

이 클러스터는 reasoning을 모델 선택 메타데이터, SDK 제어, transport 보안 경계에서 같은 계약으로 다룬다. SDK는 각 모델의 thinking 가능 범위와 mode를 노출한다. 명시적인 thinking level로 모델을 바꾸면 그 값도 durable default selection 경로를 통과해 재시작 후 사라지지 않는다.

Responses 계층은 표시 가능한 assistant reasoning과 내부 reasoning을 구분한다. provenance가 없는 reasoning은 외부로 내보내지 않고 fail-closed로 처리한다. `invalid_prompt`는 일시적 provider 장애가 아니라 오염된 history의 결정적 오류로 분류하며, 한 번의 bounded repair 이후에는 circuit breaker가 반복 재시도를 끝낸다. reasoning summary queue도 turn 소유권을 확인해 오래된 frame이 다른 turn으로 새지 않게 한다.

## Worktree 대조

현재 JWC에는 `packages/ai/src/types.ts`의 canonical thinking capability metadata와 `packages/ai/src/model-thinking.ts`의 clamp/mapping 로직이 있다. `defaultThinkingLevel`, profile activation, session restore 경로도 존재해 durable thinking의 기반은 강하다. 이 상태는 진행 중인 worktree 변경까지 반영한 관찰이다.

반면 source 집중 검색에서는 `invalid_prompt` 전용 분류자와 bounded circuit breaker가 확인되지 않았다. unmarked Responses reasoning의 fail-closed 처리와 reasoning/summary queue race를 직접 증명하는 대응 코드·테스트도 보이지 않는다. SDK가 thinking metadata를 외부 query surface에 완전히 노출하는지도 별도 검증이 필요하므로 현재 평가는 metadata·지속성은 부분 동등, transport 보안은 미대응이다.
