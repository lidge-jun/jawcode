# 260630 — 후속: ctrl+o 왕복 잔여 공백 (transient expansion floor 동결)

## 무엇이 문제였나

00의 seam 수정 e2e 중 사용자 발견: ctrl+o로 현재 턴 출력을 펼쳤다가 다시 접으면, 접힌
자리에 **펼침 크기만큼의 빈 공백**이 뷰포트에 남았다 (welcome/footer 아래로 화면의
대부분이 공백, 그 밑에 도구 셀들).

## 왜 그랬나

00의 수정은 "중복 대신 톰스톤(빈 줄)"이라는 물리적으로 정직한 교환이었다. 펼치기 성장이
diff 경로를 타면 커서가 화면 바닥을 넘어 걸어가며 **K행을 실제로 스크롤백에 밀어낸다**.
터미널은 un-scroll이 불가능하므로(§1), 접는 순간 그 K행은 어딘가에 잔여물로 남아야 하고
— 톰스톤 정책상 그것이 뷰포트 안 빈 구멍으로 나타났다. 잔여물의 크기가 "펼침 크기"라는
게 문제의 본질: 펼치기는 **일시적 UI 상태**인데 그 성장이 영구적인 물리 스크롤을
일으키고 있었다.

## 어떻게 고쳤나 — 펼치기 성장이 아예 스크롤하지 않게

`TUI.setOverflowFloorFrozen(frozen)` 신설. 동결 중에는:

- 화면 바닥을 넘는 모든 차등 렌더(명시적 스크롤 분기 + 페인트 루프 자체의 넘침)가
  `viewportRepaint`로 대체된다 — 물리 스크롤 0.
- `appendGrowthAndRepaintViewport`(known-bottom append)도 차단.
- floor(물리 실체화 길이)가 오르지 않는다.

그래서 접는 순간: fresh 프레임 길이 == floor → 톰스톤 0 → 강제 렌더가 다운그레이드
가드를 타고 뷰포트만 리페인트 → **펼치기 전 화면이 바이트 단위로 복원**된다 (회귀
테스트가 `getScrollBuffer()` 전체 동일성을 어서션).

같이 정리한 불변식: **floor 승격은 물리 스크롤이 실제 일어난 경로에서만** 일어난다
(diff append 경로 말미 · append-growth · 진짜 fullRender). `viewportRepaint`로만 그려진
성장은 스크롤백에 들어간 적이 없으므로 floor를 올리지 않는다 — 이후 수축이 그 행들을
자유롭게 다시 칠해도 중복이 아니기 때문.

와이어링 (coding-agent):

- `input-controller.ts setToolsExpanded` — `ui.setOverflowFloorFrozen?.(expanded)`
  (ctrl+o 진입점, 옵셔널 호출: 테스트 픽스처의 부분 목 대응).
- 프롬프트 제출 경로(`commitFinalizedBacklog` 직후) — 동결 자동 해제. 사용자가 펼친 채
  턴을 넘겨도 다음 턴 성장은 정상적으로 스크롤백에 흐른다.
- 동결이 남아있는 실패 모드는 "중복 없이 스크롤백 일시정지 + 뷰포트 리페인트 성장"으로만
  강등 — 안전한 방향.

펼친 상태로 스트리밍이 계속되면 그 구간은 스크롤백에 즉시 실체화되지 않는다(접기/제출
후 성장부터 정상 유입). 펼침 중 과거 정독은 ctrl+t 오버레이 몫 — 의도된 트레이드오프.

## 검증

- 신규 회귀: frozen-floor ctrl+o 왕복 — 커밋 히스토리 존재 상태에서 펼침 중 스크롤백
  불변(`buffer.length` 동일) + 접은 후 `getScrollBuffer()` 완전 동일. 5/5 통과.
- `bun test packages/tui/` 522 pass / 6 fail(render-goldens — 클린 트리 동일 기존 이슈).
- `setToolsExpanded` 참조 스위트(input-controller-keybindings 등 3파일 30케이스) 전부 통과.
- biome · tsc(양 패키지) 클린.

---

## 기술 레퍼런스

- `packages/tui/src/tui.ts`: `#overflowFloorFrozen` · `setOverflowFloorFrozen()` ·
  `#raiseOverflowFloor()`(diff 말미·append-growth·fullRender에서만) · diff 경로 동결 가드
- `packages/coding-agent/src/modes/controllers/input-controller.ts`: `setToolsExpanded`
  동결 · 제출 시 해제
- 회귀: `packages/tui/test/scroll-seam-duplication.test.ts` "frozen-floor transient
  expansion (ctrl+o) round trip restores the exact pre-expansion buffer"
- SoT: `structure/31_scroll.md` 260630 taxonomy Fixed D
