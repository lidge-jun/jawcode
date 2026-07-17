# 030 — model/ 폴더 갱신 계획

> Date: 2026-07-17

이 계획은 GJC와 OMP의 model/provider 관련 chase card가 모두 작성된 뒤 실행한다. 카드 근거를 먼저 모으고 inventory, catalog contract, provider auth, upstream pin 순서로 반영한다.

## 갱신 대상 파일

| file | 갱신 필요 사유 |
|---|---|
| `001_model_provider_inventory.md` | Grok 4.5, Kimi K2.7-Code 65K, MAI Code routing, Z.ai GLM-5.2, OpenRouter catalog, copilot vision, GPT-5.6 Codex web search |
| `002_model_catalog_contract.md` | model hub UI, floating selection, role management, sticky fallback chains, durable default selection, mpreset, preset reasoning, thinking capabilities, prompt cap, search ranking, perf tracking, small model preprocessing, task-agent resolution |
| `003_provider_auth_flow.md` | automatic credential rotation, serialized OAuth refresh, org-scoped identity, reasoning egress gating, safety stop classification, Vertex effort gating, legacy Anthropic endpoint gating, spend-limit classification, snapshot validation |
| `005_upstream_model_delta.md` | 전면 갱신. GJC와 OMP의 reviewed-through 핀을 이번 pull head로 이동하고 신규 model/provider chase card를 연결 |

`004_cross_project_patch_index.md`는 실제 코드 패치 전까지 변경하지 않는다.

## reviewed-through 핀 이동

- GJC: `4a80bac9` → `3ddf26079`
- OMP: `7aa1d581c` → `b0d04e517`

## 실행 체크리스트

- [ ] C02/C03/C11/C12/C13/C17 카드의 model 근거를 읽는다.
- [ ] D01-D05/D10/D17/D19 카드의 model 근거를 읽는다.
- [ ] `001_model_provider_inventory.md`를 갱신한다.
- [ ] `002_model_catalog_contract.md`를 갱신한다.
- [ ] `003_provider_auth_flow.md`를 갱신한다.
- [ ] `005_upstream_model_delta.md`와 reviewed-through 핀을 갱신한다.
- [ ] 실제 코드 패치가 없으면 `004_cross_project_patch_index.md`가 unchanged인지 확인한다.
