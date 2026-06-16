# 074 — decision: web search 모델 — 세션 parity vs 고정 핀

> 상태: 🟢 결정 (260613). 상위: [070 research](./070_research_native_cli_models.md).
> 입력: 사용자 — "4번(세션 parity)과 1,2,3 전부 문서화 / gemini는 parity 하지말고 3.5-flash 고정".

## 1. 배경 — 네이티브 vs 우리

[070 §1](./070_research_native_cli_models.md) 정본 분석(`~/Developer/codex/14_web-search/`): codex-rs·Claude Code·Gemini CLI는 **세션 모델로 검색**(전용 검색모델 없음), Grok만 전용 `grok-4.20-multi-agent`.

우리 구현은 **cross-provider 검색 브리지** — 세션이 Claude여도 OpenAI/Grok 검색을 빌려쓰게 하려고 provider별로 검색 모델을 **고정 핀**한다. 세션 모델을 빌릴 수 없는 경우(타모델+타검색)가 본질이라 고정이 구조상 필요.

## 2. "세션 parity" 옵션이란

codex/claude는 **세션이 같은 provider일 때만** 세션 모델로 검색하고(네이티브 패리티), cross-provider일 때만 고정 핀으로 폴백하는 하이브리드. 즉:
- 세션=codex + 검색=codex → 세션 codex 모델로 검색 (네이티브처럼)
- 세션=claude + 검색=codex → 고정 핀(gpt-5.x)으로 검색 (브리지)

## 3. 결정 (provider별)

| provider | parity 적용? | 기본 핀 | 근거 |
|---|---|---|---|
| **codex(oai)** | ✅ **하이브리드** (세션=codex면 세션모델, 아니면 핀) | [071 벤치 결과로 확정](./071_bench_codex.md) | 네이티브 패리티 + 브리지 양립 |
| **anthropic** | ✅ **하이브리드** (세션=claude면 세션모델, 아니면 핀) | [073 벤치 결과로 확정](./073_bench_claude.md) | Claude Code가 세션모델로 검색(`14_cc`) |
| **gemini** | ❌ **parity 안 함 — 고정** | **`gemini-3.5-flash`** | [사용자 확정 260613]. 그라운딩은 API가 처리하므로 모델 영향 작음 + 단순성 |
| **xai(grok)** | ❌ 고정 (네이티브도 전용 모델) | [072 벤치 결과로 확정](./072_bench_grok.md) | Grok 자체가 전용 검색모델 사용 |

## 4. 구현 방향 (하이브리드 — codex/anthropic)

검색 provider가 모델을 고를 때:
1. `<PROVIDER>_SEARCH_MODEL` env 있으면 그것 (운영자/테스트 오버라이드 — 이미 anthropic·xai 보유, codex는 `PI_CODEX_WEB_SEARCH_MODEL`).
2. **세션 모델이 같은 provider면 세션 모델** (신규 parity 분기) — 단 검색 도구 지원 모델인지 가드.
3. 아니면 **기본 핀** (벤치로 정한 default).

> 현 코드(`searchCodex`·`searchAnthropic`)는 세션 모델을 안 봄. parity 분기는 `params`에 세션 model/provider를 넘기고 그 분기를 추가하는 소규모 변경. cross-provider 경로(핀)는 그대로 보존.

## 5. 적용 상태 (260613)

| 항목 | 상태 |
|---|---|
| gemini → `gemini-3.5-flash` 고정 | ✅ `gemini.ts:31` 적용 |
| xai `XAI_SEARCH_MODEL` env 오버라이드 추가 | ✅ `xai.ts` 적용 (테스트·운영자용) |
| xai 기본 `grok-4-fast`→`grok-4.3` | ✅ 적용 (072 벤치로 재확정) |
| codex/anthropic 하이브리드 parity 분기 | ⬜ 벤치 후 구현 |
| 기본 핀 확정 (codex/grok/claude) | ⬜ [071/.2/.3](./071_bench_codex.md) 벤치 결과 |

## 6. 비범위

- gemini parity (사용자 제외).
- 세션 모델이 검색 도구 미지원일 때의 자동 폴백 정책은 각 provider 기존 fallback 체인 재사용.
