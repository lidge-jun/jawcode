# 072 — bench: grok 검색 모델 (grok-4.3 vs grok-4.20-multi-agent)

> 상태: 🟢 실측 완료 (260613). 상위: [070](./070_research_native_cli_models.md) · [074 decision](./074_decision_model_parity.md).
> 도구: `packages/coding-agent/search-bench.ts xai`. raw: `/tmp/bench-xai.md`.
> 쿼리: HARD 5종(가격 멀티홉·전기차보조금·한국영화 멀티제약·고대 MOOC·Bun freshness) + **X 특화 2종**(Claude/GPT X 반응).

## 결과 (latency / chars / sources / out-tok)

| query | grok-4.3 | grok-4.20-multi-agent | grok-4.1-fast |
|---|---|---|---|
| price-multihop | 14.0s · 2157 · 8src · 1237 | 12.1s · 3716 · **12src** · 4859 | ❌ Model not found |
| kev-subsidy | 24.6s · 1751 · 7src · 2065 | 48.4s · 3274 · **12src** · 21778 | ❌ |
| kfilm-multi | 41.5s · 929 · 5src · 2854 | 26.6s · 681 · 2src · 13700 | ❌ |
| obscure-book | 8.8s · 319 · 2src · 716 | 8.3s · 318 · 1src · 3312 | ❌ |
| freshness | 5.6s · 797 · 4src · 539 | 9.8s · 1095 · 4src · 3321 | ❌ |
| **x-claude-buzz** | 14.3s · 1519 · 9src · 1627 | 22.3s · **2634** · 8src · 12221 | ❌ |
| **x-gpt-buzz** | 13.8s · 2820 · 6src · 1547 | 18.0s · **3454** · 5src · 11064 | ❌ |

## 판정

- **`grok-4.1-fast` = 존재하지 않음** ("Model not found") → 드롭.
- **`grok-4.20-multi-agent` = 우리 `/responses` API에서 접근 가능** (분석문서 `14_gr` 검증됨). 검색이 더 풍부(소스·길이)하나 **출력 토큰 3~10배** (kev-subsidy 21778 vs 2065 = 10.5배). 비용 큼.
- **`grok-4.3` = 균형 우위**: 빠르고(평균 더 짧음) 저비용, 핵심 사실·인용 정확(가격 비교 정답 + 출처 2개). X 특화도 양호(x-gpt-buzz 2820자 6소스).
- X 특화(grok의 차별점): 둘 다 X 인용 잘함. 4.20-multi-agent가 SWE-bench 수치 등 더 깊지만 토큰 폭증.

## 결정

**기본 = `grok-4.3`** (적용됨, `xai.ts:33`). 근거: 빠름·저비용·정확, X 검색 충분. `grok-4.20-multi-agent`는 "deep" 옵션 후보 — `XAI_SEARCH_MODEL` env로 선택 가능(이번에 추가). grok-4.1-fast는 비존재라 어디에도 안 씀.

> Grok은 네이티브도 전용 검색모델(`grok-4.20-multi-agent`) → 우리도 고정 핀이 정합(parity 불필요, [074](./074_decision_model_parity.md)). X 특화는 grok 고유 가치.
