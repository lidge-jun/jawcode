# 30 — model/provider delta INDEX

> Date: 2026-07-17
> Purpose: `struct_har/chase/model/` 폴더 갱신 대상 식별
> Status: **INDEX** — 세부 파일은 `030_model_*.md` 참조

## 세부 파일

| file | 내용 |
|---|---|
| [030_model_gjc_delta.md](./030_model_gjc_delta.md) | GJC model/provider 커밋 교차 추적 (C2, C3, C11, C12, C13, C17) |
| [030_model_omp_delta.md](./030_model_omp_delta.md) | OMP model/provider 커밋 교차 추적 (D1-D5, D10, D17, D19) |
| [030_model_update_plan.md](./030_model_update_plan.md) | model/ 폴더 5개 파일 갱신 계획 |

---

아래는 원본 요약 (세부 파일 작성 전 참조용).

## GJC model/provider 커밋 요약 (C2, C3, C11, C12, C13, C17)

### C2 — security/control-token (model-transport 영향)

| hash | summary | model/ impact |
|---|---|---|
| `9036b594e` | fail closed for unmarked Responses reasoning | `003_provider_auth_flow` reasoning 게이트 |
| `5ca557eaa` | neutralize leaked control tokens at Responses boundary (gpt-5.6) | `002_model_catalog_contract` transport 주의사항 |
| `032f5cb6b` | neutralize control tokens on remote compaction paths | same |
| `9663f7744` | neutralize leaked reserved control tokens in Codex replay | same |
| `749449a6a` | scope header-form control-token match to header grammar | same |
| `236ecf14c` | enforce Codex GPT-5.6 prompt cap | `002` prompt cap 제약 |

### C3 — model preset/fallback/selection

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

---

## OMP model/provider 커밋 (D1, D2, D3, D4, D5, D10, D17, D19)

### D1 — model hub/selector

| hash | summary | model/ impact |
|---|---|---|
| `59d08172c` | introduced model hub for unified management and search | `001` `002` 새 UI 계약 |
| `8dbc43b6e` | floating model selection system | `002` selection UX |
| `ab7b776f9` | custom role management in model hub | `002` role 관리 |
| `666327608` | model search ranking by match quality | `002` search 알고리즘 |
| `af7345e87` | role switching and filtering in model picker | `002` picker 변경 |
| `c4fa0ebaa` | persistent model performance tracking + migration | `002` perf tracking |
| `1822603b2` | model browser keyboard navigation and focus visuals | UI only |

### D2 — catalog pricing/routing

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

### D3 — auth/OAuth/credential

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

### D4 — provider/transport/schema

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

### D5 — model resolver/fallback

| hash | summary | model/ impact |
|---|---|---|
| `58d6130b5` | model fallback for hard errors | `002` fallback 추가 |
| `d54dcc222` | fallback after retry budget exhaustion | `002` retry 확장 |
| `a55e4b1a7` | fuzzy literal thinking suffix preservation | `002` resolver fix |
| `00c8e921f` | strip images for non-vision models mid-session | `002` vision fallback |
| `570f8af57` | support GPT-5.6 Codex web search | `001` `002` 신규 기능 |
| `06095c103` | clear stale thinking on auto role assignment | `002` role 정리 |

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

---

## model/ 폴더 갱신 필요 항목 요약

| model/ 파일 | 갱신 필요 사유 |
|---|---|
| `001_model_provider_inventory.md` | Grok 4.5, Kimi K2.7-Code 65K, MAI Code routing, Z.ai GLM-5.2, OpenRouter catalog, copilot vision, GPT-5.6 Codex web search |
| `002_model_catalog_contract.md` | model hub UI, floating selection, role management, sticky fallback chains, durable default selection, mpreset, preset reasoning, thinking capabilities, prompt cap, search ranking, perf tracking, small model preprocessing, task-agent resolution |
| `003_provider_auth_flow.md` | automatic credential rotation, serialized OAuth refresh, org-scoped identity, reasoning egress gating, safety stop classification, Vertex effort gating, legacy Anthropic endpoint gating, spend-limit classification, snapshot validation |
| `004_cross_project_patch_index.md` | 변경 없음 (실제 코드 패치 전까지) |
| `005_upstream_model_delta.md` | 전면 갱신 — reviewed-through 핀 이동: GJC `4a80bac9` → `3ddf26079`, OMP `7aa1d581c` → `b0d04e517` |
