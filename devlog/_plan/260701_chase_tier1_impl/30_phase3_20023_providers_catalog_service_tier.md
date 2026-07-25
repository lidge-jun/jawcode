# WP3 — Card 20.023: AI providers · model catalog · per-family service-tier (OMP reference)

> Goal `f8909338-255` · PABCD work-phase 3 · State P→ (this plan)
> Card: `struct_har/chase/20.023_omp_chase_ai_providers_catalog_service_tier.md`
> OMP source: `ca9f2847e..b6c9747d4` (v16.2.5→v16.2.9, 175 commits). **reference-only, 1:1 port FORBIDDEN.**
> Interview decision (2026-07-01): IMPORT/ADAPT (의도). **실제 per-feature triage 결과(아래)**: service-tier=already-shipped, all_turns=inapplicable, reasoning-heal=real gap이나 이 카드에서 안전한 JWC-native 범위 미정의 → defer. 따라서 이 카드의 IMPORT/ADAPT 의도는 "채택할 신규 코드 없음"으로 귀결(회피 아님, evidence-backed).

## Why (non-dev summary)

OMP 상류가 AI provider/catalog 배관을 대대적으로 재작업했어요(service-tier 998줄/43파일, reasoning-fence-heal 901줄, google-interactions +753줄 등). 하지만 OMP는 reference-only 카드이고 JWC 아키텍처가 OMP와 크게 달라서, "무엇이 JWC에 실제 갭인가"를 per-feature triage한 뒤 작은 JWC-native 채택만 합니다. 큰 1:1 이식은 goal 원칙(1:1 port 금지)과 충돌하므로 하지 않아요.

## Independent audit (explorer gpt-5.4, Anscombe) — 6 behavioral surfaces

| # | OMP surface | OMP anchor | JWC gap verdict | evidence |
|---|---|---|---|---|
| 1 | per-family service-tier (per-model→per-family migration, standalone `service-tier.ts`) | `d20e6c082` | **ALREADY-SHIPPED** | JWC `packages/ai/src/types.ts:197` scoped `ServiceTier` (`openai-only`/`claude-only`) + `resolveServiceTier`/`shouldSendServiceTier`/`getPriorityPremiumRequests` (확장: 10.062 `b249348`); session `/fast` scoped 보존 `agent-session.ts:6310`. OMP per-family migration = architecture-divergent no-op for JWC. |
| 2 | reasoning `all_turns` gate (OpenAI v5.4+) | `093660f8b` | **INAPPLICABLE** | `packages/ai/src` 전체에 `all_turns`/`reasoningContext`/`reasoning.context` 매치 0. JWC reasoning surface는 effort/summary/thinking 중심(`openai-responses.ts:97`, `openai-completions.ts:251`). 막을 surface 자체가 없음. |
| 3 | leaked-reasoning-fence healing (generic, all providers) | `bebdd22e6` | **GAP (real)** → DEFER (구현 불가 아님; 이 카드에서 **안전한 JWC-native 범위가 아직 정의되지 않음**) | JWC는 provider-local healing만: MiniMax `<think>/<thinking>` 파서(`openai-completions.ts:330`, 의도적으로 minimax-code 전용·false-positive 인지·gate `:525`), DeepSeek 토큰 strip(`:368`), Kimi ToolCallHealer(`tool-call-healing.ts`). 10.055(_fin)은 harmony/invoke leak 방어(`harmony-leak.ts`)로 별개. generic cross-provider `<thinking>`-fence healer는 없음. **소형 경로 후보**: MiniMax 파서를 helper로 추출 + 명시 allowlist provider 확대 — 단 allowlist 근거가 이 카드 증거만으론 부족(별도 카드에서 설계). |
| 4 | catalog capability flags + Sonnet 5 thinking; provider refresh | `f1063cdfb`,`43ad3cd91` | reference cross-ref | JWC는 catalog를 `packages/ai`/coding-agent에 폴드(standalone `packages/catalog` 없음). models.json은 `generate-models`로만 재생성(AGENTS.md:106). per-feature 평가 대상이나 이 카드 범위 밖. |
| 5 | google-interactions transport + vertex regional fallback | `d01bf079e`(+753),`6b64ed0ff` | reference cross-ref | 대형 additive transport. 10.062 Gemini UA 인접. JWC `google-gemini-cli.ts` 기존 경로와 별개 신규 표면 — 독립 카드 후보. |
| 6 | llama.cpp/ollama hardening; antigravity reset; glm watchdog | `a2f8b3915` 외 | reference cross-ref | 10.054 local-provider chase와 중첩. per-fix 평가는 local-provider 후속에서. |

## Decision: reference-triage close (no JWC code change this card)

근거:
- 채택 candidate 3개 중 2개(#1 service-tier, #2 all_turns)는 **already-shipped / inapplicable** — 코드 변경 불필요.
- #3 leaked-fence healing은 **진짜 갭이지만**, OMP 구현이 JWC에 없는 인프라(`StreamMarkupHealing`, `owned-stream.ts`/`InbandStreamProjector`, `wrapInbandToolStream`) 위에 지어져 있어, 충실한 채택은 대형 의존성 이식을 동반 → goal "1:1 port 금지 / 작은 JWC-native" 원칙과 충돌. JWC의 MiniMax 파서는 false-positive 위험 때문에 **의도적으로** 좁혀둔 설계라, broad all-provider healing은 그 안전 결정을 뒤집음.
- #4·#5·#6은 카드 자체가 reference-only(track-only)로 명시.

→ 이 카드는 **per-feature 판정을 기록한 reference-triage closure**로 닫고, #3은 별도 implementation 카드(신규, 백로그)로 분리한다. 무변경 결정은 evidence-backed이며 카드 Done Gate("Adopt/defer/reject decision recorded per feature")를 충족.

> **Adversarial audit (Averroes, gpt-5.4):** no-code 결정 = DEFENSIBLE. #1 already-shipped(types.ts:197/207, wire emission openai-responses-shared.ts:724/openai-codex-responses.ts:629/anthropic.ts:1050), #2 inapplicable(all_turns hit 0), #4 catalog는 JWC canonical pipeline 별도(model-thinking.ts:137), #5 Vertex single-location(google-vertex.ts:48/79·fallback 없음·대형 transport라 reference), #6 ollama 자체 hardening 충분(ollama.ts:231/397). #3 helper 추출은 기계적으로 가능하나 broad all-provider healing은 false-positive 위험으로 unsafe → allowlist 설계가 별도 카드 필요. 억지 소형 채택 없음 확인.

## Implementation (this card = docs-only)

- NO JWC source/test change. (#3는 독립 카드로 분리하며, 그 카드에서 작은 JWC-native healer를 P부터 다시 설계.)
- 카드 본문에 closure 블록(per-feature 판정표 + audit 인용) 추가.
- 신규 백로그 카드 stub: leaked-reasoning-fence healing (generic, JWC-native, 보안표면) — 20.0xx 또는 10.0xx.

## Verification gate (docs-only)

- `git diff --check` clean.
- 인용 SHA(d20e6c082/093660f8b/bebdd22e6/f1063cdfb/d01bf079e) 전부 `git -C devlog/_omp_chase/oh-my-pi cat-file -e` resolve.
- 인용 JWC file:line 재확인(types.ts:197, openai-completions.ts:330, harmony-leak.ts).

## PABCD

- P: this plan.
- A: explorer audit (Anscombe, gpt-5.4) 완료 — 3 candidate verdict 확정. 추가로 무변경 결정의 타당성을 독립 reviewer로 challenge.
- B: 카드 closure 블록 작성 + 백로그 stub 카드 생성 (docs).
- C: SHA resolve + file:line 재확인 + git diff --check.
- D: 요약 + evidence attest.

## Feeds / depends

- depends: 10.054(_fin local provider), 10.055(_fin reasoning/harmony leak), 10.062(_fin DeepInfra+service-tier).
- feeds: 신규 leaked-fence-healing 카드(백로그), google-interactions 독립 카드 후보.
