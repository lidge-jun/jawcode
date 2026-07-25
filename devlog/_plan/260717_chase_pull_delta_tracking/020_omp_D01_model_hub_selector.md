# 020_omp_D01_model_hub_selector

> Range: `7aa1d581c..b0d04e517` (subset)
> Cluster: D01 — model hub/selector
> Sol priority: P1
> Model-related: yes
> Card target: 20.051_model_hub_selector
> Worker: OW1

## 커밋 전수 테이블

| # | hash | summary | JWC impact area |
|---|---|---|---|
| 1 | `59d08172c` | Introduced a unified model hub and search surface | `packages/coding-agent/src/modes/components/model-selector.ts`, selector controller |
| 2 | `5d3d1230f` | Added spatial keyboard navigation between sidebar and list panes | model selector focus and keyboard routing |
| 3 | `2081bae6a` | Added dynamic sidebar reordering for model hubs | role/provider ordering in the model selector |
| 4 | `ab7b776f9` | Added custom role management in the model hub | `model-registry.ts`, settings-backed custom roles |
| 5 | `c1e9a8411` | Added a visual separator to the model browser list | model list rendering and grouping |
| 6 | `2ab2da2b1` | Kept the role-assignment strip visible on overflow | model selector layout and overflow handling |
| 7 | `666327608` | Ranked model search results by match quality | fuzzy search ordering in the model selector |
| 8 | `1822603b2` | Improved model-browser keyboard navigation and focus visuals | model selector focus ownership and TUI input priority |
| 9 | `8dbc43b6e` | Introduced floating model selection | temporary model picker and selector controller |
| 10 | `9bda84b68` | Preserved role thinking levels for temporary picks | temporary model selection and session thinking state |
| 11 | `af7345e87` | Added role switching and role filtering in the model picker | role-aware picker filters and assignment side effects |
| 12 | `c6b83c1d9` | Accelerated the session selector with tiered search | `session-selector.ts`, shared fuzzy matching |

## 주제 분석

이 클러스터는 모델 선택을 단일 목록 팝업에서 관리 허브로 확장한다. 모델 검색, 제공자 탐색, 역할 할당, 임시 선택을 한 흐름에 묶고, 키보드만으로 사이드바와 목록을 오갈 수 있게 한다. 검색 결과는 단순 포함 여부가 아니라 일치 품질을 기준으로 정렬한다. 세션 선택에도 같은 방향의 단계형 검색을 적용한다.

JWC에는 기본 모델과 역할별 모델을 동시에 다루는 요구가 이미 있다. 따라서 이 변경의 핵심 가치는 OMP 화면을 그대로 복제하는 데 있지 않다. JWC의 `default`, `executor_ext`, `architect`, `planner`, `critic` 계약과 사용자 정의 역할을 한 화면에서 일관되게 관리하는 것이다. 임시 선택은 영구 설정을 덮어쓰지 않아야 하고, 역할별 thinking level도 함께 보존해야 한다.

## Worktree 대조

현재 JWC는 `packages/coding-agent/src/modes/components/model-selector.ts`에 검색, 역할 배지, 역할별 할당, thinking 선택을 모아 둔다. `packages/coding-agent/src/config/model-registry.ts`에는 설정에서 사용자 정의 역할을 발견하는 경로도 있다. 즉 기능 기반은 상당 부분 존재한다.

반면 OMP의 `model-hub.ts`, `model-browser.ts`, `model-picker.ts`에 해당하는 분리된 허브 구조는 JWC에 없다. 세션 선택은 `fuzzyFilter()` 한 단계로 동작하며 OMP의 tiered search와 동일한지는 별도 대조가 필요하다. 추후 카드는 기존 JWC 역할 계약을 보존하면서 허브 분리, 포커스 이동, 검색 순위, 임시 선택의 설정 비오염을 각각 검증해야 한다.
