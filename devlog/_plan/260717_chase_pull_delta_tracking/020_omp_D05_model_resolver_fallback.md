# 020_omp_D05_model_resolver_fallback

> Range: `7aa1d581c..b0d04e517` (subset)
> Cluster: D05 — model resolver/fallback
> Sol priority: P1
> Model-related: yes
> Card target: 20.052_model_resolver_fallback
> Worker: OW1

## 커밋 전수 테이블

| # | hash | summary | JWC impact area |
|---|---|---|---|
| 1 | `1424cae06` | Added id-prefixed wildcards to retry fallback chains | retry fallback selector parsing |
| 2 | `a55e4b1a7` | Preserved literal thinking suffixes during fuzzy resolution | `model-resolver.ts` |
| 3 | `053272e4e` | Typed the non-vision model-switch flattening regression | non-vision session tests |
| 4 | `a82e36955` | Covered image replay after switching to a text-only model | non-vision session tests |
| 5 | `00c8e921f` | Stripped images when switching to non-vision models mid-session | session message normalization |
| 6 | `06095c103` | Cleared stale thinking on automatic role assignment | selector controller and assignment side effects |
| 7 | `8dfbe8e09` | Removed thinking suffixes before fuzzy model matching | model resolver parsing order |
| 8 | `570f8af57` | Added GPT-5.6 Codex web-search support | Codex web-search provider |
| 9 | `58d6130b5` | Enabled model fallback for hard provider errors | agent session retry fallback |
| 10 | `d54dcc222` | Allowed fallback after retry-budget exhaustion | agent session retry budget |
| 11 | `41317cc23` | Validated performance sample aggregation and migration backfill | model performance persistence tests |
| 12 | `a0dcb8ae2` | Exposed performance monitoring in model UI | model browser/hub performance display |
| 13 | `c4fa0ebaa` | Added persistent model performance tracking and migration | `agent-storage.ts`, session sampling |
| 14 | `54bafa1cc` | Added interactive fallback-chain configuration | model hub, settings schema, agent session |

## 주제 분석

이 클러스터는 모델 선택 실패를 세 가지 층에서 다룬다. 첫째, selector 문자열을 정확히 해석한다. thinking suffix가 모델 이름의 일부처럼 fuzzy match에 섞이지 않아야 한다. 둘째, hard error나 retry budget 소진 뒤 설정된 다음 모델로 이동한다. 셋째, 장기 성능 표본을 저장해 선택 화면과 운영 판단에 사용할 수 있게 한다.

세션 콘텐츠의 capability 전환도 중요한 경계다. vision 모델에서 text-only 모델로 바꿀 때 과거 이미지 블록을 그대로 재전송하면 provider가 요청을 거부할 수 있다. 사용자 transcript의 의미는 보존하면서 모델 입력에서만 호환되지 않는 이미지를 제거해야 한다. 자동 역할 할당에서는 이전 모델의 thinking level이 새 역할에 남지 않아야 한다.

## Worktree 대조

현재 JWC의 `packages/coding-agent/src/session/agent-session.ts`에는 `retry.fallbackChains`, cooldown, primary 복귀 정책, hard-error 이후 후보 적용 로직이 이미 있다. `packages/coding-agent/src/config/model-resolver.ts`와 Codex web-search provider도 존재한다. 따라서 fallback 자체는 부재가 아니라 동등성 감사 대상이다.

반면 OMP의 persistent model performance 표본과 migration이 JWC `agent-storage.ts`에 같은 형태로 존재하는지는 확인되지 않았다. text-only 전환 시 이미지 replay를 정규화하는 정확한 경계도 별도 검증이 필요하다. 카드에서는 wildcard selector, suffix parsing, hard error, retry 소진, cooldown 복귀, 성능 저장 migration, image stripping, GPT-5.6 검색을 각각 독립 회귀로 비교해야 한다.

## 누락 커밋 보완 (2026-07-17)

범위 전체와 기존 분류 파일의 정확한 해시 차집합에서 확인한 누락 커밋을 추가한다.

| # | hash | git one-line summary | classification |
|---|---|---|---|
| 1 | `2d4d445f9` | fix(coding-agent): supported models yaml config | model resolver/fallback |
| 2 | `f9f6ed9e8` | feat(coding-agent): replaced legacy `pi/` role alias prefix with | model resolver/fallback |
