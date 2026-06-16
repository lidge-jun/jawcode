# 030 Provider Matrix — web_search swap categories

> 상태: 스캐폴딩 ✅
> 목적: provider별 검색 지원과 교체 가능 범주를 정리한다.

## Categories

| 범주 | 의미 | 대표 |
|---|---|---|
| Active-native | 현재 선택된 model provider의 native search를 우선 사용 | `auto` |
| Subscription native | OAuth/subscription 계정의 provider-native search | `codex`, `anthropic`, `gemini` |
| Keyed API search | 별도 API key 기반 검색 API | `tavily`, `brave`, `jina`, `kagi`, `parallel`, `synthetic`, `exa` |
| Answer engine | 검색+요약/응답형 provider | `perplexity`, `kimi`, `zai` |
| Keyless fallback | 설정 없이 terminal fallback | `duckduckgo` |
| Self-hosted/custom | 사용자가 endpoint를 제공 | `searxng` |

## Provider support

| provider id | human alias | support type | credentials | default role |
|---|---|---|---|---|
| `auto` | active/native | resolver mode | active provider creds if available | recommended default |
| `codex` | chatgpt/openai | native web_search via ChatGPT/Codex backend | OpenAI Codex OAuth (`/login openai-codex`) | preferred Exa replacement |
| `anthropic` | claude | native Claude web_search | Anthropic OAuth/API key | active-native for Claude |
| `gemini` | google | Google Search grounding | google-gemini-cli or antigravity OAuth/API | active-native for Gemini |
| `duckduckgo` | ddg | keyless search | none | terminal fallback |
| `perplexity` | pplx | answer/search engine | Perplexity cookie/API key | optional explicit |
| `kimi` | moonshot | answer/search engine | Moonshot search/API key | optional explicit |
| `zai` | glm/zai | remote MCP search | Z.AI auth/config | optional explicit |
| `tavily` | tavily | keyed API search | `TAVILY_API_KEY` | optional explicit |
| `brave` | brave | keyed API search | `BRAVE_API_KEY` | optional explicit |
| `jina` | jina | keyed API/search reader | `JINA_API_KEY` | optional explicit |
| `kagi` | kagi | keyed API search | `KAGI_API_KEY` | optional explicit |
| `parallel` | parallel | keyed API search | `PARALLEL_API_KEY` | optional explicit |
| `synthetic` | synthetic | keyed API search | `SYNTHETIC_API_KEY` | optional explicit |
| `searxng` | searx | self-hosted metasearch | endpoint setting/env | optional explicit |
| `exa` | exa | keyed neural search | `EXA_API_KEY` | explicit only; not recommended default |

## Availability notes from code

| provider id | cheap availability check |
|---|---|
| `codex` | `authStorage.hasOAuth("openai-codex")` |
| `anthropic` | `ANTHROPIC_SEARCH_API_KEY` or `authStorage.hasAuth("anthropic")` |
| `gemini` | OAuth for `google-gemini-cli` or `google-antigravity` |
| `duckduckgo` | always available |
| `exa` | `EXA_API_KEY` and Exa settings not disabled |
| `tavily`, `kagi`, `parallel`, `synthetic`, `zai` | stored auth or provider-specific env API key |
| `searxng` | endpoint setting/env |
| `brave`, `jina` | provider-specific env API key |

## Swappable scope

### Safe to swap via `/SEARCHENGINE`

- `providers.webSearch` preference.
- runtime `setPreferredSearchProvider()` value.
- alias normalization.

### Not safe to hide behind `/SEARCHENGINE`

- Provider credentials/login.
- Provider-specific model selection (`PI_CODEX_WEB_SEARCH_MODEL` etc.).
- Result rendering semantics.
- `web_search` tool schema.

## Recommended defaults

1. `auto` for most sessions.
2. `chatgpt`/`codex` when Exa is bad and ChatGPT OAuth is available.
3. `duckduckgo` when no credentials should be used.
4. Explicit keyed APIs only when user asks for that provider.

## Failure behavior

- If chosen provider is unavailable, existing resolver skips it and falls back to DuckDuckGo when possible.
- If chosen provider is available but runtime call fails, `executeSearch()` already records provider failure and tries the next provider in the chain.
- Error output should name failed providers and not silently claim native search was used.

---

## 검증 v2 (260613 — Sonnet 코드 대조, 구현 직전)

자격증명 기술 정정 4건 + 분류 정정 1건 (전부 코드 인용 확인):

| 항목 | 정정 |
|---|---|
| `kagi` | ~~`KAGI_API_KEY`~~ → **authStorage 전용** (`kagi.ts:62-64` — env 경로 없음) |
| `kimi` | `MOONSHOT_SEARCH_API_KEY` 외에 **`KIMI_SEARCH_API_KEY` env + authStorage `kimi-code` 키**도 수용 (`kimi.ts:63-70`) |
| `perplexity` | cookie/API key 외 **OAuth bearer 모드**(`getOAuthAccess("perplexity")`) 존재 — 3중 인증 (`perplexity.ts:219-239,557-559`) |
| `anthropic` | `isAvailable()`은 `ANTHROPIC_SEARCH_API_KEY`만 검사하는데 에러 메시지는 `ANTHROPIC_API_KEY`도 안내 — **가용성 검사와 에러 문구 불일치** (`anthropic.ts:296` vs `:263`) |
| `zai` | "Answer engine" 분류 부적절 — 실체는 keyed HTTP API(`ZAI_API_KEY`, `zai.ts:57-63,307-309`). keyed API 행으로만 분류 |

auto 매핑 테이블(`provider.ts:151-166`) 검증: openai/openai-codex/openai-responses→codex ·
anthropic→anthropic · google/google-gemini-cli/google-antigravity/gemini→gemini ·
moonshot/kimi-code/kimi→kimi · zai→zai · perplexity→perplexity · synthetic→synthetic.
**keyed 단독 프로바이더(brave/jina/exa/tavily/kagi/parallel)는 auto에서 절대 자동 선택되지
않음** — 명시 선택 전용 (`provider.ts:195-211` 주석 계약과 일치).

---

## xAI Grok 추가 (260613 — cli-jaw 260530 포팅)

`700_projects/cli-jaw` devlog `_fin/260530_grok_xsearch_integration`의 검증된 설계를
jawcode 검색 레이어로 이식. xAI Responses API(`https://api.x.ai/v1/responses`)의
`web_search`+`x_search` 도구를 함께 호출해 일반 웹과 X 라이브 인덱스를 **통합 검색**하고,
응답의 답변 텍스트 + `url_citation` 주석을 표준 `SearchSource[]`로 가상화한다.

| 항목 | 값 |
|---|---|
| provider id | `xai` (label "xAI Grok") |
| 가용성 | `hasOAuth("xai") \|\| hasAuth("xai") \|\| XAI_API_KEY` — 모델 레이어 xai OAuth 키와 동일 |
| auto 매핑 | 활성 모델 `xai`/`grok` → `xai` 검색 |
| /searchengine 별칭 | `grok`, `x` → `xai` |
| 검색 도구 | **`web_search` + `x_search` 동시 탑재** — 일반 웹 + X 라이브 통합(Grok이 질의별 선택). 라이브 탐침으로 유효 변형 확인(news_search 무효) |
| 모델 | 기본 `grok-4-fast` (저레이턴시 — cli-jaw 32 라우터 결정) |
| degraded 감지 | (연기) cli-jaw는 X 라이브 인덱스 결과 없을 때 `degraded:true` 감지 — jawcode 포팅은 1차에서 미반영 |

검증: 단위 8케이스(게이팅 OAuth/key/none, 응답 가상화 dedup, x_search 요청 형태, 무자격 401) +
실 authStorage 스모크(provider 등록·게이팅·auto 매핑·grok 별칭·미활성 경고). **미완료: 실제
api.x.ai 라이브 x_search 왕복** — xAI OAuth(`grok login`) 보유 환경에서 cli-jaw `smoke_test.mjs`
형태의 실호출 검증 필요. 이 라이브 스모크 전까지 본 폴더는 `_plan` 유지.
