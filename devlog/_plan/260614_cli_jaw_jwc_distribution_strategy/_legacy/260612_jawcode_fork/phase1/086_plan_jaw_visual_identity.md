# 086 — plan: jaw 비주얼 정체성 (080 §A + 010 잔여 묶음)

> 상태: ✅ 구현 완료 (260612) — **시안 확정**: 팔레트 **시안 3 `abyss-bite`** + 마크 **B 지느러미(fin)**.
> 태그라인 [기본값] `bite · build · ship` (사용자 미지정 — 변경 요청 시 문자열 1곳 수정).
> 소속: 080 ([080_moc_tui.md](./080_moc_tui.md) §A). ⬜ e2e: jwc 재시작 후 다크/라이트 육안 확인 + 스크린샷.
> ↳ 후속 이슈 [086.1](./086.1_issue_banner_scroll.md): 짧은 터미널 배너 스크롤백 잘림 → 수직 반응형 컴팩트 배너 패치 ✅.
> ↳ 후속 이슈 [086.2](./086.2_issue_scrollback_fragments_redraw.md): 스크롤백 TUI 조각 잔존 → `/redraw` 수동 복구 커맨드 ✅.
> 입력: 사용자 "080 §A + 010 리네이밍 묶음으로 플랜. dev-frontend·dev-uiux-design 스킬과 cli-jaw 디자인 철학을 보고" (260612).
> ⚠️ **fork 고유 변경 — 업스트림 PR 안 올림** (brand 조건부, gjc 모드 diff-0 원칙).

010이 텍스트 표면(배너 타이틀 `jwc vX · Jawcode`, 상태줄 `JWC`, 헬프 — 커밋 59d10c66)을
끝냈지만, **비주얼은 아직 100% gjc다**: 기본 테마 red-claw, welcome 배너의 claw 마크와
빨강-주황 그라디언트, 워드마크 "Gajae forge". jwc로 실행해도 화면은 가재 셸 그대로.
이 밴드는 cli-jaw 웹 UI가 이미 확립한 디자인 언어를 TUI로 이식해서, `jwc` 실행 시
jaw 정체성이 기본이 되게 한다. gjc 모드(`APP_NAME === "gjc"`)는 픽셀 하나 안 바뀐다.

## 1. 디자인 리드 (dev-uiux-design §2 형식)

**jaw의 디자인 DNA는 이미 cli-jaw 웹 UI에 존재한다** — 새로 발명하지 않고 이식한다.

근거: `cli-jaw/public/css/variables.css` 토큰 (OKLCH → hex 변환, sRGB):

| cli-jaw 토큰 | OKLCH | hex | 의미 |
|---|---|---|---|
| `--bg` | 7% 0.01 280 | `#010102` | 심해 — 거의 검정, 한색 기 |
| `--surface` | 11% 0.01 280 | `#040407` | 표면 |
| `--text` | 92% 0.01 270 | `#e2e4eb` | 본문 |
| `--text-dim` | 53% 0.02 270 | `#676b78` | 보조 |
| `--accent` | 78% 0.14 200 | `#00d1da` | **시안(cyan) — jaw 브랜드색** |
| `--accent2` | 70% 0.13 200 | `#00b6be` | 시안 보조 |
| `--green` | 78% 0.16 150 | `#5fd37f` | success |

폰트는 Chakra Petch(테크) + Outfit/Pretendard — TUI는 폰트 제어 불가이므로 **컬러·심볼·마크**가
정체성 전달의 전부다. 020 identity가 이미 🦈를 잡았다.

```
Reading this as: 개발자 TUI(코딩 에이전트 셸), 심해×상어 모티프의 차가운 테크 언어.
"Linear의 절제 + 심해 생물 발광" — red-claw의 갑각류 웜톤(빨강·산호·모래)을
정확히 대칭 반전한 한색 축 (hue 25→200).
DESIGN_VARIANCE: 3 · MOTION_INTENSITY: 2 (기존 그라디언트 인트로 1회만 유지) · density: devtools
Do: 시맨틱 컬러 무결성 (브랜드색 ≠ error/warning/diff — gjc REBRANDING_PLAN 원칙 3)
Don't: 이모지 UI 남발 (테마 symbols 슬롯 외 금지), 레이아웃 변경 (스킨만 — 080 [기본값])
```

## 2. 시안 — 선택 대기 (각 시안 = 팔레트 + 테마명)

> 🖼️ **HTML 미리보기**: [086_preview.html](./086_preview.html) — TUI welcome+채팅 목업,
> 3종 팔레트 × 다크/라이트, 마크 A/B 비교, 배너 그라디언트 띠.

red-claw 팔레트의 역할 슬롯(ink/mantle/surface/accent/…)을 1:1로 유지하고 색만 치환.

### 시안 1 — `jaw-deep` (심해 시안 · cli-jaw 웹 직계) ⭐ 추천

cli-jaw 웹과 같은 hue 200 축. 웹↔TUI 단일 브랜드 언어, accent 시안이 error 빨강·warning 호박과
멀어 시맨틱 충돌 제로.

| 슬롯 (red-claw) | red-claw | jaw-deep |
|---|---|---|
| accent (claw `#ff6a3d`) | 주황 | `#00d1da` 시안 |
| brandRed `#ff3b30` → brandCyan | 빨강 | `#00b6be` |
| ink `#110b0b` / mantle `#1b1010` | 적갈 흑 | `#0a0d12` / `#0e131b` 청흑 |
| surface `#2a1515` / Bright `#3a1d1d` | | `#14202c` / `#1b2c3c` |
| foam `#ffe7dc` (text) | 조개 미색 | `#dfeef2` 물거품 백 |
| coral/sand 하이라이트 | 산호/모래 | `#7ee8f0` / `#bdeff4` 발광 플랑크톤 |
| 배너 그라디언트 | 적갈→빨강→산호→모래 | `#0f2a43`→`#13647f`→`#00b6be`→`#00d1da`→`#d9f6f8` |

### 시안 2 — `shark-gray` (상어 그레이 · 절제)

상어 등가죽 스틸 그레이 + 흰 배 하이라이트. accent `#7da7c4`(차분한 스틸 블루), 표면은 무채색
한색 그레이. GitHub 결의 무광 프로페셔널 — 브랜드색 존재감은 시안 1보다 약함.

### 시안 3 — `abyss-bite` (심해 + 바이트 포인트)

베이스는 시안 1과 동일한 심해 블루, **accent 한 슬롯만 red-claw의 `#ff6a3d`를 계승** —
"물어뜯는 포인트". gjc와의 혈통 연속성은 최고지만 warm accent가 warning 호박(`#f5b84b`)과
근접 — 원칙 3 위반 위험, 채택 시 warning 색 재조정 필요.

### 마크 방향 (welcome 배너 — 초안, 구현 시 정련)

claw 마크(welcome.ts:281, 6행 × ~36열 박스드로잉)와 같은 규격으로:

- **방향 A — 턱(jaws)**: 위·아래 이빨 지그재그(`╲╱`)가 마주 보는 열린 턱. claw의 "집게 두 짝"
  대칭 구도를 "턱 두 짝"으로 계승 — 시각적 혈통 유지.
- **방향 B — 지느러미(fin)**: 수면선(`～`) 위로 솟은 등지느러미 삼각형. 더 미니멀하고 좁은
  터미널 폴백에 유리하나 claw 구도와 단절.

### 워드마크/태그라인 (welcome.ts:111-112, brand 조건부)

`Gajae forge` / `shape · act · prove` → `Jawcode` / 태그라인 후보:
(a) `bite · build · ship` (b) `scent · strike · ship` (c) `sense · bite · prove` — 선택 대기.

## 3. 작업 항목 (코드 앵커)

| # | 항목 | 위치 |
|---|---|---|
| 1 | **jaw 테마 JSON 신설** — red-claw.json 복제(vars ~37·colors 67키·export·symbols) 후 시안 팔레트 치환. symbols: blue-crab 패턴(🦀/🦞/🌊) 참고해 `icon.pi`→🦈 등 jaw 오버라이드 | `modes/theme/defaults/jaw-*.json` + `defaults/index.ts:2-6` 등록 |
| 2 | **브랜드 조건부 기본 테마** — `"red-claw"` 하드코딩 4곳을 단일 헬퍼 `defaultDarkTheme()`(= `APP_NAME !== ENGINE_NAME ? "jaw-*" : "red-claw"`)로 수렴 | `theme.ts:1788, 1809, 1823-25, 1855` · brand 축: `utils/dirs.ts:20-23` (jwc bin이 `GJC_BRAND_NAME=jwc` 세팅 — `jwc/bin/jwc.js:2`) |
| 3 | **welcome 배너 brand 분기** — `RED_CLAW_LOGO`(:281)·`GRADIENT_STOPS`(:291)·`GRADIENT_RAMP_256`(:300)·워드마크/태그라인(:111-112)을 brand별 세트로. ⚠️ `REST_FRAME`(:389)이 모듈 로드 시 1회 계산 — APP_NAME은 env 기반 상수라 로드 시 분기 가능, 착수 시 확인. ASCII/narrow 폴백 유지 (원칙 4) | `modes/components/welcome.ts` |
| 4 | **잔여 텍스트 스윕** — `$ gjc ...` 리터럴 16건 (011 이월): examples를 APP_NAME 보간으로 | `gjc-runtime/ultragoal-runtime.ts`, `commands/state.ts`, `commands/ralplan.ts`, `commands/ultragoal.ts` 외 |
| 5 | **가드 정합** — `verify-gjc-ui-redesign.ts`(상태줄 프리셋 검사) 저촉 확인, `rebrand-inventory` 기대값에 jaw 테마 파일 추가 필요 여부 | `scripts/` |

## 3.5 구현 기록 (260612)

- 테마 2종: `abyss-bite.json`(다크) + `abyss-bite-light.json`(라이트) — red-claw vars 키 1:1 유지
  (blue-crab 선례), colors 매핑 무수정이라 67키 커버리지 보장. symbols: 🦈/🐟/🌊.
- **계획에 없던 발견 1 — settings 스키마 기본값이 brand 기본값을 덮어씀**: `main.ts:839`가
  `settings.get("theme.dark")`를 initTheme에 항상 전달 → 스키마 default `"red-claw"`가 `??` 폴백을
  무력화. `settings-schema.ts:398/409` default도 brand 조건부로 패치 (theme.ts 헬퍼만으론 부족했음).
- **계획에 없던 발견 2 — 라이브 피드백 "채팅 창이 아직 빨간색"**: `colors.accent`(입력창 테두리·
  상태줄 모델·리스트 불릿 등 광역 슬롯)가 bite 주황이면 화면 전체가 red-claw처럼 읽힘.
  **시안-우선 재배분**: claw/accent/coral → 시안 계열(#00d1da/#2fc4ce), bite 주황(#ff5a2e)은
  crabShell/brandRed 점 슬롯(mdHeading·syntaxKeyword·borderAccent·thinkingHigh)에만 잔류.
  배너 그라디언트도 주황을 끝점 1스톱으로 축소 (시안 지배 + 바이트 팁).
- **macOS 라이트 모드 가시성**: 라이트 팔레트 dim 톤 상향(dimGray #6b7c87, dimShell #6b7f89),
  accent #00788a(흰 배경 대비 확보). 발견 1 패치로 jwc의 theme.light 기본값이 abyss-bite-light로
  떨어지는 것 확인 (이전엔 blue-crab 다크 팔레트가 라이트 터미널에 적용돼 글자가 안 보였음).
- 가드 확장 (010 전략 — 끄지 않고 기대값 확장): `verify-gjc-ui-redesign.ts`가 brand 조건부 표현식
  + 4테마 defaults를 기계 검증. `gjc-ui-redesign.test.ts`·`theme-selector-input.test.ts` 기대값 갱신.
- 신규 테스트: `test/brand-visual-identity.test.ts` — 서브프로세스 양방향 분기
  (jwc→abyss-bite+Jawcode 배너 / gjc→red-claw+claw 배너).

- **계획에 없던 발견 3 — 입력창 테두리 = effort 인디케이터** (라이브 피드백 2 "아직 메세지 창이
  빨간색"): 컴포저 테두리는 `getThinkingBorderColor(level)`(theme.ts:1313, interactive-mode.ts:882) —
  사용자가 effort `high` 상시라 `thinkingHigh`=bite 주황이 테두리 전면에. **effort 램프 재배치**:
  off dim → low `#2fc4ce` → medium `#00d1da` → high `glow #00e5f2`(전기 시안) → **xhigh/max만 bite 주황**
  ("최대 출력에서만 문다"). error 빨강과 분리 유지. high 1차 시안(seafoam 파스텔)은 "테두리가
  가늘어 보임" 피드백으로 고채도 glow로 교체 — 글리프는 동일, 색 잉크 밀도 차이였음.
- 마크 정련 (라이브 피드백 3·4·5): 꼬리 █ 블록 띠 시도는 "투박" 반려 → 닫힌 윤곽선 → **최종**:
  앞전은 둥근 라이트 스텝 커브(╭─╯), **꼬리쪽 뒷전은 헤비 박스(┗━┓, 팁 전환 ╼·수면 전환 ┖)로
  2배 굵게**, 내부에 **아가미 슬릿 ╱ 2줄**(이음새 불필요한 내부 포인트라 대각선 사용 가능).
  윤곽 끊김 0, 파도선(~)에서만 절단, 바이트 주황이 헤비 팁에 얹힘. 렌더 스모크 + 테스트 그린.
- 배너 레이아웃 (라이브 피드백 6): branded일 때 **왼쪽 정렬 + 2분할 강제** — 기존엔 좌열 35%
  캡(desiredLeftCol)이 fin 폭(35)보다 작아 width 100에서도 우열이 숨고 단일 중앙 열로 폴백했음.
  branded는 좌열을 콘텐츠 폭만큼 성장(우열 최소폭 20 보장 시), 좌열에 워드마크/태그라인/**버전**/
  fin/모델·프로바이더 좌측 몰기. gjc는 기존 중앙 정렬·35% 공식 그대로 (분기).
  Flow keys도 branded는 키 이름만 (`/ · # · ! · $ · ?` / `ctrl+l · shift+tab`) — 설명 텍스트 제거.
  Session trail은 세션 3개 → 빈 줄 → `/resume` 단독 안내로 확정 (branded, 세션 셀렉터 진입 커맨드).

## 4. 검증 / 완료 기준 (080 MOC §A 완료 기준 구체화)

- ✅ `jwc` 실행: jaw 테마 + jaw 마크 + Jawcode 워드마크 기본. `gjc` 실행: red-claw + claw 그대로
  (**brand 분기 양방향 검증** — `brand-visual-identity.test.ts` + settings 스키마 양방향 확인)
- ✅ rebrand-inventory exit 0 · `verify-gjc-ui-redesign` 그린 · tsc 클린
- ✅ `$ gjc` 리터럴 grep 0건
- ✅ coding-agent 전체 스위트 5354 pass / 4 fail — 4건 모두 기존 베이스라인 실패와 동일 (신규 회귀 0)
- ⬜ 스크린샷 기록 (truecolor / 256색 폴백 각 1장) — e2e 시

## 5. 비충돌 메모 (동시 세션)

050(orchestrate)·090(kiro, `packages/ai/*` 미커밋 WIP)은 타 세션 영역 — 본 밴드 변경 표면
(`modes/theme/`, `modes/components/welcome.ts`, `commands/*` 문자열, `scripts/`)과 교집합 없음.
