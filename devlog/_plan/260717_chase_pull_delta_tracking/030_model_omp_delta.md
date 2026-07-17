# 030 — OMP model/provider delta

> Purpose: OMP 쪽 model/provider 관련 커밋 교차 추적
> Clusters: D01, D02, D03, D04, D05, D10, D17, D19
> Feeds: `struct_har/chase/model/` 갱신

## 클러스터별 model 커밋

### D01 — model hub/selector

| hash | summary | model/ impact |
|---|---|---|
| `59d08172c` | introduced model hub for unified management and search | `001` `002` 새 UI 계약 |
| `8dbc43b6e` | floating model selection system | `002` selection UX |
| `ab7b776f9` | custom role management in model hub | `002` role 관리 |
| `666327608` | model search ranking by match quality | `002` search 알고리즘 |
| `af7345e87` | role switching and filtering in model picker | `002` picker 변경 |
| `c4fa0ebaa` | persistent model performance tracking + migration | `002` perf tracking |
| `1822603b2` | model browser keyboard navigation and focus visuals | UI only |

### D02 — catalog pricing/routing

| hash | summary | model/ impact |
|---|---|---|
| `6e0b9d34f` | Kimi K2.7-Code maxTokens 65K on Fireworks | `001` catalog 데이터 |
| `b865e6a4d` | scope Kimi K2.7 timeout to Moonshot | `001` timeout 정책 |
| `d7241e572` | invalidate stale MAI Code routes | `001` route 갱신 |
| `fdf79caf2` | sourced zai GLM pricing from PAYG | `001` pricing 변경 |
| `f34034fa7` | Z.ai GLM-5.2 anthropic-messages budget-effort | `001` effort 분류 |
| `4d89b2902` | copilot mai-code → responses API | `001` routing 변경 |
| `03c48d073` | OpenRouter usage reconciliation + catalog updates | `001` catalog bulk |
| `c1480b29e` | version-first Claude IDs parsed | `002` resolver |

### D03 — auth/OAuth/credential

| hash | summary | model/ impact |
|---|---|---|
| `6ae7cdbf9` | automatic credential rotation for invalidated OAuth | `003` rotation 정책 |
| `792f75298` | retain targeted OAuth row after refresh races | `003` race handling |
| `e858c1be6` | serialized provider OAuth refreshes | `003` serialization |
| `044d722a3` | scope Anthropic credential identity by organization | `003` org-scoped |
| `7029789e7` | cleared stale OAuth session stickies | `003` cleanup |
| `c97449c51` | stop perplexity OAuth token leaking to api-key endpoint | `003` leak fix |
| `7cef4a769` | improved OAuth credential resolution fallback | `003` fallback |
| `0ab90f63e` | rotate through quota-limited accounts | `003` rotation |

### D04 — provider/transport/schema

| hash | summary | model/ impact |
|---|---|---|
| `ae0d5054d` | Anthropic Vertex effort beta gating | `003` Vertex 정책 |
| `80815af78` | Vertex fallback effort sanitization | `003` sanitization |
| `8932acb6f` | boolean schema coercion for Google/CCA | `002` schema 처리 |
| `f6de37350` | omit unsupported reasoning sampling params | `002` param 필터링 |
| `375e89099` | legacy Anthropic beta to official endpoints | `003` endpoint 정책 |
| `4b3ec660f` | disable eager streaming for custom Anthropic | `003` streaming |
| `b0f22caf8` | copilot business vision restoration | `001` vision 기능 |
| `188985eb0` | isolated provider header defaults | `003` header 격리 |

### D05 — model resolver/fallback

| hash | summary | model/ impact |
|---|---|---|
| `58d6130b5` | model fallback for hard errors | `002` fallback 추가 |
| `d54dcc222` | fallback after retry budget exhaustion | `002` retry 확장 |
| `a55e4b1a7` | fuzzy literal thinking suffix preservation | `002` resolver fix |
| `00c8e921f` | strip images for non-vision models mid-session | `002` vision fallback |
| `570f8af57` | support GPT-5.6 Codex web search | `001` `002` 신규 기능 |
| `06095c103` | clear stale thinking on auto role assignment | `002` role 정리 |

### D10 — agent-loop/tool/stream (model-provider interaction)

`30_model_provider_delta.md`는 D10을 model-related 대상으로 지정하지만 커밋 표를 생략한다. 아래 전수 표는 `020_omp_D10_agent_loop_tool_stream.md`에서 보완한다.

| hash | summary | model/ impact |
|---|---|---|
| `e28197c69` | revert empty toolUse retry reclassification | agent-loop/provider 종료 분류 |
| `1df790a5d` | revert incomplete sibling tool-call discard | agent-loop partial stream 처리 |
| `7a2e34988` | discard incomplete sibling tool calls | agent-loop partial stream 처리 |
| `4200dec04` | strip incomplete tool calls on empty toolUse stop | agent-loop/provider 종료 분류 |
| `94fc54859` | reclassify empty toolUse in result-only completion | agent-loop/provider 종료 분류 |
| `f64a17c52` | classify empty toolUse stop as retryable | provider retry 계약 |
| `9e72202b4` | gate custom eager streaming on compat provenance | `003` provider streaming 정책 |
| `33bbf69f1` | derive eager streaming from the effective endpoint | `003` provider endpoint 계약 |
| `4b3ec660f` | disable eager streaming for custom Anthropic | `003` streaming |
| `d00e5548e` | drop incomplete failed tool calls | agent-loop partial stream 처리 |
| `5a7f10780` | preserve Cursor results on stream failure | provider stream failure 처리 |
| `408641822` | pair tool calls/results on failed partial streams | provider stream failure 처리 |
| `b3145170a` | surface provider stream failures | provider 오류 전달 |
| `8c6b2fb45` | resolve agent slash URLs for nested subagent output | nested agent output 처리 |
| `0b9bdaaed` | recover malformed tool arguments automatically | AI dialect validation |
| `54af1c03f` | surface provider errors to ACP clients | provider 오류 전달 |
| `51cc34ac6` | surface exhausted empty-stop retries | provider retry 종료 계약 |
| `fabded89e` | classify empty provider responses as retryable | provider retry 계약 |

### D17 — usage/quota/spend-limit

| hash | summary | model/ impact |
|---|---|---|
| `2faa345d1` | Anthropic spend-limit as persistent usage limit | `003` billing 분류 |
| `e3a7ec880` | classify spend limits in quota parser | `003` quota 파서 |
| `b0d04e517` | snapshot validation for login-sourced API keys | `003` key 검증 |

### D19 — small model/task-agent

| hash | summary | model/ impact |
|---|---|---|
| `93635e7b6` | centralized preprocessing for small models | `002` small model 처리 |
| `425e583ae` | task-agent field and model resolution | `002` resolution 경로 |
| `441037025` | thinking-level configuration precedence | `002` config 우선순위 |

## model/ 파일 영향 요약

| cluster | 영향 파일 | 갱신 축 |
|---|---|---|
| D01 | `001_model_provider_inventory.md`, `002_model_catalog_contract.md` | model hub, selection UX, role/search/performance 계약 |
| D02 | `001_model_provider_inventory.md`, `002_model_catalog_contract.md` | catalog, pricing, routing, timeout, Claude ID resolver |
| D03 | `003_provider_auth_flow.md` | OAuth rotation/serialization, org identity, credential fallback |
| D04 | `001_model_provider_inventory.md`, `002_model_catalog_contract.md`, `003_provider_auth_flow.md` | schema/parameter 처리, endpoint/streaming 정책, vision |
| D05 | `001_model_provider_inventory.md`, `002_model_catalog_contract.md` | fallback/retry, thinking suffix, vision fallback, GPT-5.6 web search |
| D10 | `003_provider_auth_flow.md` | provider stream, retry, partial tool-call, error surfacing 경계 |
| D17 | `003_provider_auth_flow.md` | spend-limit/quota 분류와 login API key 검증 |
| D19 | `002_model_catalog_contract.md` | small-model preprocessing, task-agent resolution, thinking 우선순위 |

모든 클러스터의 upstream 추적 결과는 `005_upstream_model_delta.md`의 OMP reviewed-through 핀 이동에도 반영한다.
