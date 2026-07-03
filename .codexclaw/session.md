# IPABCD Session — ② chase 카드 결정 인터뷰

## Goal (draft)
②(기능 결정 필요) 18개 active chase 카드의 Decision Slots(A-H)를 인터뷰로 확정 →
"①(기능 결정 없이 따라갈 수 있음)" 또는 "③(백로그)"로 재분류. import/adapt/reject/split 판정 기록.

## Scope candidates (18)
- 정체성: 10.065, 20.027
- AI provider/catalog: 10.062, 10.054, 20.023, 20.019
- 세션/compaction/상태: 20.025, 20.020, 20.021, 20.009
- oauth/보안: 20.024
- goal/interview UX: 10.042, 10.059
- 신규 표면/명령: 10.019, 10.027, 10.044
- 패키징: 10.063, 10.048
- 검색: 20.028

## Dimensions
- Goal: ?
- Constraint: ?
- Success: ?
- Ontology: 카드 Decision Slots A-H (이미 정의됨)

## Direction (confirmed 2026-07-01)
- deliverable = decision_only (문서만; Decision Slots A-H 확정 + ①/③ 재분류; JWC 코드 무변경)
- identity = behavior_adapt_content_reject (self-grounding 동작 채택, 문구/이름 JWC 재작성)
- grouping = theme7

## 7 Themes
1. 정체성: 10.065, 20.027
2. AI-provider/catalog: 10.062, 10.054, 20.023, 20.019
3. 세션/compaction/상태: 20.025, 20.020, 20.021, 20.009
4. oauth/보안: 20.024
5. goal/interview UX: 10.042, 10.059
6. 신규표면/명령: 10.019, 10.027, 10.044
7. 패키징·검색: 10.063, 10.048, 20.028

## State: I (INTERVIEW) — theme-by-theme questioning

## Decisions locked (round 2, 2026-07-01)
### Theme 1 정체성 — identity_depth=adapt_to_tier1
- 10.065 prompt self-awareness: Decision A=ADAPT (grounding 동작 채택, content는 JWC-authored 가드). → ① 격하, 단 "content always JWC-authored" 불변식 명시.
- 20.027 prompts/subagent/discovery: Decision A=ADAPT (discovery-rules/loop-guard ①), subagent 이름은 JWC 네이밍 재작성. → ① 격하 (identity content reject).
### Theme 2 AI provider — provider_direction=multi_additive, config_defaults=adapt_jwc_defaults
- 10.062 DeepInfra+Gemini UA: Decision A=IMPORT (additive provider + Gemini UA 정합성). → ①
- 10.054 local provider discovery: Decision A=IMPORT (멀티프로바이더 적극). → ①
- 20.023 providers/catalog/service-tier: Decision A=IMPORT/ADAPT (service-tier+reasoning-heal additive, catalog 머지 주의). → ①
- 20.019 codex/AI config: Decision A=ADAPT (동작 골격 채택, 기본값/네이밍 JWC). → ①

## NOTE: goal collision — lazygap_impl(84059fb7-f18) 주입됨. 사용자는 chase-card 인터뷰 지속 중. chase 인터뷰 우선.

## Decisions locked (round 3, 2026-07-01)
### Theme 3 세션/상태 — session_state=integrity_import_ux_adapt
- 20.021 v2 streaming integrity: IMPORT (무결성). → ① (회귀가드 명시)
- 20.009 append-only context integrity: IMPORT (무결성). → ①
- 20.025 snapcompact/session-scope: IMPORT (branch-scoping/key-identity 무결성). → ① (.jwc 마이그레이션 주의)
- 20.020 session title/idle recap: ADAPT (UX). → ①
### Theme 4 oauth/보안 — oauth_security=adapt_review_gate
- 20.024 MCP oauth/reauth: ADAPT + 독립 보안리뷰 게이트. → ②에 'adapt+security-review' 유지 (① 격하 안 함)
### Theme 5 goal/interview UX — goal_interview_ux=adapt_guard_import
- 10.042 deep-interview ask+goal-state: ADAPT (ask gate, JWC 인터뷰 흐름). → ①
- 10.059 ralplan ask gate + render guard: ask gate=ADAPT, render undefined guard=IMPORT. → ①

## Decisions locked (round 4, 2026-07-01)
### Theme 6 신규표면 — new_surface=gc_adapt_rest_defer
- 10.019 jwc gc 명령: ADAPT (lock/orphan GC 운영가치). → ①
- 10.027 goal live-artifact 검증엔진: DEFER. → ③
- 10.044 plugin extensibility: DEFER. → ③
### Theme 7 패키징·검색 — packaging_search=search_import_ci_adapt_natives_defer
- 20.028 web-search provider settings: IMPORT (DDG scrape+provider settings). → ①
- 10.048 dev/CI/release packaging: ADAPT. → ①
- 10.063 natives 플랫폼 분리: DEFER (대형 배포아키텍처). → ③

## FINAL classification (19 cards — 원래 목록이 19개였음, 누락 0)
### → ① (기능결정 없이 follow 가능, 13장)
10.065(adapt·content-JWC), 20.027(adapt·name-JWC), 10.062(import), 10.054(import), 20.023(import/adapt),
20.019(adapt), 20.021(import), 20.009(import), 20.025(import·migration주의), 20.020(adapt),
10.042(adapt), 10.059(adapt+import), 10.019(adapt), 20.028(import), 10.048(adapt)

### → ② (adapt + 게이트 유지, 1장)
20.024 (adapt + 독립 보안리뷰 게이트)
### → ③ (백로그, 3장)
10.027, 10.044, 10.063
