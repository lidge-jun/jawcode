# Pre-drafted decision blocks (paste-ready per elicitation answer)

> Non-pre-emptive prep (independent-review verdict WAIT, 2026-06-27): nothing is written
> into a card here. When the user answers the elicitation, paste the matching block into the
> card's `## Confirmed decisions (2026-06-27 interview)` section, then close per disposition.
> Format mirrors the existing decided cards (e.g. `10.024`): a `| slot | confirmed value |`
> table for Decision A–H plus a free-text scope line.
> Slots: A=source classification (import/adapt/reject/split/defer) · B=JWC naming impact ·
> C=test impact · D=docs impact · E=rollout impact · F=residual risk · G=reviewer · H=bundle.

---

## Q1 `ref_batch` — 20.002 · 20.003 · 20.004 · 20.008  (recommended branch: **close_now**)

### 20.002 worker_catalog — `reject/reference`
| slot | confirmed value |
|------|-----------------|
| A | **reject** (pi-catalog 비채택 D4); omp workerHost는 M2 100 참조만 |
| B | none — JWC M2/Node 명명 유지; workerHost/pi-catalog는 소스 참조어 |
| C | manual evidence only — 코드 변경 없음 (100 MOC 링크 1줄) |
| D | chase only — `_fin/20/` 이동 + 20 MOC 행 |
| E | no migration |
| F | closed — pi-catalog 의식적 거부, workerHost는 M2 100에서 추적 |
| G | no |
| H | single-card commit |

Close: 100 MOC cross-ref 1줄 → `struct_har/chase/_fin/20/`.

### 20.003 memory_skills — `reference (covered by 99.01)`
| slot | confirmed value |
|------|-----------------|
| A | **reject/reference** — mnemopi는 99.01로 이미 구현; `.omp/skills`는 D5 cli-jaw 경로 |
| B | none — `.jwc/skills` + cli-jaw 명명 유지 |
| C | manual evidence only — 99.01 ✅ 근거 (`006 §99.01`) |
| D | chase only — `_fin/20/` + MOC |
| E | no migration |
| F | closed — 99.01 covers; `.omp/skills`는 D5로 의식적 라우팅 |
| G | no |
| H | single-card commit |

Close: 99.01 참고 1줄 → `struct_har/chase/_fin/20/`.

### 20.004 lsp_dap — `split (reference/defer)`
| slot | confirmed value |
|------|-----------------|
| A | **split** — 대부분 보류; jaw 선택-포팅 후보만 목록화 |
| B | none |
| C | manual evidence only — 후보/보류 목록 |
| D | chase only |
| E | no migration — 현재 구현 없음 |
| F | monitored — LSP/DAP 후보는 미래 선택 포팅 |
| G | no (docs); architecture if productized |
| H | single-card commit |

Close: 후보/보류 5줄 → `struct_har/chase/_fin/20/`.
**Branch `hold_lsp`**: keep active, no `_fin` move; A→pending, F→deferred.

### 20.008 pull_15_13_delta — `confirm as index card`
| slot | confirmed value |
|------|-----------------|
| A | — (routing index, not an import/adapt target) |
| B | none |
| C | manual evidence only — 라우팅 표 최신성 확인 |
| D | chase only — index 역할 유지; 다음 omp pull 시 갱신 |
| E | no migration |
| F | closed-as-index — 구현은 20.005/006/003/007 + 99.xx 레인이 소유 |
| G | no |
| H | index card |

**Resolves goal discrepancy**: 20.008은 구현 카드가 아니라 인덱스 → goal 큐에서는 "인덱스
확정"으로 처리(_fin 이동 선택), 그리고 **10.019(decided)를 goal 종료 큐에 추가** 권고.

---

## Q2 `code_card` — 10.013 assistant_msg_cache  (recommended branch: **adapt_now**)

### 10.013 — `adapt` (the only real-code card)
| slot | confirmed value |
|------|-----------------|
| A | **adapt** — `#contentBlocksCache` WeakMap + `#renderTextBlock`/`#renderThinkingBlock` 이식, JWC collapse 공존 |
| B | none — 내부 렌더 구현; 공개 명령/상태 영향 없음 |
| C | **new focused test** — thinking expand/collapse가 캐시와 공존(캐시 키=content-block identity, collapse 상태 무관) 회귀 |
| D | chase only (+ devlog cycle 기록) |
| E | no migration — 순수 렌더 성능 |
| F | monitored — collapse 상태 ↔ 캐시 키 충돌 회귀 감시 |
| G | frontend/architecture (TUI 렌더) |
| H | PABCD bundle — 단일 카드 작은 PABCD 사이클 |

Source evidence: gjc `assistant-message.ts:21,110,128`; jwc lacks it; jwc collapse
`#thinkingExpanded`(L21)/`setThinkingExpanded`(L59). Close: tsc/test/diff 게이트 → `_fin/10/`.
**Branch `defer_p3`**: A=adapt(방향만), F=deferred(P3), active 유지·`_fin` 보류.
**Branch `investigate`**: A=pending, 별도 충돌-조사 후 adapt/reject 재결정.

---

## Q3 `ref_design` — 10.020 · 10.025 · 20.007 · 10.006  (recommended branch: **ref_close**, except 10.006)

### 10.020 deep_interview_semantics — `reference-only / split`
| slot | confirmed value |
|------|-----------------|
| A | **split** — deep-interview SKILL/ralplan 체리픽 거부; scoring/recorder 패턴만 jaw-interview로 translate(별도) |
| B | state path — `jaw-interview` slug·`.jwc/specs/`·mutation guard 불변 |
| C | manual evidence only (this pass) — adopt/reject 목록 문서화 |
| D | chase only — 패턴 채택은 별도 jaw-interview devlog 소유 |
| E | no migration |
| F | monitored — 패턴 이식은 jaw-interview PABCD로 분리 |
| G | backend/architecture (패턴 이식 시) |
| H | split — reference 확정 now, pattern adapt는 별도 카드 |

Close: adopt/reject 증거 문서화 → `_fin/10/`. **Branch `spinoff`**: + 후속 jaw-interview adapt 카드/devlog 발행.

### 10.025 perf_corpus_geobench — `reference / split`
| slot | confirmed value |
|------|-----------------|
| A | **split** — geobench YAML 복사 거부; threshold ledger 패턴만 |
| B | none |
| C | manual evidence only — 채택 게이트 결정 doc |
| D | chase only (+ optional 99.02 CI ledger) |
| E | no migration |
| F | monitored — ledger 패턴은 99.02 옵션 |
| G | no (docs); data/devops if ledger productized |
| H | split — reference now, ledger→99.02는 옵션 spinoff |

Close: 채택 게이트 결정 doc → `_fin/10/`. **Branch `spinoff`**: + 99.02 ledger 카드.

### 20.007 session_modularization — `reference-only`
| slot | confirmed value |
|------|-----------------|
| A | **reject (1:1 copy) / reference** — OMP 모듈 경계 채굴만, `session-manager.ts` 대이식 금지 |
| B | none |
| C | manual evidence only — OMP module→jwc symbol map sketch |
| D | chase only |
| E | no migration — close에 behavior change 불필요 |
| F | monitored — 미래 refactor 시 참조 |
| G | architecture (refactor 시) |
| H | split — reference sketch now, refactor는 별도 PABCD |

Close: module→symbol map sketch → `_fin/20/`. **Branch `spinoff`**: + refactor devlog.

### 10.006 tui_core — `defer (gated behind 082/083)`
| slot | confirmed value |
|------|-----------------|
| A | **defer** — upstream tui 버그픽스는 082/083 분리 후에만; abyss-bite·99.03 HUD 금지 |
| B | none |
| C | focused test (unblock 시) — `diff -qr packages/tui` ≤10줄 후 _fin |
| D | chase only |
| E | no migration |
| F | deferred — 082/083 게이트 이후로 보류 |
| G | frontend (unblock 시) |
| H | single-card (deferred) |

Note: 10.006은 게이트 때문에 즉시 `_fin` 부적합 → "**defer 확정**"으로 기록하고 active 유지
(082/083 분리 완료 후 별도 close). `ref_close`/`defer` 어느 답이든 동일 처리.

---

## Post-answer execution order (once user answers)

1. Paste matching block into each card → commit `docs(chase): record 2026-06-27 directions`.
2. `reference/reject` cards (per disposition) → evidence line + move to `_fin/{10,20}/`,
   update `10_/20_` MOC + `007_follow_index.md`.
3. Goal-list reconcile: add 10.019, settle 20.008 as index.
4. `adapt` cards (10.013 if adapt_now) → join close-queue, run tiny PABCD per card.
