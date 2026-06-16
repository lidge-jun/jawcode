# 080 MOC — TUI 전반 리브랜딩 (비주얼 정체성 + 워크플로 시각화)

> 상태: ⬜. 입력: 사용자 "주력으로 개발할 TUI 필요" [확정] + "전반적인 TUI 리브랜딩 계획" 요청 (260612 04:29).
> 040–060 산출물(위젯 표시 대상) 뒤 배치가 기본이나, §A 비주얼 트랙은 분리 선행 가능 (열린 질문 1).

## 코드 사실 (260612 04:29 구체화)

- `packages/tui/` — 자체 차등 렌더링 라이브러리. Bun 전용 7파일 — Node 포팅 대상 아님 (D8)
- **비주얼 정체성은 아직 100% gjc**:
  - 기본 다크 테마 = **`red-claw`**, `theme.ts`에 폴백 포함 4곳 하드코딩 (L1788 `autoDarkTheme`,
    L1809 `darkTheme ?? "red-claw"`, L1824–25 로딩 실패 폴백)
  - 내장 테마: `modes/theme/defaults/` — `red-claw.json`, `blue-crab.json` (jaw 테마 없음)
  - **welcome 배너가 claw(집게발) 마크를 드로잉** — welcome.ts:18 "a claw/talon mark without copying
    another agent shell", L82 레이아웃이 claw 마크 폭 기준 (`minLeftCol = 18`)
  - `scripts/verify-gjc-ui-redesign.ts` 가드: 상태줄 프리셋이 레거시 "pi" 세그먼트를 쓰지 않는지 검사 —
    jaw 테마/세그먼트 추가 시 저촉 여부 착수 시 확인
- 010/020에서 이미 끝난 텍스트 표면: 배너 타이틀(`jwc vX · Jawcode`), 상태줄 `JWC`, 안내문/헬프, Identity 탭 🦈
- **(260612 06시 조사) "TUI에 도구 행이 안 나오는" 버그는 TUI 무죄 판정** — 원인은 cursor 프로바이더
  파서의 네이티브 ToolCall oneof 드롭 ([081.1_issue_toolcall_render.md](./081.1_issue_toolcall_render.md),
  수정 대상은 `packages/ai/src/providers/cursor.ts`). 자매 이슈 [081.2](./081.2_issue_title_hallucination.md)(타이틀 환각)도 본 밴드 발현·프로바이더 소관.
  TUI는 미등록 도구명도 폴백 렌더 가능 (`ui-helpers.ts:371`, `tool-execution.ts:188`) — 본 밴드 비주얼 작업과 독립

## 스코프 — 2트랙

### §A. 비주얼 리브랜딩 트랙 (워크플로 무관 — 분리 선행 가능)

> ✅ **§A 구현 완료 (260612)**: [086_plan_jaw_visual_identity.md](./086_plan_jaw_visual_identity.md) —
> 시안 3종 HTML 미리보기 제시 → 사용자 확정 **abyss-bite(시안-우선 + 바이트 포인트) + fin 마크**.
> 테마 2종(다크/라이트)·brand 조건부 기본값(theme.ts + settings-schema)·welcome 배너 분기·`$ gjc` 스윕·가드 확장.
> 아래 §A 1–4항 전부 + 열린 질문 1·2 해소. ⬜ e2e 스크린샷만 잔여.
> ↳ 후속 [086.1](./086.1_issue_banner_scroll.md): 짧은 터미널 배너 스크롤백 잘림 → 수직 반응형 컴팩트
> 배너(5행, BRANDED 게이트) 패치 ✅ · 렌더러 단일 원인은 라이브 로그 대기.

1. **jaw 테마 신설**: `modes/theme/defaults/jaw-<이름>.json` — red-claw.json을 베이스로 jaw 팔레트
   (방향 미정 — 열린 질문 2). 시맨틱 컬러 무결성 유지 (gjc REBRANDING_PLAN 원칙 3: 브랜드색 ≠ error/warning/diff 색)
2. **브랜드 조건부 기본 테마**: `APP_NAME !== "gjc"`일 때 autoDarkTheme 기본값을 jaw 테마로 —
   010의 brand-조건 패턴 재사용, 4곳 하드코딩을 단일 헬퍼로 수렴. gjc 무회귀 (diff-0 패턴)
3. **welcome 배너 마크 교체**: claw 마크 → jaw 마크(상어 모티프) 드로잉, brand 조건부 —
   gjc 실행 시 기존 claw 유지. ASCII/narrow 터미널 폴백 유지 (REBRANDING_PLAN 원칙 4)
4. 잔여 텍스트 스윕: 서브커맨드 `examples`의 `$ gjc ...` 리터럴 (011 이월)

### §B. 워크플로 시각화 트랙 (040–060 산출물 의존)

> 📐 구현 상세: [99.04.00_moc_workflow_hud.md](./99.04.00_moc_workflow_hud.md) + 99.03.02(IPABCD 띠)·99.03.03(인터뷰 게이지)·99.03.04(goal 표시)·99.03.01(공통 인프라) — 260612 11:45 문서화 완료, 260612 99밴드 이관. 아래 5–7항은 99.03.n이 정본.

5. 인터뷰 위젯: 4차원 점수 + ambiguity 게이지 라운드별 표시 (040 산출)
6. PABCD 단계 인디케이터: 현재 단계/게이트 상태 상시 표시 (050 산출)
7. goal 상태 표시: active goal/checkpoint 진행 (060 산출)
8. 한국어 UX: IME 경계 케이스, 한글 폭 계산 검증.
   **선결 버그**: [082.1](./082.1_issue_tui_ctrl_ime.md) — 한글 IME에서 Ctrl 단축키·종료 미작동
   (legacy 터미널이 0x03 대신 자모 바이트 전달, native 매처가 C0만 인식). 업스트림 버그.

## [기본값] 결정

- 업스트림 TUI 컴포넌트 재사용, jaw 위젯은 신규 컴포넌트 (기존 최소 수정)
- 키바인딩 업스트림 유지, jaw 전용은 비충돌 범위 추가
- 레이아웃 개편(스킨 초과)은 별도 밴드로
- 테마는 json 추가 + 기본값 조건부 — 업스트림 테마 파일 무수정

## 완료 기준

- §A: jwc 실행 시 jaw 테마+마크가 기본, gjc 실행 시 red-claw+claw 그대로 (brand 분기 검증) ·
  `verify-gjc-ui-redesign` + `rebrand-inventory --strict` 그린 · 스크린샷 기록
- §B: 인터뷰 점수·PABCD 단계·goal 상태 시각 표시 · 한글 스모크

## 열린 질문 (착수 전 인터뷰)

1. **§A 분리 선행 여부**: (a) 080에서 §A+§B 한 번에 (현행) vs (b) §A만 얇은 밴드로 당김 (030 전후)
2. **jaw 비주얼 방향**: 팔레트 (red-claw 대응 — 심해 블루/상어 그레이?), 마크 디자인 (상어 지느러미/턱?),
   테마 이름 (`jaw-deep`? `shark-fin`?) — 디자인 결정, dev-uiux 관점 시안 2–3개 제시 후 선택
3. 위젯 배치 (상태바 vs 사이드 패널) — 착수 시 목업
4. jwc TUI에서 cli-jaw 서버 헬스 표시 — [기본값] M1 범위 밖
