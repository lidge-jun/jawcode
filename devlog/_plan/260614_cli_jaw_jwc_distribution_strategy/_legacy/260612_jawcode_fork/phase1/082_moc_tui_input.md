# 082 — TUI 입력/IME 이슈 (MOC)

> 상태: 🔍 조사 완료 / 수정 ⬜. 소속: 080 밴드(TUI)의 입력·IME 하위군.
> ⚠️ 번호 규약: 입력/IME 버그군을 082 하위(082.n)로 묶음 (cursor 도구군 = [081](./081_moc_cursor_tools.md)).
> 공통점: 둘 다 **업스트림 gjc 코드 (0 diff)**, 둘 다 **한글 IME 환경에서 발현**, 수정은 `packages/tui` 입력/렌더 경로.

## 하위 문서

| # | 이슈 | 원인 요지 | 상태 |
|---|------|-----------|------|
| [082.1](./082.1_issue_tui_ctrl_ime.md) | 한글 IME에서 Ctrl 단축키·종료 미작동 | legacy 터미널이 0x03 대신 자모 바이트 전달, native 매처가 C0만 인식 | ✅ 종료 안전망(ESC 2연타) + 자모 chord 힌트(D안: 상태줄 "switch to English (한/A) or esc esc" 4초) / 일반 Ctrl=Kitty 권고 |
| [082.2](./082.2_issue_first_char_cursor_jump.md) | 첫 글자 입력 시 캐럿 우측 점프→복귀 | 플레이스홀더 프레임이 커서 마커를 꺼 미동기화 → 첫 글자 IME preedit 스냅 | ✅ 수정 (placeholder 마커 유지) |
| [082.3](./082.3_plan_interview_ask_docked_input.md) | 인터뷰 ask: ↑↓ **N+1=입력 슬롯** + `CustomEditor` embed (§9) | v2 구현 (`customInputListSlot`) | ✅ |

## 공통 배경

`packages/tui`는 자체 차등 렌더러 + 하드웨어 커서(IME support) 모드. 입력 경로에 preedit/compose 처리가
없어 조합 글리프는 터미널/OS IME에 위임됨 (`showHardwareCursor` 기본 true). 두 이슈 모두 이 "IME는
터미널이 그린다 + 앱은 C0/마커 기반"이라는 구조에서 한글 IME가 가정을 벗어나며 발생.

## 수정 우선순위 (제안)

1. **082.2 (A 또는 B안)** — placeholder 프레임에서도 커서 마커 유지. 낮은 위험, UX 직접 개선.
2. **082.1 (A+B+C 조합)** — Kitty baseLayoutKey 경로 자모 fallback + IME 독립 종료 안전망. legacy 터미널은
   터미널이 modifier를 안 주면 근본 한계 → Kitty 지원 터미널(Ghostty/Kitty/WezTerm) 권고 병행.

## 완료 기준

- 082.1: 한글 IME에서 Ctrl+C/Ctrl+D/주요 단축키 동작 (최소 Kitty 프로토콜 터미널) + 종료 안전망
- 082.2: 빈 입력에 첫 한글 글자 입력 시 캐럿 점프 없음 (PI_TUI_DEBUG 프레임 로그로 검증)
