# 260630 — Codex 문서 정합성 검토 리시트

## 무엇을 대조했나

요청 범위에 따라 소스 코드는 읽기만 하고, 문서 수정은 `structure/31_scroll.md`와
`devlog/_plan/260630_scroll_seam_duplication/` 아래 Markdown으로 제한했다.

대조 대상은 다음 기술 주장이다.

- `packages/tui/src/tui.ts`: `#overflowFloor`, `#previousRawLines`, `#lastTombstoneRows`,
  `#fillSentinelPresent`, `#overflowFloorFrozen`, `setOverflowFloorFrozen()`,
  `compactViewportFill()`, `#expandViewportFill()`, `#restoreOverflowFloor()`,
  `#raiseOverflowFloor()`, `fullRender(clear=true)` 다운그레이드 가드, `viewportRepaint`,
  `appendGrowthAndRepaintViewport`, `firstChanged < viewportTop` 분기, frozen-floor diff 가드.
- `packages/coding-agent/src/modes/controllers/input-controller.ts`: 정상 제출 경로의
  `commitFinalizedBacklog()` 직후 `setOverflowFloorFrozen(false)`와 `compactViewportFill()`,
  `toggleToolOutputExpansion()`, `#currentTurnToggleTargets()`, `setToolsExpanded(expanded)`.
- `packages/tui/test/scroll-seam-duplication.test.ts`: 테스트 케이스 이름과 수, buffer 중복
  어서션, frozen-floor 전체 버퍼 동일성 어서션, compact replay 회귀.

## 발견·수정한 불일치

1. `structure/31_scroll.md` §9가 `scroll-seam-duplication.test.ts`를 4케이스로 설명했지만,
   현재 테스트 파일은 5케이스다. frozen-floor ctrl+o 왕복 정확 복원 케이스가 추가되어 있어
   §9를 5케이스로 고쳤고, 전체 버퍼 동일성 어서션을 명시했다.

2. `00_root_cause_and_fix.md`는 1차 seam 수정 당시의 "신규 회귀 4케이스"와
   "`packages/tui/src/tui.ts` 렌더러 내부 수정" 서술을 담고 있었다. 후속 01 문서 이후 현재
   전체 상태로 읽으면 `input-controller.ts` 와이어링과 5번째 테스트가 누락처럼 보이므로,
   00의 결론은 유지하되 "1차 수정"과 "01 후속 이후 5케이스"로 시간순을 분리했다.

3. `structure/31_scroll.md`의 `input-controller.ts:<line>`와 `tui.ts:<line>` 인용 일부가
   현재 미커밋 코드 라인과 맞지 않았다. 라인 번호는 변경 중 쉽게 흔들리므로, 해당 문장은
   메서드·분기명 중심으로 바꿨다.

4. ctrl+o 대상 설명이 `liveToggleEligible`인 chat/live-zone 자식만 순회한다고 되어 있었지만,
   현재 `setToolsExpanded`는 `#currentTurnToggleTargets()`를 통해 현재 턴 chat slice,
   `liveToolContainer`, `streamingComponent`를 모은 뒤 순회한다. 이 현행 동작에 맞춰
   `structure/31_scroll.md`를 수정했다.

5. 구 sticky gap 표현은 현행 동작으로 읽히지 않도록 점검했다. `structure/31_scroll.md`에서
   sticky gap은 260630 이전 실패 모드와 역사적 맥락으로만 남아 있으며, 현행 정책은
   `#restoreOverflowFloor`의 in-place 톰스톤과 `compactViewportFill()`의 강제 렌더/다운그레이드
   경로로 정리되어 있다.

## 남긴 판단 근거

- `#restoreOverflowFloor()`는 ViewportFill sentinel이 없으면 floor 상태를 리셋하고 반환한다.
  sentinel이 있고 `#overflowFloor > height && lines.length < #overflowFloor`일 때만
  `#previousRawLines`와 비교해 첫 변경 행을 찾고, `#viewportTopRow` 위 tombstone은 이전 raw
  행으로, 가시 tombstone은 빈 줄로 삽입한다.
- `#expandViewportFill()`은 오버플로 시 `fill = 0`으로 두고 `#lastFillRows = first === 0 ? fill : 0`
  을 기록한다. 따라서 오버플로 중 commit lane은 `liveZoneTop <= 0` 조건으로 자동 폴백한다.
- `compactViewportFill()`은 `#lastTombstoneRows === 0`이면 no-op이고, tombstone이 있으면
  `requestRender(true, "viewportFill compact")`만 호출한다. 실제 3J 재구축 여부는
  `fullRender(clear=true)` 가드가 결정한다.
- `fullRender(clear=true)`는 `newLines.length > height`, legacy multiplexer flag off,
  그리고 `isMultiplexerSession() || #hasCommittedHistory`가 참이면 `viewportRepaint`로
  다운그레이드한다.
- `#raiseOverflowFloor()`는 `frameLength > height`일 때만 floor를 올리며, 호출 위치는
  실제 full render, append-growth + repaint, 일반 diff 렌더 말미다. `viewportRepaint` 전용
  경로에서는 floor를 올리지 않는다.
- `setToolsExpanded(expanded)`는 먼저 `ui.setOverflowFloorFrozen?.(expanded)`를 호출하고,
  접힘 렌더는 `requestRender(!expanded, expanded ? "tools expand" : "tools collapse")`로
  강제 렌더를 요청한다. 정상 제출 경로는 `commitFinalizedBacklog()` 직후
  `ui.setOverflowFloorFrozen?.(false)`로 동결을 해제한다.
