# 000 MOC — browse skill + browser tool slimming

> 상태: 🟢 MVP 구현 완료 (260614) — 4.5K→1.4K tokens (69% 절감)
> 입력: 사용자 지시 “browse tool 정의를 대폭 줄이고 + browse 스킬로 주입” (260612)
> 소유: `packages/coding-agent` browser tool prompt/schema surface

## 문제

현재 `browser` tool은 매 LLM 요청에 긴 description과 중첩 schema를 싣는다.
실측 기준 대략 `browser` 단독 약 4.5K tokens이며, 대부분은 다음 둘이다.

| 항목 | 원인 | 대략 |
|---|---|---:|
| description | `packages/coding-agent/src/prompts/tools/browser.md` 긴 지침/예제 | ~1.8K |
| schema | `browser.ts` zod object + nested `actions[]` descriptions | ~2.7K |

이 지침은 브라우저 작업이 실제로 필요할 때만 유용하다. 평시 기본 context에 상주시킬 이유가 약하다.

## 결정

`browser` tool 정의는 **짧은 affordance + 최소 schema**로 축소하고, 긴 사용법은 `browse` tool-help artifact로 이동한다.

- tool description: “브라우저 open/run/act/close 가능, 자세한 조작 전략은 browse tool-help” 수준으로 축소.
- tool schema: 1차는 `.describe()` 제거/축약만 한다. `actions` compact envelope는 1차 구현 범위 밖의 별도 결정이다.
- browse guidance: observe-first, act verbs, raw JS escape hatch, screenshots, attached app 같은 **현재 jwc browser contract**만 MVP skill text에 둔다.
- product boundary: `browse`는 workflow skill이 아니다. 런타임 경로가 정해지기 전까지 정본 초안은 `devlog/_plan/260612_browse/020_skill_definition/SKILL.md`이며, 구현 시에도 별도 승인 없이는 fifth bundled workflow skill이나 public `/skill:browse` entrypoint를 추가하지 않는다.

## 범위

### 포함

- `browser` tool prompt slimming.
- `browser` schema token audit + low-risk 축약.
- `browse` skill 초안 추가(현재는 devlog draft만).
- 회귀 측정: context usage에서 Tools token 감소 확인.

### 비포함

- cli-jaw web-ai 전체 이식.
- ChatGPT/Gemini/Grok 세션/watch/code artifact 런타임 통합.
- AGBrowse backend 선택 기능.
- Playwright/Puppeteer 런타임 교체.

## 단계

| 단계 | 산출물 | 완료 기준 |
|---|---|---|
| B0 | inventory/parity | 기존 `browser.md` 지침을 browse draft로 빠짐없이 옮길 항목 목록화 |
| B1 | browser prompt slim | `browser.md`가 짧은 tool affordance만 남김 |
| B2 | browse tool-help artifact | 선택된 non-workflow 경로가 조작법/예제를 보유 |
| B3 | schema audit | tool token estimate 전후 수치 기록 |
| B4 | optional schema compact | nested action schema 축약 여부를 별도 follow-up으로 결정 |

## 검증

- Token measurement: `browser` 단독 token estimate와 active tools 합계를 before/after로 기록한다.
- Pass target: 1차 구현은 `browser` 단독 추정치를 기존 약 4.5K에서 2.5K 이하로 낮추는 것을 목표로 하며, 미달 시 원인을 기록한다.
- 최소 smoke: `browser open` → `act[{verb:"observe"}]` → `close`가 실패 없이 동작한다.
- skill/manual scenario: browse guidance를 주입한 뒤 모델이 `observe` 우선, stale id 재관찰, `run` escape hatch 기준을 설명/선택할 수 있어야 한다.

## 열린 질문

| 질문 | MVP 결정 |
|---|---|
| `browse` skill placement | devlog draft만 생성. 구현 시 non-workflow tool-help 경로를 먼저 정하고, public workflow skill로 등록하지 않는다. |
| `browser.act.actions[]` compact schema | 1차 구현 범위 밖. `.describe()` 축약 후에도 token이 과하면 별도 문서에서 결정한다. |
| `console/network`, `vision-click`, `adaptive-fetch` | MVP skill에는 현재 jwc browser contract만 둔다. cli-jaw/AGBrowse 기능은 follow-up runtime track으로 분리한다. |

## Rollback

구현 후 회귀가 생기면 `packages/coding-agent/src/prompts/tools/browser.md`, `packages/coding-agent/src/tools/browser.ts`, 선택된 browse tool-help 파일, 그리고 관련 routing/settings 변경을 직전 상태로 되돌린다. 기록된 token baseline은 삭제하지 말고 rollback 근거로 남긴다.
