# 080 — plan: 검색 세부 설정 UX (fast/deep·추론값·provider 세팅)

> 상태: ⬜ 설계 (260613).
> 상위: [000 MOC](./000_moc_searchengine.md) · [074 parity](./074_decision_model_parity.md) · [075 deep](./075_design_deep_search_tier.md).
> 입력: 사용자 — "뭐 누르면 창 바뀌고 fast랑 deep 그리고 추론 값을 바꿀 수 있는 세팅".

## 1. 사용자 경험 (목표)

`/searchengine` 셀렉터가 이미 떠 있는 상태(스크린샷: provider 목록 + `(2/11)`)에서:

1. **provider를 고른다** (Enter — 기존 동작 유지)
2. **세부 설정에 들어간다** (키 → pane 전환) — fast/deep tier · 추론 effort · provider별 옵션

### 세부 설정 pane 내용

```
┌─ Web search settings ─────────────────────────────┐
│  Provider: chatgpt (codex)                         │
│                                                    │
│  Depth          [ fast ● | deep ]                  │
│  Reasoning      [ none ● | low | medium | high ]   │
│  Context size   [ low | medium | high ● ]          │
│                                                    │
│  ⏎ apply  ·  esc back  ·  space provider list      │
└────────────────────────────────────────────────────┘
```

- **Depth**: fast(기본, 60s 동기) / deep(180s async, 무거운 모델)
- **Reasoning effort**: none(기본, non-thinking) / low / medium / high (deep 시 high 강제 가능)
- **Context size**: search_context_size (codex provider)

## 2. 키 선택 — `space` (셀렉터 내 pane 전환)

**모델 셀렉터 패턴 동형**: `/model` 셀렉터에서 `space`가 Models↔Profiles 탭 전환(`model-selector.ts:861` `"space to switch pane"`)으로 이미 쓰여요. `/searchengine`도 같은 패턴:

- **space**: provider 목록 ↔ 세부 설정 pane 전환
- 새 글로벌 키 안 먹음 — 셀렉터 내부 키로만 동작
- 기존 `SelectList`에서 space는 Enter와 동의어(select)가 아님(Enter만 select 트리거)

### 대안 검토 (기각)

| 키 | 문제 |
|---|---|
| `alt+s` | 셀렉터 밖에서도 먹히는 글로벌 키 — 셀렉터 내 설정에만 필요한데 과잉 |
| `tab` | 일부 터미널에서 자동완성과 충돌 |
| `→` (right arrow) | drill-down 느낌이지만 SelectList가 가로 키를 안 씀 — 혼란 |

## 3. 구현 방향

### 3-A. `showSearchEngineSelector` 확장

`selector-controller.ts`의 `showSearchEngineSelector()` — 현재: `Container` + `SelectList`(provider).

확장: **2-pane Container** — pane 0(provider list, 기존) + pane 1(settings form). `space`로 토글.

pane 1은 **3개 세그먼트 컨트롤** (Depth·Reasoning·ContextSize) — `showEffortSelector`의 `SelectList` 대신 세그먼트(`←/→`로 값 변경, `Enter`로 적용). 기존 패턴: 모델 셀렉터의 profiles pane이 폼 형태.

### 3-B. settings 영속

변경은 **settings에 저장** (세션 재시작 후에도 유지):
- `providers.webSearch.depth` = `"fast" | "deep"` (기본 fast)
- `providers.webSearch.reasoningEffort` = `"none" | "low" | "medium" | "high"` (기본 none)
- `providers.webSearch.contextSize` = `"low" | "medium" | "high"` (기본 high)

설정 키는 `web_search.*` 네임스페이스 아래 — 기존 `web_search.enabled` 이웃.

### 3-C. deep tier 자동 연동

settings에 `depth=deep`이 저장되면 → `WebSearchTool.execute`가 `params.depth`를 세팅값으로 override (LLM이 안 넣어도 세팅이 deep이면 deep으로). LLM이 명시하면 LLM 값 우선(런타임 > 세팅).

## 4. hint line

셀렉터 하단에 `space settings · ⏎ select · esc close` 힌트 (모델 셀렉터 동형).

## 5. 슬라이스

| # | 작업 |
|---|---|
| S1 | settings schema에 `web_search.depth/reasoningEffort/contextSize` 추가 |
| S2 | `showSearchEngineSelector` 2-pane 확장 (space 토글 + settings form) |
| S3 | `WebSearchTool.execute`가 settings 기본값 읽기 (LLM 미지정 시) |
| S4 | `/searchengine` hint line 갱신 |

## 6. 결정 (260613 사용자 확정)

| 질문 | 결정 |
|---|---|
| 접근 경로 | **`/searchengine` 안에서만** — space pane 전환. 별도 커맨드 없음, /settings에도 미노출. 검색 관련은 /searchengine 한 곳 수렴 |
| deep reasoning | **high 기본 + 사용자 override 허용** — deep 시 기본 high이지만, 사용자가 세부 설정 pane에서 deep용 reasoning을 따로 고르면 그걸 존중 |
| 영속 | **settings.json 영속** — 세션 재시작·jwc 재기동 후에도 유지. pane에서 바꾸면 settings.json에 저장 |
| provider 분기 | **현재 선택된 provider 기준 동적 표시** — codex면 contextSize 행 보이고, claude면 안 보임. pane이 provider에 따라 달라짐 |

## 7. 추가 결정 (260613)

| 질문 | 결정 |
|---|---|
| 키보드 조작 | **↑/↓ 행 이동 · ←/→ 값 변경 · Enter 확정** |
| 적용 방식 | **Enter로 확정** (즉시 아님 — 실수 방지) |
| reasoning 키 | **통합 `web_search.reasoningEffort` 1개** — depth별 분리 안 함. deep tier는 코드에서 `max(사용자값, "high")` floor 적용 (fast=none 기본·deep=high 최소 보장, 사용자가 medium이면 fast=medium·deep=high) |

## 8. settings.json 키 (최종)

```jsonc
{
  "web_search.depth": "fast",              // "fast" | "deep"
  "web_search.reasoningEffort": "none",    // "none" | "low" | "medium" | "high"
  "web_search.contextSize": "high"         // "low" | "medium" | "high" (codex only)
}
```

키 3개. pane에는 provider별 동적 표시(codex 아니면 contextSize 숨김).

deep tier reasoning floor 로직:
```typescript
const userEffort = settings.get("web_search.reasoningEffort") ?? "none";
const effectiveEffort = depth === "deep"
  ? EFFORT_ORDER.indexOf(userEffort) >= EFFORT_ORDER.indexOf("high") ? userEffort : "high"
  : userEffort;
```

## 9. 미해결

- ACP 경로에서 settings form 미노출 (headless는 env/settings.json으로만)
- pane 힌트 라인 구체 문구 (구현 시 확정)
