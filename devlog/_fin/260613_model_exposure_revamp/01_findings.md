# P0 조사 결과 종합 (Q1~Q8)

> 상태: ✅ 조사 완료 (260613, Sonnet 서브에이전트 4기 병렬 + 메인 세션 라이브 조회).
> 소속: [00_plan.md](./00_plan.md). 각 절 끝의 앵커는 서브에이전트가 코드에서 직접 검증한 위치.

## 1. Q1·Q2 — codex/spark: cli-jaw는 정적 목록 + 런타임 파라미터 조정

- cli-jaw는 `chatgpt.com/backend-api/codex/models`를 **호출하지 않는다**. 모델 목록은 전부
  정적 하드코딩: `gpt-5.5, gpt-5.4, gpt-5.4-mini, gpt-5.3-codex, gpt-5.3-codex-spark,
  gpt-5.2-codex, gpt-5.1-codex-max, gpt-5.1-codex-mini` (`cli-jaw/src/cli/registry.ts:109`).
  `supported_in_api` 개념 자체가 없다.
- **spark는 전 UI에 노출**하되 런타임에서 조정한다 (`cli-jaw/src/agent/args.ts:8,241-260`):
  reasoning 파라미터 **전부 미전송** (서버가 400 `unsupported_parameter` 반환,
  `core/employees.ts:277-280` 주석), `model_context_window=128000` +
  `auto_compact_token_limit=110000` 고정, 세션 버킷 `codex-spark` 분리 (`args.ts:165`).
- **`codex-auto-review`는 cli-jaw에 완전 부재** (검색 0건) — 노출하지 않는 모델.
- 모델명 유효성 검사 없음 — 잘못된 모델은 서버 에러로 처리.
- **jwc와의 차이 결론**: jwc 디스커버리의 `supported_in_api===false` 필터(`codex.ts:255`)가
  spark를 떨어뜨리는 것은 **오독** — 이 플래그는 API 플랫폼 가용성이지 ChatGPT-OAuth
  전송로 가용성이 아니다. 단 spark 노출 시 reasoning 미전송 가드가 동반되어야 한다.
- gpt-5.3-codex: cli-jaw는 정적 노출하지만 **본 계정 백엔드 응답(0.139.0)에는 부재** —
  계정/플랜별 차이로 추정. 디스커버리를 진실로 삼으면 자연 처리된다.

## 2. Q3 — xai: progrok도 클라이언트 필터 없음, 정규 목록은 capabilities.ts

- progrok는 **클라이언트 화이트리스트가 없다** — `/v1/models` 응답을 그대로 통과시키고
  접근 제어는 xAI 서버(계정/구독)가 한다 (`05_progrok/src/commands/models.ts:43-77`).
- 사람/에이전트용 정규 지원 목록 = `src/commands/capabilities.ts:209-350`:
  - 채팅: **grok-4.3**(기본·1M·앨리어스 다수), **grok-4.20-0309-reasoning**,
    **grok-4.20-0309-non-reasoning**, **grok-4.20-multi-agent-0309**(Responses API 전용),
    **grok-build-0.1**, grok-composer-2.5-fast(히든·`/v1/models` 미노출),
    grok-composer-2.5(팀 전용)
  - 이미지 2종(grok-imagine-image±quality) · 비디오 2종 · 보이스 3종 — 채팅 셀렉터 비대상.
- `grok-4-1-fast`→`grok-4.3` 응답은 **xAI 서버측 앨리어스 해석** (클라이언트 매핑 없음).
- `cli-chat-proxy.grok.com`은 billing/user 전용 — 모델 게이팅과 무관.
- jwc 디스커버리(`api.x.ai/v1/models` 26종)는 레거시 앨리어스(grok-2/3/4 구형)까지 전부
  노출 중 → **정적 allowlist 교집합**이 필요한 provider.

## 3. Q4·Q5 — agy·anthropic: 둘 다 디스커버리 경로 보유

- **google-antigravity**: 서버 진실 소스 있음 — `daily-cloudcode-pa.googleapis.com
  /v1internal:fetchAvailableModels` (OAuth Bearer, `utils/discovery/antigravity.ts:6-10`).
  `isInternal` 제거(`:220`) + 5종 denylist(`:14-20`). 번들 15종은 폴백인데 **denylist 모델
  (gemini-3-pro-low, gemini-2.5-pro)이 번들에 들어 있는 모순** — 디스커버리 기반 마킹으로
  자연 해소 가능.
- **anthropic**: `api.anthropic.com/v1/models` 디스커버리가 **OAuth 토큰으로도 동작**
  (`sk-ant-oat` 감지 → `Authorization: Bearer`, `openai-compat.ts:116-129`). 단 이 API는
  token limit을 안 줘서 번들이 메타데이터 canonical (`openai-compat.ts:138-146`). 번들
  19종(3-5-sonnet 구형 포함) 전부 노출 중이고 **auth 타입별 필터링은 현재 없음**.
- allowlist가 들어갈 자리: ① `staticModels` 오버라이드 ② `fetchDynamicModels` 래퍼 필터
  (antigravity가 이미 이 패턴) ③ openai-compat의 `filterModel` 콜백.

## 4. Q7 — 캐시: staticFingerprint는 models.json 변경에만 반응

- fast path 5조건 (`model-manager.ts:130-138`): 비fetch + fresh(TTL 2h) + authoritative +
  fingerprint 일치 → 캐시 그대로 서빙.
- fingerprint = `Bun.hash(JSON.stringify(staticModels))` — **번들(models.json) 변경 시에만
  bust**. `fetchDynamicModels` 내부 필터 같은 **코드 변경은 bust 안 됨** → TTL 2h 경과 후
  재fetch에서야 반영. 마이그레이션은 최대 2시간 지연으로 자연 해소 (강제는 `online`
  refresh 또는 캐시 행 삭제).

## 5. Q8 — 2분할: 기존 선례 2개, ~+50행 최소 침습

- 선례: `help-selector.ts:155-193` `PaneComponent`+수동 zip, `agent-dashboard.ts:298-328`
  `TwoColumnBody`. TUI에 2D 레이아웃 프리미티브는 없음 — 행 zip 방식이 관례.
- 변경셋 (~+50행): pane 필드 3개(`#activePaneId`/인덱스 2개), `#updateList` ALL 탭 분기,
  신규 `#buildAllTabPane(width)`(zip ~35행), `#getSelectedItem` 분기, up/down 분기,
  **←/→는 ALL 탭에서만 페인 포커스로 인터셉트** (탭 전환은 tab/shift+tab 유지 —
  `TabBar.handleInput`이 left/right도 먹고 있으므로 순서 조정 필요, `model-selector.ts:920`).
- 테스트 하네스 호환: `selector.render(220).join("\n")` + `normalizeRenderedText` 패턴
  그대로 사용 가능 (`test/model-selector-*.test.ts`).

## 6. ⚠ 설계 수정 — "제거"가 아니라 "마킹"이어야 한다

P0 전 가설(디스커버리 성공 시 번들 id **제거** = 보류 초안 `dynamicReplacesStatic`)은
**ctrl+o 트리거와 양립 불가** — registry에서 지워버리면 ctrl+o로 펼칠 대상이 없다.

수정안: **모델은 전부 보유하되 `Model`에 미지원 마킹** (가칭 `unlisted: true`).

- 판정: provider별 "지원 셋"(codex/agy/anthropic = 디스커버리 id 집합, xai = 정적
  allowlist 교집합)에 없는 모델에 마킹.
- 셀렉터: 기본 숨김 → ctrl+o 토글 시 dim 스타일로 표시. 선택 자체는 허용 (cli-jaw
  철학: 클라이언트 검증 없음, 서버가 거부).
- 부가 가드: 기본모델 자동선택·context promotion 등이 unlisted 모델을 고르지 않도록.
- 캐시: 마킹이 캐시 row에 함께 저장되므로 Q7 메커니즘 그대로.
