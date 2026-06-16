# 260614 — Follow-up plan: `ctrl+t` full transcript overlay

> 상태: 🟡 후속 phase 상세 계획
> 배경: 이전 phase에서 `ctrl+o`는 현재 live/current-turn tool+thinking 토글로 좁혔고, `ctrl+t` 기본 thinking 토글은 제거했다. 남은 요구는 Claude/Codex처럼 전체 대화 transcript를 별도 화면/overlay로 펼쳐 보는 기능이다.
> 결정 초안: `ctrl+t`는 normal scrollback을 mutate하지 않고 source-backed full transcript overlay/screen을 연다. 기존 `alt+t` tool-only overlay는 유지한다.

## 1. 사용자 요구 정리

사용자 의도:

- `ctrl+o`는 이미 Codex식 current-turn live toggle로 고정했다.
- `ctrl+t`는 예전 thinking toggle로 돌아가면 안 된다.
- `ctrl+t`로 Claude Code처럼 전체 대화/출력/생각을 펼쳐 보는 별도 화면을 원한다.
- 이 기능은 현재 prompt screen의 terminal scrollback을 다시 쓰거나 과거 픽셀을 접고 펴는 기능이 아니다.

한 줄 목표:

> `ctrl+t`를 full conversation transcript overlay로 구현하고, 그 안에서는 user/assistant/custom/summary/compaction/tool/thinking을 source state에서 full-expanded 형태로 탐색할 수 있게 한다.

## 2. 현재 구현 상태

### 2.1 이미 해결된 기반

이전 phase에서 다음 기반이 들어갔다.

- `packages/coding-agent/src/config/keybindings.ts`
  - `app.thinking.toggle.defaultKeys = []`
  - `app.tools.expand.defaultKeys = "ctrl+o"`
  - `app.tools.expand.description = "Toggle current turn tool and thinking output"`
- `packages/coding-agent/src/modes/controllers/input-controller.ts`
  - `ctrl+o`는 live/current-turn eligible component만 토글한다.
  - historical/rebuilt transcript component는 live toggle 대상이 아니다.
- `packages/coding-agent/src/modes/utils/ui-helpers.ts`
  - committed render는 canonical collapsed 형태로 scrollback에 기록한다.
  - replay/history components는 collapsed + liveToggleEligible=false로 렌더된다.
- `packages/coding-agent/src/session/agent-session.ts`
  - model context와 display context가 분리되었다.
  - `buildDisplaySessionContext()`는 visible transcript 보존용 projection이다.
  - `buildModelSessionContext()`는 LLM/compaction용 compacted projection이다.
- `packages/coding-agent/src/session/session-manager.ts`
  - `buildVisibleTranscriptContext(...)`가 compaction 전 raw history를 visible transcript로 보존한다.

따라서 `ctrl+t` full transcript overlay는 compacted model context가 아니라 display/visible transcript source를 사용하면 된다.

### 2.2 이미 존재하는 유사 컴포넌트

`packages/coding-agent/src/modes/components/tool-transcript-overlay.ts`:

- 현재 `alt+t`에서 쓰는 tool-only overlay다.
- `ToolExecutionComponent[]`를 받아 full-expanded tool render를 보여준다.
- 자체 scroll state를 갖는다.
- `escape`/`q`로 닫고, `up/down/pageUp/pageDown/g/G`를 지원한다.
- editor container를 overlay로 교체하는 방식이다.

현행 연결:

- `packages/coding-agent/src/config/keybindings.ts`
  - `app.tools.transcript.defaultKeys = "alt+t"`
- `packages/coding-agent/src/modes/controllers/input-controller.ts`
  - keybinding loop에서 `app.tools.transcript` 키를 `showToolTranscript()`에 연결한다.
  - `showToolTranscript()`는 `chatContainer.children`의 `ToolExecutionComponent`만 모아 overlay를 연다.

이 컴포넌트를 복제/일반화하면 `ctrl+t` full transcript overlay 구현 비용이 낮다.

## 3. Codex/Claude식 해석

### 3.1 Codex RS 스타일

이전 조사 기준:

- Codex RS의 normal chat은 history cell source를 보존하면서 terminal scrollback에도 append한다.
- `ctrl+t`는 source `transcript_cells`를 clone해서 transcript overlay를 연다.
- raw-output/resize처럼 명시적인 reflow 경로 외에는 과거 scrollback 픽셀을 일반 hotkey로 mutate하지 않는다.

jwc 적용:

- prompt screen scrollback은 그대로 둔다.
- `ctrl+t`는 source-backed overlay를 열어 full transcript를 보여준다.
- overlay close는 prompt screen으로 복귀할 뿐, scrollback pixels는 변경하지 않는다.

### 3.2 Claude Code 스타일

이전 조사 기준:

- Claude Code는 transcript screen을 별도 surface로 둔다.
- transcript mode에서는 prompt mode의 축약/필터를 우회한다.
- thinking은 `isTranscriptMode || verbose` 조건에서 full display된다.
- message별 expansion은 transcript screen 내부 state다.

jwc 적용:

- 최소 1차 구현은 full overlay로 간다.
- 내부적으로는 모든 expandable component를 full-expanded로 렌더한다.
- 장기적으로는 per-message expanded keys, search, virtual list로 확장할 수 있다.

## 4. 권장 UX

### 4.1 Normal prompt screen

- `ctrl+o`
  - 현재 live/current-turn tool + thinking만 펼침/접힘.
  - 과거 scrollback은 canonical collapsed 상태 유지.
- `alt+t`
  - 기존 tool-only transcript overlay 유지.
- `ctrl+t`
  - 새 full conversation transcript overlay open/close.
  - thinking toggle이 아니다.

### 4.2 Full transcript overlay

Header 예시:

```text
 Full transcript (42 entries, 1–38/2120)   ctrl+t/q/esc close
```

Body 포함 범위:

- user messages
- assistant messages
- assistant thinking full text
- tool executions full output
- bash/eval execution details
- read/search grouped output
- custom messages
- skill messages
- branch summary messages
- compaction summary messages
- 현재 streaming/live tail, 가능하면 포함

Navigation:

- `up` / `down`: 한 줄 이동
- `pageUp` / `pageDown`: 페이지 이동
- `g` / `G`: top/bottom
- `escape` / `q` / `ctrl+t`: close

Non-goals in first implementation:

- normal scrollback clear/rewrite
- 기존 `ctrl+o` 의미 변경
- 기존 `alt+t` 제거
- transcript 안에서 편집/복사/선택 UI
- per-message expansion key persistence
- search/filter UI

## 5. 구현 옵션

### Option A — 기존 rendered component tree를 강제 expanded render

구조:

- `chatContainer.children`를 source로 사용한다.
- overlay 렌더 시 각 component에 대해 가능한 경우 full-expanded 상태로 임시 전환 후 `render(width)`를 호출한다.
- `ToolExecutionComponent`, `AssistantMessageComponent`, `ReadToolGroupComponent` 등 타입별 full render helper를 둔다.

장점:

- 현재 TUI component 렌더링 스타일을 그대로 재사용한다.
- 구현이 빠르다.
- 기존 `ToolTranscriptOverlayComponent` 패턴과 유사하다.

단점:

- compaction/rebuild 후 chatContainer가 display projection 기준이어야 한다.
- 이미 committed되어 render tree에서 skip되는 normal render semantics와 충돌하지 않도록 overlay가 직접 children을 렌더해야 한다.
- component private state를 임시로 바꾸는 패턴이 많아질 수 있다.

판정:

- 1차 구현 후보로 가능하지만, full transcript source를 `chatContainer.children`에만 의존하면 session source와 UI source가 어긋날 때 약하다.

### Option B — `SessionContext` source를 overlay 전용 component로 다시 렌더

구조:

- `ctx.session.buildDisplaySessionContext()`를 호출해 visible transcript source를 얻는다.
- overlay 내부에서 message들을 full-expanded transcript line으로 변환한다.
- 필요하면 `UiHelpers`의 message→component 생성 로직을 재사용하거나, pure transcript renderer를 별도로 둔다.

장점:

- compaction 이후 raw visible transcript 보존과 직접 연결된다.
- prompt screen의 committed/uncommitted component 상태에 의존하지 않는다.
- Codex/Claude의 source-backed transcript screen에 더 가깝다.

단점:

- message role별 rendering 중복이 생길 수 있다.
- 현재 live tail 포함을 별도로 합쳐야 한다.

판정:

- 최종적으로 권장. 다만 pure renderer 중복이 커질 수 있으므로 1차에서는 `chatContainer.children + live tail` 혼합 방식보다 조금 더 많은 설계가 필요하다.

### Option C — hybrid: display session source + existing component renderer

구조:

- source는 `buildDisplaySessionContext()`로 잡는다.
- overlay 생성 시 임시 offscreen `Container` 또는 renderer helper를 사용해 message들을 full-expanded component로 만든다.
- 현재 live components는 `chatContainer/liveToolContainer/streamingComponent`에서 추가로 append한다.

장점:

- source-backed 성질을 유지하면서 기존 visual component를 재사용한다.
- compaction display 문제를 다시 만들 위험이 낮다.
- full expanded rendering을 component protocol로 정리할 수 있다.

단점:

- offscreen render lifecycle을 잘못 만들면 history population/pendingTools 같은 부작용을 낼 수 있다.
- `addMessageToChat()`는 실제 `chatContainer`에 mutate하므로 그대로 재사용하면 안 된다.

판정:

- 장기적으로 가장 좋지만, 1차 구현에서는 별도 pure renderer 또는 cloned component construction이 필요하다.

## 6. 권장 1차 설계

권장안:

> 새 `FullTranscriptOverlayComponent`를 추가하고, 1차 구현은 prompt의 `chatContainer.children` + `liveToolContainer.children` + `streamingComponent`를 source로 삼되, overlay 내부에서만 full-expanded 렌더한다. 동시에 설계상 `buildDisplaySessionContext()` 기반 pure renderer로 옮길 수 있도록 인터페이스를 좁혀 둔다.

이유:

- 현재 UI에 이미 렌더된 component는 visible transcript projection을 반영한다.
- compaction 후 rebuild가 끝난 상태라면 `chatContainer.children`에는 pre-compaction visible messages가 다시 들어와야 한다.
- 기존 `ToolTranscriptOverlayComponent`와 구조가 같아 구현/검증이 빠르다.
- overlay는 terminal scrollback을 건드리지 않는다.

주의:

- `child.committed`여도 overlay에서는 렌더해야 한다. prompt render skip 규칙을 쓰면 안 된다.
- live-only eligibility와 무관하게 overlay에서는 전체 transcript를 보여준다.
- full-expanded render는 화면 상태를 바꾸지 않고 원복해야 한다.
- assistant thinking은 overlay에서 full로 보여야 한다.

## 7. 파일별 상세 계획

### 7.1 MODIFY `packages/coding-agent/src/config/keybindings.ts`

추가 후보:

```ts
"app.transcript.full": {
	defaultKeys: "ctrl+t",
	description: "Open full conversation transcript overlay",
},
```

타입 맵/alias에도 추가:

```ts
fullTranscript: "app.transcript.full",
```

주의:

- `app.thinking.toggle`는 계속 `defaultKeys: []` 유지.
- `app.tools.transcript`는 계속 `alt+t` 유지.

### 7.2 MODIFY `packages/coding-agent/src/modes/components/custom-editor.ts`

`ConfigurableEditorAction` union에 추가:

```ts
| "app.transcript.full"
```

`DEFAULT_ACTION_KEYS`에 추가:

```ts
"app.transcript.full": ["ctrl+t"],
```

필요 시 callback 추가:

```ts
onFullTranscript?: () => void;
```

단, 현재 `input-controller.ts`는 `setCustomKeyHandler(...)`로 `alt+t`를 연결하므로, `ctrl+t`도 같은 방식이면 editor callback 추가 없이 가능하다. 기존 패턴과 충돌하지 않는 방식을 선택한다.

### 7.3 ADD `packages/coding-agent/src/modes/components/full-transcript-overlay.ts`

새 컴포넌트 역할:

- 전체 transcript lines를 lazy/cache로 만든다.
- scroll state를 관리한다.
- close callback으로 editor를 복원한다.
- `ctrl+t`, `escape`, `q`로 닫는다.

Skeleton:

```ts
export class FullTranscriptOverlayComponent extends Container {
	#items: Component[];
	#liveItems: Component[];
	#close: () => void;
	#requestRender: () => void;
	#scroll = 0;
	#cache?: { width: number; lines: string[] };

	constructor(items: Component[], callbacks: { close: () => void; requestRender: () => void }) { ... }

	handleInput(data: string): void { ... }

	override render(width: number): string[] { ... }
}
```

Full render helpers:

- `ToolExecutionComponent`: save `expanded`, set true, render, restore.
- `ReadToolGroupComponent`: same if it has `expanded`/`setExpanded`.
- components with duck-typed `setExpanded(expanded)` + `expanded` boolean: generic helper.
- `AssistantMessageComponent`: save `isThinkingExpanded()`, set true, render, restore.
- components without expansion protocol: render as-is.

Helper should be local and conservative:

```ts
type ExpandableLike = { expanded?: boolean; setExpanded(expanded: boolean): void };
type ThinkingLike = { isThinkingExpanded(): boolean; setThinkingExpanded(expanded: boolean): void };
```

Do not use `any`; use `unknown` + type guards.

### 7.4 MODIFY `packages/coding-agent/src/modes/controllers/input-controller.ts`

Add imports:

```ts
import { FullTranscriptOverlayComponent } from "../components/full-transcript-overlay";
```

Bind key:

```ts
for (const key of this.ctx.keybindings.getKeys("app.transcript.full")) {
	this.ctx.editor.setCustomKeyHandler(key, () => this.showFullTranscript());
}
```

Add method:

```ts
showFullTranscript(): void {
	this.#exitToolFocus();
	const items = [...this.ctx.chatContainer.children];
	const liveItems = [...this.ctx.liveToolContainer.children];
	if (this.ctx.streamingComponent) liveItems.push(this.ctx.streamingComponent);
	if (items.length === 0 && liveItems.length === 0) {
		this.ctx.showStatus("No transcript to show");
		return;
	}
	const close = () => { ...same editor restore... };
	const overlay = new FullTranscriptOverlayComponent([...items, ...liveItems], { close, requestRender: ... });
	this.ctx.editorContainer.clear();
	this.ctx.editorContainer.addChild(overlay);
	this.ctx.ui.setFocus(overlay.getFocus());
	this.ctx.ui.requestRender();
}
```

Close should also be triggered by `ctrl+t` inside overlay so repeated `ctrl+t` toggles it closed.

### 7.5 MODIFY `packages/coding-agent/src/modes/utils/hotkeys-markdown.ts`

Add row:

```ts
`| `${appKey(bindings, "app.transcript.full")}` | Open full conversation transcript overlay |`,
```

Keep existing `app.tools.transcript` row:

```ts
`| `${appKey(bindings, "app.tools.transcript")}` | Open full tool transcript overlay |`,
```

### 7.6 Tests

Likely targets:

- `packages/coding-agent/test/...` existing keybinding/hotkey tests if present.
- New focused component test for full transcript overlay rendering.
- Existing compaction display tests can be extended if overlay uses display context source later.

Suggested tests:

1. keybinding defaults:
   - `app.transcript.full` defaults to `ctrl+t`.
   - `app.thinking.toggle` defaults to `[]`.
   - `app.tools.transcript` remains `alt+t`.

2. overlay close keys:
   - `escape` closes.
   - `q` closes.
   - `ctrl+t` closes.

3. overlay renders committed/history children:
   - create a fake component with `committed=true` and render lines.
   - full overlay still includes its lines.

4. overlay force-expands expandable children:
   - fake `expanded=false` component with `setExpanded` records calls.
   - overlay render includes expanded content and restores `expanded=false` after render.

5. assistant thinking full render:
   - assistant component with thinking collapsed initially.
   - overlay render includes full thinking lines and restores previous state.

6. integration-ish input controller:
   - pressing configured `ctrl+t` opens full transcript overlay.
   - pressing `alt+t` still opens tool-only overlay.

## 8. Risk notes

### 8.1 Do not mutate prompt screen state permanently

Overlay full render will temporarily expand components. Every temporary state change must be restored in `finally`.

Bad:

```ts
component.setExpanded(true);
return component.render(width);
```

Good:

```ts
const previous = component.expanded;
try {
	component.setExpanded(true);
	return component.render(width);
} finally {
	component.setExpanded(previous);
}
```

### 8.2 Do not use prompt render skip semantics

`Container.render()` skips committed children. Full transcript overlay must directly render the stored child components, not render the chat container as a container.

### 8.3 Do not regress compaction display split

Full transcript must not use `buildModelSessionContext()` or `sessionManager.buildSessionContext()` as its source. Those are compacted LLM model projections and would reintroduce the “past transcript disappeared” bug.

Allowed sources:

- current `chatContainer.children` after display rebuild
- `session.buildDisplaySessionContext()`
- future dedicated visible transcript source

Forbidden source:

- `buildModelSessionContext()`
- `sessionManager.buildSessionContext()` for overlay UI

### 8.4 Avoid `any`

Repo rule forbids `any` unless absolutely necessary. Type guards should use `unknown` and small duck-typed interfaces.

### 8.5 Keep visual/TUI invariants

Do not touch:

- welcome banner animation
- viewport scroll model in `packages/tui/src/tui.ts`
- tool folding defaults except the explicit `ctrl+t` transcript binding

## 9. Acceptance criteria

Implementation is acceptable when:

- `ctrl+t` opens a full conversation transcript overlay.
- Pressing `ctrl+t` again inside the overlay closes it.
- `escape`/`q` close the overlay.
- `ctrl+o` still only toggles current live/current-turn tool+thinking output.
- `ctrl+t` does not toggle thinking in the prompt screen.
- `alt+t` still opens tool-only transcript overlay.
- Overlay includes historical visible transcript after compaction, including pre-compaction user messages/scripts.
- Overlay shows tool output and thinking in full-expanded form.
- Closing overlay returns to prompt editor without changing prompt screen expansion state.
- Focused tests and `bun --cwd=packages/coding-agent run check` pass.

## 10. Suggested execution sequence

1. Add keybinding action `app.transcript.full` with default `ctrl+t`.
2. Add `FullTranscriptOverlayComponent` modeled after `ToolTranscriptOverlayComponent`.
3. Wire `input-controller.ts` with `showFullTranscript()`.
4. Add hotkeys markdown row.
5. Add focused tests for keybinding and overlay full-expanded restore behavior.
6. Run focused tests.
7. Run package check.
8. If overlay source misses compaction-preserved messages, switch source from `chatContainer.children` to `session.buildDisplaySessionContext()` with a pure transcript renderer.

## 11. Open decision for implementation phase

Primary unresolved design decision:

> Use `chatContainer.children` as first implementation source, or build a pure source-backed renderer from `session.buildDisplaySessionContext()` immediately?

Recommendation:

- Start with `chatContainer.children + liveToolContainer + streamingComponent` because it is fast and matches the existing overlay architecture.
- Add a test or manual check for compaction-preserved old user message visibility in overlay.
- If that fails or proves brittle, promote the source-backed renderer immediately before shipping.

Rationale:

- The previous compaction fix already ensures display rebuild populates `chatContainer` from visible transcript context.
- A pure renderer is cleaner but can become a larger refactor.
- The first user-visible feature should avoid destabilizing prompt rendering and scrollback.
