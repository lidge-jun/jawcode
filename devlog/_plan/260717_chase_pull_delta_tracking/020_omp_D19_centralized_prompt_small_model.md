# 020_omp_D19_centralized_prompt_small_model

> Range: `7aa1d581c..b0d04e517` (subset)
> Cluster: D19 — centralized prompt/small-model delegation
> Sol priority: P2
> Model-related: yes
> Card target: 20.069_centralized_prompt_small_model
> Worker: OW9

## 커밋 전수 테이블

| # | hash | summary | JWC impact area |
|---|---|---|---|
| 1 | `93635e7b6` | small model preprocessing과 guidance를 중앙화 | tiny/title prompts, session preprocessing |
| 2 | `441037025` | thinking-level 설정 우선순위 갱신 | discovery, task agents/executor |
| 3 | `425e583ae` | task-agent frontmatter와 model resolution 지원 | model resolver, discovery, agent dashboard |
| 4 | `29a6a6800` | title preprocessing에서 chat envelope 보존 | tiny message preprocessor |
| 5 | `2f97b7fe4` | bundled plan subagent 제거 | task agents/prompts/docs |
| 6 | `1c6f5dc18` | agent delegation 조건과 제약 정교화 | system/eager-task prompts |
| 7 | `8e006a5c8` | task agent 선택 지침 개선 | task prompt/index |
| 8 | `cb2153e9a` | task 구조를 agent 중심 flat model로 재편 | task executor/prompts/docs |

## 주제 분석

이 클러스터는 작은 모델에 필요한 전처리와 agent delegation 결정을 여러 호출부가 제각각 만들지 않도록 중앙화한다. title 생성에서도 chat envelope를 보존해 입력 의미를 잃지 않게 하고, task-agent frontmatter·model resolution·thinking precedence를 하나의 선택 규칙으로 정리한다.

OMP의 plan subagent 제거는 JWC에 그대로 적용할 수 없다. JWC는 `planner`, `architect`, `critic`을 공개 role agent 계약으로 유지하고 PABCD audit에 사용한다. 따라서 이 커밋은 제거 패치가 아니라 중복되거나 충돌하는 legacy plan agent가 있는지 확인하는 negative reference로 사용해야 한다.

## Worktree 대조

현재 JWC는 `packages/coding-agent/src/prompts/agents/`, task model override, role별 resolver를 이미 운영한다. root `AGENTS.md`에도 planner/architect/critic의 read-only 역할과 executor 계열의 선택 규칙이 명시돼 있다. OMP의 flat task 구조보다 역할 구분이 더 강한 상태다.

가져올 가치가 큰 부분은 small-model preprocessing의 단일 진입점, title envelope 보존, thinking-level 우선순위 테스트다. delegation prompt와 plan-agent 목록은 JWC 고유 계약을 우선해 adapt/reject를 명시해야 한다.

## 누락 커밋 보완 (2026-07-17)

범위 전체와 기존 분류 파일의 정확한 해시 차집합에서 확인한 누락 커밋을 추가한다.

| # | hash | git one-line summary | classification |
|---|---|---|---|
| 1 | `69865b609` | feat(coding-agent/prompts): updated system prompt verification guidelines | centralized prompt/model role |
| 2 | `6b12dd4d4` | fix(prompt): restored non-linux cpu model metadata | centralized prompt/model role |
| 3 | `71f29e17c` | fix(coding-agent): kept cleanup tail out of plan-mode execution specs | centralized prompt/model role |
| 4 | `f47fd9300` | feat(coding-agent/prompts): removed blocking configuration from scout agent | centralized prompt/model role |
| 5 | `f75c97773` | fix(coding-agent): renamed project-context wrapper to <repo-rules> | centralized prompt/model role |
