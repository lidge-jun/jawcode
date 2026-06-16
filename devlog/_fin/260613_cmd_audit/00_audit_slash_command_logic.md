# 00 — audit: 슬래시 커맨드 논리 취약점 전수 감사

> 상태: 조사 ✅ (260613, /help 2창 작업 중 파생) / **재감사 v2 ✅ (260613, 플립 `8e17a1ce`
> 랜딩 후 현행 기준 — 하단 절)** / 수리: **P1 ✅ (260613 — `allowArgs: true` + 회귀 1케이스,
> model-onboarding-guidance 6 pass · provider 7 pass · tsc 0)** / P2~P9 잔여는 v2 표 참조.
> 입력: 사용자 "지금 cmd들의 논리적 취약점들이 있을텐데 그것도 _plan에 별도 폴더 만들어서 기록".
> 방법: `builtin-registry.ts` 정적 스윕(스펙 39건 파싱) + 디스패처 2종(TUI `:1382`·ACP
> `acp-builtins.ts`) 게이트 추적 + 입력 파이프라인(`input-controller.ts:320-440`) 폴스루 추적.
> 관련: [99.20.02](../../_plan/260612_jawcode_fork/phase1/99.20.02_audit_interaction_grammar.md) (인터랙션 문법
> 불일치 — 본 감사는 그 커맨드-계층 자매편), [99.20.08](../../_plan/260612_jawcode_fork/phase1/99.20.08_impl_help_command.md) (/help).

슬래시 커맨드 계층은 "스펙 선언(레지스트리) → 디스패처 게이트 → 폴스루(LLM 프롬프트)"의
3단인데, **선언과 집행이 어긋나는 지점마다 입력이 조용히 LLM으로 새는 구조**다. 아래 9건 중
P1이 실사용 버그, P2가 구조 원인, 나머지는 계약 불일치·표면 비대칭이다.

## P1 — `/model <인자>`가 LLM 채팅으로 폴스루 (실버그, 수리 1줄)

- **선언**: `/model`은 `inlineHint: "[target] <model>"`로 인자 사용을 광고하고, `handle`
  본문은 `command.args`를 파싱해 모델을 전환한다 (`builtin-registry.ts:344-420`).
- **집행**: `allowArgs` 미설정 → TUI 디스패처 게이트
  `if (parsed.args.length > 0 && !command.allowArgs) return false` (`:1382`)에서 거부.
- **결과**: `/model sonnet`이 **명령이 아니라 채팅 프롬프트로 LLM에 전송**된다 (폴스루 경로
  `input-controller.ts:320→440`). bare `/model`은 셀렉터가 뜨므로 사용자는 인자형이 "가끔
  되는 것처럼" 오인 — ACP에서는 인자형이 정상 동작해 혼란 가중 (P3).
- **수리**: `allowArgs: true` 1줄. 단 fork/resume 병행 작업이 같은 파일을 만지는 중 —
  랜딩 타이밍 조율.

## P2 — 슬래시 폴스루 자체가 무경고 (구조 원인)

- 거부(false)·오타 커맨드는 경고 없이 일반 프롬프트로 흘러간다. 보호 장치는
  `formatUnknownBuiltinSlashCommandDiagnostic` 단 하나인데 **하드코딩 오타 1건("provicer")**
  전용 (`:1333-1340`) — 특정 오타만 잡는 단발 특례는 그 자체가 문법 불일치.
- 수리안: ① 등록 명령인데 인자 거부면 usage 에러 표시 (silent false 금지) ② 미등록
  `/이름`이면 컴포저 푸터(99.20.06)에 "unknown command — sent as chat" transient 1줄.

## P3 — `allowArgs` 게이트의 모드 비대칭

- TUI 디스패처만 게이트 (`:1382`). **ACP 디스패처(`acp-builtins.ts`)에는 게이트 부재** —
  같은 스펙이 TUI에서는 거부, ACP에서는 실행. `types.ts:84` 계약 주석("the dispatcher
  refuses")은 단수 디스패처를 전제 — 계약 문서와 집행 불일치.

## P4 — TUI-전용 17종, ACP 표면 공백

- `handleTui`만 있고 `handle`이 없는 스펙: settings · theme · goal · hotkeys · monitors ·
  login · logout · new · drop · resume · fork · branch · btw · retry · background · debug
  (+ agents는 격리). ACP 클라이언트에는 광고조차 안 됨 — 셀렉터류(theme/settings)는 타당하나
  **goal/new/drop/resume 같은 세션 수명 동작의 ACP 부재는 기능 갭**. 역방향(handle-only:
  identity·identity-auto·orchestrate)은 어댑터로 TUI 동작 — 문제 없음.

## P5 — ~~aliases는 실행만 되고 발견 불가~~ → ✅ 해소 (260613)

- ~~자동완성 매칭은 정식 name만~~ → **양측 모두 해소**: ① /help 2창 디테일 페인에 aliases
  표기 (99.20.08 §7) ② `extensibility/slash-commands.ts:119-124`가 별칭을 독립 자동완성
  항목으로 노출 ("alias of /name" 설명 포함, 병행 세션 랜딩). 잔여 없음.

## P6 — `subcommands` 계약의 이중 용법

- 계약(`types.ts:18`): "Subcommands for dropdown completion" = 하위 **동작**. 그런데
  `/effort`는 값 enum(off/minimal/…/status)을 subcommand로 등재하고, `/fast`는 같은
  값-인자를 `inlineHint "[on|off|status]"`로 표현 — **같은 의미를 두 문법으로** (99.20.02
  ⑤의 커맨드-계층 판박이). 카탈로그/디테일 표면에서 "subcommands"라는 라벨이 값 목록에
  붙는 의미 왜곡 발생 (/help 2창에서 노출됨).

## P7 — in-command help 문법 3종 혼재

- `/ssh` = `help` 서브커맨드 선언 + `!subcommand || subcommand === "help"` / `/todo` =
  `case "help"` 비선언 처리 / 다수 명령 = help 부재. 글로벌 `/help`(99.20.08) 신설로 위계가
  생겼으니 in-command help는 "usage 에러 메시지로 통일 + 서브커맨드 선언 제거"가 일관.

## P8 — 종료 표면 3종 의미 점검 (99.20.02 ④ 연동)

- `/exit` = 즉시 종료 · ctrl+d = (99.20.06 W2) 빈 에디터 더블프레스 · esc esc = 안전망 즉시
  종료. 명령형(/exit)의 즉시성은 타당하나, **ctrl+d 리바인드 사용자가 /exit에 기대하는
  거동과 키 거동이 분기**됨을 문서화할 것. doubleEscapeAction(tree/branch) 데드 경로 잔존.

## P9 — 레지스트리 필터의 로드 시점 고정

- `ACTIVE_…REGISTRY`가 모듈 import 시 `isJawBrand()`를 1회 평가 (`:1319-1323`) — 프로세스
  내 브랜드/env 전환 시 재평가 불가. 현 운영상 위험 낮음 — 기록만.

## 수리 우선순위 제안

| 순위 | 항목 | 비용 |
|---|---|---|
| P1 | `/model` `allowArgs: true` | 1줄 + 회귀 1케이스 |
| P2 | 거부 시 usage 에러 + 미등록 푸터 안내 | 소(디스패처 분기 2개) |
| P3 | ACP 게이트 동기화 (또는 계약 주석 정정) | 소 |
| P5 | 자동완성 별칭 매칭 | 소~중 (tui autocomplete) |
| P4/P6/P7 | 표면 정비 — 슬라이스 분리 | 중 |
| P8/P9 | 문서화/기록 | — |

---

## 재감사 (260613 v2 — gjc→jwc 플립 `8e17a1ce` 랜딩 후 현행 기준)

> 방법: 위 9건을 현행 `slash-commands/builtin-registry.ts`·`acp-builtins.ts`·
> `modes/controllers/input-controller.ts`에 대해 재추적. 파일 경로가 `modes/` →
> `slash-commands/`로 이동했으나 핵심 라인(:1382 게이트, :1333 provicer, :1319 ACTIVE 필터)은
> 번호까지 유지.

| # | v1 상태 | v2 판정 | 근거 |
|---|---|---|---|
| P1 | 실버그 | 🔴 **여전히 미수리** | `/model` 스펙(`:345` 블록)에 `allowArgs` 부재, 게이트 `:1382` 그대로 — `/model sonnet`은 지금도 채팅으로 폴스루. **v1의 랜딩 보류 사유(fork/resume 병행 작업)는 플립 랜딩으로 소멸 — 즉시 수리 가능** |
| P2 | 구조 원인 | 🔴 그대로 | `formatUnknownBuiltinSlashCommandDiagnostic` 여전히 "provicer" 1건 특례 (`:1333-1340`), usage 에러/푸터 안내 미구현 |
| P3 | 모드 비대칭 | 🔴 그대로 | `acp-builtins.ts`에 `allowArgs` 참조 0건 — TUI만 게이트하는 비대칭 유지 |
| P4 | TUI-전용 17종 | 🔴 **확대 (17→20종)** | handleTui-only: 기존 + redraw·tree·exit. goal/new/drop/resume 세션 수명 갭 그대로 |
| P5 | ✅ 해소 | ✅ 유지 | `extensibility/slash-commands.ts:135` — 별칭 독립 자동완성 + "alias of /name" 건재 |
| P6 | 이중 용법 | 🟡 **형태 변화** | `/fast`도 값 enum을 subcommands로 채택(`:502-505`) — fast/effort 간 문법 불일치는 해소됐으나, "값 enum을 subcommands(하위 동작) 계약에 등재"하는 의미 왜곡은 1건→2건으로 확대 |
| P7 | 3종 혼재 | 🟡 **축소 (3종→2종)** | `/todo` 레지스트리에서 제거 + `case "help"` 패턴 소멸. 잔존: `/ssh` 선언형(`:1016`) vs `/provider` ad-hoc `args === "help"`(`:830`·`:886`) |
| P8 | 데드 경로 | ⚪ **진술 stale — 항목 재작성 필요** | `doubleEscapeAction`은 데드가 아니라 활성: `input-controller.ts:130`에서 빈 에디터 더블 esc 시 tree(기본)/branch/none 분기, `tree.md` 문서에도 명시. v1의 "esc esc = 즉시 종료 안전망" 전제 자체가 현행과 불일치 |
| P9 | 기록만 | 🔴 그대로 | `ACTIVE_BUILTIN_SLASH_COMMAND_REGISTRY` 로드 시 `isJawBrand()` 1회 평가 (`:1319-1322`) |

### v2 수리 우선순위 (갱신)

| 순위 | 항목 | 비고 |
|---|---|---|
| ~~P1~~ | ~~`/model`에 `allowArgs: true` 1줄 + 회귀 1케이스~~ | ✅ 수리 완료 (260613, 본 감사 마감 커밋과 함께 랜딩) |
| P2+P3 | 거부 시 usage 에러 + ACP 게이트 동기화 | 같은 디스패처 슬라이스로 묶어 처리 권장 |
| P6 | `subcommands` 계약 주석(`types.ts`)을 "동작+값 enum 겸용"으로 정정하거나 값 전용 필드 분리 | fast/effort 통일로 코드 쪽 정리는 끝 — 계약 문서만 결정 필요 |
| P7 | `/provider`의 ad-hoc help 2사이트를 usage 에러로 통일 | /todo 소멸로 잔여 면적 절반 |
| P8 | 항목 자체를 현행 거동(doubleEscapeAction 활성) 기준으로 재작성 | 수리 아님 — 감사 기록 정정 |
| P4/P9 | 변동 없음 — v1 판단 유지 | |
