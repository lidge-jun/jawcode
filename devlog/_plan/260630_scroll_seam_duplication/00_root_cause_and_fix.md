# 260630 — 업스크롤 seam 중복 근본 원인과 수정

## 무엇이 문제였나

모델 응답 중 위로 스크롤하면 **뷰포트 상단에 보이는 행이 바로 그 위 스크롤백에도 똑같이
나타나는** 중복 밴드가 생겼다. 260615의 두 차례 패치(live-zone 라우팅, unknown-viewport
append 차단) 이후에도 재발했고, 사용자 관찰대로 "펼치기 후 다시 접기"가 가장 확실한
재현 경로였다.

## 왜 그랬나 — 세 갈래의 근본 원인

xterm 기반 VirtualTerminal 재현 테스트(`packages/tui/test/scroll-seam-duplication.test.ts`)로
세 가지 결함을 전부 실측 확정했다.

**A. 상단 sticky gap의 시프트 (주범 — 사용자가 본 그 증상).** 프레임이 뷰포트를 초과한
상태에서 수축(ctrl+o 접기, thinking settle, autocomplete 닫힘, 083.9 P3 shed)이 일어나면
083.7 §10의 sticky gap이 프레임 **최상단**에 빈 줄 K개를 삽입해 길이를 보존했다. 그 결과
아래의 모든 콘텐츠 행이 프레임 좌표로 K줄 내려가고, `viewportRepaint`가 뷰포트를 다시 그릴
때 **이미 물리 스크롤백으로 밀려난 마지막 K행을 뷰포트 상단에 또 그렸다**. 터미널은
un-scroll이 불가능하므로(§1 물리 제약) 스크롤백 사본은 지울 수 없고, 화면 상단과 스크롤백
말단에 같은 내용이 이중으로 남는다. shed는 스트리밍 중 상시 발생하므로 ctrl+o 없이도
응답 중에 계속 재현됐다.

**B. 3J 금지 이후의 전체 재인쇄 replay.** `fullRender(true)`가 "스크롤백을 내용 동일하게
재구성한다"는 전제는 3J(스크롤백 삭제)가 함께 실행되던 커밋 레인 이전 세계의 것이었다.
커밋 레인이 `#hasCommittedHistory`로 3J를 영구 금지한 뒤에는, `compactViewportFill()`과
`requestRender(true)`(ctrl+o 접기의 강제 렌더 포함)가 2J-only로 프레임 전체를 다시 찍으며
**뷰포트를 넘는 헤드 행 전부를 기존 스크롤백 위에 사본으로 밀어 넣었다.** 프롬프트 제출마다
compact가 발화하므로 장기 세션에서 중복이 누적됐다.

**C. 오버플로 중 커밋 리전 오인.** gap이 `#lastFillRows`로 집계되는 바람에, 오버플로 중에는
뷰포트 위(화면 밖)에 있는 fill 행을 `commitLines()`가 "화면 상단 히스토리 리전"으로 오인해
가시 트랜스크립트 행 위에 커밋을 덮어쓸 수 있었다.

## 어떻게 고쳤나

이 문서의 1차 seam 수정은 `packages/tui/src/tui.ts` 렌더러 내부에 집중됐다. 뒤이은 ctrl+o
왕복 잔여 공백 후속은 `01_ctrl_o_transient_expansion.md`에서 별도로 다루며,
`input-controller.ts`의 `setToolsExpanded` 와이어링을 추가했다.

1. **상단 gap 폐기 → in-place 톰스톤 (`#restoreOverflowFloor`).** 오버플로 중 프레임 길이는
   단조 불변식으로 승격(`#overflowFloor`). 수축이 오면 제거된 행 수만큼 **첫 변경 행 위치에**
   톰스톤을 삽입한다 — 접두부는 절대 인덱스를 유지하고, 접미부는 이전 행 위치로 재정렬되며,
   이후 스트리밍 성장이 톰스톤을 제자리에서 소비한 뒤에야 프레임이 끝에서 자란다. 뷰포트
   위 톰스톤은 직전 프레임 픽셀을 동결(frozen)해 물리 화면과 정렬을 유지하고, 가시 구간은
   빈 줄로 접힘을 표현한다. 시프트가 사라지므로 seam 중복이 원천 차단된다. 첫 변경 행
   탐지는 prepare(정규화) 이전의 원시 프레임 사본(`#previousRawLines`)과 비교한다.
2. **`fullRender(true)` 다운그레이드 가드.** `프레임 > viewport && (멀티플렉서 ||
   커밋 히스토리) && !레거시 플래그`면 전체 재인쇄 대신 `viewportRepaint`. 강제 렌더가 어느
   경로에서 와도(compact, ctrl+o, /redraw) replay 중복이 불가능해졌다.
3. **오버플로 시 커밋 레인 자동 차단.** 오버플로 중 fill=0 → `#lastFillRows`=0 →
   `commitLines()`가 폴백. 커밋 리전 오염 제거.
4. **compact 재정의.** 톰스톤이 없으면 no-op. 있으면 강제 렌더 — 3J 허용 세션에서만 floor를
   리셋하고 진짜 재구축, 그 외에는 가드가 뷰포트 리페인트로 낮춘다.
5. **레거시 무간섭.** ViewportFill 센티널이 없는 프레임(핀 비활성)은 floor/톰스톤이 전혀
   개입하지 않아 기존 clearOnShrink 동작이 바이트 동일하게 유지된다.

## 검증

- 1차 신규 회귀 4케이스 전부 통과: 오버플로 접기 · 펼치기→접기 왕복 · shed+꼬리 성장(스트리밍
  시뮬레이션) · 커밋 히스토리 후 compact. 어서션은 물리 버퍼(스크롤백+뷰포트) 전체에서
  콘텐츠 마커 중복 0, seam 연속성, 컴포저 floor 유지.
  후속 `01_ctrl_o_transient_expansion.md` 이후 같은 파일은 frozen-floor ctrl+o 왕복 케이스를
  포함해 5케이스가 됐다.
- `bun test packages/tui/` 521 pass / 6 fail — 실패 6건은 render-goldens로 **클린 트리에서도
  동일하게 실패하는 기존 이슈**(260630 CI green 스레드와 별개 확인). `commit-time-folding`의
  agent_end 1건도 클린 트리 동일.
- `viewport-fill.test.ts`의 §10 gap compaction 테스트 1건을 신규 의미론(수축 지점 톰스톤 +
  seam 연속성 어서션)으로 갱신. 나머지 13케이스는 무수정 통과.
- biome · tsc 클린.

## 남은 것 (WONDER)

- 톰스톤이 가시 구간에 있을 때 접힌 자리가 빈 줄로 남는다(성장이 소비하기 전까지).
  구 top-gap은 즉시 "콘텐츠가 컴포저에 붙는" 모양이었지만 그게 곧 중복 버그였다 — 물리
  제약상 둘 다 가질 수 없고, 코덱스도 잔여물을 히스토리에 남기는 쪽이다.
- gap이 열린 상태에서 뷰포트 위 중간 삽입 성장(라이브 존 외 컴포넌트가 위에서 자라는 경우)은
  여전히 이론적 시프트 창이 있다. e7c3026d 이후 스트리밍 경로가 전부 라이브 존(하단)이라
  실사용 노출은 좁다. 재발 시 이 문서와 `#restoreOverflowFloor`부터 볼 것.
- 실터미널(Ghostty/tmux) 라이브 확인은 사용자 e2e 몫.

---

## 기술 레퍼런스

- 1차 수정 파일: `packages/tui/src/tui.ts` (`#overflowFloor` · `#previousRawLines` ·
  `#lastTombstoneRows` · `#fillSentinelPresent` · `#restoreOverflowFloor()` ·
  `#expandViewportFill()` 오버플로 분기 · `fullRender` 가드 · `compactViewportFill()`)
- 회귀: `packages/tui/test/scroll-seam-duplication.test.ts` (신규),
  `packages/tui/test/viewport-fill.test.ts` (1케이스 갱신)
- SoT: `structure/31_scroll.md` §3 · §5 · 260630 taxonomy · §9
- 선행 사이클: `devlog/_plan/260615_scroll_anchor_duplication/` ·
  `devlog/_plan/260614_performance/73_scroll_repaint_timing_followup.md`
