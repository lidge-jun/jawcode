# 020_omp_D02_catalog_pricing_routing

> Range: `7aa1d581c..b0d04e517` (subset)
> Cluster: D02 — catalog pricing/routing
> Sol priority: P1
> Model-related: yes
> Card target: 20.053_catalog_pricing_routing
> Worker: OW2

## 커밋 전수 테이블

| # | hash | summary | JWC impact area |
|---|---|---|---|
| 1 | `6e0b9d34f` | Raised Fireworks Kimi K2.7-Code maxTokens to 65,536 | generated model catalog and Fireworks descriptors |
| 2 | `b865e6a4d` | Scoped the Kimi K2.7 timeout override to Moonshot | OpenAI-compatible timeout policy |
| 3 | `d7241e572` | Invalidated stale MAI Code routes | GitHub Copilot model discovery cache |
| 4 | `03c48d073` | Reconciled OpenRouter usage and refreshed catalog entries | OpenRouter transport usage plus generated models |
| 5 | `4d89b2902` | Routed Copilot MAI Code models to the Responses API | Copilot descriptor and API selection |
| 6 | `fdf79caf2` | Sourced Z.ai GLM pricing from PAYG catalog keys | generated catalog pricing metadata |
| 7 | `29c8cae9b` | Extended the stream idle floor for Kimi K2.7 Code | model-specific stream timeout compatibility |
| 8 | `7cdecd824` | Widened GLM coding-plan idle timeouts for OpenCode gateways | GLM/OpenCode compatibility routing |
| 9 | `f34034fa7` | Classified Z.ai GLM-5.2 anthropic-messages as budget effort | model thinking capability classification |
| 10 | `c1480b29e` | Parsed version-first Claude model identifiers | catalog identity and family classification |
| 11 | `b7aa046ed` | Preserved static model limits on cache mismatch | model manager cache reconciliation |
| 12 | `26a4a4f89` | Made OpenCode model discovery authoritative | provider descriptor discovery precedence |
| 13 | `b61dddc78` | Partitioned OpenCode model caches | provider-scoped model cache identity |

## 주제 분석

이 클러스터는 모델 이름을 목록에 추가하는 수준을 넘어선다. 같은 모델이라도 제공자와 엔드포인트에 따라 최대 출력, 유휴 타임아웃, 가격, reasoning 단계, API 형식이 달라진다는 점을 카탈로그 계약에 반영한다. 특히 Kimi K2.7-Code, MAI Code, GLM 계열은 잘못된 공통값이나 오래된 경로를 사용하면 요청 실패 또는 조용한 비용 오차로 이어진다.

JWC에서 중요한 것은 생성 카탈로그와 런타임 라우팅을 함께 갱신하는 것이다. 정적 `models.json`만 바꾸면 재생성 시 사라질 수 있고, descriptor만 바꾸면 기존 캐시가 오래된 route와 limit를 계속 제공할 수 있다. OpenRouter 사용량 보정도 모델 메타데이터와 별개로 응답 usage 병합 규칙을 검증해야 한다.

## Worktree 대조

현재 JWC는 별도 `packages/catalog` 패키지 없이 `packages/ai/src/models.json`, `packages/ai/src/provider-models/`, `packages/ai/src/model-manager.ts`에 카탈로그 기능을 유지한다. Kimi K2.7 계열과 Z.ai/GLM 계열 데이터는 이미 존재하지만, OMP와 생성 구조가 다르므로 커밋을 경로 단위로 그대로 옮길 수 없다.

JWC 대조 시에는 `packages/ai/scripts/generate-models.ts`와 descriptor를 소스로 삼고 생성 결과를 확인해야 한다. Kimi 제공자별 65K 제한과 timeout scope, MAI Code의 Responses 라우팅, GLM effort/idle timeout, OpenCode cache partition, OpenRouter usage reconciliation을 각각 독립 계약으로 비교해야 한다.
