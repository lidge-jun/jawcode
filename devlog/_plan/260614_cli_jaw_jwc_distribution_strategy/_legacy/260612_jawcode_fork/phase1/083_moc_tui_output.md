# 083 — TUI 출력 접기/노이즈 (MOC, 계획)

> 상태: 🔶 083.2 ✅ + 083.1 1차(minimize) ✅ (260612 12시) / 083.1 패턴 B(포커스 개별 펼침)·패턴 A(Ctrl+T 오버레이) ⬜.
> 소속: 080 밴드(TUI)의 출력-밀도 하위군. 입력: 사용자 "jwc가 claude code처럼
> 접기가 부족, --verbose 항상 보는 느낌" (260612 10시) + "tool↔tool 공백 너무 큼".
> ⚠️ 번호 규약: TUI 출력 밀도 버그군을 083 하위(083.n)로 묶음 (081=cursor 도구, 082=TUI 입력/IME).

jwc TUI가 Claude Code 대비 출력이 장황하게 느껴지는 문제. 조사 결과 **접기 인프라는 있으나(도구 출력
previewLines + ctrl+o 펼침, JSON 트리 collapse, thinking 토글) 두 가지 핵심 UX가 빠져 있다.**

## 하위 문서 (계획)

| # | 이슈 | 핵심 | 상태 |
|---|------|------|------|
| [083.1](./083.1_plan_tool_autocollapse.md) | 완료 도구 자동 접힘 | A 도구→B 도구 시 A가 한 줄 요약으로, ctrl+o 전체 / ctrl+↑ 포커스 개별 / alt+t 전체 transcript 오버레이 | ✅ 완료 (3a85824, e74b2d9, d317e42e) |
| [083.2](./083.2_plan_tool_spacing.md) | 도구 간 공백 과다 | 도구 사이 빈 줄 3줄 → 1줄 (Box/Text 세로 패딩 0, Spacer 일원화) | ✅ 구현 (a590aea) |
| [083.3](./083.3_issue_thinking_interleave.md) | 추론 인터리빙 소실 | 도구 뒤 thinking이 상단 단일 어시스턴트 블록에 합쳐짐 — 단일 streamingComponent 구조가 원인 → 세그먼트 분할(A안) 적용 | ✅ 수정 완료 |
| [083.4](./083.4_plan_effort_command.md) | `/effort` 커맨드 | 추론 강도 직접 지정 표면 부재 → Codex 표준 어휘로 슬래시 커맨드 추가 (none/minimal 별칭 포함) | ✅ 구현 완료 |
| [083.5](./083.5_plan_thinking_collapse.md) | thinking 블럭 접기 | 기본 접힘(1줄 `Thinking … +N lines`) · ctrl+t=thinking만 토글 · ctrl+o=전체(도구+thinking) · 스트리밍 tail은 항상 전문 | ✅ 구현 완료 (260612) |
| [083.6](./083.6_issue_autocollapse_editor_jump.md) | 자동접힘의 입력창 출렁임 | 턴 중간 minimize가 프레임 높이를 진동시켜 컴포저(흐름 마지막 줄)가 위아래로 이동 — 옵션 A(턴말 일괄)~B(하단 고정) 기록 | 🔍 분석 기록 |
| [083.7](./083.7_plan_composer_bottom_pin.md) | 하단 고정 컴포저 | ViewportFill 센티널 스페이서로 입력창을 터미널 바닥에 상시 고정 (B안 상세 설계 — 렌더러 코어 무수정, 센티널 치환 1줄) | ⬜ 계획 |
| [083.11](./083.11_issue_global_toggle_commit_lane.md) | 커밋 레인 전역 토글 비대칭 | `ctrl+o`/`ctrl+t`가 미커밋 현재 턴만 접고 커밋된 과거 scrollback 픽셀은 열린 채 남음 — commit lane 불변식과 전역 가역 토글 UX 충돌 | 🔴 사용자 실기기 버그 기록 |
| [260614_tui_codex_live_toggle](../../../../260614_tui_codex_live_toggle/00_moc.md) | Codex식 live-only 토글 | `ctrl+t` thinking 매핑 제거 · `ctrl+o`는 현재 미커밋/live tool+thinking만 토글 · 과거 scrollback은 collapsed canonical 커밋 · full transcript overlay는 후속 phase | 🟡 새 devlog로 이동 |

## 업스트림 스택 PR (260612 제출, base=dev)

| PR | 내용 | fork 커밋 | 의존 |
|----|------|----------|------|
| [#521](https://github.com/Yeachan-Heo/gajae-code/pull/521) | 083.2 도구 간 공백 1줄 | a590aea | — |
| [#522](https://github.com/Yeachan-Heo/gajae-code/pull/522) | 083.1 자동 접힘 + ctrl+↑ 포커스 + alt+t 오버레이 | 3a85824·8bef330·e74b2d9·d317e42e | #521 |
| [#523](https://github.com/Yeachan-Heo/gajae-code/pull/523) | 083.3 추론 인터리빙 세그먼트 분할 | b06d48c | #522 |

fork에서는 GitHub 진짜 스택(base=fork 브랜치)이 불가 → 전부 base=dev, 브랜치 체인 + "depends on" 표기
방식. 선행 PR 머지 시 후행 diff 자동 축소. dev 기존 실패 18건(searchExa 등 네트워크/키 의존)은 무관 확인.
(/effort는 별도 [#520](https://github.com/Yeachan-Heo/gajae-code/pull/520).)

## 관련 레버 (참고)

- **thinking 기본 펼침**: `hideThinkingBlock` 기본값 `false` (`settings-schema.ts:729`) → 추론 트레이스가
  매 턴 통째로 인라인. Claude Code는 기본 접음. 083 범위 밖이나 노이즈 동일 원인 — 별도 결정 시 jwc 브랜드
  기본값 변경 또는 "완료 후 한 줄 요약 접기" 검토 가능. (사용자 1차 선택은 "도구 자동 접힘" 우선.)

## 공통 코드 지도

- 라이브 도구 컴포넌트 생성: `packages/coding-agent/src/modes/controllers/event-controller.ts:472`
  (`#handleToolExecutionStart` → `new ToolExecutionComponent` → `chatContainer.addChild`, `pendingTools` 추적)
- 정적 재렌더(히스토리): `packages/coding-agent/src/modes/utils/ui-helpers.ts` (`setExpanded(toolOutputExpanded)` 전역 적용)
- 전역 펼침 토글: `toolOutputExpanded` (ctrl+o = `app.tools.expand`) — 모든 도구 일괄 토글, 도구별 상태 없음
- 도구 컴포넌트: `packages/coding-agent/src/modes/components/tool-execution.ts`
  (`setExpanded`, `#expanded`, `previewLines`, 생성자 `:198 Spacer(1)` / `:201-202 Box/Text(1,1)`)

## 완료 기준 (구현 시)

- 083.1: 도구 여러 개 실행 시 활성 도구만 펼침, 이전 완료 도구는 한 줄 요약 + ctrl+o로 재오픈 → ✅ 1차 충족
  (단위 테스트 `tool-execution-minimize.test.ts`). **포커스 기반 개별 펼침(패턴 B)·Ctrl+T 오버레이(패턴 A)는 잔여.**
- 083.2: 도구 간 빈 줄이 1줄 이내로 축소 → ✅ 정확히 1줄 (`tool-execution-spacing.test.ts`), gjc 무회귀
  (스위트 5322 pass, 변경은 브랜드 무관 공통 컴포넌트).
