# 260612 searchengine — swappable web search provider surface

> 상태: 스캐폴딩 ✅
> 목적: Exa 중심/오염 fallback에서 벗어나 ChatGPT native search 또는 active-model native search를 기본으로 쓰고, 사용자가 `/SEARCHENGINE`로 즉시 갈아끼우게 한다.
> 비목표: 검색 provider 런타임 전체 재작성. 기존 `web_search` unified provider 계층을 재사용한다.

## Jawdev layout

| 문서 | 역할 | 상태 |
|---|---|---|
| [000_moc_searchengine.md](./000_moc_searchengine.md) | 범위, 결정, MVP | 스캐폴딩 ✅ |
| [010_research_current_web_search.md](./010_research_current_web_search.md) | 현재 구현 실사 | 스캐폴딩 ✅ |
| [020_plan_searchengine_slash.md](./020_plan_searchengine_slash.md) | `/SEARCHENGINE` slashline 설계 | 스캐폴딩 ✅ |
| [030_provider_matrix.md](./030_provider_matrix.md) | provider별 search 지원/교체 범주 | 스캐폴딩 ✅ |
| [040_deep_research_implementation_notes.md](./040_deep_research_implementation_notes.md) | slash wiring/provider behavior 심화 리서치 | 리서치 진행 ✅ |
| [050_subagent_review.md](./050_subagent_review.md) | 서브에이전트 점검 및 반영 결정 | 리뷰 반영 ✅ |
| [060_patch_outline.md](./060_patch_outline.md) | `/SEARCHENGINE` MVP 실제 패치 윤곽 | 구현 전 설계 ✅ |

## Current finding

이미 `providers.webSearch` 설정과 `setPreferredSearchProvider()` 런타임 preference가 있다. `auto`는 active model provider의 native search를 우선하고, 없으면 DuckDuckGo로 fallback한다. 즉 핵심 패치는 새 검색 엔진을 처음 만드는 게 아니라 **선택 표면과 기본 정책을 정리**하는 일이다.

## Desired operator UX

```text
/SEARCHENGINE                 # 현재 엔진 + 후보 목록
/SEARCHENGINE auto            # active model native search → DuckDuckGo fallback
/SEARCHENGINE chatgpt         # alias: codex/OpenAI native web_search
/SEARCHENGINE codex           # same as OpenAI native provider
/SEARCHENGINE duckduckgo      # keyless fallback
/SEARCHENGINE off             # optional future: disable web_search tool preference
```

---

## Phase 2 — 검색 모델 선택 (070–075)

1차 슬래시/provider swap 후속: 각 provider 검색의 **모델**을 네이티브 대조·실측 벤치로 정함 + deep tier 설계. 인덱스: [000_moc_searchengine.md](./000_moc_searchengine.md) §Phase 2.
