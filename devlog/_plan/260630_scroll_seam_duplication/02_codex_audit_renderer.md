# 260630 — 렌더러 seam 패치 적대 감사

## 종합 판정: PASS with findings

이번 패치는 사용자가 본 핵심 증상, 즉 오버플로 상태에서 수축 후 뷰포트 상단 행이 스크롤백 말단에 한 번 더 남는 seam duplication을 올바른 축에서 막고 있다. 상단 sticky gap을 버리고 첫 변경 행 위치에 톰스톤을 삽입한 결정은 `structure/31_scroll.md`의 물리 제약, 즉 터미널은 un-scroll을 할 수 없다는 전제와 일치한다. `fullRender(true)`가 3J 금지 상태에서 스크롤백을 replay하지 않도록 내린 것도 같은 방향이다.

감사 중 신규 회귀 테스트 5개를 읽었고, `/tmp/scroll-audit-resize.test.ts`에 임시 실측 케이스를 만들어 `TERM=xterm-256color bun test /tmp/scroll-audit-resize.test.ts`로 커밋 히스토리 이후 height resize + frozen expansion round trip을 검증했다. 결과는 1 pass / 0 fail이고, 마커 중복은 `beforeDup=[]`, `afterDup=[]`였다. 그래서 현재 변경은 중복/행 밀림에 대해 실사용 주요 경로를 통과한다고 본다.

다만 적대 감사 관점에서 “패치가 완전히 닫지 않은 창”은 남아 있다. 치명적 실패는 찾지 못했지만, forced render 상태 갱신 순서와 `#previousRawLines`의 write-before-commit 성격은 이론적/운영적 리스크다.

## 발견 1 — 실패한 terminal write 이후 raw floor 기준이 앞서 나갈 수 있다

시나리오: `#restoreOverflowFloor()`는 렌더 준비 초반에 실행되고 곧바로 `#previousRawLines = [...newLines]`를 갱신한다. 그 뒤 `fullRender`, `viewportRepaint`, `appendGrowthAndRepaintViewport`, 일반 diff 경로가 실제 `#writeTerminal()`을 호출한다. 그런데 write가 실패하면 해당 경로는 `return`하고 `#previousLines`, `#previousWidth`, `#viewportTopRow`, `#overflowFloor` 같은 committed 렌더 상태를 갱신하지 않는다. 반면 raw 기준만 이미 새 프레임을 기억한다.

왜 문제인가: 다음 렌더가 성공할 때 `#restoreOverflowFloor()`의 f-scan은 실제 물리 화면이 아니라 실패했던 논리 프레임을 기준으로 첫 변경 행을 찾을 수 있다. 이 경우 tombstone 삽입 위치가 실제 스크롤백/화면의 행 정렬과 어긋나고, 증상은 중복보다는 행 밀림이나 blank residue로 나타날 가능성이 크다. 일반 터미널에서 write 실패는 곧 detach/stop에 가까워 노출 빈도는 낮지만, 감사 대상이 명시한 `#previousRawLines`와 `#previousLines` 불일치 창은 실제로 존재한다.

심각도: 주의. 정상 터미널 경로에서는 낮은 빈도지만, renderer invariant로는 불완전하다.

권고: `#previousRawLines` 갱신을 실제 write 성공 후 상태 갱신 묶음과 같은 단계로 옮기거나, 실패 시 raw snapshot을 롤백/무효화하는 별도 플래그를 둔다. 최소한 `#writeTerminal()` 실패를 만나면 `#previousRawLines=[]` 또는 `#overflowFloor=0`으로 다음 렌더의 f-scan을 보수적으로 full realign 쪽으로 보내는 방안을 검토한다.

## 발견 2 — forced render의 downgrade 경로는 floor는 보존하지만 force semantics는 일부 잃는다

시나리오: `requestRender(true)`는 `#previousLines=[]`, `#previousWidth=-1`, `#previousHeight=-1`, `#viewportTopRow=0`으로 만든다. 그 뒤 `#restoreOverflowFloor()`는 `forcedRebuild && canClearScrollback`일 때만 floor를 리셋한다. 커밋 히스토리나 멀티플렉서에서는 canClearScrollback이 false이므로 floor는 살아남고, `fullRender(true)`는 `newLines.length > height && (multiplexer || hasCommittedHistory)`에서 `viewportRepaint`로 downgrade된다.

왜 문제인가: duplication 방지 측면에서는 맞다. 하지만 force가 `#previousLines`와 viewport anchor를 날린 뒤 repaint로 내려가므로, 이 렌더는 “전체 재구축”도 “기존 diff 기준 유지”도 아닌 중간 상태가 된다. 현재 코드는 viewportRepaint 말미에 상태를 다시 세우므로 테스트상 중복은 없었지만, force 직전에 overlay 또는 resize가 같이 끼면 이전 viewport top 기준이 사라져 `#restoreOverflowFloor()`의 freezeEnd가 0이 되고, 화면 위 tombstone이 빈 줄로 들어갈 수 있다. 이는 중복은 피하지만 스크롤백 말단의 이전 픽셀 보존 대신 blank residue를 선택하는 경로다.

심각도: 이론적. 의도적으로 “중복보다 공백”을 택한 설계와 맞닿아 있고, 실측 resize 케이스에서는 중복이 없었다.

권고: forced downgrade가 발생할 때는 `requestRender(true)`가 `#viewportTopRow`를 0으로 지우기 전 값을 보존해 `#restoreOverflowFloor()`의 freezeEnd 계산에 쓰는 편이 더 정직하다. 어렵다면 이 정책을 SoT에 “force+downgrade는 중복 방지를 위해 위-뷰포트 tombstone을 빈 줄로 둘 수 있음”으로 명시한다.

## 발견 3 — `#previousRawLines`는 cursor marker/prepare/image 이전 기준이라 행 정체성은 맞지만 byte 정체성은 아니다

시나리오: raw snapshot은 cursor marker 제거, ANSI normalize/terminator 부착, truncation, image-line bypass보다 앞에서 저장된다. diff 기준인 `#previousLines`는 prepare 이후 bytes다. 따라서 cursor marker가 움직인 줄, OSC/hyperlink terminator가 prepare에서 달라지는 줄, image protocol line은 raw equality와 emitted-byte equality가 다를 수 있다.

왜 문제인가: f-scan이 찾으려는 것은 “첫 물리 행 변화”인데, raw 기준은 일부 줄에서 실제 emitted bytes와 다르다. 특히 cursor marker가 같은 raw line 안에서만 이동하면 `#restoreOverflowFloor()`는 그 차이를 수축 위치로 보지 않을 수 있다. 다만 marker는 visible viewport의 focus line에만 있고, tombstone 수축 문제의 주 무대는 overflowed transcript/body라 실제 중복으로 번질 가능성은 낮다. image line은 `TERMINAL.isImageLine()`이 prepare/truncate를 우회하므로 오히려 raw와 emitted 기준 차이가 작다.

심각도: 이론적.

권고: 현 설계를 유지해도 된다. 다만 향후 cursor-bearing 컴포넌트가 transcript 중간이나 live-zone 위쪽에 들어가면 raw f-scan 대신 “marker 제거 후 raw”를 별도 snapshot으로 쓰는 회귀 테스트가 필요하다.

## 발견 4 — f-scan은 동일 반복 콘텐츠에서 의미적 변경 위치를 증명하지 못한다

시나리오: 첫 변경 행 탐지는 `while (lines[firstChanged] === prev[firstChanged]) firstChanged++`인 순수 접두부 비교다. 빈 줄 반복, 동일 summary row 반복, 여러 도구가 같은 제목/blank를 출력하는 패턴에서는 실제로 제거된 블록의 시작보다 뒤쪽을 첫 변경 행으로 잡을 수 있다.

왜 문제인가: 이 알고리즘은 LCS가 아니라 prefix scan이다. 같은 문자열이 많이 반복되면 “살아남은 행이 같은 인덱스에 있다”는 착시가 생긴다. 그 결과 tombstone이 실제 수축 위치보다 뒤에 들어가고, 앞쪽의 의미적 행들이 물리 위치를 바꿀 수 있다. 그래도 byte 기준으로는 같은 행이므로 사용자가 보는 duplication 마커는 안 잡힐 수 있다. 이 위험은 중복 라인이 많은 UI에서 blank residue나 스크롤 위치 감각 이상으로 나타날 수 있다.

심각도: 이론적.

권고: 현재 패치 범위에서는 prefix scan이 합리적인 최소 구현이다. 하지만 regression 자산에 “동일 빈 줄/동일 라벨 반복 블록 수축” 케이스를 추가해, 최소한 composer tail과 고유 마커가 밀리지 않는지를 확인하는 것이 좋다.

## 발견 5 — freeze 해제 누락은 안전하지만 history pause가 길어질 수 있다

시나리오: `setToolsExpanded(true)`는 floor를 동결하고, collapse에서는 `setToolsExpanded(false)`, prompt submit에서는 `commitFinalizedBacklog()` 직후 `setOverflowFloorFrozen(false)`가 호출된다. 그러나 예외적 UI 경로가 `ctx.toolOutputExpanded`를 직접 바꾸거나, current-turn expansion 상태에서 overlay/외부 에디터/강제 redraw가 이어진 뒤 collapse 경로를 밟지 않으면 동결이 오래 남을 수 있다.

왜 문제인가: 코드 주석처럼 동결 유지의 실패 모드는 중복이 아니라 viewportRepaint growth와 scrollback pause다. 이는 안전한 방향이지만, 긴 스트리밍 중 사용자가 펼친 상태를 오래 유지하면 해당 성장 구간이 즉시 스크롤백에 실체화되지 않는다. 사용자는 터미널 스크롤백에서 방금 본 expanded rows를 기대할 수 있는데, 실제 canonical history는 뒤늦게 재개된다.

심각도: 주의.

권고: `setOverflowFloorFrozen(true)`의 소유자를 ctrl+o transient expansion으로 좁힌 것은 좋다. 추가로 turn completion, abort, interrupt, overlay transcript 진입, external editor 진입 같은 “현재 턴 UI 상태를 종료/대체하는 경계”에서 false를 idempotent하게 호출하는 방어를 고려한다. 단, 이 권고는 duplication 수정의 필수 조건은 아니다.

---

## 기술 레퍼런스

읽은 기준 문서:
- `devlog/_plan/260630_scroll_seam_duplication/00_root_cause_and_fix.md`
- `devlog/_plan/260630_scroll_seam_duplication/01_ctrl_o_transient_expansion.md`
- `structure/31_scroll.md` §3, §5, 260630 follow-up taxonomy

검토한 구현 지점:
- `packages/tui/src/tui.ts:1295` `#overflowFloor`와 floor 주석
- `packages/tui/src/tui.ts:1303` `#previousRawLines` raw snapshot
- `packages/tui/src/tui.ts:1329` `setOverflowFloorFrozen()`
- `packages/tui/src/tui.ts:1388` `compactViewportFill()` tombstone 기반 forced render
- `packages/tui/src/tui.ts:1407` `#expandViewportFill()` overflow fill=0 / commit lane 차단
- `packages/tui/src/tui.ts:1452` `#restoreOverflowFloor()` forcedRebuild, resize, f-scan, tombstone 삽입
- `packages/tui/src/tui.ts:1544` raw snapshot 갱신 위치
- `packages/tui/src/tui.ts:1580` `fullRender()` downgrade guard
- `packages/tui/src/tui.ts:1641` `viewportRepaint()` 상태 갱신
- `packages/tui/src/tui.ts:1683` `appendGrowthAndRepaintViewport()` floor 승격
- `packages/tui/src/tui.ts:1761` height change 분기
- `packages/tui/src/tui.ts:1875` above-viewport change 분기와 frozen append 차단
- `packages/tui/src/tui.ts:1900` frozen 상태에서 화면 바닥을 넘는 diff repaint 전환
- `packages/coding-agent/src/modes/controllers/input-controller.ts:495` prompt submit의 unfreeze
- `packages/coding-agent/src/modes/controllers/input-controller.ts:1296` ctrl+o expansion freeze/unfreeze

검증한 신규 테스트 자산:
- `packages/tui/test/scroll-seam-duplication.test.ts`: collapse, expand-collapse, shed+tail growth, frozen-floor round trip, compact replay 5개 케이스

임시 실측:
- 파일: `/tmp/scroll-audit-resize.test.ts`
- 명령: `TERM=xterm-256color bun test /tmp/scroll-audit-resize.test.ts`
- 결과: 1 pass / 0 fail
- 관찰: 커밋 히스토리 이후 오버플로 상태에서 height resize, frozen expansion, collapse forced render를 거쳐도 `afterDup=[]`로 marker duplication은 없었다.

검증했지만 문제없던 엣지:
- 커밋 히스토리 이후 `compactViewportFill()` → `requestRender(true)` replay 중복: 기존 신규 테스트가 duplicate-free를 확인한다.
- ctrl+o transient expansion round trip: 신규 테스트가 scroll buffer exact equality를 확인한다.
- unknown viewport real terminal 형태: `unknownViewportTerminal()` 테스트에서 append-growth가 추측 실행되지 않고 duplicate-free다.
- 오버플로 중 commit lane 자동 차단: `#expandViewportFill()`가 overflowed일 때 fill=0으로 만들고 `commitLines()`는 `liveZoneTop <= 0`에서 false가 된다.
- 멀티플렉서 기본 경로: `fullRender(true)` downgrade guard가 multiplexer + overflow에서 viewportRepaint로 내려간다.
- legacy multiplexer flag 경로: `useLegacyMultiplexerFullRender()`가 켜지면 기존 위험한 fullRender를 의도적으로 허용하는 escape hatch다. 이는 패치 결함이 아니라 플래그 의미다.
- overlay 열림 중 commitLines: `commitLines()`는 `overlayStack.length > 0`에서 false라 커밋 리전 오염으로 이어지지 않는다.
- 동결 중 height resize: 임시 테스트에서 중복은 재현되지 않았다.

---

## 메인 에이전트 처리 결정 (disposition — 260630)

- **발견 1 (write 실패 후 raw 선행 갱신): 무해 확인 — 주석으로 봉인.** `#writeTerminal` 실패는
  `#guardTerminalOperation` → `#markTerminalUnavailable()` → `#stopped = true`로 이어져 렌더링이
  영구 정지한다. 실패 이후 렌더가 없으므로 stale `#previousRawLines`가 소비될 창이 존재하지
  않는다. 이 불변식 근거를 `tui.ts`의 raw snapshot 갱신 지점 주석으로 명시했다.
- **발견 2 (forced downgrade의 freezeEnd=0): 의도된 설계로 수용.** "중복보다 공백" 원칙과 일치.
  권고대로 이 문서와 SoT taxonomy가 정책을 명문화하고 있어 추가 조치 없음.
- **발견 3 (raw vs prepared 기준): 이론적 — 보류.** cursor marker는 컴포저(가시 하단)에만
  존재하고 수축 무대는 트랜스크립트 상부라 현 설계 유지. transcript 중간 cursor-bearing
  컴포넌트가 생기면 재검토.
- **발견 4 (반복 콘텐츠 f-scan): 이론적 — 보류.** prefix scan이 뒤쪽을 잡아도 바이트 동일
  접두부이므로 물리 중복은 불가능. 반복 블록 수축 회귀는 후속 사이클 후보로 남긴다.
- **발견 5 (freeze 해제 경계): 부분 수용 — 현행 유지.** 실패 모드가 안전 방향(스크롤백 일시정지)
  이고, 제출 경로 해제가 abort/interrupt 후에도 다음 제출에서 결국 도달한다. turn-end/abort
  경계의 idempotent 해제 추가는 후속 사이클 후보.
