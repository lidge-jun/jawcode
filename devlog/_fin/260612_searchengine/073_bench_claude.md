# 073 — bench: claude 검색 모델 (haiku-4-5 vs sonnet-4-6 vs opus-4-6)

> 상태: 🟢 실측 완료 (260613). 상위: [070](./070_research_native_cli_models.md) · [074 decision](./074_decision_model_parity.md).
> 도구: `search-bench.ts anthropic`. raw: `/tmp/bench-anthropic.md`. 사용자 Claude 로그인 후 실측.
> 연구 전제: Claude Code 기본 검색모델 = **세션 모델**(`mainLoopModel`), haiku는 experimental flag `tengu_plum_vx3` ON일 때만 ([070 §1](./070_research_native_cli_models.md), `14_cc` decompiled).

## 결과 (latency / chars / sources / out-tok)

| query | claude-haiku-4-5 | claude-sonnet-4-6 | claude-opus-4-6 |
|---|---|---|---|
| price-multihop | 6.6s · 594 · 18src | 20.0s · 2228 · 16src | 21.1s · 1641 · 18src |
| kev-subsidy | 12.8s · 707 · **34src** | ⏱ **timeout** | ⏱ **timeout** |
| kfilm-multi | 34.5s · 671 · **79src** | 52.4s · 218 · 138src | ⏱ **timeout** |
| obscure-book | 11.8s · 497 · 30src | 41.3s · 0 · 104src | 43.2s · 92 · 90src |
| freshness | 3.7s · 107 · 9 | 10.5s · 380 · 8 | 11.9s · 764 · 8 (전부 완주) |

## 판정

- **haiku-4-5 = 전 쿼리 완주**, 가장 빠름(6.6~34.5s), 소스 풍부(18~79). 60s 검색 타임아웃 안에 항상 끝남.
- **sonnet-4-6** = 답변 prose는 더 조밀(price 2228 vs 594)하나 어려운 쿼리(kev-subsidy) **타임아웃**, 일부 답변 0자(소스만).
- **opus-4-6** = 가장 느림, **타임아웃 최다**(kev·kfilm). 검색용으로 부적합.
- **핵심**: 검색은 60s 하드 타임아웃(`utils.ts:56 SEARCH_HARD_TIMEOUT_MS`)이 있어 **무거운 모델이 어려운 쿼리에서 실패**. 빠른 haiku가 완주·다소스로 이김. 이는 Claude Code의 experimental "haiku for search"(`tengu_plum_vx3`) 합리성과 일치.

## 결정 (하이브리드, [074](./074_decision_model_parity.md))

- **cross-provider 핀 = `claude-haiku-4-5` 유지** (세션≠claude일 때). 완주·저비용·다소스라 검색 핀으로 최적.
- **세션=claude일 때 = 세션 모델 parity 분기 추가** (Claude Code 기본 동작). 단 어려운 쿼리 타임아웃 위험 → 세션이 opus/sonnet이면 검색만 haiku로 강등하는 옵션 검토(= Claude Code의 `ANTHROPIC_SMALL_FAST_MODEL` 철학).
- `ANTHROPIC_SEARCH_MODEL` env로 운영자 오버라이드 유지(기존).

> 즉 우리 haiku 핀은 "기본 흉내 실패"가 아니라 **검색 신뢰성 측면에서 옳은 선택**이었다 — 실측이 뒷받침. parity는 세션=claude 케이스에 한해 추가.
