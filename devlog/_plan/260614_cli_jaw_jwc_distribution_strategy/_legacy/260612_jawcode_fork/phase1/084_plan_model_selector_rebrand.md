# 084 — plan: /model 셀렉터 프로바이더 탭 리브랜딩 (라벨 단축 + LOCAL 통합)

> 상태: ✅ 구현 완료 (2026-06-12, D1~D3 기본값 적용). 소속: 080 밴드 (TUI).
> 입력: 사용자 "탭이 너무 많고 이름이 너무 길다 — ANTHROPIC→CLAUDE, OPENAI CODEX→CODEX,
> LLAMA.CPP/LM STUDIO/OLLAMA → LOCAL 통합, 라벨 ~6자. provider 선택창은 그대로, /model만."
> ⚠️ **fork 고유 변경 — 업스트림 PR 안 올림.**

/model을 열면 프로바이더 탭이 `ALL CANONICAL ANTHROPIC CURSOR GOOGLE KIRO LLAMA.CPP
LM STUDIO OLLAMA OPENAI CODEX XAI`로 11개나 깔린다. 로컬 런타임 3종(llama.cpp, LM Studio,
Ollama)은 쓰지도 않는데 탭 3개를 차지하고, OPENAI CODEX 같은 라벨은 두 단어라 길다.
탭 라벨을 6자 안팎으로 줄이고 로컬 3종을 LOCAL 탭 하나로 합쳐서
`ALL CANONICAL CLAUDE CODEX CURSOR GOOGLE KIRO LOCAL XAI` 9개로 만든다.
프로바이더 인증/선택 다이얼로그는 건드리지 않는다 — 이 계획의 변경 표면은
`model-selector.ts` 단일 파일(+테스트)이다.

---

## 1. 현재 구조 (근거 코드)

전부 `packages/coding-agent/src/modes/components/model-selector.ts`:

| 위치 | 역할 |
|---|---|
| `:133-139` | `STATIC_PROVIDER_TABS` = ALL, CANONICAL (고정 선두 2탭) |
| `:153-155` | `formatProviderTabLabel(providerId)` — `-`/`_`→공백, 대문자. `anthropic`→ANTHROPIC, `openai-codex`→OPENAI CODEX, `llama.cpp`→LLAMA.CPP |
| `:157-159` | `createProviderTab` — **탭 1개 = provider 1개** (`providerId` 단수 필드) |
| `:500-516` | `#buildProviderTabs` — `#allModels`의 provider + `modelRegistry.getDiscoverableProviders()` 합집합 → 라벨 알파벳 정렬 → 탭 생성 |
| `:518-529` | `#refreshSelectedProvider` — 활성 탭의 `providerId` **단건** `refreshProvider()` |
| `:566-576` | `#filterModels` — `m.provider === activeProviderId` 단일 매칭 |
| `:580-589` | provider 탭에서 검색 시 ALL 자동 전환 (`activeProviderId` truthy 체크) |

탭이 많은 이유: ollama/llama.cpp/lm-studio는 모델이 0개여도
`getDiscoverableProviders()`(model-registry.ts:2416)가 항상 노출하기 때문.

## 2. 목표 탭 구성

| 현재 | 변경 후 | 방식 |
|---|---|---|
| ALL / CANONICAL | 유지 | — |
| ANTHROPIC | **CLAUDE** | 라벨 오버라이드 맵 |
| OPENAI CODEX | **CODEX** | 라벨 오버라이드 맵 |
| LLAMA.CPP + LM STUDIO + OLLAMA | **LOCAL** (1탭) | 그룹 탭 |
| CURSOR / GOOGLE / KIRO / XAI | 유지 | 기본 포맷터 |

- 정렬은 기존 라벨-알파벳 유지 → 결과: `ALL CANONICAL CLAUDE CODEX CURSOR GOOGLE KIRO LOCAL XAI`.
  (사용자 예시는 `… KIRO LOCAL CODEX XAI`였으나 CODEX<LOCAL이 알파벳순 —
  커스텀 순서 배열을 추가하지 않고 알파벳 유지를 권장. 원하면 D2에서 뒤집기.)
- **`ollama-cloud`는 LOCAL에 안 합침** — 원격 호스팅 프로바이더고, 기존 회귀 테스트
  (`model-selector-role-badge-thinking.test.ts:314` "refreshes Ollama Cloud using provider id")가
  단독 탭을 전제한다. 라벨도 OLLAMA CLOUD 유지(현 사용자 환경에선 비활성이라 안 보임).

## 3. 구현 설계 (model-selector.ts 국소 수정)

1. **라벨 오버라이드 맵** (`formatProviderTabLabel` 위에):
   ```ts
   const PROVIDER_TAB_LABEL_OVERRIDES: Record<string, string> = {
       anthropic: "CLAUDE",
       "openai-codex": "CODEX",
   };
   ```
   `formatProviderTabLabel`이 맵 우선, 없으면 기존 포맷.
2. **LOCAL 그룹 상수**:
   ```ts
   const LOCAL_TAB = "LOCAL";
   const LOCAL_TAB_PROVIDERS = ["llama.cpp", "lm-studio", "ollama"] as const;
   ```
3. **`ProviderTabState.providerId?: string` → `providerIds?: string[]`** (단일 탭도 `[id]`).
   - `#getActiveProviderId(): string | undefined` → `#getActiveProviderIds(): string[]`
4. **`#buildProviderTabs`**: provider set에서 LOCAL 멤버를 빼고, 멤버가 1개 이상 존재/디스커버러블하면
   LOCAL 탭 1개를 추가. 정렬은 동일하게 라벨 기준.
5. **`#filterModels`**: `providerIds.includes(m.provider)`. 검색 시 ALL 자동 전환 조건(:581)은
   "provider 탭 여부"(`providerIds` 존재)로 치환 — LOCAL 탭에서도 동일 동작.
6. **`#refreshSelectedProvider`**: `for (const id of providerIds) await refreshProvider(id)` 순차 루프
   (에러는 기존 catch 경로 그대로).

provider 인증/선택 다이얼로그·Ctrl+P 모델 사이클·`--models` 스코프·풋터 모델 표기는 모두 무변경.

## 4. 테스트 계획

- 회귀: 기존 `model-selector-*.test.ts` 3종 통과 (특히 ollama-cloud 탭 :314).
- 신규 (model-selector 테스트에 추가):
  1. anthropic/openai-codex 모델 로드 시 탭 라벨이 CLAUDE/CODEX로 렌더.
  2. llama.cpp·lm-studio·ollama 모델/디스커버리 존재 시 LOCAL 탭 **1개만** 생기고 개별 탭 없음.
  3. LOCAL 탭 활성 시 3사 모델이 전부 리스트에 보임 (필터 = 그룹 멤버십).
  4. LOCAL 탭 새로고침 시 `refreshProvider`가 3개 id 각각으로 호출됨 (라벨 "LOCAL" 아님).
- `bun test packages/coding-agent/test/model-selector-*` + `check:types` + `jwc`에서 /model 육안 확인.

## 5. 열린 질문 (구현 전 확인)

| # | 질문 | 기본값 |
|---|---|---|
| D1 | CANONICAL(9자)도 줄일까? (예: CANON) | 유지 (사용자 예시에 CANONICAL 그대로) |
| D2 | 탭 순서: 알파벳(CODEX가 LOCAL 앞) vs 사용자 예시 순서 | 알파벳 유지 |
| D3 | ollama-cloud 라벨(12자) 단축? | 유지 (현 환경 비노출) |

## 6. 리스크

- 업스트림 리베이스 충돌면: model-selector.ts 수정은 상수 1블록 + 메서드 4곳 국소 diff로 한정.
- `providerIds` 시그니처 변경이 같은 파일 내 호출처에만 영향 — 외부 export 아님 (grep 확인 완료).

## 7. 구현 결과 (2026-06-12)

- 적용 파일: `model-selector.ts` (설계 §3 그대로 — 오버라이드 맵, LOCAL 그룹, `providerIds[]` 전환,
  그룹 필터/순차 refresh, empty-state는 그룹 첫 멤버 상태 사용).
- 신규 테스트: `test/model-selector-provider-tabs.test.ts` — 5건 (라벨 2종, LOCAL 단일탭,
  ollama-cloud 분리, 그룹 필터, 그룹 refresh id 검증) **5/5 pass**.
- 회귀: 기존 model-selector 테스트 3파일 27/27 pass (ollama-cloud :314 포함). `check:types` clean.
- D1~D3 모두 기본값 채택: CANONICAL 유지, 탭 순서 알파벳(CODEX가 LOCAL 앞), ollama-cloud 라벨 유지.
