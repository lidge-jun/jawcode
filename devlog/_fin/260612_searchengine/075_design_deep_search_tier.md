# 075 — design: 2-tier 검색 (fast 기본 + deep 비동기 모드)

> 상태: 🟢 설계 (260613) — feasibility 확인 완료(인프라 존재). 상위: [070](./070_research_native_cli_models.md) · [074 parity](./074_decision_model_parity.md).
> 입력: 사용자 — "codex-spark 런타임으로 검색", "deep 모드: oai 5.5추론·grok 4.20-multi-agent medium·opus-4.6, 타임아웃 3분, 비동기 별도 모드, exa도, tool 확장".

## 1. feasibility — 전부 가능 (인프라 실재)

| 필요 | 존재하는 인프라 | 위치 |
|---|---|---|
| 세션 모델로 검색 (parity) | WebSearchTool이 활성 모델 provider 해석 + `resolveProviderChain(auth, pref, activeModelProvider)` | `web/search/index.ts:119-125`, `provider.ts:206` |
| codex-spark 런타임 검색 | 사용자 패치 완료 (런타임으로 spark 사용) — codex provider가 세션 모델 쓰게만 하면 됨 | `openai-codex-responses.ts` |
| 비동기 별도 모드 | **`AsyncJobManager.register(type, label, run)`** — 백그라운드 실행 + 지연 전달(`#enqueueDelivery`) + reportProgress | `async/job-manager.ts:214,302,379` |
| 3분 타임아웃 | `withHardTimeout(signal, ms)` ms 인자화 (현재 기본 60s) | `web/search/providers/utils.ts:71` |
| tool 확장 | `web_search` 도구에 `depth` 파라미터 추가 또는 `web_search_deep` 신규 | `tools/index.ts:343`, `web/search/index.ts` |

## 2. 현재 문제 (parity 누락)

`auto` 모드에서 세션=codex면 라우팅은 codex provider를 고르지만, **codex provider가 세션 모델을 무시하고 `gpt-5.4`를 핀**한다 (`codex.ts DEFAULT_MODEL_PREFERENCES`). 즉 세션이 codex-spark여도 검색은 gpt-5.4로 감 → 사용자가 패치한 spark 런타임 검색이 안 쓰임.

**수정**: `SearchParams`에 `model?`(세션 모델 id) 추가 → WebSearchTool이 세션 Model id를 전달 → codex/anthropic provider가 **세션이 같은 provider면 그 모델로** 검색(parity), 아니면 핀 ([074 §4](./074_decision_model_parity.md)).

## 3. 2-tier 설계

### Tier 1 — fast (기본, 동기, 60s)
빠른 단발 검색. [071~073 벤치]로 확정한 fast 핀 + 세션-parity:
- codex: 세션=codex면 세션모델(spark 포함), 아니면 핀(벤치 결과) · reasoning effort 낮음(medium)
- anthropic: 세션=claude면 세션모델, 아니면 `claude-haiku-4-5`
- grok: `grok-4.3` · gemini: `gemini-3.5-flash`

### Tier 2 — deep (비동기, AsyncJob, 180s)
어려운 멀티홉 리서치. **AsyncJobManager로 등록 → 즉시 job:// 핸들 반환 → 완료 시 지연 전달**(턴 블록 안 함).

| provider | deep 모델 | effort |
|---|---|---|
| **oai(codex)** | `gpt-5.5` | **reasoning high** |
| **grok** | `grok-4.20-multi-agent` | medium |
| **anthropic** | `claude-opus-4-6` | (reasoning 가능 시 high) |
| **gemini** | (3.5-flash 유지 or 3-pro 검토) | — |
| **keyed** | `exa`(deep/livecrawl), `perplexity`(sonar-deep-research), `tavily` | provider별 deep 파라미터 |

- **타임아웃 180s** (`withHardTimeout(signal, 180_000)`).
- **비동기**: deep는 동기 60s에 안 들어가므로(벤치상 무거운 모델 60s 초과 빈번) **반드시 async**. `AsyncJobManager.register("task", "deep-search:<q>", run)` → 에이전트는 job 핸들 받고 다른 일 하다가 결과 수신.
- exa/perplexity: keyed deep provider는 자체 deep 모드(exa `type:deep`·livecrawl, perplexity sonar-deep-research) 사용 — "알아서 방법 찾기"는 각 provider의 deep 파라미터 매핑으로.

## 4. tool 표면 (확장)

두 안:
- **A. `web_search` 파라미터** `depth: "fast" | "deep"` (기본 fast). deep이면 내부적으로 async job 등록 + job 핸들 반환. — 단순, 도구 1개 유지.
- **B. 별도 `web_search_deep` 도구**. — 명시적, 자동완성에 분리 노출, async 의미 명확.

**권장 = B + A 혼합**: `web_search`에 `depth` 추가하되 deep은 async 전달이라 동작이 다르므로, 자동완성/도움말 명확성 위해 `web_search_deep`도 alias로 노출. `/searchengine`에도 deep tier 모델 표시.

## 5. 구현 슬라이스 (제안)

| # | 작업 | 파일 |
|---|---|---|
| S1 | `SearchParams.model?`·`depth?`·`timeoutMs?` 추가 + WebSearchTool이 세션 Model 전달 | `base.ts`, `web/search/index.ts` |
| S2 | codex/anthropic provider: 세션=동일provider면 세션모델 parity, 아니면 핀 (074 §4) | `codex.ts`, `anthropic.ts` |
| S3 | deep tier 모델 테이블 + `withHardTimeout` 180s | `provider.ts` or 신규 `deep-tier.ts` |
| S4 | deep = `AsyncJobManager.register` 비동기 등록 + job 핸들 반환 | `web/search/index.ts`, `async/` |
| S5 | tool 확장 `depth` 파라미터 + `web_search_deep` | `tools/index.ts`, `web/search/index.ts` |
| S6 | exa/perplexity deep 파라미터 매핑 | `providers/{exa,perplexity}.ts` |

## 6. 미해결

- deep gemini 모델 (3.5-flash 유지 vs 3-pro) — 인증 없어 벤치 불가, 보류.
- async deep 결과 전달 UX (job:// → 채팅 인라인 vs 알림).
- deep 동시 실행 상한 (`AsyncJobManager` maxRunningJobs 재사용).
