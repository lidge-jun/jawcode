# 000 MOC — searchengine provider switching

> 상태: ✅ 완료·**실 스모크 통과** (260613) — api.x.ai 라이브 x_search 왕복 확인(grok OAuth,
> HTTP 200, 당일 X 게시물 + 파서 가상화 검증). 구현분: `/searchengine`+`/SEARCHENGINE` 슬래시,
> OAuth/키 가용성 게이팅(OAuth 가능 도구는 OAuth로 해금·나머지는 키 보유 시만 활성 — 모델 레이어
> 패턴), **xAI Grok x_search 프로바이더 신설(cli-jaw 260530 포팅)**. 검증: 슬래시+검색 스위트
> 67 pass · tsc 0 + 실 authStorage 스모크 + 라이브 API 왕복. 라이브가 드러낸 결함(citation title이
> 인덱스 번호) → URL 폴백 수리.
> Sonnet 병렬 5기 활용(블로커 2 + 적대검증 1 + OAuth게이팅 검증 1 + perf감사 1).
> 부수 수확: TUI 디스패처 handleTui-우선 발견 → /model 인자형 위임으로 cmd_audit P1 완전 종결.
> 입력: 사용자 지시 “exa가 개판이라 ChatGPT native search나 활성 프로바이더로 갈아끼우는 방안 + /SEARCHENGINE” (260612)
> 소유: `web_search` unified provider layer + slash command surface

## 문제

`web_search`는 이미 다수 provider를 지원하지만 operator가 즉석에서 “이번 세션 검색 엔진”을 바꾸는 표면이 약하다. Exa가 부정확하거나 noisy할 때 현재 active model의 native web search 또는 ChatGPT native search로 빠르게 전환해야 한다.

## 현재 구현 요약

- Tool: `packages/coding-agent/src/web/search/index.ts`
- Provider resolver: `packages/coding-agent/src/web/search/provider.ts`
- Provider preference setting: `providers.webSearch`
- Runtime setter: `setPreferredSearchProvider(provider)`
- Existing providers: `duckduckgo`, `exa`, `brave`, `jina`, `kimi`, `zai`, `perplexity`, `anthropic`, `gemini`, `codex`, `tavily`, `parallel`, `kagi`, `synthetic`, `searxng`
- `auto`: active model provider → native search mapping if credentials exist, then DuckDuckGo fallback

## 결정

1. Exa는 기본 추천 경로가 아니다. 명시 선택 시에만 사용한다.
2. 기본 UX는 `auto`: active model native search를 우선한다.
3. ChatGPT native search는 `codex` provider를 canonical로 쓰고, slash alias `chatgpt`, `openai`, `codex`를 모두 허용한다.
4. `/SEARCHENGINE` slashline은 settings-backed persistent preference와 runtime setter를 함께 갱신한다.
5. Provider별 native/search support matrix를 문서화해 “갈아끼울 수 있는 범주”를 명확히 한다.

## 범위

### MVP 포함

- `/searchengine` builtin slash command 추가. 대문자 `/SEARCHENGINE`는 parser가 case-insensitive가 아니면 alias로 명시 처리한다.
- `chatgpt`/`openai` alias → `codex` provider.
- 현재 provider 표시 + 후보 목록 출력.
- `providers.webSearch` 저장 + `setPreferredSearchProvider()` 호출.
- provider availability check는 표시용으로만 사용하고, 실행 실패는 기존 fallback/error path를 유지한다.

### MVP 비포함

- 새 provider 구현.
- Exa provider 삭제.
- `web_search` tool schema 확장.
- provider별 quality ranking 자동 학습.
- browser/web-ai search 통합.

## Acceptance

- `/SEARCHENGINE` without args prints current provider and supported aliases.
- `/SEARCHENGINE chatgpt` persists `providers.webSearch=codex` and subsequent `web_search` prefers Codex/OpenAI native search when credentials exist.
- `/SEARCHENGINE auto` restores active-model native search preference.
- Invalid provider prints a bounded usage message and does not mutate settings.
- Existing settings selector path for `providers.webSearch` continues to work.

## Verification

- Unit test slash parser/handler for `auto`, `chatgpt`, `codex`, invalid provider.
- Focused web search resolver test: active `openai-codex`/`anthropic`/`google-gemini-cli` maps to `codex`/`anthropic`/`gemini` in auto mode and appends DuckDuckGo fallback.
- Manual smoke with available credentials: `/SEARCHENGINE chatgpt` → `web_search` response provider is `codex` or reports credential failure and fallback behavior as designed.

## Rollback

Remove the builtin slash command entry and any alias helper. Restore `providers.webSearch` schema only if changed. Existing provider implementations remain untouched.

---

## Phase 2 — 모델 선택 / 벤치 / deep tier (070–075, 260613)

> 1차(000–060)는 `/searchengine` 슬래시·provider swap(완료). 2차는 **각 provider 검색이 어떤 모델을 쓰는가** — 네이티브 대조·실측 벤치·parity 결정·deep 모드 설계.

| 문서 | 내용 |
|---|---|
| [070_research_native_cli_models.md](./070_research_native_cli_models.md) | 네이티브 CLI(codex-rs·Claude Code·Gemini·Grok) 검색 모델 대조 (`~/Developer/codex/14_web-search` 정본) — 셋 다 세션-모델 parity, Grok만 전용. 우리는 cross-provider 핀 |
| [071_bench_codex.md](./071_bench_codex.md) | codex 실측 (gpt-5.4/5.5/spark, reasoning 공정) — **spark 최속·완주**, 어려운 2쿼리는 셋 다 60s 타임아웃 |
| [072_bench_grok.md](./072_bench_grok.md) | grok 실측 — `grok-4.3` 기본, `grok-4.20-multi-agent` deep용, `grok-4.1-fast` 비존재 |
| [073_bench_claude.md](./073_bench_claude.md) | claude 실측 (haiku/sonnet-4-6/opus-4-6) — **haiku 전 쿼리 완주·다소스**, sonnet/opus 타임아웃 |
| [074_decision_model_parity.md](./074_decision_model_parity.md) | provider별 결정: gemini=3.5-flash 고정·grok=4.3·anthropic/codex=하이브리드(세션=동일provider면 parity) |
| [075_design_deep_search_tier.md](./075_design_deep_search_tier.md) | 2-tier 설계: fast(60s 동기) + deep(180s 비동기 AsyncJob, gpt-5.5+reasoning·grok-4.20-multi-agent·opus-4-6) + tool 확장 |

**적용 완료 (typecheck 0)**: gemini→`gemini-3.5-flash` 고정 · grok→`grok-4.3`+`XAI_SEARCH_MODEL` env · codex 검색 reasoning 파라미터(`PI_CODEX_WEB_SEARCH_EFFORT`).
**잔여(구현)**: 074 §4 세션-parity 분기 + 075 deep async tier(S1–S6). 벤치 스크립트: `packages/coding-agent/search-bench.ts`.
| [080_plan_search_settings_ux.md](./080_plan_search_settings_ux.md) | `/searchengine` space pane — fast/deep·reasoning·contextSize 세부 설정 UX. 키: ↑↓←→+Enter, settings.json 영속, provider별 동적 표시 |
