# 260701 chase ① tier 구현 루프 — slice map (00_INDEX)

> Goal `f8909338-255` · 2026-07-01 · 다회전 PABCD 루프 (15 work-phase)
> 전제: 잘못 주입된 lazygap_impl(84059fb7-f18) 정정. ② 결정 인터뷰(theme7)에서 ①로 격하된 15 카드를 **실제 JWC 코드**로 구현→검증→_fin.
> 산출물 전환: chase 지금까지=문서, 이번부터=**코드 구현**.

## 루프 규칙
- 1 카드 = 1 FULL PABCD 사이클(P→A→B→C→D --attest). 끝나면 IDLE→다음 카드 P.
- A phase: 독립 리뷰(employee/sub-agent)로 모순·블로커 검증.
- 게이트: focused test + `bun run check:ts` (또는 워크스페이스 focused) + `git diff --check`.
- 카드 완료: status→✅, MOC row, _fin/10|20 이전, 007/009 인덱스, cycle changelog 갱신.
- 카드별 atomic 커밋. OMP 카드는 1:1 port 금지(JWC식 재설계). JWC 네이밍/identity 보존. push 금지.

## Work-phase 순서 (의존성 기반)

### 클러스터 A — AI provider (먼저)
| WP | card | 판정 | 1차 타깃 파일 (조사 기준) |
|----|------|------|------|
| 1 ✅ | 10.054 local provider discovery | IMPORT ✅ _fin 260701 | `packages/coding-agent/src/cli/local-provider-smoke.ts`(NEW), `commands/local-provider.ts`(NEW), `slash-commands/builtin-registry.ts`, `session/agent-session.ts` |
| 2 | 10.062 DeepInfra + Gemini UA | IMPORT | `packages/ai/src/` provider/oauth, `models.json`(additive) |
| 3 | 20.023 providers/catalog/service-tier | IMPORT/ADAPT | `packages/ai/src/` (service-tier, reasoning-heal), catalog 보존 머지 |
| 4 | 20.019 codex/AI config | ADAPT | config 표면 (기본값 JWC) |

### 클러스터 B — 세션 무결성
| WP | card | 판정 |
|----|------|------|
| 5 | 20.009 append-only context integrity | IMPORT |
| 6 | 20.021 v2 streaming integrity | IMPORT (회귀가드) |
| 7 | 20.025 snapcompact/session-scope | IMPORT (.jwc 마이그레이션 주의) |
| 8 | 20.020 session title/idle recap | ADAPT |

### 클러스터 C — goal/interview UX
| WP | card | 판정 |
|----|------|------|
| 9 | 10.059 ralplan ask gate + render guard | ADAPT(gate)+IMPORT(guard) |
| 10 | 10.042 deep-interview ask+goal-state | ADAPT |

### 클러스터 D — 정체성 (content always JWC-authored)
| WP | card | 판정 |
|----|------|------|
| 11 | 10.065 prompt self-awareness | ADAPT |
| 12 | 20.027 prompts/subagent/discovery | ADAPT (이름 JWC) |

### 클러스터 E — 단독
| WP | card | 판정 |
|----|------|------|
| 13 | 10.019 jwc gc | ADAPT |
| 14 | 20.028 web-search provider settings | IMPORT |
| 15 | 10.048 dev/CI/release packaging | ADAPT |

## 진행 ledger
- [x] WP1 10.054 local provider (A: CLI/discovery, B: slash+session fallback) — ✅ _fin
- [x] WP2 10.062 provider DeepInfra+Gemini — ✅ _fin
- [x] WP3 20.023 providers/catalog/service-tier — ✅ _fin
- [x] WP4 20.019 codex/AI config — ✅ _fin
- [x] WP5 20.009 append-only integrity — ✅ _fin
- [x] WP6 20.021 v2 streaming integrity — ✅ _fin
- [x] WP7 20.025 compaction snapshot caps — ✅ _fin
- [x] WP8 20.020 session title casing — ✅ _fin
- [x] WP9 10.059 interview wording + ask gate + render guard — ✅ _fin
- [x] WP10 10.042 deep-interview ask+goal-state — ✅ _fin (ADAPT: round-shape write guard, 5 sub-features already-covered)
- [x] WP11 10.065 prompt self-awareness — ✅ _fin (ADAPT, identity-safe)
- [x] WP12 20.027 (정체성: subagent 이름) — ✅ _fin (ADAPT: 1 ADOPT #5 agent-param optional+default, 5 defer/reject; OMP reference-only)
- [ ] WP13 10.019 jwc gc (ADAPT) — next
- [ ] WP14 20.028 · WP15 10.048 (단독) — pending

각 WP 상세 diff-level 플랜은 해당 사이클 P phase에서 `NN_phaseN_<card>.md`로 작성.
