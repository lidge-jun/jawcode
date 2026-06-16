# 070 — research: web search 모델 — 네이티브 CLI vs 우리 박은 값

> 상태: 🟢 조사 완료 (260613) — 정본 출처: `~/Developer/codex/14_web-search/` (역공학 분석 문서).
> 입력: 사용자 — "타모델+oai search일 때 모델", "claude-code/gemini-cli는 어떻게 하는지", "grok-4-fast는 레거시".
> 스모크 증거: `packages/coding-agent/codex-search-model-smoke.ts` (gpt-5.5 vs 5.3-codex-spark 실측).

## 1. 핵심 발견 (정본 분석 문서 기반)

**네이티브 CLI 3종은 "검색 전용 모델"이 없다 — 세션 모델이 검색한다.** Grok만 전용 모델 존재.

> ⚠️ 문서 식별 정정 (parity 심층 260613): **codex-rs = `14_co`** (`14_cr`은 Cursor Agent). 아래 표 출처 정정 반영.

| CLI | 검색 메커니즘 | 검색 모델 | 출처 |
|---|---|---|---|
| **codex-rs** | `ToolSpec::WebSearch` (Responses API 내장), 클라이언트는 pass-through | **세션 모델** (gpt-4o=non-reasoning / o3·o4-mini=agentic / o3-deep-research=deep). 별도 search-model 없음 | `14_co:236-240,244` |
| **Claude Code** | 별도 Anthropic API sub-call (systemPrompt "assistant for performing a web search tool use") | **세션 모델 = 기본** (`mainLoopModel`). Haiku는 **experimental flag `tengu_plum_vx3`=ON일 때만**(기본 OFF) → 우리 haiku 핀은 기본 아닌 실험경로 흉내 | Claude Code decompile `1515_bl1.js:131,143` (별도 역공학, `14_cc` md 아님) · `00:59-65` |
| **Gemini CLI** | `google_web_search` = API-level Google Search Grounding (가장 단순) | **세션 모델** (gemini-3 family); 그라운딩은 Gemini API가 처리 | `14_ge:27-49` |
| **Grok** | enabled-by-default, `--disable-web-search` | **`grok-4.20-multi-agent`** (전용 search 모델, server-internal). 우리 API에서 접근 가능 확인(072) | `14_gr:18-20` |

→ **codex-rs·Claude Code(기본)·Gemini = 세션-모델 parity** (크로스-CLI 매트릭스 7개 중 다수). Grok만 전용. Pattern A(세션모델이 검색)가 canonical, Claude의 별도 sub-call(Pattern B)은 비용 2배라 예외. 우리만 cross-provider 핀.

## 2. 우리(jawcode/gajae) 구현 = cross-provider 브리지 (provider별 모델 박음)

우리 search provider들은 **세션 모델과 무관하게** 자기 모델을 박는다. 이유: 타모델(Claude/Gemini)로 대화하면서 OpenAI 검색을 빌려쓰는 구조라 빌려올 세션 모델이 없음 → OpenAI 모델을 직접 지정해야 함 (구조상 필수).

| provider | 우리가 박은 모델 | 위치 | 네이티브 대비 |
|---|---|---|---|
| codex(oai) | `gpt-5.4` (1순위), fallback 체인 | `web/search/providers/codex.ts:22-31` | 네이티브는 세션모델(5.5). 우리는 5.4 박음 (한 단계 뒤) |
| anthropic | `claude-haiku-4-5` (env `ANTHROPIC_SEARCH_MODEL`) | `anthropic.ts:30,48` | Claude Code는 세션모델. 우리는 haiku 고정 (검색 subcall 비용 최적화 — 합리적 단순화) |
| gemini | `gemini-2.5-flash` | `gemini.ts:31` | Gemini CLI는 세션모델(gemini-3 family). 우리 2.5-flash는 **stale** (단종 아님·gemini-3로 대체 중) |
| xai(grok) | ~~`grok-4-fast`~~ → **`grok-4.3`** (260613 변경) | `xai.ts:33` | Grok 전용은 `grok-4.20-multi-agent`. **⚠️ 충돌 — 아래 §4** |

## 3. 스모크 실측 — gpt-5.5 vs gpt-5.3-codex-spark (어려운 검색)

쿼리: "gpt-5.5 vs Claude Opus 4.8 context window·pricing 비교, 출력 토큰당 더 싼 쪽 인용" (멀티홉).

| 모델 | latency | answer chars | sources | out tokens |
|---|---|---|---|---|
| gpt-5.5 | 34.4s | 1703 | 0 (인라인 인용) | 1237 |
| gpt-5.3-codex-spark | **21.1s** | 1230 | 1 (구조화 소스) | 6197 |

> ⚠️ **이 1차 스모크는 reasoning 미적용 = 불공정** (사용자 지적 260613): codex 검색 provider가 `reasoning` 필드를 안 넣었음. codex-spark는 non-reasoning(`model-thinking.ts:252`)이라 무관하나, gpt-5.5는 reasoning 모델이라 추론 없이 비교됨. → §3.1 reasoning 수정 + 재벤치.

### 3.1 reasoning 수정 (260613)

jaw 런타임 정본(`applyResponsesReasoningParams`, `openai-responses-shared.ts:749-762`)은 `model.reasoning`일 때 `reasoning:{effort,summary:"auto"}` + `include:["reasoning.encrypted_content"]`를 넣는다. 검색 provider(`codex.ts`)는 이를 안 넣었음 → **추가**(추론 가능 모델만, effort=`PI_CODEX_WEB_SEARCH_EFFORT` 기본 medium). spark는 non-reasoning이라 자동 제외. 공정 재벤치 = [071](./071_bench_codex.md).

## 4. provider별 결정 (실측 종합)

| provider | 결정 | 상태 |
|---|---|---|
| **grok** | `grok-4.3` 고정 (4.20-multi-agent는 deep 옵션, 4.1-fast 비존재) | ✅ 적용 `xai.ts:33` ([072](./072_bench_grok.md)) |
| **gemini** | `gemini-3.5-flash` 고정 (parity 안 함) | ✅ 적용 `gemini.ts:31` |
| **anthropic** | cross 핀 `claude-haiku-4-5`(완주·다소스 실측) + 세션=claude면 parity | ✅ 핀 유지 / ⬜ parity 분기 ([073](./073_bench_claude.md)) |
| **codex** | reasoning 재벤치 후 확정 (5.4 vs 5.5+reasoning vs spark) + 세션=codex면 parity | ⏳ [071](./071_bench_codex.md) |

## 5. 적용/잔여

| 항목 | 상태 |
|---|---|
| grok `grok-4.3` + `XAI_SEARCH_MODEL` env | ✅ |
| gemini `gemini-3.5-flash` 고정 | ✅ |
| codex 검색 reasoning 파라미터 추가 + `PI_CODEX_WEB_SEARCH_EFFORT` | ✅ |
| codex 기본 핀 확정 (재벤치) | ⏳ 071 |
| codex/anthropic 세션-parity 분기 | ⬜ 074 §4 |
| 소넷 검증 다중 | ⬜ |
| (옵션) 세션모델 패리티 | provider별 고정 | codex/claude/gemini는 **세션이 동 provider면 세션모델 사용** | 네이티브 패리티 — 단 cross-provider는 고정 유지 |

## 출처

- `~/Developer/codex/14_web-search/{14_co,14_cc,14_ge,14_gr}_web-search.md` (역공학 정본)
- 스모크: `packages/coding-agent/codex-search-model-smoke.ts`
- 코드: `packages/coding-agent/src/web/search/providers/{codex,anthropic,gemini,xai}.ts`
