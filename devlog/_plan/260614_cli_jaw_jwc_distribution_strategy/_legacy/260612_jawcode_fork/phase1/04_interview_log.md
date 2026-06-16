# 04 — 인터뷰 로그 (요구사항 확정 추적)

> ⚠️ **[구원칙 폐기 — 인터뷰 260612 02:04]** 본 문서의 'gjc diff-0 / 무수정 추종 / 런타임 치환 / 무회귀' 서술은 폐기된 구원칙 기록이다. 현행 원칙은 **소스 하드 수정**(Jaw/jwc 어휘 직접 기입, 가드 jwc 기준 반전) — [085.5 개정판](./085.5_plan_prompt_rebrand.md) · [095](./095_plan_debt_cleanup.md) 참조.

> Interview 모드 진행 기록. 라운드별 질문/답변/확정사항을 누적한다.

## 확정된 사실 (세션 누적)

| # | 사실 | 출처 | 차원 |
|---|------|------|------|
| 1 | gjc(gajae-code 0.4.4)를 포크해 jwc(jawcode)를 만든다 | 사용자 | goal |
| 2 | TUI는 주력 개발 인터페이스로 필요하다 | 사용자 | goal |
| 3 | cli-jaw에 직결(네이티브) 부착 — JSON 파싱 사이드카 방식 기각 | 사용자 (03 §결정 1) | goal |
| 4 | 호스팅: Node 포팅(옵션 A), 상주 네이티브 런타임 본선 | 사용자 확정 | constraint |
| 5 | 인스턴스당 jwc 1개 부착 방식 (resume 버그 시 재부착) | 사용자 (세부 미확정) | ontology |
| 6 | jwc 부착 시 스킬은 사용자(~/.cli-jaw/skills) 것을 쓴다 | 사용자 | ontology |
| 7 | jwc 자체로도 PABCD를 돌릴 수 있어야 한다 | 사용자 | goal |
| 8 | interview/goal 등은 gjc 체제와 cli-jaw 체제를 통합한다 | 사용자 (방식 미확정) | ontology |
| 9 | Phase 1 (packages/jwc 셸) 구현·검증 완료 | repo | constraint |
| 10 | 업스트림은 명시적 Bun 전용 — Phase 2는 Bun 셰임 + 트랜스파일 빌드 둘 다 필요 | repo 조사 | constraint |

## 미확정 (열린 질문)

- [ ] **워크플로 통합 방식**: gjc 4종(deep-interview/ralplan/ultragoal/team) vs cli-jaw PABCD/goal — 공존? 매핑 통합? PABCD로 대체?
- [ ] **성공 기준**: 이 프로젝트의 1차 "done"은 어느 Phase인가 (3 상주 대화 / 4 세션·스킬·PABCD / 6 기본 런타임 승격)
- [ ] **결정 2 확정**: 스킬 정본 = `~/.cli-jaw/skills` (현재 권고 상태)
- [ ] **결정 3 확정**: 세션 정본 = jaw.db (현재 권고 상태)
- [ ] **부착 시맨틱**: jwc TUI가 서버에 붙을 때 Web UI 세션과 공유(미러)인지 별도 세션인지
- [ ] **jwc 단독 모드 스킬**: 부착 안 됐을 때 임베디드 스킬 셋은 무엇을 번들하나

## 라운드 기록

### R1 (260612 02:34, compact 후 재개)

질문: ① gjc 워크플로 ↔ PABCD 통합 방식 ② 1차 done 기준 Phase ③ 결정 2·3 확정 여부
답변 (02:39):
- **개념적 phase 설계가 최우선** — 구현 디테일보다 먼저
- **부착 방식 확정**: jwc를 벤더 CLI처럼 통째로 붙이는 게 아니라, **jwc의 런타임 코어를 분리해 cli-jaw가 직접 품는다**. jaw chat이 그 런타임 기반으로 돌아간다. "분리됐지만 통합된" 두 제품 구조
- **세션 비공유 확정**: TUI(jwc)와 Web(cli-jaw) 세션은 공유 불필요. **OAuth만 공유**. jwc에서 대화가 이어지지 않아도 OK → Phase 5(TUI를 서버 WS 씬클라이언트로) 사실상 기각/단순화
- **스킬 이원화**: jwc 단독 = 임베디드 스킬 + 커스텀 주입 가이드라인 / cli-jaw 부착 런타임 = cli-jaw 스킬 체계
- **메모리**: jwc 자체 memory 폴더를 만들어 확장 가능하게 (세부 미확정, "~하게끔?" 톤)

코드 확인: `packages/coding-agent/src/sdk.ts:409` `discoverAuthStorage(agentDir)` —
`createAgentSession({authStorage})` 주입 가능 → OAuth 공유는 agentDir 공유만으로 성립.

### R2 (260612 02:39)

새 아키텍처 그림 확인 + 질문: ① jwc memory 폴더 시맨틱 ② 임베디드 스킬 셋에 PABCD 포함 여부 ③ 1차 done 마일스톤 (R1-②再)
답변 (02:41):
- **결정 2 확정**: 스킬 정본 = `~/.cli-jaw/skills`, jwc가 읽음. **단, "gjc 포크를 직접 수정해도 괜찮다"** —
  업스트림 무수정 원칙을 "리베이스 인지하며 포크 수정 허용"으로 완화 (스킬 디스커버리를 coding-agent에 직접 추가 가능)
- **스킬 디스커버리 순서**: jwc 임베디드 + 프로젝트 루트 스킬 + `~/.cli-jaw/skills`, **우선순위는 `~/.cli-jaw/skills`**
- **대화 공유 입장 변화**: R2 "세션 공유 불필요" → R3 "main instance와 대화 내용 공유해도 괜찮을 것 같아" (헤징 톤, 필수/옵션 미확정 → R3 질문)
- **인증 UX**: cli-jaw처럼 로컬 토큰 추출 가능하면 그대로 사용 — 이미 로그인된 상태로 즉시 사용. OAuth 플로우는 옵션으로 유지

코드 확인:
- cli-jaw `src/routes/quota.ts:145` — `security find-generic-password -s "Claude Code-credentials" -w` (macOS Keychain) +
  `.credentials.json` 추출 경로 기존재 → jwc AuthStorage 시딩 브리지로 재사용 가능
- gjc 인증: `packages/coding-agent/src/session/auth-storage.ts` + `packages/ai/src/utils/oauth/` —
  외부 CLI credential 임포트 기능은 업스트림에 없음 → 포크에서 추가할 신규 표면

### R3 (260612 02:41)

질문: ① 대화 공유 = 필수 코어인가 후순위 옵션인가 ② 1차 done 기준 3항목 yes/no 확정 (3차 시도)
답변 (02:45):
- **모순 해소**: R3에서 공유한다고 한 건 대화가 아니라 **스킬**. 세션 기록은 인스턴스와 **별도로 쌓임** (R2 입장 유지)
- **새 우려 제기 (스케일)**: jwc 세션이 따로 쌓일 때, 현재 memory search / `jaw dashboard chat search` 구조가
  "존나 많은 대화"를 감당할 수 있는가? → R4에서 코드 근거로 답변

코드 확인 (스케일 평가 근거):
- cli-jaw L1 chat search: `src/core/db.ts:269-293` — `content LIKE '%q%'` **풀스캔 (FTS 아님)**
- cli-jaw L2 federation: `src/manager/memory/chat-federation.ts:77` — 인스턴스별 jaw.db를 readonly로 열어 LIKE 스캔,
  `probeSchema()`가 `messages.content` 없으면 schema_mismatch로 스킵
- memory(파일) 검색만 FTS5 (`src/memory/indexing.ts`)
- gjc 세션 저장: `packages/coding-agent/src/session/history-storage.ts` — bun:sqlite + **`history_fts` FTS 기존재**
- 함의: ① jwc 세션 db는 현 federation 스키마와 달라 dashboard chat search에 **아예 안 잡힘** (감당 이전에 비가시)
  ② cli-jaw chat search 자체가 LIKE라 메시지 수십만 단위부터 선형 열화 ③ gjc는 자체 FTS 보유 → 어댑터/FTS 도입이 해법

### R4 (260612 02:45)

질문: ① jwc 세션 검색 연동 방식 (a 자체 FTS만 / b federation 어댑터 / c cli-jaw FTS 전환 포함) ② 1차 done 3항목 확정 (4차 시도)
답변 (02:50) — **우선순위 대전환**:
- **1단계 = jwc 단독 완성이 먼저** (cli-jaw 임베딩보다 선행). "jwc를 먼저 jaw 워크플로우에 맞춰서 완성"
- 작업 항목: ① gjc→jaw 리네이밍 ② deep-interview + jaw Interview 장점 병합 ③ ralplan + jaw P단계 장점 병합
  ④ 메모리 통합 ⑤ PABCD를 범용 jwc에 반영할 커맨드 설계 — 각 개선안은 jaw devlog에 기록
- **워크플로 통합 방식 확정**: 매핑 병합 (R2 질문 ②의 답) — "이름만 다르지 거의 비슷하잖아"

코드 검증 (유사성 주장 확인 — 사실로 판정):
- `defaults/gjc/skills/deep-interview/SKILL.md`: 소크라테스식 질문 + 수학적 ambiguity 스코어링 + 약한 차원 타겟팅 +
  research-first(explore 선행) + 임계치 게이트 → jaw Interview(4차원 트래커/negativity bias/약한 차원 조준)와 개념 동일.
  차별점: 수학적 스코어 표시, Round 0 topology gate, `.gjc/specs/` 핸드오프 파일, 1질문/턴 강제
- `defaults/gjc/skills/ralplan/SKILL.md`: Planner→Architect→Critic 합의 루프 + pending-approval 게이트 +
  `.gjc/plans/` 아티팩트 영속화 + receipt-only 역할 응답 → jaw P(계획)+A(read-only 감사) 합체와 동형.
  차별점: 다중 에이전트 합의 N회 루프, --deliberate 프리모템, CLI 아티팩트 라이터
- 매핑: deep-interview↔I / ralplan↔P+A / ultragoal↔goal / team↔employee dispatch — 개념 중복도 ~80%

### R5 (260612 02:50)

질문: ① 리네이밍 깊이 (표면만 vs .gjc→.jwc 포함 전면) — 리베이스 비용 트레이드오프 ② 마일스톤 M1(jwc 단독 완성)/M2(cli-jaw 임베딩) 구조 확정
답변 (02:53):
- **리네이밍 (a) 표면 확정** — bin `jwc`, 브랜딩/문서/스킬 이름만 jaw. `.gjc/` 경로·`@gajae-code/*` 패키지명 유지
- "어차피 지금 많이 엇나가긴 할꺼잖아" — 업스트림과의 실질 분기 수용. 리베이스는 용이성 유지 차원이지 추종 의무 아님
- M1/M2 구조 이의 없음 (M1 내용 자체가 R4에서 사용자가 직접 정의)

### 인터뷰 종료 (260612 02:53)

모든 차원 충족. 결론은 [05_interview_conclusions.md](./05_interview_conclusions.md) 참조. 다음: `cli-jaw orchestrate P`

### R6 (260612 02:57) — 종료 후 추가 지시: 넘버링 전면 재편

- **새 체계 확정**: 000–099 = jwc 만들기(M1), 100~ = cli-jaw 런타임 이식(M2). "아예 처음부터 다시"
- 프롬프팅 + TUI 변경 + 워크플로우 변경을 포함한 큰 로드맵 스캐폴딩 요청 → [000_roadmap.md](./000_roadmap.md) 작성
- 밴드 구성: M1 = 000 리서치 / 010 셸·리네이밍 / 020 프롬프팅 / 030 스킬 3계층 / 040 Interview 병합 /
  050 Plan+PABCD / 060 Goal / 070 메모리 / 080 TUI / 090 인증·release gate.
  M2 = 100 Node 포팅 / 110 JawRuntime / 120 세션 jaw.db / 130 주입 3종 / 140 federation / 150 승격
- 답변: (000_roadmap 확인 대기)

### R7 (260612 03:01) — MOC 전수 작성 지시

- 지시: "010~150 MOC 다 작성해놓으라" + "구체적으로 정해진 거 없으면 그거대로 정해놓고 일단 다 적어놔.
  계속 인터뷰하면서 적자. 긴 플랜이니 나중에 하나씩 결정"
- 수행: MOC 14개 작성 (010–090 M1, 100–150 M2). 각 문서에 [확정]/[기본값] 구분 표기 —
  [기본값] = 내가 정해둔 제안, 후속 인터뷰에서 개별 뒤집기 대상
- 추가 조사 발견: ① gjc 프롬프트는 전부 모듈형 .md (`prompts/system/` 23개 + `agents/` 10개) — 020 근거
  ② **gjc에 메모리 파이프라인 기존재** (`prompts/memories/` consolidation/read-path/stage_one) — 070은 신규 구축이 아니라 매핑
  ③ `prompts/goals/goal-continuation.md` — jaw goal-continuation과 동일 패턴 기존재, 060 비용 하락
  ④ ultragoal은 `.gjc/ultragoal/{brief,goals.json,ledger.jsonl}` repo-native 멀티골 + 통합 goal 도구
- 답변: (대기 — MOC [기본값] 항목들이 후속 인터뷰 의제)

### R8 (260612 03:09) — 기본값 정의 교정

- 지적: "그건 기본값이 아니잖아. **repo의 기본값을 보라고**" — 내가 [기본값]에 내 제안을 박은 것을 교정.
  기본값 = 업스트림 gjc의 실제 동작. 결정 없으면 repo대로 간다. 내 아이디어는 [제안]으로 분리
- repo 기본값 코드 확인 결과:
  - **시스템 프롬프트**: `createAgentSession({systemPrompt})` 옵션이 `string[] | ((default)=>string[])` (sdk.ts:241)
    — 공식 오버레이 메커니즘 기존재 → 020은 repo 방식 그대로 사용으로 수정
  - **스킬 루트**: capability API, `~/.gjc/agent`+`.gjc` 베이스, "GJC only accepts native .gjc skills" (skills.ts:122),
    추가 루트 설정 없음 → `~/.cli-jaw/skills` 추가는 포크 최소 diff [확정 D5] — 030 수정
  - **인터뷰 질문 수**: repo 기본 = 라운드당 1개 강제. 내 1–3개는 [제안]으로 강등 — 040 수정
  - **메모리**: `getMemoriesDir()` = `<agentDir>/memories/state` = `~/.gjc/agent/memories/state` (dirs.ts:431),
    SQLite + stage1→phase2 consolidation 잡 큐 완비 → 내 `~/.jwc/memory/` 마크다운안은 [제안]으로 강등,
    [기본값] = gjc 엔진·경로 그대로 — 070 수정
- 010/020/030/040/070/000 표기 개정 완료
- 답변: (대기)

### R9 (260612 03:14–16) — 기본값 정의 재교정 (cli-jaw 측)

- 지적: "미소녀 프롬프트는 cli-jaw 실제 리포의 기본값이 아니잖아" — repo 기본값 원칙을 cli-jaw 쪽에도 동일 적용
- 코드 확인: cli-jaw 리포 기본 아이덴티티 = `src/prompt/templates/a2-default.md`
  (Name Jaw, Emoji 🦈, Vibe "Friendly, warm / Technically accurate", Language English).
  미소녀 톤은 리포 grep 0건 — 사용자 인스턴스 settings 주입값
- 020 MOC 교정: jwc 아이덴티티 [기본값] = 중립(a2-default 상당) + 사용자 vibe는 설정 주입 계층 분리.
  "미소녀 적용 여부"는 설계 결정 아님(사용자 설정의 몫) — 020 열린 질문에서 제거
- 답변: (대기)

### R10 (260612 03:19–03:28) — gjc 프롬프트 주입 조사 + structure 직원 구축

질문 3건 처리:
1. **gjc 프롬프트 주입 방식** (코드 확인): 4계층 —
   ① Handlebars 템플릿 `prompts/system/system-prompt.md`의 `{{systemPromptCustomization}}` 슬롯 (L13, 프롬프트 앞부분)
   ② 파일 기반: `system-prompt.ts:281 loadSystemPromptFiles()` — **SYSTEM.md** (project가 user 오버라이드, capability API 경유)
   ③ SDK 옵션: `createAgentSession({systemPrompt: string[] | fn})` 전체 교체/가공 + `appendPrompt`
   ④ 합성 입력: skills 목록/contextFiles(AGENTS.md)/toolInfo가 같은 템플릿에 끼워짐
   → 020의 jaw 오버레이는 SYSTEM.md(파일) 또는 systemPrompt fn(SDK) 둘 다 repo-native 통로
2. **010 잔여 스코프** (코드 확인): 브랜딩이 이미 중앙화 — `packages/utils/src/dirs.ts:20 APP_NAME="gjc"` (+`VERSION`),
   사용처 21파일. 010 = APP_NAME 치환 지점 1곳 + 헬프/배너 표면 검증. **020과 직교라 020 결정 전 선행 가능**
3. **structure/ cli-jaw급 구축**: Docs 직원 디스패치(--mutable --scope structure) 완료 —
   11개 문서 (INDEX/README/architecture/conventions/packages_overview/sdk_surface/prompt_flow/workflows/
   session_storage/extensibility/gitstructure), 전 항목 파일경로:라인 근거 포함.
   참고: dispatch CLI가 fetch failed를 떴지만 서버측 워커는 정상 실행(pendingReplay 케이스) — 폴링으로 회수
- 답변: (대기 — 010 실행 승인 여부)

### R11 (260612 03:34) — rebrand-inventory 가드 의도 분석

- 질문: "rebrand-inventory --strict는 의도적으로 막아놓은 건가?"
- 답 (코드 확인): **의도적 가드 맞음, 단 대상이 다름.** gajae-code 자체가 상류 "oh-my-pi"의 리브랜드 포크이고,
  `scripts/rebrand-inventory.ts`는 자기 리브랜드 완전성을 지키는 가드 (`docs/REBRANDING_PLAN_260525.md` 계약 산출물).
  금지 토큰이 oh-my-pi 계열(L47)이라는 게 증거 — 다운스트림 포크(우리)를 막으려는 게 아님
- 강제 항목: @gajae-code/ 스코프(비스코프는 gajae-code만), bin [gjc, gjc-stats], 번들 스킬 정확히 4종,
  롤 에이전트 정확히 4종 (L32-37, L257-261 기계 검사)
- 010 전략 확정: 가드 비활성화가 아니라 **상수 확장** (allowedUnscopedPackageNames+expectedCliBins에 jwc) —
  가드를 jaw 리브랜드의 가드로 전환. gjc가 oh-my-pi에 한 작업의 반복이라 REBRANDING_PLAN_260525.md가 교본
- 파급 반영: 040/050 MOC에 "번들 스킬 추가 시 정확히-4종 가드 저촉" 경고 추가

### R10–R12 (260612 03:38–04:07) — 010 실행 + 020 스코프 확정

- R10: goal 모드로 010 밴드 PABCD 풀사이클 실행 완료 (011 문서, 커밋 59d10c6/1b23d24/f2ef1f7, 독립 감사 COMPLETE, goal paused)
- R11: "020 쉽게 설명" — 020 = 시스템 프롬프트 jaw화. 주입 통로 3종 기존재 확인(SYSTEM.md/systemPrompt fn/appendPrompt)
- R12 (04:07) **020 스코프 확정**:
  - 저장 모델 (a): config.yml `identity.{name,emoji,vibe,language}` + 합성기 렌더 (cli-jaw a2 동형)
  - TUI 표면: /settings Identity 섹션 + `/identity`(경로 안내) + `/identity-auto`(대화형 질문 후 자동 작성) — 사용자 설계
  - 밴드 배치 (a): 020에서 한 번에
  - 무회귀 불변식: identity 필드 미설정 시 업스트림 프롬프트 diff 0
- 코드 근거: /settings 커맨드(builtin-registry.ts:212) + settings-selector/settings-defs 분리 구조 + config.yml(settings.ts:223)

### R13 (260612 04:42–46) — 030 스킬 루트 셋 확정 (대체 모델)

- 사용자 재정의: "추가"가 아니라 **"뺄 건 빼고 우리 쪽으로 확정"** — 대체 검토 지시
- 실측 조사: ~/.gjc/agent/skills **빈 디렉토리** / ~/.cli-jaw/skills 29개(최신) /
  Developer/new/.agents/skills 48개(크로스툴 컬렉션, 일부 노후) / gjc 베이스는 .gjc+.gemini만 (config.ts:9-11)
- **확정 4건**:
  ① user-level **대체+폴백**: jwc 브랜드 = ~/.cli-jaw/skills (부재 시 업스트림 폴백), gjc 브랜드 = 업스트림 (diff-0)
  ② **.agents 프로젝트 베이스 추가** (워크업 nearest, 충돌 시 글로벌 승)
  ③ `<루트>/skills/` 인식 안 함 — ".agents가 표본"
  ④ .gemini 베이스 유지
- 기각: "M1은 .gjc/skills 쓰고 M2에서 전환" 대안 — 정본 이중화 드리프트(과거 cli-jaw skill sync 버그 패턴) + R3 요구 충돌

### R14 (260612 04:49–54) — D10 확정: 명령어 체계 cli-jaw 통일

- 사용자 지적 (맹점): cli-jaw 스킬들이 본문에서 `cli-jaw ...` 명령·서버 API를 지시 + cli-jaw 스킬 로딩은
  깃헙 최신 로직에 의존 → "jwc 명령어를 cli-jaw처럼 구현해야 하지 않나"
- 의존도 실측 (29개): 순수 가이드 19 / cli-jaw 명령 의존(browser·desktop-control·screen-capture·search·pptx·dev) /
  서버 API 의존(telegram-send·dev-scaffolding·diagram) / **네이티브 충돌 2 (memory, dev-pabcd)**
- **D10 확정** (사용자: "pabcd 로직을 jwc에서 구현, 평소에도 쓴다, 명령어 체계는 cli-jaw로 통일"):
  jwc 사용자-가시 명령 표면 = cli-jaw 어휘 (`jwc orchestrate I|P|A|B|C|D`, `jwc goal ...`, `jwc memory ...`).
  엔진은 gjc 네이티브(ralplan/ultragoal/memories) 재사용, 표면만 통일
- 파급 패치 완료: 05(D10 추가) / 000(횡단 원칙 0) / 050(명령 표면 확정) / 060(jwc goal 표면) /
  070(jwc memory 표면 확정 승격) / 030(충돌 스킬 2개 = 네이티브-대체 제외 명단) / 020(명령 예시 어휘) / 130(이득)
- 재구현 경계: D10 표면 3종(orchestrate/goal/memory)만 — browser 등 cli-jaw 인프라 명령은 재구현 안 함(bash 실행)
- "깃헙 최신 의존" 우려는 대체 모델로 자연 해소 (라이브 디렉토리 직독, 동기화 코드 0)
