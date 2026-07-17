# 020_omp_D07_ask_dialog

> Range: `7aa1d581c..b0d04e517` (subset)
> Cluster: D07 — ask dialog
> Sol priority: P2
> Model-related: no
> Card target: 20.058_ask_dialog
> Worker: OW4

## 커밋 전수 테이블

| # | hash | summary | JWC impact area |
|---|---|---|---|
| 1 | `38a5c8a89` | Added a rich interactive ask dialog | ask tool, extension UI, settings |
| 2 | `69c02c802` | Reset countdown on input and bounded prompt titles | ask dialog timer and viewport |
| 3 | `48b2a742c` | Added distinct chat redirect results and row-specific note prefill | ask result contract and note editor |
| 4 | `1d14e262b` | Tagged guest results and gated Next | ask dialog result identity and navigation |
| 5 | `f66e52767` | Fixed guest multi-select Next gating and bottom-border height | multi-select validation and layout |
| 6 | `bcee73e58` | Streamlined ask dialog workflow and layout | ask dialog and extension UI controller |

## 주제 분석

이 클러스터는 ask를 단순 단일 선택창에서 여러 질문을 연속 처리하는 대화형 폼으로 확장한다. multi-select에서는 하나 이상의 선택이 있을 때만 Next가 활성화된다. 직접 입력한 guest 결과는 일반 옵션과 구분해 보존한다. 각 행의 note 편집은 그 행의 이전 값을 prefill해야 한다.

timeout은 사용자가 입력을 시작하면 다시 계산해야 한다. 그렇지 않으면 답을 작성하는 중에 다이얼로그가 닫힌다. chat redirect는 일반 취소나 옵션 선택과 다른 결과 타입이어야 호출자가 후속 대화로 정확히 전환할 수 있다. 화면 높이와 제목 폭도 작은 터미널에서 하단 경계와 현재 선택을 가리지 않아야 한다.

## Worktree 대조

현재 JWC의 `packages/coding-agent/src/tools/ask.ts`는 multi-select, 여러 질문, prefill, timeout, 로컬/Telegram 응답 경쟁을 지원한다. 원격 ask를 위한 `notifications/ask-bridge.ts`와 Telegram inline keyboard도 있다. 즉 ask 기능 자체는 OMP보다 다른 방향으로 이미 확장되어 있다.

반면 OMP의 독립 `ask-dialog.ts`는 JWC에 없고, JWC는 extension UI/editor 흐름 안에서 ask를 구성한다. 따라서 카드에서는 화면 파일 유무가 아니라 Next gating, guest identity, 입력 시 countdown reset, 행별 note prefill, chat redirect 결과를 행동 계약으로 비교해야 한다. 특히 Telegram 원격 응답과 로컬 다이얼로그가 경쟁할 때 동일 결과 스키마를 유지하는지도 함께 확인해야 한다.

## 누락 커밋 보완 (2026-07-17)

범위 전체와 기존 분류 파일의 정확한 해시 차집합에서 확인한 누락 커밋을 추가한다.

| # | hash | git one-line summary | classification |
|---|---|---|---|
| 1 | `34f8eb70f` | fix(tui): honor ends during plan review reflow | ask/todo dialog |
| 2 | `3617668c6` | fix(coding-agent): narrowed todo question detection | ask/todo dialog |
| 3 | `4fa5b61b0` | Add plan review copy hotkey | ask/todo dialog |
| 4 | `6b6471c86` | fix(coding-agent): suppressed todo reminders for questions | ask/todo dialog |
| 5 | `82327af42` | fix(coding-agent): require terminal user prompt for todo suppression | ask/todo dialog |
| 6 | `dc2235fa9` | fix(tui): preserved plan review scroll position | ask/todo dialog |
| 7 | `fd3f15c91` | fix(todo): signal removal intent so agent stops rebuilding cleared todos | ask/todo dialog |
