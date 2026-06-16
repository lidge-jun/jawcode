# Scroll — TUI 스크롤/뷰포트 모델 (정본)

> jwc TUI의 스크롤 모델 전체: 차등 렌더러의 물리 제약, 컴포저 핀(ViewportFill), floor/압축,
> 커밋 시점 접기, 뷰포트 리페인트 정책, 커밋 레인 이중-레인 아키텍처. 083.6/083.7/083.8/083.9/
> 99.20.03/99.20.04의 구현 결과를 단일 문서로 통합한 SoT. 사용자 e2e 확인: 260613 00:25.

## 1. 모델 — 스크롤백-네이티브

jwc는 CC(구세대)·gjc 계열의 **스크롤백-네이티브** 모델이다: 프레임 = 전체 트랜스크립트이고,
터미널 스크롤백이 히스토리의 1급 저장소다 (위로 스크롤 = 진짜 과거). 차등 렌더러가 변경 행만
다시 그리고, 뷰포트를 넘어간 행은 스크롤백으로 들어간다.

**물리 제약 (모든 설계의 출발점)**: 터미널은 **un-scroll이 불가능**하다. 버퍼에 들어간 행은
지울 수만 있고(2K) 회수할 수 없다. 따라서 "프레임 수축"은 반드시 잔여물(빈 행)을 남기며,
이를 어디에 두고 언제 청소하느냐가 스크롤 UX의 전부다.

## 2. 프레임 레이아웃 (B2-lite — 083.7 §11)

```
[ 환영 배너 ]                ← 상단 고정 (스크롤백으로 자연 진입)
[ ViewportFill ]             ← 뷰포트 잔여 높이만큼 늘어나는 스페이서
[ chatContainer ]            ← 트랜스크립트 (커밋된 셀만, 단조 성장)
[ pendingMessages ]          ┐
[ liveToolContainer ]        │ ← 99.20.04 라이브 존: 실행 중 도구 preview
[ statusContainer(로더) ]    │
[ todo / btw / statusLine ]  │ 컴포저 클러스터 — 항상 터미널 바닥에 밀집
[ hookAbove / editor / hookBelow ] ┘
```

- fill이 채팅 **위**에 있는 게 핵심 (B2-lite): 콘텐츠·슬래시 출력·셀렉터 복구가 전부 입력창
  주변(바닥)에 모이고, 수축 델타는 **상단 여백**이 흡수한다. §0의 B2 기각 근거(전화면 diff·
  스크롤백 붕괴)는 frame ≤ viewport 구간에선 무효 — 줄 이동은 스크롤백 진입 전에만 발생.
- 마운트: `interactive-mode.ts` (addChild 순서). 활성화 해석:
  `!$flag("PI_NO_COMPOSER_PIN") && (settings.get("tui.composerPin") ?? isJawBrand())`.

## 3. ViewportFill 메커니즘 (`packages/tui/`)

| 단계 | 위치 | 동작 |
|------|------|------|
| 센티널 방출 | `components/viewport-fill.ts` | `VIEWPORT_FILL_SENTINEL` 1줄 (disabled면 0줄 — 레거시 바이트 동일) |
| 확장 | `tui.ts #expandViewportFill` — 트리 렌더 직후·오버레이 합성 **이전** | 첫 센티널을 `max(0, target - 콘텐츠줄수)`개의 빈 줄로 치환, 추가 센티널 제거. 렌더러 코어 분기 무수정 |
| **sticky gap** (§9→§12) | 동일 함수 `#viewportFillGap`/`#viewportFillFloor` | 초과 구간 수축 시 갭이 늘어 컴포저를 바닥에 고정(풀렌더 1회). **성장 시 갭 동결** — 프레임이 끝에서 자라 append-only diff 유지 (§12: 갭을 위에서 소비하면 전 행 시프트 → append마다 3J 풀렌더 폭풍). 갭은 상단(스크롤백 쪽)이라 뷰포트에 안 보임 |
| gap 추적 | `#viewportFillGap` | floor가 적립한 빈 행 수 |
| **압축** (§10) | `compactViewportFill()` | floor/gap 리셋 + `requestRender(true)` — 전체 트랜스크립트 재인쇄로 스크롤백을 빈 행 없이 재구축. 갭 0이면 no-op |

압축/토글 트리거 맵 (정본: devlog `99.20.03_issue_transient_shrink_triggers.md`, 083.8 S2 갱신):
**프롬프트 제출** (`input-controller.ts:457` — `commitFinalizedBacklog` 직후 compact) · 슬래시 디스패치 완료
(`input-controller.ts:328` `slashResult === true`) · ctrl+o current-turn 출력 토글 말미. ctrl+o는 현재 live turn만 펼치기/접기하며, 이미 커밋된 이전 턴은 펴기도 접기도 하지 않는다. ctrl+o는 current-turn assistant thinking coupling(`thinkingExpanded`)도 유지한다. ctrl+t는 full transcript overlay 전환이며 prompt scrollback compact trigger가 아니다. ctrl+t overlay는 최신/하단에서 열리고, 열린 뒤에는 사용자 스크롤 위치를 보존하며 위로 올라가 과거를 본다.
`event-controller.ts:775` 주석: `"083.8 S2: the post-overflow gap is NOT compacted here"`.
`input-controller.ts:457` 주석: `"083.8 S2: collapse any post-overflow gap left by the previous turn"`.
잔여 에지: ESC 드롭다운(제출 없음).

## 4. 커밋 시점 접기 (99.20.04 — 수축의 근원 제거)

`tool.renderMode` (미지정 = 브랜드 기본: jwc=commit, gjc=verbose):

- **commit**: 실행 중 도구는 `liveToolContainer`(라이브 존)에서만 펼쳐 보이고, 완료 시
  `setMinimized(true)` 상태로 chatContainer에 **단 한 번** append — 히스토리 단조 성장,
  도구발 수축 원천 소멸. agent_end가 잔여 라이브 셀 일괄 커밋(abort 안전망).
- **verbose**: 083.1 현행 — preview가 히스토리에 흐르고 사후 접힘(§9/§10 안전망 의존).
- 구현: `event-controller.ts` `#commitFoldingEnabled`/`#commitLiveTool`. ctrl+o 스윕은
  `input-controller.ts setToolsExpanded`에서 `liveToggleEligible`인 chat/live-zone 자식만 순회한다.

## 5. 뷰포트 리페인트 정책 (083.8 S3)

뷰포트 밖 변경이 발생했을 때 어떤 경로를 밟느냐가 UX의 핵심이다.

**`viewportRepaint`** (`tui.ts:1353`) — 2J/3J 없이 현재 보이는 N행만 제자리에 재인쇄. 스크롤백
픽셀을 건드리지 않고 커서를 화면 상단으로 올려 각 행을 2K로 지우고 다시 씀. 083.8 S3 이후
**모든 터미널(멀티플렉서 포함)의 뷰포트-위 변경**에 기본 경로다. 과거에는 멀티플렉서 전용
`multiplexerViewportRepaint`가 별도로 존재했으나 현재는 통합·삭제됐다.

- `firstChanged < viewportTop` 조건: 기본은 `viewportRepaint`. 프레임이 **동시에 성장**(append)하고
  멀티플렉서가 아니며 `isViewportAtBottom() === true`로 터미널이 바닥 고정 상태임을 증명할 때만,
  성장분만 먼저 append한 뒤 같은 synchronized output에서 `viewportRepaint`를 수행한다. 이는
  기존 `fullRender(true)` 예외(전체 트랜스크립트 replay로 중복 출력 유발)를 대체한다. 레거시
  멀티플렉서 플래그(`PI_TUI_LEGACY_MULTIPLEXER_FULL_RENDER`)는 여전히 `fullRender(true)`를
  강제한다. `isViewportAtBottom() === false`처럼 off-bottom이 확실한 테스트/터미널과
  `isViewportAtBottom`이 없는 실제 터미널(`undefined`)은 append 없이 `viewportRepaint`만 수행해
  사용자 스크롤백 위치를 강제로 바닥에 붙이거나 추측성 CRLF append로 중복 행을 만들지 않는다.
  이는 `devlog/_plan/260615_scroll_anchor_duplication/20.9_d_done_summary.md` 후속 패치에서 이전 unknown-as-bottom append 정책을 의도적으로 뒤집은 것이다.

| `isViewportAtBottom()` | 물리 경로 | 이유 |
| --- | --- | --- |
| `true` | append-growth + `viewportRepaint` | 실제 바닥 고정이 증명되어 성장분 append가 안전함 |
| `false` | `viewportRepaint` only | 사용자가 과거를 보는 중이므로 바닥으로 밀면 안 됨 |
| `undefined` / 미구현 | `viewportRepaint` only | 실제 터미널 상태를 모르므로 추측성 CRLF append가 중복/밀림을 만들 수 있음 |

260615 follow-up taxonomy:
- **Fixed:** unknown real-terminal viewport를 bottom-like로 취급해 생기던 물리 duplicate/pushed-row 문제.
- **Deferred:** “다음 채팅 입력을 치면 복구되는” next-input self-healing repaint timing edge. 논리 프레임은 맞고 즉시 repaint/compact 트리거가 한 박자 늦는 계열로 보며, 성능 devlog `73_scroll_repaint_timing_followup.md`에 보류 기록.
- **Forbidden shortcut:** 이 deferred edge를 이유로 P1.5.1 expedited input render, P2.2 prepared-line cache, 또는 tick-wide render scheduling을 wholesale rollback하지 않는다. 재오픈 시 다음 입력이 유발한 repair path와 누락된 transition path를 먼저 비교한다.
- `extraLines > height` 조건: 레거시 멀티플렉서 플래그(`PI_TUI_LEGACY_MULTIPLEXER_FULL_RENDER`)
  없는 경우 `viewportRepaint` 분기.
- height 변화(멀티플렉서 한정): `viewportRepaint` 경로.

**`fullRender(true)`** — `2J H` 후 프레임 전체 재인쇄. 스크롤백을 내용 동일하게 재구성하므로
히스토리가 보존된다(압축이 안전한 이유). width 변화, clearOnShrink, `requestRender(true)` 등
강제 리빌드 시 발화.

**3J(스크롤백 전체 삭제) 금지 조건** (`tui.ts:1325`):

```
buffer += isMultiplexerSession() || this.#hasCommittedHistory
    ? "\x1b[2J\x1b[H"       // 3J 생략 — 멀티플렉서 또는 커밋 레인이 히스토리 기록 중
    : "\x1b[2J\x1b[H\x1b[3J";
```

- 멀티플렉서(tmux/zellij): 사용자가 직접 스크롤하므로 3J 금지.
- **커밋 레인이 한 줄이라도 스크롤백에 기록한 후** (`#hasCommittedHistory = true`): 스크롤백이
  정본 트랜스크립트이므로 3J로 지우면 안 된다 — 영구 금지.

`tui.ts:251` 주석: `"True once any line was committed — the scrollback is then canonical and 3J is forbidden."`

## 6. 커밋 레인 이중-레인 아키텍처 (083.9)

jwc는 렌더링 경로를 **두 레인**으로 분리한다.

| 레인 | 설명 | 상태 |
|------|------|------|
| **가상 레인 (virtual lane)** | 확정된 셀을 `chatContainer`에 추가 → 차등 렌더러가 매 프레임 재인쇄 | 항상 활성 (폴백) |
| **커밋 레인 (commit lane)** | 확정된 셀을 스크롤백에 단 한 번 기록 → 이후 렌더러가 건드리지 않음 | **기본 ON** (260613 플립) — `JWC_COMMIT_LANE=0`으로 옵트아웃 |

### 6-1. commitLines() — 스크롤백 커밋 기본 연산

`tui.ts:1168 commitLines(lines: string[]): boolean`:

```
커밋 레인 진입 조건:
  #historyLane === "standard"           (Zellij·dumb 터미널 제외)
  && !stopped && terminalAvailable
  && overlayStack.length === 0          (오버레이 열려 있으면 불가)
  && liveZoneTop > 0                    (fill 영역이 있어야 히스토리 영역 존재)
  && lines.length > 0
```

성공 시 `#committedScreenRows`를 증가시키고 `#hasCommittedHistory = true`로 3J를 영구 금지한다.
실패 시 `false` 반환 → 호출자가 가상 레인으로 폴백.

### 6-2. #committedScreenRows 불변식

`#committedScreenRows`는 **라이브 존 바로 위의 스크린 행 수** — 아직 스크롤백으로 올라가지 않고
화면 상단에 버티고 있는 커밋된 픽셀 블록이다. 두 가지 시나리오에서 훼손될 수 있으며 tui.ts가
각각 방어한다:

1. **라이브 존 성장으로 fill 축소** (`tui.ts:1295`): `lastFillRows < prevFillRows`이면 히스토리
   블록이 덮일 위험이 있다 → `#scrollOutCommittedRows(delta, prevFillRows)`로 먼저 스크롤 아웃.
2. **fullRender(clear=true)** (`tui.ts:1309`): 클리어 렌더 전 블록 전체를 `#scrollOutCommittedRows`
   로 스크롤백에 밀어넣고 `#committedScreenRows = 0`으로 초기화.

### 6-3. fill-region = history-region 재해석

`#expandViewportFill` 실행 후 `#lastFillRows = first === 0 ? fill : 0` (`tui.ts:1247`):

fill 스페이서가 프레임 **맨 위**(index 0)에 있을 때만 히스토리 영역으로 인정한다. fill이 0이거나
프레임 중간에 위치하면 커밋 레인은 자동으로 비활성(`commitLines` → `false`)된다. 즉 **fill
영역 = 히스토리 영역**이라는 1:1 재해석이 devlog 083.9 §3b의 핵심이며, ViewportFill이 없는
터미널(B2-lite 이전 레이아웃)에서는 커밋 레인 자체가 불가하다.

### 6-4. detectHistoryLaneMode() — 터미널 종류별 레인 결정

`insert-history.ts:30 detectHistoryLaneMode()`:

```
TERM === "dumb"              → "unsupported"
ZELLIJ / ZELLIJ_* 환경변수   → "zellij-raw"   (스크롤 리전이 soft-wrap을 끊음)
그 외                        → "standard"      (tmux 포함: tmux 자체 pane 히스토리에 기록)
```

Zellij는 scroll-region 내 soft-wrap 행을 올바르게 처리하지 못하므로 raw-append 모드를 쓴다.
tmux는 standard 경로: 커밋된 행이 tmux pane history로 들어가는 것이 의도된 동작이다.

### 6-5. buildInsertHistorySequence() — 2-페이즈 스크롤백 커밋

`insert-history.ts:56`:

**Phase 1** (라이브 존이 화면 바닥과 맞닿지 않은 경우만 실행):
`liveZoneTop..screenRows` 리전에서 `\x1bM`(Reverse Index)을 `scrollAmount`번 반복 → 라이브 존이
화면 아래로 밀리고, 위에 빈 히스토리 행이 생긴다.

**Phase 2** (항상 실행):
`1..liveZoneTop` 리전을 설정하고 `liveZoneTop` 행에 커서를 둔다. 각 `line`마다 `\r\n`(리전
위쪽으로 스크롤 아웃) → `\x1b[2K`(freed row 청소) → `line` 기록. 리전 top이 row 1이므로
밀려난 행이 실 스크롤백에 진입한다.

> 주의: top > 1인 scroll-region에서 `\r\n`으로 밀려난 행은 스크롤백 진입이 **아니라 폐기**다.
> 커밋이 제대로 이뤄지려면 반드시 `\x1b[1;N r` (1-based top=1)이어야 한다.

### 6-6. commitOrAppend() / commitLaneEnabled() — 코딩-에이전트 진입점

`packages/coding-agent/src/modes/utils/ui-helpers.ts:47–63`:

```ts
export function commitLaneEnabled(): boolean {
    const env = process.env.JWC_COMMIT_LANE;          // 기본 ON (083.10 §1)
    if (env !== undefined) return env !== "0" && env !== "false";
    return true;
}
export function commitOrAppend(ctx, component): void {
    if (commitLaneEnabled()) {
        if (ctx.ui.commitLines(component.render(width))) return;
    }
    ctx.chatContainer.addChild(component);  // 폴백: 가상 레인
}
```

현재 와이어된 호출처:
- **접힌 도구 (`#commitLiveTool`)**: `event-controller.ts:127` — 도구 완료 시 `setMinimized(true)` 후
  `commitOrAppend` 호출.
- **사용자 메시지**: `interactive-mode.ts:821` `startPendingSubmission` → `addMessageToChat` →
  `chatContainer.addChild` (가상 레인만; 커밋 레인 직접 연결은 미완).

기본 ON — 커밋은 **턴 경계(다음 프롬프트 제출 직전)**에 `commitFinalizedBacklog()` 일괄 스윕으로 수행되고, 컴포넌트는 제거되지 않고 `committed` 플래그로 프레임에서만 스킵된다(alt+t·토글은 비커밋 컴포넌트 대상). `JWC_COMMIT_LANE=0`이면 스윕 자체가 no-op. 게이트와 무관하게 미지원 터미널/zellij/오버레이/오버플로/부분 UI 픽스처는 호출 단위로 자동 폴백한다.

## 6b. TUI 수정 시 레인 체크리스트 [정본 — 260613]

**대부분의 TUI 작업은 레인을 신경 쓸 필요가 없다.** 컴포넌트 `render()`가 단일 진실원이다 —
가상 레인은 프레임 diff로, 커밋 레인은 턴 경계 스윕(`commitFinalizedBacklog`)이 같은 `render()`
출력을 스크롤백에 쓰는 것뿐이다. 따라서:

| 작업 | 레인 작업 |
|------|-----------|
| 비주얼 변경 (배너·도구 셀·폴딩 포맷·테마) | **없음** — 한 곳 수정, 양쪽 자동 |
| 새 컴포넌트 추가 | **없음** — 기본 비커밋으로 동작, 턴 경계 스윕이 자동 커밋 |
| 입력·키바인딩·셀렉터·오버레이·컴포저 | **없음** — 레인 무관 |

**같이 생각해야 하는 좁은 영역 3가지:**

1. **`tui.ts` 렌더러 내부** (fill·diff·클리어 경로) — fill 영역 = 히스토리 리전 겸용이므로
   `#committedScreenRows` 불변식(커밋 픽셀 위를 덮어쓰기 전에 선행 스크롤아웃, tui.ts §3b-3)과
   **커밋 후 3J 금지**(`#hasCommittedHistory`)를 보존할 것. 위반은 `commit-lane.test.ts` 6케이스가 잡는다.
2. **과거 콘텐츠 사후 변경 기능** — 커밋된 픽셀은 불변. 이전 턴을 다시 그리는 기능은 비커밋
   컴포넌트 대상이거나 오버레이(alt+t 패턴)로 설계할 것.
3. **턴 종료 후에도 변하는 컴포넌트** (지연 결과·백그라운드 도구) — 백로그 스윕에서 제외 필요.
   현행 가드: `streamingComponent`·`pendingTools`(ui-helpers `commitFinalizedBacklog`). 유사 수명의
   컴포넌트가 생기면 이 가드에 추가.

**디버깅**: `JWC_COMMIT_LANE=0`으로 끄고 재현 비교 → 레인 원인 여부 즉시 판별.
회귀 어서션: 커밋 픽셀 생존(`commit-lane.test.ts`), 2J/3J 0건(`above-viewport-repaint.test.ts`).

## 7. 레퍼런스 대조 (소스 실측 — `~/Developer/codex/01_tui-design/` 보강 섹션)

| | jwc | Codex | CC (현세대) |
|---|---|---|---|
| 모델 | 스크롤백-네이티브 (프레임=트랜스크립트) | **inline viewport 기본** — 커밋 셀만 `insert_history.rs`(SetScrollRegion+`\x1bM`)로 실 스크롤백에 write, 이후 불변 | alt-screen + 더블버퍼 — 스크롤백에 아무것도 안 씀 |
| 접기 | commit 모드: 커밋 시점 접기 (head/tail 아님, minimized 1줄) | compact-from-birth: head 5+tail 5+`…+N lines`로 커밋 | 완료 항목 컴팩트 출생 |
| 과거 보기 | 터미널 스크롤백(진짜) + alt+t 오버레이 | Ctrl+T transcript 오버레이 | ctrl+o/오버레이 |
| 수축 문제 | floor+압축으로 방어 (커밋 모드에선 거의 발생 안 함) | 구조적 부재 | 구조적 부재 |
| 커밋 레인 | `commitLines()` + `buildInsertHistorySequence()` (083.9 · Codex parity) | `insert_history.rs` | 없음 |

jwc가 스크롤백-네이티브를 유지하는 이유: 사용자가 터미널 스크롤로 과거를 실제로 읽음(확인됨) +
tmux 친화. alt-screen 전환은 99.20 장기 메모로만 존재.

## 8. 설정·이스케이프·가드

- `tui.composerPin` (boolean, 미지정=브랜드 기본) · `tool.renderMode` (enum, 동일) —
  settings UI에서 미지정은 **"default"로 표기** (`settings-selector.ts`).
- `PI_NO_COMPOSER_PIN=1` — 핀 강제 off (리그레션 대조용).
- `JWC_COMMIT_LANE=0` — 커밋 레인 **옵트아웃** (기본 ON, 083.10 §1 플립 260613). 미지원 터미널/zellij/오버레이/오버플로는 게이트와 무관하게 호출 단위 자동 폴백 
  (chatContainer)으로 폴백.
- `PI_TUI_LEGACY_MULTIPLEXER_FULL_RENDER=1` — 멀티플렉서에서 height 변화 시 viewportRepaint 대신
  fullRender를 강제 (레거시 비교용).
- 크래시 가드: `settings-list.ts`가 비-string currentValue에 내성 (`String(v ?? "")`) —
  260613 00:08 `/settings` 전체 다운(undefined→`truncateToWidth` native throw)의 재발 방지.

## 9. 테스트 자산

- `packages/tui/test/viewport-fill.test.ts` — **13케이스**: 핀 불변식(grow/collapse×3) ·
  clearOnShrink 미발화 · 센티널 규칙 · 경계 상/하향 통과 · off 경로 바이트 동일 · 커서 정합 ·
  리사이즈 · post-overflow 수축(autocomplete/접힘) · 갭 압축+no-op · 슬래시 복구 ·
  **뷰포트 초과 셀렉터 복구**(260613 00:04 스크린샷 시나리오).
- `packages/tui/test/settings-list-undefined-value.test.ts` — 크래시 회귀.
- `packages/coding-agent/test/commit-time-folding.test.ts` — 라이브존→접힌 커밋 · agent_end
  잔여 커밋 · verbose 보존.

## 관련 문서

- devlog: `083.6`(출렁임 기전) · `083.7`(핀 §1~§11) · `083.8`(viewportRepaint 정책·S2 compact
  이동·S3 기본화) · `083.9`(커밋 레인 P1/P2 — insert-history·commitLines·history-region) ·
  `99.20.03`(압축 트리거 맵) · `99.20.04`(커밋 폴딩 설계·구현·핫픽스)
- 260615 follow-up: `devlog/_plan/260615_scroll_anchor_duplication/20.9_d_done_summary.md`(unknown-viewport duplicate/pushed-row fix) · `devlog/_plan/260614_performance/73_scroll_repaint_timing_followup.md`(deferred next-input repaint timing edge)
- 주입/프롬프트와의 경계: [prompt_flow.md](./20_prompt_flow.md) — 스크롤은 표시층, 주입은 컨텍스트층.
