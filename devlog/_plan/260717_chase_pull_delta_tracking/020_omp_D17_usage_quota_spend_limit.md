# 020_omp_D17_usage_quota_spend_limit

> Range: `7aa1d581c..b0d04e517` (subset)
> Cluster: D17 — usage/quota/spend-limit classification
> Sol priority: P1
> Model-related: yes
> Card target: 20.054_usage_quota_spend_limit
> Worker: OW2

## 커밋 전수 테이블

| # | hash | summary | JWC impact area |
|---|---|---|---|
| 1 | `b0d04e517` | login 유래 API key snapshot의 wire validation 수정 | AI auth-broker wire schemas |
| 2 | `34870d578` | 기존 quota classifier가 후속 분류에서 사라지지 않게 보존 | AI rate-limit classifier |
| 3 | `d3520732b` | main의 usage-limit classifier 보존 | AI rate-limit classifier |
| 4 | `e3a7ec880` | quota parser에서 spend-limit 오류 분류 | AI rate-limit parser/tests |
| 5 | `03c48d073` | OpenRouter usage attribution/reconciliation 및 catalog entry 수정 | OpenAI-compatible providers, catalog |
| 6 | `0c5458a24` | OpenRouter 일일 key limit 인식 | AI rate-limit/auth retry |
| 7 | `2faa345d1` | Anthropic spend-limit을 persistent usage-limit으로 분류 | AI rate-limit, Anthropic retry |
| 8 | `c95a2b993` | content-filter 응답의 retry 분류 수정 | AI provider error flags |
| 9 | `1d9889810` | Codex usage reset을 현재 선택 account에 적용 | AI Codex usage reset |
| 10 | `b929ed164` | gateway quota usage-limit을 credential rotation에서 존중 | auth gateway/storage, API-key resolver |

## 주제 분석

이 클러스터는 일시적 rate limit과 지속적인 quota·spend limit을 구분하고, 그 결과를 account 선택과 재시도에 연결한다. 지속 한도를 단순 429로 취급하면 같은 credential에 무의미한 retry가 반복된다. 반대로 classifier를 덮어쓰면 이미 정확히 판별된 quota 상태가 일반 rate limit으로 퇴행한다.

OpenRouter reconciliation은 실제 요청 identity와 보고된 usage를 같은 account에 귀속시키는 문제다. Codex reset 역시 UI에서 선택한 account와 reset 대상이 일치해야 한다. `b0d04e517`은 login 경로에서 생성된 key snapshot이 wire schema 단계에서 탈락하지 않도록 해 이 전체 흐름의 입력을 안정화한다.

## Worktree 대조

현재 JWC의 관련 로직은 `packages/ai/src/rate-limit-utils.ts`, provider별 transport, auth storage와 model manager에 분산돼 있다. 이 영역은 현재 worktree에서도 수정 중이므로 upstream classifier를 곧바로 덮어쓰면 사용자 변경과 충돌할 가능성이 높다.

카드 단계에서는 persistent usage-limit 표식, retry 가능 여부, account rotation, reset 대상 선택을 하나의 상태 흐름으로 검증해야 한다. OpenRouter·Anthropic·Codex를 각각 fixture로 나누고, login-sourced snapshot은 broker wire schema 경계에서 별도 검증하는 편이 안전하다.

## 누락 커밋 보완 (2026-07-17)

범위 전체와 기존 분류 파일의 정확한 해시 차집합에서 확인한 누락 커밋을 추가한다.

| # | hash | git one-line summary | classification |
|---|---|---|---|
| 1 | `1f619dcf1` | feat(ai): enhanced Codex rate-limit header ingestion and usage-based key ranking | usage/quota/spend |
| 2 | `2010f01cd` | fix(ai): routed zai api keys by usage | usage/quota/spend |
| 3 | `43f8999a9` | feat(ai): added cache invalidation for usage reports | usage/quota/spend |
| 4 | `6bb0878b6` | feat(ai): added cache invalidation command for usage reports | usage/quota/spend |
| 5 | `8d4e4fde5` | fix(ai): resolved zai api key usage probes | usage/quota/spend |
| 6 | `965f5b0bb` | feat(ai): report Cursor account usage | usage/quota/spend |
| 7 | `c11545f23` | fix(ai): match legacy broker usage by identity | usage/quota/spend |
