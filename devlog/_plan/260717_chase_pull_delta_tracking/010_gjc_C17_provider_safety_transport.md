# 010_gjc_C17_provider_safety_transport

> Range: `4a80bac9..3ddf26079`
> Cluster: C17 — provider safety/transport
> Sol priority: P2
> Model-related: ✓
> Card target: 10.094_provider_safety_transport
> Worker: GW3

이 클러스터는 Anthropic, Google, OpenAI 계열 transport에서 서로 다른 safety stop 표현을 하나의 의미로 분류한다. 동시에 managed fallback의 로컬 실행 실패를 provider가 내린 차단으로 오인하지 않도록 authority 경계를 분리한다.

## 커밋 전수 테이블

| # | hash | summary | JWC impact area |
|---|---|---|---|
| 1 | `e0b4b0ee7` | fix: keep managed fallback local failures outside provider authority (#2433) | `packages/ai/src/utils/fallback-transport.ts` |
| 2 | `d0c944010` | test: stabilize legacy safety-stop label test under parallel load | safety-stop regression fixture |
| 3 | `a19242a37` | test: stabilize legacy safety-stop label test under parallel load | safety-stop regression fixture |
| 4 | `5331bdb29` | fix: classify provider safety stops across transports (#2077) | provider adapters and session mapping |

## 주제 분석

provider가 반환한 차단과 client-side transport 실패는 복구 정책이 다르다. safety stop은 사용자에게 일관된 종료 사유를 보여 주되 retry/fallback 판단에 원래 provider 증거를 보존해야 한다. 로컬 fallback 실패는 provider authority 밖의 오류로 남겨 잘못된 safety label과 회로 차단을 막아야 한다.

## model/ 교차 참조

- [ ] `packages/ai` provider별 finish reason과 safety metadata를 `model/` transport 문서에 반영한다.
- [ ] Google Gemini CLI, Google shared, Anthropic, OpenAI Completions의 분류 표를 만든다.
- [ ] C12의 `invalid_prompt` 및 Responses reasoning 차단과 safety stop을 별도 오류 축으로 유지한다.

## Worktree 대조

JWC의 provider adapter 여러 파일은 현재 작업 트리에서 수정 중이지만 upstream의 `session/provider-safety-stop.ts`는 같은 경로에 없다. 먼저 JWC의 기존 오류 정규화 위치를 찾고, provider별 원본 필드를 잃지 않는 형태로 카드의 이식 지점을 정해야 한다.

