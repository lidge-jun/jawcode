# 모델 노출 개혁 + /model ALL 탭 UX 2분할 — 마스터 플랜

> 상태: ✅ **구현 완료 (260613)** — S1~S7 슬라이스별 커밋 7건 (`9df6855c`→`817cb73c`).
> 결정 확정: D1 auto-review 숨김 ✅ / D2 multi-agent **라이브 검증으로 제외 확정**
> (chat completions 400 — Responses 전용; 나머지 allowlist 5종 전부 200) / D3 unlisted
> 직접 선택 허용 / D4 잘게 분할(슬라이스=커밋). 잔여: 수동 e2e (§P4).
> 소속: [99.30.00 MOC](../260612_jawcode_fork/phase1/99.30.00_moc_feature_improvement.md) 99.30.04 슬롯.
> 입력: 사용자 260613 — ① `/model`이 OAuth로 실제 지원 안 되는 모델까지 기본 노출(codex
> 17개 중 실지원 ~5개), ② xai도 progrok 런타임 지원분만 사용 가능, ③ ALL 탭에서 Profiles와
> 모델이 한 리스트에 섞이는 UX 이상, ④ spark는 cli-jaw 구현 확인 전 판단 보류.

`/model`의 기본 노출이 "카탈로그에 있는 모델"이지 "지금 내 인증으로 쓸 수 있는 모델"이
아니다. codex OAuth 기준 백엔드가 실제 서빙하는 모델은 한 줌인데 번들 카탈로그의 레거시
(gpt-5, 5.1, 5.2, 5-codex…)가 전부 섞여 나오고, 선택해도 동작하지 않는다. xai도 동일 구조
(progrok 런타임 지원분만 유효). 동시에 ALL 탭은 Profiles 9줄 뒤에 모델 17줄이 한 리스트로
이어져 탐색이 어렵다. 본 플랜은 **노출 정책**(지원분만 기본 노출 + 트리거 키워드로 전체
해제)과 **ALL 탭 2분할 UX**(좌 Profiles / 우 Models)를 단계적으로 설계한다.

## 0. 결정 사항 (사용자 확정)

1. 기본 노출 = **현재 OAuth로 지원되는 모델만**. 대상 provider: openai-codex, xai,
   google-antigravity(agy), anthropic(claude code). 그 외 provider는 현행 유지.
2. ALL·CANONICAL 탭에서 **`ctrl+o` 토글**로 미지원 모델까지 일시 노출 (기본은 숨김,
   비영속). [확정 260613] — 근거: `ctrl+o`는 이미 jwc의 "펼치기" 문법 (컴포저
   `app.tools.expand` = `config/keybindings.ts:107`, tree-selector 필터 확장 사이클 =
   `tree-selector.ts:743`). 셀렉터-스코프라 전역 키맵 오염 0, 검색 Input의 readline 키와도
   비충돌. 리스트 위/아래 힌트 라인에 안내 1토큰 추가 (예: `ctrl+o show unsupported`).
3. ALL 탭 UX를 **2분할**: 왼쪽 Profiles, 오른쪽 Models (현재: 단일 리스트에 혼합).
4. **지금은 구현하지 않는다** — 본 폴더에서 계획 합의 후 슬라이스별 착수.

## 1. 확보된 사실 (260613 조사분)

- codex 백엔드 라이브 조회(`/codex/models`, client_version 0.139.0, originator pi/codex_cli_rs
  동일 결과): **gpt-5.5, gpt-5.4, gpt-5.4-mini, gpt-5.3-codex-spark, codex-auto-review** 5종.
  spark는 `supported_in_api=false`라 현행 디스커버리 필터(`codex.ts:255`)에서 **탈락** → 실제
  살아남는 건 4종. 사용자 기대 목록(5.5 / 5.4 / 5.3-codex / 5.4-mini / 5.3-codex-spark)과
  차이: 백엔드에 **5.3-codex 부재**, 대신 codex-auto-review 존재 — §2-Q1.
- `/model` 16~17개 노출의 원인: `resolveProviderModels`(`model-manager.ts:102`)가
  `static(번들) ∪ models.dev ∪ cache ∪ dynamic(디스커버리)`를 **id 병합** — 디스커버리가
  안 주는 레거시 id도 번들에서 살아남는다. 병합 시 dynamic 항목은 번들 메타데이터(thinking
  레벨 등)를 상속받는 점에 주의 (`mergeDynamicModel`).
- 보류된 초안(참고용, 리버트됨): `dynamicReplacesStatic` 옵션 — 디스커버리 성공 시 그
  id 집합으로 노출 제한, 번들은 메타데이터 도너 + 오프라인 폴백. 테스트 자리는
  `test/model-manager-dynamic-replace.test.ts`(현재 빈 파일)로 예약.

## 2. 조사 항목 — ✅ **P0 완료 (260613, Sonnet 4기 병렬)** → [01_findings.md](./01_findings.md)

| # | 결론 한 줄 |
|---|-----------|
| ✅ Q1 | codex-auto-review는 cli-jaw에 완전 부재(비노출 대상), gpt-5.3-codex는 계정별 백엔드 응답 차이 — 디스커버리 진실 원칙으로 자연 처리 |
| ✅ Q2 | cli-jaw는 `supported_in_api` 개념 없이 **spark 노출 + 런타임 조정**(reasoning 미전송·128K 고정·세션 버킷 분리) — jwc의 필터는 플래그 오독 |
| ✅ Q3 | progrok도 클라이언트 필터 없음(서버가 게이팅), 정규 목록은 `capabilities.ts` 채팅 7종 — xai는 **정적 allowlist 교집합** 필요 |
| ✅ Q4 | agy는 이미 서버 디스커버리(`fetchAvailableModels`)+denylist 구조 — 지원 셋 = 디스커버리 id |
| ✅ Q5 | anthropic `/v1/models`가 **OAuth Bearer로 동작**(sk-ant-oat 감지) — 디스커버리 id가 지원 셋, 번들은 메타데이터 canonical 유지 |
| ✅ Q6 | **`ctrl+o` 셀렉터-스코프 토글 + 힌트 1토큰** (§0-2, 사용자 확정) |
| ✅ Q7 | staticFingerprint는 models.json 변경에만 반응 — 코드 정책 변경은 TTL 2h 후 자연 반영 |
| ✅ Q8 | 2분할은 기존 선례(PaneComponent·TwoColumnBody) 차용 ~+50행, ←/→는 ALL 탭에서만 페인 포커스로 인터셉트 |

**⚠ 설계 수정 (P0 발견)**: "디스커버리 성공 시 번들 제거" 방식은 ctrl+o와 양립 불가
(지우면 펼칠 게 없음) → **전 모델 보유 + `unlisted` 마킹 + 셀렉터 기본 숨김**으로 전환
([01_findings §6](./01_findings.md)).

### 2.1 트리거 설계 후보 (Q6 — 사용자 결정 대기)

전제: ALL·CANONICAL 탭에서만 동작, 기본은 숨김, 선택 후/셀렉터 재오픈 시 원복(비영속).

| 안 | 트리거 | 예시 | 장점 | 단점 |
|----|--------|------|------|------|
| **A (권장)** | 검색어 **`*` 접두** | `*` 전체 해제, `*5.1` 숨김 포함 검색 | 한 글자·"전부"라는 직관·모델 id와 충돌 0·추가 검색어와 합성 가능·푸터 힌트 한 칸으로 안내 끝 | 기호라 최초 발견성은 힌트 의존 |
| B | 검색어 키워드 `all` | `all` 입력 시 해제 | 영단어라 기억 쉬움 | 퍼지 검색과 충돌 — `all` 타이핑이 "smALL" 류 매칭과 겹치고, `all`로 시작하는 진짜 검색어를 못 씀 |
| C (수정안) | **셀렉터-스코프 단축키 토글** | 셀렉터 포커스 중에만 키 한 번으로 on/off | 검색어 오염 없음 · **전역 키맵 오염 0** (260613 검증: 입력은 포커스 컴포넌트로만 라우팅 — `model-selector.ts:909 handleInput`이 전부 수신, ALL·CANONICAL 탭 가드도 한 줄) · 기존 힌트 라인(`:236`)에 토큰 1개 추가로 발견성 해결 | 키 선택 제약: 미처리 키는 검색 Input으로 폴스루 → readline 키와 충돌 금지. **`ctrl+u`는 불가**(deleteToLineStart=검색어 삭제), ctrl+a/e/k/y도 사용 중. 안전 후보: **`alt+a`**("all" 연상, 미사용) 또는 `ctrl+o` |
| D | 탭 추가 (`LEGACY`) | tab 사이클에 합류 | 기존 탭 패러다임과 일관 | 탭 사이클이 7개로 길어짐, "ALL인데 전부가 아님" 모순은 그대로 |

정리 (260613 2차): C의 원래 감점 요인이던 "보이지 않는 전역 단축키"는 **스코핑으로 소멸**
— 입력이 포커스 컴포넌트에만 라우팅되므로 셀렉터 밖에서는 존재 자체가 없다.

**최종 확정 (260613 3차, 사용자)**: **C안 — `ctrl+o`**. "지금 펼치기 로직이니까 여기서는
이걸로 작동하도록 하고 위나 밑에 안내 하나". 기존 문법과의 일관성이 결정타: 컴포저
`app.tools.expand`(ctrl+o = 도구 펼치기) · tree-selector ctrl+o(필터를 all 방향으로 확장).
구현 시 메모: tree-selector처럼 raw `matchesKey(keyData, "ctrl+o")` 매칭 (셀렉터-스코프,
ALL·CANONICAL 탭 가드), 힌트는 기존 힌트 라인(`model-selector.ts:236`) 위/아래에 1토큰.

## 3. 확정 플랜 (260613 — 각 단계 사용자 승인 후 착수)

### P1 — `unlisted` 마킹 인프라 + provider 4종 지원 셋 (ai 패키지)

1. `Model`에 `unlisted?: true` 필드 추가 (`types.ts`). 캐시 row에 자연 직렬화 (Q7 호환).
2. `model-manager.ts`: `markUnlistedOutsideDynamic?: boolean` 류 옵션 — 동적 fetch 성공 시
   디스커버리 id 밖의 static/cache 모델에 `unlisted: true` 부여 (제거 아님).
3. provider별 지원 셋:
   - **openai-codex**: 디스커버리 id = 지원 셋. `supported_in_api===false` 필터 **제거**
     (spark 복귀, `codex.ts:255`) + **spark 런타임 가드**: reasoning 파라미터 미전송
     (cli-jaw `args.ts:241-260` 선례 — jwc `openai-codex-responses` provider에서 spark id
     감지 시 reasoning 필드 생략). codex-auto-review는 **노출 denylist 1건** (cli-jaw 선례).
   - **xai**: 정적 OAuth allowlist 교집합 — progrok capabilities 채팅 셋 기준:
     `grok-4.3 · grok-4.20-0309-reasoning · grok-4.20-0309-non-reasoning ·
     grok-build-0.1 · grok-composer-2.5-fast` (+multi-agent는 Responses 전용이라 보류 —
     §결정 D2). 위치: `fetchDynamicModels` 래퍼 필터 (antigravity denylist 패턴).
   - **google-antigravity**: 기존 디스커버리 그대로 + 마킹 옵션만 적용 (번들·denylist 모순
     자연 해소).
   - **anthropic**: `/v1/models` OAuth 디스커버리 id = 지원 셋 + 마킹 옵션 적용 (번들은
     메타데이터 canonical 역할 유지 — limit 없음 제약 때문).
4. 가드: 기본모델 자동선택·context promotion이 `unlisted` 모델을 고르지 않도록.

### P2 — 셀렉터 기본 숨김 + `ctrl+o` 토글 (coding-agent)

- ALL·CANONICAL 탭: `unlisted` 모델 기본 숨김, `ctrl+o`로 토글 (비영속, dim 스타일 표시).
- raw `matchesKey(keyData, "ctrl+o")` 매칭 (tree-selector 선례), 힌트 라인에
  `ctrl+o show unsupported` 1토큰.
- provider 탭(CODEX/XAI/…)에서의 동작은 동일 토글 적용 (탭 가드만 ALL·CANONICAL 우선).

### P3 — ALL 탭 2분할 (coding-agent, 99.20 밴드 협의)

- Q8 변경셋 그대로 (~+50행): `#activePaneId` + 페인별 인덱스, `#buildAllTabPane(width)`
  zip 렌더(TwoColumnBody 패턴), ALL 탭에서만 ←/→ 페인 포커스 인터셉트 (탭 전환은
  tab/shift+tab 유지), 검색은 양 페인 공통 필터.
- 시안(preview.html) 승인 → 구현 (99.20.06 절차 준용).

### S7.1·S7.2 — e2e 발견 버그 2건 수리 (260613 새벽, 사용자 리포트)

1. **탭 사이클 사망 (S7.1, `04132930`)**: S7이 ←/→를 페인 포커스로 가로채면서 화살표
   탭 전환이 죽음. 수리: 화살표·tab은 TabBar 원복, **페인 전환은 space** (모델 검색어에
   공백 불요 — 사용자 확정) + 헤더 행에 `Models · space to switch pane` 표기.
2. **space 토글 시 탭바 유령 중복 (S7.2)**: space를 누를 때마다 스크롤백에 `Models: ALL
   CANONICAL …` 탭바가 겹겹이 쌓임. 원인 — models 포커스에서만 하단 `Model Name:` 푸터
   (+Spacer)가 붙어 **토글마다 도킹 높이가 ±2줄 변동** → 렌더러가 이전 프레임을
   스크롤백에 잔류시킴 (086 아티팩트 계열의 높이 가변 트리거). 수리 — profiles 포커스에도
   대칭 푸터(`Profile: <name>`)를 렌더해 **높이 불변화**. 회귀 테스트: space 2회 토글 후
   `render().length` 동일성 단언. 교훈: **도킹 컴포넌트는 상태 전환 간 높이를 보존할 것**
   (렌더러 근본 수리는 086 소유).

### S8·S9 — 후속 노출 정리 (260613 새벽, 사용자 리포트)

1. **온보딩 안내문 상시 표출 (S8, `915a37c5`)**: `/model` 생성자가 `--models` 스코프가
   없으면 무조건 `formatModelOnboardingInlineHint()` 4줄을 렌더 — "온보딩이 필요한
   상태인가"를 안 봄. 수리: registry에 모델이 1개라도 있으면 생략 (plain 설치에서만 표출).
2. **google provider 무단 점등 (S9)**: 명시 추가 없이도 GOOGLE 탭/모델이 등장 — 원인은
   다른 툴링용 `GEMINI_API_KEY` env를 registry가 자동 인증으로 집어 광고. 수리:
   `disabledProviders` 스키마 기본값을 `["google"]`로 — 명시 opt-in은
   `/provider enable google`. (사용자 설정 DB에 기존 persisted 값 없음 확인 → 즉시 적용.)

### S10 — composer 정적 주입 (260613, 사용자 지적 "히든이지만 히든이 아닌")

`grok-composer-2.5-fast`를 S4 allowlist에 넣었지만 **`/v1/models`·`/v1/language-models`
어느 쪽에도 안 내려오는 히든 모델**이라 목록에 등장 자체를 못 했다 (allowlist는 디스커버리
결과에만 작용). 수리(`1b9a1289`): OAuth 경로 디스커버리가 composer를 누락하면 정적 엔트리
주입 — `reasoning: false`(reasoning_effort 거부, progrok이 프록시에서 strip하는 모델),
메타 미공개라 보수적 256K/32K 캡. 플랫폼 API 키 경로엔 미주입. 라이브 200 재확인.

### S10.1 — fast 변형 후보 라이브 검증 (260613, 사용자 요청 "되면 넣어놔" → 결과: 미추가)

| 후보 | 결과 |
|------|------|
| grok-4.3-fast · grok-build-0.1-fast · grok-4.3-mini | **400 — 존재하지 않음** |
| grok-composer-2.5 (non-fast) | 404 (progrok 조사와 일치: 팀 전용) |
| grok-4-fast · grok-4-1-fast · grok-4-fast-(non-)reasoning | 200이지만 전부 **grok-4.3의 서버측 앨리어스** (응답 model=grok-4.3) |
| grok-code-fast(-1) | 200, **grok-build-0.1 앨리어스** |

판정: 동작하는 id는 전부 이미 listed인 모델의 중복 앨리어스 → 추가 시 99.30.04가 막 걷어낸
앨리어스 노이즈를 픽커에 재도입하므로 **미추가**. 부수 발견: 라이브 `/v1/models`가 9종으로
축소됨 (어제 캐시 26종 대비 — xAI가 레거시 앨리어스를 목록에서 제거, 서버 해석은 유지).
캐시 갱신 시 unlisted 잔여는 번들 유래만 남는다.

### S11 후보 — GJC `a12a751` group preset UX cherry-pick 검토 (260614)

사용자 질문: GJC의 `feat(model-profiles): group preset selection UX (#553)`를 cherry-pick하되,
jwc가 이미 확정·구현한 provider preview/tab 이름과 unsupported 제외 UX는 유지할 수 있는가?

판정: **가능하지만 clean cherry-pick 대상은 아님.** `a12a751`은 `/model`의 profile 표면을
`Browse presets → group → profile → action` 흐름으로 바꾸는 패치이고, jwc 현재 `model-selector.ts`는
99.30.04 라인에서 이미 다음 UX를 가진다.

- provider tab 라벨은 jwc 전용 짧은 이름을 유지: `anthropic → CLAUDE`, `openai-codex → CODEX`,
  local runtimes는 `LOCAL` 그룹 탭(`llama.cpp`·`lm-studio`·`ollama`).
- unsupported/unlisted 모델은 기본 제외하고, selector-scoped `ctrl+o`로만 임시 노출한다.
- ALL 탭은 `Profiles | Models` 2분할이며, `space`로 pane focus를 전환한다.
- profile focus 상태에서도 footer 높이를 유지해 탭바 유령 중복 회귀를 피한다.

따라서 이식 방식은 cherry-pick 후 충돌 해결이 아니라 **GJC의 데이터/그룹 탐색 로직만 선별 포팅**이 맞다.

1. `model-profiles.ts`: GJC 신규 builtin profile(`minimax-standard`, `minimax-cn-standard`,
   `kimi-standard`, `glm-standard`)은 채택 후보. 단, jwc 모델 카탈로그/지원셋 정책과 맞는지 확인 후
   추가한다.
2. `model-selector.ts`: `ProfileGroupDefinition`, `ProfileMenuState`, `#buildProfileGroups`,
   `#renderProfileMenu`, `#handleProfileMenuInput` 계열은 선별 가능. 단, 기존
   `#showUnlisted`/`#hiddenUnlistedCount`, `#filterModels`의 `unlisted` gate,
   `PROVIDER_TAB_LABEL_OVERRIDES`, `LOCAL_TAB_PROVIDERS`, `#renderAllTabPanes`,
   `#activePaneId`/`space` 전환은 보존한다.
3. UX 병합안: ALL 탭의 왼쪽 `Profiles` pane에서 profiles를 평면 리스트로 계속 보여줄지,
   GJC처럼 `Browse presets` 단일 진입점으로 접을지 결정 필요. 어느 쪽이든 오른쪽 `Models`
   pane과 unsupported 기본 제외는 유지한다.
4. 테스트: 기존 99.30.04 회귀(`ctrl+o`, two-pane height stability, provider tab labels, LOCAL grouping)
   위에 GJC group preset traversal 테스트만 추가한다.

비채택: GJC의 provider tab 생성 로직을 그대로 가져와 jwc의 `CODEX`/`CLAUDE`/`LOCAL` 표면을 되돌리는 것,
또는 `unlisted` 모델을 기본 목록에 다시 노출하는 것.

구현 메모(260614): 선별 포팅 완료. `model-profiles.ts`에 GJC 신규 coding-plan profile 4종을 추가하고,
`model-selector.ts`에는 grouped preset browser를 접목했다. jwc 고유 UX인 `CODEX`/`CLAUDE` provider tab
label, `LOCAL` provider grouping, `Profiles | Models` ALL-tab split, `space` pane switching, `unlisted`
기본 제외와 `ctrl+o` unsupported reveal은 보존했다. 포팅 형태는 왼쪽 Profiles pane의 단일
`Browse presets` 진입점 → group → profile → action menu이며, 오른쪽 Models pane은 기존 모델 목록과
unlisted filtering을 그대로 유지한다. 회귀 테스트는 `model-selector-profiles.test.ts`에 grouped preset
탐색과 unlisted 기본 숨김/`ctrl+o` 노출 케이스를 추가했다.
후속 수리(260614 사용자 UX 지시): group menu의 긴 설명이 터미널 폭에서 줄바꿈되는 문제가 있어
설명을 축약(`OpenCode Go defaults + Codex review`, `MiniMax/Kimi/GLM-zAI profiles`). 또한 `/model`
preset UX가 항상 커스텀 슬롯을 보여주도록 빈 builtin profile `custom-1`~`custom-4`를 추가했다.
이 슬롯은 `~/.jwc/agent/models.yml`의 top-level `profiles:`에서 같은 이름으로 override해서 채운다.
모델 action menu에는 선택한 모델을 default/executor/architect/planner/critic에 모두 적용하는
`Apply all roles` 옵션을 추가했다. 집중 검증: `bun test packages/coding-agent/test/model-selector-profiles.test.ts`,
`bun test packages/coding-agent/test/model-profiles-catalog.test.ts packages/coding-agent/test/model-profiles-redteam.test.ts`,
`bun x biome check src/modes/components/model-selector.ts src/config/model-profiles.ts test/model-selector-profiles.test.ts test/model-profiles-catalog.test.ts test/model-profiles-redteam.test.ts`.
후속 수리(260614 사용자 스크린샷 10:48): `Profiles | Models` 2분할은 실제 폭에서 공간을 낭비하고
`Browse presets`가 잘리므로 제거했다. ALL 탭은 검색창 아래에 `Current preset: <name>` →
`View preset configuration` → `Browse presets` → 필터된 모델 리스트 순서로 단일 컬럼 렌더한다.
`View preset configuration`은 현재 profile의 role→selector 매핑을 보여준다. current preset 이름은
활성화된 session profile을 우선하고, 없으면 persisted `modelProfile.default`를 쓴다. profile 활성화
경로는 `session.setActiveModelProfile()`도 갱신하도록 보강했다.

### P4 — 검증

- provider 4종 노출 스냅샷 테스트 (지원 셋/마킹/토글) + 스파크 reasoning 미전송 테스트.
- 수동 e2e: ALL 탭 2분할 + ctrl+o + `/model` 카운터.

### 사용자 결정 대기 (착수 전)

| # | 결정 | 권장 |
|---|------|------|
| D1 | codex-auto-review 숨김 (cli-jaw 선례) | 숨김 (denylist) |
| D2 | xai allowlist에 grok-4.20-multi-agent 포함? (Responses API 전용 — jwc chat 경로와 비호환 가능) | 보류 (제외 후 검증 뒤 추가) |
| D3 | unlisted 모델 직접 선택 허용? (cli-jaw 철학: 클라이언트 검증 없음) | 허용 (서버가 거부) |
| D4 | P1+P2 한 슬라이스로 묶을지, P3 분리 여부 | P1+P2 / P3 분리 |

## 4. 비범위 (이 플랜에서 안 함)

- 모델 카탈로그 데이터 자체 수정 (99.30.03에서 컨텍스트 윈도우만 이미 처리).
- provider 추가/제거, 프로파일 시스템 변경.
- spark 필터 변경 — Q2 해소 전 금지.
