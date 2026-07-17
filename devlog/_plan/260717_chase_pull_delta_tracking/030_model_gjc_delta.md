# 030 — GJC model/provider delta

> Purpose: GJC 쪽 model/provider 관련 커밋 교차 추적
> Clusters: C02, C03, C11, C12, C13, C17
> Feeds: `struct_har/chase/model/` 갱신

## 클러스터별 model 커밋

### C02 — security/control-token (model-transport 영향)

| hash | summary | model/ impact |
|---|---|---|
| `9036b594e` | fail closed for unmarked Responses reasoning | `003_provider_auth_flow` reasoning 게이트 |
| `5ca557eaa` | neutralize leaked control tokens at Responses boundary (gpt-5.6) | `002_model_catalog_contract` transport 주의사항 |
| `032f5cb6b` | neutralize control tokens on remote compaction paths | same |
| `9663f7744` | neutralize leaked reserved control tokens in Codex replay | same |
| `749449a6a` | scope header-form control-token match to header grammar | same |
| `236ecf14c` | enforce Codex GPT-5.6 prompt cap | `002` prompt cap 제약 |

### C03 — model preset/fallback/selection

| hash | summary | model/ impact |
|---|---|---|
| `bceb66bab` | sticky model fallback chains for presets and overrides | `002_model_catalog_contract` fallback 정책 |
| `f30323b2e` | lower codex preset reasoning | `002` preset 설정 변경 |
| `5c76e5556` | apply /model role overrides immediately | `002` runtime behavior |
| `f56d6b2c5` | reuse model cache for list-models | `002` cache 계약 |
| `b12fb2573` | serialize prompt and model admission | `002` admission 순서 |
| `08c58a87a` | keep login reachable without model credentials | `003` auth fallback |
| `c8c2d92b9` | fence durable model promotion | `002` promotion 규칙 |
| `41c8e1f76` | preserve durable thinking in model selection | `002` thinking 보존 |

### C11 — Grok 4.5, GPT-5.6 Codex presets

| hash | summary | model/ impact |
|---|---|---|
| `684a26694` | documented Grok 4.5 support | `001_model_provider_inventory` 신규 모델 |
| `cc661b43a` | benchmark GPT-5.6 Codex presets | `002` preset 벤치마크 |
| `2f213136c` | authoritative model profile selection via mpreset | `002` mpreset 명령어 |

### C12 — Codex reasoning/thinking

| hash | summary | model/ impact |
|---|---|---|
| `1a3d04649` | expose model thinking capabilities | `002` capabilities 노출 |
| `cf94f8804` | explicit invalid_prompt classification + bounded circuit breaker | `002` 에러 분류 |
| `f912eddcf` | close Codex reasoning and summary queue races | `003` reasoning 보안 |

### C13 — RPC durable default model

| hash | summary | model/ impact |
|---|---|---|
| `82b5159b8` | add durable default model selection | `002` 기본 모델 선택 지속성 |
| `9f6de8820` | persist unchanged default thinking level | same |

### C17 — provider safety stops

| hash | summary | model/ impact |
|---|---|---|
| `5331bdb29` | classify provider safety stops across transports | `003` transport safety 분류 |
| `e0b4b0ee7` | keep managed fallback local failures outside provider authority | `003` fallback 권한 |

## model/ 파일 영향 요약

| cluster | 영향 파일 | 갱신 축 |
|---|---|---|
| C02 | `002_model_catalog_contract.md`, `003_provider_auth_flow.md` | GPT-5.6 prompt cap, control-token transport 경계, reasoning 게이트 |
| C03 | `002_model_catalog_contract.md`, `003_provider_auth_flow.md` | preset fallback, role override, cache/admission, auth fallback |
| C11 | `001_model_provider_inventory.md`, `002_model_catalog_contract.md` | Grok 4.5 inventory, GPT-5.6 Codex preset, mpreset |
| C12 | `002_model_catalog_contract.md`, `003_provider_auth_flow.md` | thinking capability, invalid_prompt 분류, reasoning queue 보안 |
| C13 | `002_model_catalog_contract.md` | durable default model과 thinking level 지속성 |
| C17 | `003_provider_auth_flow.md` | provider safety stop과 managed fallback 권한 분류 |

모든 클러스터의 upstream 추적 결과는 `005_upstream_model_delta.md`의 GJC reviewed-through 핀 이동에도 반영한다.
