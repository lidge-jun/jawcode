# 260615 — Ctrl+T full transcript overlay correction

> 상태: 패치/검증 완료
> 입력: 사용자 피드백 — “ctrl+t는 구현은 됐는데 목표는 모든 게 펼쳐진 화면이 보여야지 그냥 창만 전환하면 의미가 없다.”
> 관련 기록: `devlog/_plan/260614_cli_jaw_jwc_distribution_strategy/_legacy/260612_jawcode_fork/phase1/083.11_issue_global_toggle_commit_lane.md`, `083.12_plan_codex_style_live_toggle.md`, `devlog/_plan/260614_performance/03_safety_boundaries.md`.

## 1. 기존 계약

083.11/083.12 결론:

- normal prompt scrollback의 과거 픽셀은 terminal scrollback에 커밋되면 가역 토글 대상이 아니다.
- `ctrl+o`는 current live / 미커밋 턴의 tool + thinking inline expand/collapse만 담당한다.
- 과거까지 포함한 “전부 다시 보기”는 inline scrollback mutation이 아니라 `ctrl+t` full transcript pager/screen에서 해결한다.
- `ctrl+t`는 thinking toggle이 아니다.

현재 코드 상태:

- `packages/coding-agent/src/config/keybindings.ts`
  - `app.tools.expand = ctrl+o`
  - `app.transcript.full = ctrl+t`
  - `app.thinking.toggle` 기본키 제거됨.
- `packages/coding-agent/src/modes/controllers/input-controller.ts`
  - `showFullTranscript()`가 session historical replay + current live tail을 모아 `FullTranscriptOverlayComponent`를 만든다.
  - `toggleToolOutputExpansion()`은 live-toggle eligible component만 순회한다.
- `packages/coding-agent/src/modes/components/full-transcript-overlay.ts`
  - component별 `renderFullTranscript(width)` 프로토콜을 우선 호출한다.
  - `AssistantMessageComponent`, `ToolExecutionComponent`, `ReadToolGroupComponent`, bash/eval/custom/summary component는 full transcript 렌더에서 일시적으로 expanded 상태를 강제한다.

## 2. 문제 판정

현재 `ctrl+t`는 “전문 렌더 프로토콜” 일부는 갖췄지만, 화면 소유권과 expanded replay 정책이 둘 다 불완전하다.

`InputController.showFullTranscript()`는 overlay를 진짜 TUI overlay stack에 올리지 않고 아래처럼 editor 영역만 교체한다.

```ts
this.ctx.editorContainer.clear();
this.ctx.editorContainer.addChild(overlay);
this.ctx.ui.setFocus(overlay.getFocus());
```

따라서 사용자는 prompt/editor 자리만 transcript component로 바뀐 것으로 느낄 수 있다. 제품 목표였던 Codex식 “전체 transcript pager/screen”과 달리 base chat/status/composer 레이아웃이 계속 남아 있고, 이것이 “그냥 창만 전환”처럼 보이는 핵심 원인이다.

반대로 이미 존재하는 진짜 overlay 경로는 `TUI.showOverlay()`다.

- `packages/tui/src/tui.ts`: `showOverlay(component, { width, maxHeight, anchor, margin })`
- `packages/coding-agent/src/modes/controllers/selector-controller.ts`: session observer가 `ui.showOverlay(..., { anchor: "bottom-center", width: "100%", maxHeight: "100%" })` 사용.
- `packages/coding-agent/src/modes/controllers/extension-ui-controller.ts`: hook custom overlay도 같은 overlay stack 사용.

추가로 `FullTranscriptOverlayComponent#viewportRows()`는 `stdout.rows - 8`을 쓰므로, full-screen overlay로 올려도 header/footer 외에 불필요한 여백을 남긴다. editor-container 장착 시절의 보수적 예약값으로 보이며, full transcript screen 목표에는 맞지 않는다.

사용자 스크린샷 재확인(260615 18:28):

- 기대: transcript 화면에서는 Bash/tool/read/compaction/thinking 등 접을 수 있는 모든 블록이 “`ctrl+o`가 전체에 적용된 것처럼” 전문 표시된다.
- 실제: prompt 화면의 compact/collapsed 상태가 transcript에도 섞여 들어와 `Compacted from ... (ctrl+o to expand)`, `Read <path>` 같은 한 줄 요약이 남는다.
- 특히 `ReadToolGroupComponent`는 `renderFullTranscript()`에서 `setExpanded(true)`를 해도, 생성자 옵션 `showContentPreview`가 false이면 본문 preview component 자체를 만들지 않는다. `InputController.showFullTranscript()`가 `readToolResultPreview: this.ctx.settings.get("read.toolResultPreview")`를 그대로 넘기므로 기본값 false 세션에서는 full transcript에서도 read가 한 줄로 남는다.
- 따라서 full transcript replay는 normal chat의 출력 밀도 설정을 그대로 복사하지 말고, “전부 펼친 transcript” 정책을 강제해야 한다.

## 3. 목표 UX

`ctrl+t`는 modal/fullscreen transcript pager다.

- normal prompt scrollback은 그대로 둔다. 커밋된 scrollback을 clear/rewrite하지 않는다.
- `ctrl+t`를 누르면 현재 viewport 위에 full-width/full-height overlay를 띄운다.
- overlay 안에서는 historical session replay + current live tail을 모두 보여준다.
- tool/read/search/bash/eval/custom summary/thinking은 collapsed prompt 상태와 무관하게 full transcript renderer로 expanded 표시한다.
- 처음 열 때는 최신 tail(bottom)에 붙는다.
- `↑↓`, `pgup/pgdn`, `g/G`로 이동한다.
- `ctrl+t`, `q`, `esc`로 닫고 이전 focus로 돌아간다.
- `ctrl+o`는 계속 current-turn inline toggle로만 남는다.
- full transcript 화면은 `ctrl+o` expanded 상태를 과거+현재 모든 expandable 항목에 적용한 결과처럼 보여야 한다. `read.toolResultPreview=false` 같은 prompt-density 설정도 이 화면에서는 read 본문을 숨기면 안 된다.

## 4. 패치 범위

### A. `InputController.showFullTranscript()` 장착 방식 변경

대상: `packages/coding-agent/src/modes/controllers/input-controller.ts`

현재 editorContainer 치환을 제거하고 `ui.showOverlay`를 사용한다.

권장 형태:

```ts
let overlayHandle: OverlayHandle | undefined;
const close = () => {
  overlayHandle?.hide();
  overlayHandle = undefined;
};
const overlay = new FullTranscriptOverlayComponent(source, {
  close,
  requestRender: () => this.ctx.ui.requestRender(),
});
overlayHandle = this.ctx.ui.showOverlay(overlay, {
  anchor: "bottom-center",
  width: "100%",
  maxHeight: "100%",
  margin: 0,
});
this.ctx.ui.setFocus(overlay.getFocus());
```

Notes:

- `OverlayHandle`는 top-level type import로 추가한다. inline/dynamic import 금지.
- editor text를 건드리지 않는다.
- close 시 editorContainer를 restore하지 않는다. `showOverlay().hide()`가 preFocus 복원을 담당한다.
- 필요하면 close 후 `requestRender()`를 명시하되, `hide()` 자체도 render를 요청한다.

### B. `FullTranscriptOverlayComponent` viewport row 계산 보정

대상: `packages/coding-agent/src/modes/components/full-transcript-overlay.ts`

현재:

```ts
return Math.max(8, (process.stdout.rows ?? 30) - 8);
```

full-screen overlay에서는 header/footer 2행만 제외하는 값이 맞다.

권장:

```ts
return Math.max(1, (process.stdout.rows ?? 30) - 2);
```

이렇게 하면 overlay render output이 `header + viewportRows + footer`로 터미널 높이를 거의 꽉 채운다.

### C. Full transcript replay/read preview 강제

대상: `packages/coding-agent/src/modes/controllers/input-controller.ts`, `packages/coding-agent/src/modes/components/read-tool-group.ts`

현재:

```ts
readToolResultPreview: this.ctx.settings.get("read.toolResultPreview"),
```

수정:

```ts
readToolResultPreview: true,
```

이 값은 normal prompt 화면의 기본 밀도 설정이 아니라 `ctrl+t` transcript 화면의 제품 계약이다. prompt 화면에서 read preview 기본값이 false인 것은 유지하되, full transcript에서는 read 본문이 보이도록 강제한다.

Live-tail 보정:

```ts
return (this.#showContentPreview || this.#expanded) && entry.contentText !== undefined;
```

historical replay는 controller에서 preview 생성을 강제하고, current live tail은 `ReadToolGroupComponent` 자체가 expanded/full-transcript 상태에서 preview 설정을 무시하도록 한다.

추가 hardening 후보:

- `buildSessionTranscriptComponents()`는 transcript mode 전용 함수이므로, 향후 fallback render 경로까지 안전하게 만들려면 tool/custom/summary/read/assistant thinking component를 생성 직후 expanded 상태로 둘 수 있다.
- 단, 현재 `FullTranscriptOverlayComponent`가 `renderFullTranscript()`를 우선 호출하므로 controller의 read preview 강제 + `ReadToolGroupComponent` expanded preview gate로 이번 버그를 닫는다.


### D. 테스트 갱신

대상: `packages/coding-agent/test/input-controller-keybindings.test.ts`

현재 테스트는 `ctx.editorContainer.addChild`에서 overlay를 꺼낸다. 이제 `ctx.ui.showOverlay` spy에서 overlay를 꺼내야 한다.

수정/추가 검증:

- `opens full transcript from display session context`
  - `ctx.ui.showOverlay`가 `{ width: "100%", maxHeight: "100%", anchor: "bottom-center" }` 형태로 호출되는지 확인.
  - `editorContainer.clear/addChild`가 호출되지 않는지 확인.
- `includes live current-turn components in session full transcript`
  - `showOverlay.mock.calls[0][0]`의 render output에서 `SESSION_MARKER`, `LIVE_CHAT_MARKER`, `LIVE_TOOL_MARKER`, `STREAMING_MARKER` 포함 확인.
  - committed chat marker는 session-source live tail 중복 후보에서 제외되는지 현행 테스트 유지.
- `assembles session replay dependencies...`, `keeps session-source live tail...`도 overlay 추출 helper를 `showOverlay` 기반으로 변경.
- `ctrl+t` controller path에서 `read.toolResultPreview` 설정이 false여도 read tool result 본문이 transcript에 표시되는지 회귀 테스트를 추가한다.
- compaction summary가 `Compacted from ... (ctrl+o to expand)` 한 줄이 아니라 `COMPACTION_SUMMARY` 본문을 표시하는지 확인하는 테스트를 추가한다.

대상: `packages/coding-agent/test/full-transcript-overlay.test.ts`

추가 후보:

- stdout rows를 테스트에서 안전하게 mock 가능한 경우, render output line count가 `rows`를 넘지 않고 bottom marker를 포함하는지 확인.
- 최소한 기존 bottom-open / scroll tests는 유지한다.

## 5. 비목표

- `ctrl+o`로 committed historical scrollback을 다시 펼치게 만들지 않는다.
- terminal scrollback clear/rewrite 또는 3J 재도입을 하지 않는다.
- visual welcome/scroll model을 건드리지 않는다.
- 이 패치에서 lazy transcript rendering(P2.3 performance work)을 같이 하지 않는다.
- `alt+t` tool-only transcript overlay 통합은 별도 판단이다. 이번 문제는 `ctrl+t` full conversation transcript의 화면 소유권 수정이다.

## 6. 검증

Focused gates:

```sh
bun test packages/coding-agent/test/full-transcript-overlay.test.ts packages/coding-agent/test/input-controller-keybindings.test.ts
```

필요 시 인접:

```sh
bun test packages/coding-agent/test/session-transcript-replay.test.ts
```

수동 실기기 확인:

1. tool output + thinking이 포함된 긴 세션에서 `ctrl+o`로 current turn만 inline expand/collapse 되는지 확인.
2. `ctrl+t`를 눌렀을 때 editor 자리 치환이 아니라 viewport를 덮는 full transcript pager가 뜨는지 확인.
3. overlay 내부에서 과거 tool/thinking 전문이 expanded 상태로 보이는지 확인.
4. `q`/`esc`/`ctrl+t`로 닫은 뒤 editor focus와 입력 내용이 유지되는지 확인.

## 7. 260615 follow-up patch 결과

사용자 재확인에서 “그 화면이 Ctrl+T인데도 접힌 상태로 보인다”는 증상이 보고되어 외부 `executor_ext` 병렬 감사를 추가로 수행했다.

반영 내용:

- `TUI` overlay protocol에 `Component.setOverlayViewportRows?(rows)` optional hook을 추가했다.
  - `packages/tui/src/tui.ts`가 overlay render 직전에 resolved `maxHeight`/terminal height를 컴포넌트에 전달한다.
  - `FullTranscriptOverlayComponent`는 더 이상 `process.stdout.rows` 추측에만 의존하지 않고 TUI가 계산한 실제 overlay row budget을 사용한다.
  - 목적: overlay가 화면 하단 일부만 덮어 위쪽 배경의 collapsed prompt 화면이 남는 상태를 제거한다.
- `KeybindingsManager` constructor도 `app.thinking.toggle = ctrl+t` 충돌을 sanitize한다.
  - 파일 로드/create 경로뿐 아니라 직접 생성/in-memory 변형에서도 `ctrl+t`는 `app.transcript.full` 우선이다.
  - `CustomEditor` priority regression test를 추가해 `app.transcript.full`과 legacy `app.thinking.toggle`이 모두 `ctrl+t`에 묶여도 full transcript만 실행되는지 확인한다.
- 기존 A/B/C 패치 유지:
  - Ctrl+T는 `editorContainer` 치환이 아니라 `ui.showOverlay(..., { width: "100%", maxHeight: "100%", margin: 0 })` 사용.
  - transcript replay는 `readToolResultPreview: true`를 강제한다.
  - `ReadToolGroupComponent`는 expanded 상태에서 inline preview 설정과 무관하게 본문을 렌더한다.
- 회귀 테스트 추가:
  - full transcript가 TUI-supplied overlay height로 전체 화면을 채우는지 확인.
  - session overlay의 collapsed live assistant thinking이 전문으로 펼쳐지는지 확인.
  - TUI overlay가 full-height overlay에 resolved row budget을 전달하고 배경 줄을 남기지 않는지 확인.
  - direct constructor keybinding sanitize와 editor keybinding priority 확인.

검증:

```sh
bun test packages/coding-agent/test/full-transcript-overlay.test.ts packages/coding-agent/test/input-controller-keybindings.test.ts packages/coding-agent/test/session-transcript-replay.test.ts packages/coding-agent/test/read-tool-group.test.ts packages/coding-agent/test/custom-editor-keybindings.test.ts packages/coding-agent/test/keybindings-migration.test.ts packages/tui/test/overlay-scroll.test.ts
# 108 pass, 0 fail

bunx biome check packages/tui/src/tui.ts packages/tui/test/overlay-scroll.test.ts packages/coding-agent/src/modes/components/full-transcript-overlay.ts packages/coding-agent/src/config/keybindings.ts packages/coding-agent/test/full-transcript-overlay.test.ts packages/coding-agent/test/custom-editor-keybindings.test.ts packages/coding-agent/test/keybindings-migration.test.ts packages/coding-agent/src/modes/controllers/input-controller.ts packages/coding-agent/src/modes/components/read-tool-group.ts packages/coding-agent/test/input-controller-keybindings.test.ts packages/coding-agent/test/read-tool-group.test.ts
# OK
```

## 8. 260615 second follow-up — Ctrl+T looked like Ctrl+O scope

사용자 재확인에서 “Ctrl+T가 Ctrl+O와 동일 동작처럼 보이고 이전 세션/턴이 안 펴진다”는 증상이 보고되었다.

원인:

- `InputController.showFullTranscript()`가 session replay로 historical transcript를 이미 만든 뒤에도 `chatContainer`의 live-toggle eligible chat component를 다시 `liveItems` tail에 붙였다.
  - 이 live chat tail은 Ctrl+O가 커버하는 current-turn 범위와 동일하다.
  - overlay가 bottom-pinned이므로 사용자가 보는 첫 화면이 중복 live tail로 채워져, expanded historical replay가 위로 밀려 “Ctrl+O랑 같은 범위만 켜진” 것처럼 보였다.
- `ToolExecutionComponent.renderFullTranscript()`가 내부적으로 `setExpanded(true)`만 사용했다.
  - 따라서 generic/non-renderer tool output은 Ctrl+O expanded limit(12 lines)을 그대로 받았다.
  - `expanded`가 이미 true인 상태에서는 `setExpanded(true)`가 no-op이라 full transcript flag 같은 추가 상태를 넣어도 display rebuild가 일어나지 않는 구조였다.

반영:

- session source가 있을 때 Ctrl+T `liveItems`는 out-of-band live surfaces만 붙인다.
  - `liveToolContainer` children
  - `streamingComponent`
  - historical replay가 완전히 비어 있는 hidden-only 특수 케이스의 chat fallback
  - 일반 `chatContainer` live component는 session replay와 중복되므로 붙이지 않는다.
- `ToolExecutionComponent`에 transient `#fullTranscript` render mode를 추가했다.
  - `renderFullTranscript()`는 `expanded=true`뿐 아니라 `fullTranscript=true`를 강제하고 display를 rebuild한다.
  - generic text output은 full transcript mode에서 line-count limit을 제거한다.
  - JSON fallback도 full transcript mode에서는 expanded JSON line cap을 제거한다.
  - render 후에는 기존 expanded 상태와 fullTranscript 상태를 복원한다.

검증:

```sh
bun test packages/coding-agent/test/input-controller-keybindings.test.ts packages/coding-agent/test/full-transcript-overlay.test.ts packages/coding-agent/test/session-transcript-replay.test.ts packages/coding-agent/test/read-tool-group.test.ts packages/coding-agent/test/modes/components/tool-execution-minimize.test.ts
# 75 pass, 0 fail

bunx biome check packages/coding-agent/src/modes/controllers/input-controller.ts packages/coding-agent/src/modes/components/tool-execution.ts packages/coding-agent/test/input-controller-keybindings.test.ts packages/coding-agent/test/modes/components/tool-execution-minimize.test.ts
# OK
```
