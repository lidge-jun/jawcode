# 260612 browse — tool schema slimming + browse skill

> 상태: **MVP 구현 완료 ✅** (260613) — browse skill 등록 + browser.md 축소 + token 측정 + smoke 검증
> 목적: `browser` tool 정의를 얇게 만들고 긴 조작 지침을 `browse` skill로 지연 주입한다.
> 비목표: 기존 MVP/web-ai 빌딩 폴더로 흡수하지 않는다. `browse`는 독립 브라우저 조작·진단 트랙이다.
> **확장 (260613)**: 이 패턴(hidden bundled skill로 tool guidance 분리)을 search, web-ai에도 적용. cli-jaw A1 tool 섹션 조건부 축소의 전제 작업.

## Jawdev layout

| 문서 | 역할 | 상태 |
|---|---|---|
| [000_moc_browse.md](./000_moc_browse.md) | 범위, 결정, 통합 원칙 | 스캐폴딩 ✅ |
| [010_plan_tool_slimming.md](./010_plan_tool_slimming.md) | `browser` tool description/schema 축소 실행안 | 스캐폴딩 ✅ |
| [020_skill_definition/SKILL.md](./020_skill_definition/SKILL.md) | 최소 `browse` skill 초안 | 스캐폴딩 ✅ |
| [030_subagent_review.md](./030_subagent_review.md) | planner/architecture/critic 점검 통합 기록 | 반영 완료 ✅ |

## Current decision

- Fork policy: 기존 “번들 기본 workflow skill 4개 제한”은 이 트랙에서 제품 제약으로 보지 않는다.
- 그래도 `browse`는 workflow skill이 아니라 **tool usage skill**로 취급한다.
- 기본 context 절감이 1차 목표다. 런타임 통합(cli-jaw/AGBrowse backend)은 후속 트랙이다.
- ~~현재 폴더의 MVP는 계획 문서 스캐폴딩~~ → **구현 완료** (260613). `browser.md` 72→14줄, `.describe()` 18개 제거, browse skill `hide:true` 등록, token 4,500→2,965 (34% 감소).
- **포팅 완료** (260613): search skill (`hide:true` standalone) + web-ai (`browse:web-ai` fragment). 130 Scope A 선행 작업 완수.
- **커버리지 갭 감사** (260613): cli-jaw 대비 jwc 스킬 미보강 9건 식별 (130.2 §6 참조). 높음: snippet verification / tier escalation / role separation. 중: evidence status / question envelope / escalation ladder / Korean protocol.

## Subagent review — 260612

| reviewer | verdict | 반영 |
|---|---|---|
| sequence planner | 방향 적합, 실행 전 보강 필요 | B0 inventory, 측정 기준, skill discovery 경계 추가 |
| architecture planner | workflow skill 경계와 deferred-loader 계약 보강 필요 | `browse`를 non-workflow tool-help artifact로 고정 |
| critic | NEEDS_FIX → 문서 보강 필요 | rollback, token measurement, verification, path decision 추가 |
