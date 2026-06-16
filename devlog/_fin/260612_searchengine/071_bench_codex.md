# 071 — bench: codex 검색 모델 (gpt-5.4 vs gpt-5.5 vs gpt-5.3-codex-spark, reasoning 반영)

> 상태: 🟢 실측 완료 (260613, **reasoning 공정 적용**). 상위: [070](./070_research_native_cli_models.md) · [074](./074_decision_model_parity.md) · [075 deep](./075_design_deep_search_tier.md).
> 도구: `search-bench.ts codex` (effort=medium). raw: `/tmp/bench-codex-reasoning.md`.
> **공정성 수정**(사용자 지적): codex 검색 provider에 reasoning 파라미터 추가 후 측정 — 5.4/5.5는 reasoning(medium), spark는 non-reasoning(model-thinking.ts:252) 자동 제외.

## 결과 (latency / chars / src)

| query | gpt-5.4 (reasoning) | gpt-5.5 (reasoning) | gpt-5.3-codex-spark (non-reasoning) |
|---|---|---|---|
| price-multihop | 33.7s · 2012 · 3 | 43.5s · 1537 · 4 | **20.9s** · 1348 · 6 |
| kev-subsidy | ⏱ timeout | ⏱ timeout | ⏱ timeout |
| kfilm-multi | ⏱ timeout | ⏱ timeout | ⏱ timeout |
| obscure-book | 47.4s · 1726 · 3 | 12.7s · 329 · 1 | **9.5s** · 434 · 1 |
| freshness | 32.8s · 1088 · 2 | 44.3s · 814 · 2 | **9.4s** · 447 · 2 |

## 판정

1. **reasoning 켜니 5.4·5.5 크게 느려짐** (price 33.7s/43.5s vs 1차 무reasoning 11.4s/23.9s). 추론이 검색 wall-clock을 60s 쪽으로 밀어붙임.
2. **가장 어려운 멀티제약 2쿼리(kev-subsidy·kfilm-multi)는 셋 다 60s 타임아웃** — codex는 모델 불문 이 난이도를 fast(60s)에 못 끝냄 → **deep tier(180s async) 필요** ([075](./075_design_deep_search_tier.md)).
3. **spark = 일관 최속**(9~21s), non-reasoning이라 60s 안에 항상 완주. 출력토큰은 많지만(verbose) wall-clock 승리. 소스도 동등 이상(price 6src).
4. → 사용자 지적이 맞음: **codex-spark가 fast 검색에 최적**. "강한 모델=좋은 검색"이 아니라 60s 타임아웃 하에선 **빠른 비추론 모델이 이김** (claude haiku, gemini flash와 동일 패턴).

## 결정

| tier | codex 모델 | 근거 |
|---|---|---|
| **fast (기본)** | 세션=codex면 **세션 모델 parity**(사용자 spark 런타임 그대로) · cross-provider 핀 = **`gpt-5.3-codex-spark`** (카탈로그에 있으면, 없으면 gpt-5.4) | spark 최속·완주·non-reasoning |
| **deep (async 180s)** | **`gpt-5.5` + reasoning high** | 어려운 멀티홉(60s 초과분) 전담 — [075](./075_design_deep_search_tier.md) |

**적용 변경**:
- fast 핀 후보 1순위를 spark로 올리는 건 `DEFAULT_MODEL_PREFERENCES` 카탈로그 필터에 spark 포함 여부 확인 후 ([074 §4] 세션-parity 우선이라 세션=spark면 자동 해결).
- deep는 075 S3-S4(gpt-5.5+reasoning high, 180s, AsyncJob).

> reasoning 파라미터 자체는 이미 추가됨(`codex.ts`, `PI_CODEX_WEB_SEARCH_EFFORT` 기본 medium) — fast는 medium, deep는 high.
