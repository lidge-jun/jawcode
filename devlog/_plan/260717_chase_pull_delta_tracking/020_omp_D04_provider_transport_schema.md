# 020_omp_D04_provider_transport_schema

> Range: `7aa1d581c..b0d04e517` (subset)
> Cluster: D04 — provider transport/schema
> Sol priority: P1
> Model-related: yes
> Card target: 20.056_provider_transport_schema
> Worker: OW3

## 커밋 전수 테이블

| # | hash | summary | JWC impact area |
|---|---|---|---|
| 1 | `cb0a407f0` | Corrected Vertex effort payload-gate coverage | Anthropic provider alignment tests |
| 2 | `e289975e0` | Added focused Vertex effort payload-gate coverage | Anthropic provider alignment tests |
| 3 | `8932acb6f` | Scoped boolean schema coercion to Google transports | JSON Schema normalization |
| 4 | `0fbe8c212` | Covered the reasoning sampling-parameter gate | OpenAI completions compatibility tests |
| 5 | `80815af78` | Sanitized Vertex fallback effort overrides | Anthropic Vertex request construction |
| 6 | `ae0d5054d` | Disabled Anthropic effort beta on the Google Vertex header path | Anthropic provider headers and payload |
| 7 | `cd4171975` | Stripped conditional schema keywords for Google/CCA | schema field constraints |
| 8 | `c6c063ee0` | Rejected `not` schemas on CCA transport | schema normalization and rejection |
| 9 | `f6de37350` | Omitted unsupported reasoning sampling parameters | OpenAI completions/responses request shaping |
| 10 | `da3e50063` | Handled boolean entries in schema maps | schema normalizer traversal |
| 11 | `508dbbbc5` | Coerced boolean subschemas for Google/CCA | transport-specific JSON Schema adaptation |
| 12 | `188985eb0` | Isolated provider header defaults | model registry and custom provider config |
| 13 | `9e72202b4` | Gated custom eager streaming on compatibility provenance | Anthropic custom endpoint transport |
| 14 | `33bbf69f1` | Derived eager streaming from the effective endpoint | Anthropic endpoint resolution |
| 15 | `375e89099` | Limited legacy Anthropic beta headers to official endpoints | Anthropic header policy |
| 16 | `4b3ec660f` | Disabled eager streaming for custom Anthropic endpoints | catalog compatibility metadata |
| 17 | `3f52e26a7` | Preserved CCA schemas with annotation conflicts | schema normalization and provider compatibility tests |
| 18 | `e58d2c460` | Preserved Copilot vision denials | Copilot model discovery limits |
| 19 | `4bae9a42a` | Required Copilot vision confirmation | Copilot dynamic capability discovery |
| 20 | `b0f22caf8` | Restored Copilot Business vision support | Copilot wire metadata and snapcompact behavior |

## 주제 분석

이 클러스터는 모델 capability와 실제 전송 계약 사이의 차이를 방어한다. Anthropic API와 Google Vertex의 Anthropic 호환 경로는 같은 payload처럼 보여도 허용 beta header와 effort 필드가 다르다. custom endpoint도 공식 Anthropic endpoint와 동일한 eager streaming 기능을 지원한다고 가정하면 안 된다.

도구 스키마 역시 제공자별 허용 범위가 다르다. Google/CCA에서는 boolean subschema를 객체형으로 정규화하고, 지원하지 않는 conditional 또는 `not` 구문을 제거하거나 명시적으로 거절해야 한다. reasoning 모델에는 temperature 같은 sampling parameter를 전송하지 않는 게이트가 필요하다. Copilot vision은 정적 추정만으로 켜지 않고 discovery 결과의 확인과 거부를 모두 보존해야 한다.

## Worktree 대조

현재 JWC에는 `packages/ai/src/providers/anthropic.ts`, `packages/ai/src/utils/schema/`, `packages/ai/src/providers/google-shared.ts`, `packages/ai/src/providers/github-copilot-headers.ts`가 있다. schema 정규화와 provider별 전송 계층이 이미 분리되어 있어 OMP 변경을 계약 단위로 비교할 수 있다.

그러나 JWC는 OMP와 카탈로그 패키지 구조가 다르고 provider header 기본값도 `model-registry.ts`와 여러 provider 파일에 나뉜다. 카드 단계에서는 Vertex effort/beta, custom endpoint eager streaming, Google/CCA boolean schema, reasoning sampling omission, Copilot vision을 별도 테스트 축으로 두어야 한다. 일반 브라우저 헤더 회귀 커밋은 이 provider transport 클러스터에서 제외했다.

## 누락 커밋 보완 (2026-07-17)

범위 전체와 기존 분류 파일의 정확한 해시 차집합에서 확인한 누락 커밋을 추가한다.

| # | hash | git one-line summary | classification |
|---|---|---|---|
| 1 | `122772782` | fix(amazon-bedrock): guarded baseMessage against undefined stringify | provider transport/schema |
| 2 | `22fa8f662` | perf(stream): batched response decoding | provider transport/schema |
| 3 | `3188506e6` | fix(ai): included responses incomplete details | provider transport/schema |
| 4 | `38af95646` | fix(ai): accepted null assistant content | provider transport/schema |
| 5 | `447593ba8` | fix(ai): make content blocks terminal | provider transport/schema |
| 6 | `8ff821515` | fix(ai): honor NO_PROXY ports for secure websockets | provider transport/schema |
| 7 | `a0a4f0d56` | fix(codex): avoid atomic summary separator | provider transport/schema |
| 8 | `a5673c90f` | feat(ai): removed legacy Google interactions routing from AI providers | provider transport/schema |
| 9 | `c49c693b7` | fix(ai): retried codex pre-response watchdog timeouts | provider transport/schema |
| 10 | `d600cce75` | fix(amazon-bedrock): handled stringify exceptions | provider transport/schema |
| 11 | `e5f6119a4` | fix(ai): preserved streamed responses text | provider transport/schema |
| 12 | `e897b7cee` | fix(codex): preserve sequential reasoning summaries | provider transport/schema |
| 13 | `ed5ec3ebd` | fix(ai): handled cursor tls session errors | provider transport/schema |
| 14 | `f029e536b` | fix(ai): honored proxies for codex websockets | provider transport/schema |
