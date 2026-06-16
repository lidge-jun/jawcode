# 260614 — PABCD P plan: ctrl+o/ctrl+t live toggle + compaction transcript preservation

> 상태: 🟡 P-stage plan draft
> 목표: `ctrl+o`/`ctrl+t` 출력 토글 버그와 compaction 후 과거 대화내역이 TUI에서 사라지는 문제를 함께 고친다.
> 범위: product/source 변경은 아직 하지 않음. 이 파일은 P-stage 계획 산출물이다.

## 1. 문제 정의

### 1.1 `ctrl+o` / `ctrl+t` 접기 상태가 과거 scrollback에 굳는 문제

현재 구조:

- `packages/coding-agent/src/config/keybindings.ts`
  - `app.tools.expand`: `ctrl+o`
  - `app.thinking.toggle`: `ctrl+t`
- `packages/coding-agent/src/modes/controllers/input-controller.ts`
  - `toggleToolOutputExpansion()`은 tool + thinking expanded state를 같이 바꾼다.
  - `setToolsExpanded()`는 `chatContainer.children` 전체와 `liveToolContainer.children` 전체에 `setExpanded(expanded)`를 호출한다.
  - `toggleThinkingBlockVisibility()`는 `chatContainer.children` 전체 assistant thinking을 토글한다.
- `packages/coding-agent/src/modes/utils/ui-helpers.ts`
  - `commitFinalizedBacklog()`는 turn boundary에서 `child.render(width)` 결과를 `ctx.ui.commitLines(lines)`로 terminal scrollback에 기록한 뒤 `child.committed = true`로 표시한다.

문제:

- 사용자가 `ctrl+o` 또는 `ctrl+t`로 출력/thinking을 펼친 상태에서 다음 prompt를 보내면, expanded pixels가 terminal scrollback에 commit된다.
- 이후 hotkey를 눌러도 committed child는 render tree에서 skip되므로 과거 scrollback 픽셀은 닫히지 않는다.
- 사용자가 보기에는 “위쪽 과거 출력은 닫을 수 없는 열린 상태로 남는” UX가 된다.

결정:

- Codex식으로 normal prompt screen의 과거 scrollback은 canonical collapsed transcript로 둔다.
- `ctrl+o`는 현재 live/uncommitted tool + thinking만 토글한다.
- `ctrl+t`의 thinking 전용 기본 매핑은 제거한다.
- `ctrl+t` full transcript overlay/screen은 후속 phase로 예약한다.

### 1.2 compaction 후 과거 대화내역이 사라지는 문제

현재 구조:

- `SessionManager.buildSessionContext()`는 LLM input용 compacted projection이다.
  - latest compaction summary + kept messages + post-compaction messages만 반환한다.
  - compaction으로 요약된 old raw messages는 의도적으로 모델 context에서 빠진다.
- `AgentSession.buildDisplaySessionContext()`가 현재 `sessionManager.buildSessionContext()`를 그대로 사용한다.
- `InteractiveMode.rebuildChatFromMessages()`가 compaction 후 `buildDisplaySessionContext()`를 렌더한다.

문제:

- compaction은 모델 context 축소여야 하는데, TUI visible transcript도 compacted projection으로 재렌더된다.
- 그 결과 사용자 화면에서 과거 user script / assistant / tool transcript가 싹 사라진다.

결정:

- model projection과 visible transcript projection을 분리한다.
- 모델 replay/LLM context는 기존 compacted `buildSessionContext()`를 유지한다.
- TUI display/rebuild/resume/tree navigation은 새 visible transcript context를 사용해 raw branch history + compaction marker를 보여준다.

## 2. 변경 파일과 diff-level 계획

### 2.1 MODIFY `packages/coding-agent/src/config/keybindings.ts`

Before:

```ts
"app.thinking.toggle": {
	defaultKeys: "ctrl+t",
	description: "Toggle thinking mode",
},
"app.tools.expand": {
	defaultKeys: "ctrl+o",
	description: "Expand tools",
},
```

After:

```ts
"app.thinking.toggle": {
	defaultKeys: [],
	description: "Toggle thinking block visibility",
},
"app.tools.expand": {
	defaultKeys: "ctrl+o",
	description: "Toggle current turn tool and thinking output",
},
```

Notes:

- Keep the action name for custom keybinding compatibility.
- Remove default `ctrl+t` binding.
- Make `ctrl+o` description scope explicit.

### 2.2 MODIFY `packages/coding-agent/src/modes/components/custom-editor.ts`

Before:

```ts
"app.tools.expand": ["ctrl+o"],
"app.thinking.toggle": ["ctrl+t"],
```

After:

```ts
"app.tools.expand": ["ctrl+o"],
"app.thinking.toggle": [],
```

Notes:

- Keep `ConfigurableEditorAction` and `onToggleThinking` path so user-defined custom binding can still work.
- Default runtime no longer treats `ctrl+t` as thinking toggle.

### 2.3 MODIFY `packages/coding-agent/src/modes/utils/hotkeys-markdown.ts`

Before:

```ts
`| \`${appKey(bindings, "app.tools.expand")}\` | Toggle tool output expansion |`,
...
`| \`${appKey(bindings, "app.thinking.toggle")}\` | Toggle thinking block visibility |`,
```

After:

```ts
`| \`${appKey(bindings, "app.tools.expand")}\` | Toggle current turn tool and thinking output |`,
...
```

- Remove the thinking toggle row when `appKey(...)` resolves to no configured keys, or hard-delete the default row if the helper does not support optional rows.
- Keep custom configured key display only if existing hotkey helper has an established pattern for optional/unbound actions.

### 2.4 MODIFY `packages/coding-agent/src/modes/controllers/input-controller.ts`

Before:

```ts
toggleToolOutputExpansion(): void {
	// ctrl+o is the global trigger ... Thinking state stays in sync so a following
	// ctrl+t toggles from what is actually on screen.
	const expanded = !this.ctx.toolOutputExpanded;
	this.ctx.thinkingExpanded = expanded;
	this.setToolsExpanded(expanded);
	this.ctx.ui.compactViewportFill();
}

setToolsExpanded(expanded: boolean): void {
	this.ctx.toolOutputExpanded = expanded;
	for (const child of this.ctx.chatContainer.children) {
		if (isExpandable(child)) {
			child.setExpanded(expanded);
		}
	}
	for (const child of this.ctx.liveToolContainer.children) {
		if (isExpandable(child)) {
			child.setExpanded(expanded);
		}
	}
	this.ctx.ui.requestRender();
}
```

After:

```ts
toggleToolOutputExpansion(): void {
	const expanded = !this.ctx.toolOutputExpanded;
	this.ctx.thinkingExpanded = expanded;
	this.setToolsExpanded(expanded);
	this.ctx.ui.compactViewportFill();
	this.ctx.showStatus(`Current turn output: ${expanded ? "expanded" : "collapsed"}`);
}

setToolsExpanded(expanded: boolean): void {
	this.ctx.toolOutputExpanded = expanded;
	for (const child of this.ctx.chatContainer.children) {
		if (!isLiveToggleEligible(child)) continue;
		if (isExpandable(child)) {
			child.setExpanded(expanded);
		}
	}
	for (const child of this.ctx.liveToolContainer.children) {
		if (isExpandable(child)) {
			child.setExpanded(expanded);
		}
	}
	this.ctx.streamingComponent?.setThinkingExpanded(expanded);
	this.ctx.ui.requestRender();
}
```

Add a local helper/type in the same controller or shared UI utility. If local to `input-controller.ts`, either import `type Component` from `@gajae-code/tui` or type the helper parameter as `unknown`; do not leave an unresolved `Component` type.

```ts
type LiveToggleEligible = { liveToggleEligible?: boolean };

function isLiveToggleEligible(child: unknown): boolean {
	return (child as LiveToggleEligible).liveToggleEligible === true;
}
```

`!child.committed` is not sufficient: after compaction/resume/tree rebuild, historical transcript components are visible but uncommitted in the virtual frame. Only components created for the current active turn, streaming tail, or live tool container may opt into `liveToggleEligible`.

Required lifecycle:

- Components rendered from persisted session history in `renderSessionContext()` / `renderInitialMessages()` must be collapsed and `liveToggleEligible = false`.
- Components created by live event handlers for the current assistant/tool turn may set `liveToggleEligible = true`.
- `commitFinalizedBacklog()` must set `liveToggleEligible = false` when it marks `child.committed = true`.
- Session rebuild, resume, tree navigation, branch navigation, and compaction rebuild must not leave historical components eligible for `ctrl+o`.

Concrete file-level work items:

- `packages/coding-agent/src/modes/utils/ui-helpers.ts`
  - In replay paths (`renderSessionContext()` / `addMessageToChat()`), pass an explicit render mode such as `{ source: "history" }` or `{ live: false }`.
  - History/replay components must be created collapsed regardless of `ctx.toolOutputExpanded` / `ctx.thinkingExpanded`.
  - History/replay components must have `liveToggleEligible = false`.
- `packages/coding-agent/src/modes/controllers/event-controller.ts`
  - Live current-turn components created from stream events must opt into `liveToggleEligible = true` where they should respond to `ctrl+o`.
  - Clear `liveToggleEligible` when a live component is finalized/committed or moved out of the current-turn mutable lane.
  - Cover AssistantMessageComponent, ToolExecutionComponent, ReadToolGroupComponent, and TTSR notification creation paths.


Also update `toggleThinkingBlockVisibility()` comments/status so it is documented as custom-binding-only legacy path, not the default `ctrl+t` UX. If retained, it must skip committed children too:

```ts
for (const child of this.ctx.chatContainer.children) {
	if (!isLiveToggleEligible(child)) continue;
	if (child instanceof AssistantMessageComponent) {
		child.setThinkingExpanded(expanded);
	}
}
```

### 2.5 MODIFY `packages/coding-agent/src/modes/utils/ui-helpers.ts`

Add a committed-render protocol near `commitLaneEnabled()`:

```ts
type CommittedRenderable = {
	renderCommitted(width: number): string[];
};

function hasCommittedRenderer(component: Component): component is Component & CommittedRenderable {
	return "renderCommitted" in component && typeof component.renderCommitted === "function";
}
```

Change `commitFinalizedBacklog()`:

Before:

```ts
const lines = child.render(width);
```

After:

```ts
const lines = hasCommittedRenderer(child) ? child.renderCommitted(width) : child.render(width);
```

Change `renderInitialMessages()` default context:

Before:

```ts
const context = prebuiltContext ?? this.ctx.sessionManager.buildSessionContext();
```

After:

```ts
const context = prebuiltContext ?? this.ctx.session.buildDisplaySessionContext();
```

Rationale:

- committed scrollback must be canonical collapsed regardless of current expanded state.
- initial/reload UI rendering must use display projection, not model projection.

Change replay expansion defaults:

Before examples in current replay code:

```ts
component.setExpanded(this.ctx.toolOutputExpanded);
```

After for history/replay mode:

```ts
component.setExpanded(false);
(component as { liveToggleEligible?: boolean }).liveToggleEligible = false;
```

For live event-created components, apply current state explicitly in `event-controller.ts` and mark eligible:

```ts
component.setExpanded(this.ctx.toolOutputExpanded);
(component as { liveToggleEligible?: boolean }).liveToggleEligible = true;
```

Preserve compaction marker order for visible transcript rendering:

- `renderSessionContext()` currently defers `compactionSummary` messages to the bottom.
- For visible transcript context, remove this deferral or gate it behind an explicit legacy option.
- The default visible transcript render must show compaction marker entries in branch order as returned by `buildVisibleTranscriptContext()`.
- Add a UI-level render-order test for compaction markers, not only a SessionManager projection test.

### 2.6 MODIFY expandable components to implement `renderCommitted(width)`

Target components, at minimum:

- `packages/coding-agent/src/modes/components/tool-execution.ts`
- `packages/coding-agent/src/modes/components/read-tool-group.ts`
- `packages/coding-agent/src/modes/components/assistant-message.ts`
- `packages/coding-agent/src/modes/components/compaction-summary-message.ts`
- `packages/coding-agent/src/modes/components/custom-message.ts`
- `packages/coding-agent/src/modes/components/skill-message.ts`
- `packages/coding-agent/src/modes/components/branch-summary-message.ts`
- `packages/coding-agent/src/modes/components/hook-message.ts`
- `packages/coding-agent/src/modes/components/ttsr-notification.ts`
- `packages/coding-agent/src/modes/components/bash-execution.ts`
- `packages/coding-agent/src/modes/components/eval-execution.ts`

Patch pattern:

```ts
renderCommitted(width: number): string[] {
	const previous = this.isExpanded();
	this.setExpanded(false);
	try {
		return this.render(width);
	} finally {
		this.setExpanded(previous);
	}
}
```

For `AssistantMessageComponent`, canonical commit must force thinking collapsed while preserving normal message text. If the component tracks thinking separately:

```ts
renderCommitted(width: number): string[] {
	const previousThinking = this.isThinkingExpanded();
	this.setThinkingExpanded(false);
	try {
		return this.render(width);
	} finally {
		this.setThinkingExpanded(previousThinking);
	}
}
```

If component internals do not expose the exact private fields above, implement equivalent state save/restore using existing setters or internal state names discovered during execution.
Do not implement `renderCommitted()` by only assigning a private `#expanded` flag if the component rebuilds child nodes in `setExpanded()`, `#updateDisplay()`, or `#rebuild()`. Use the component's existing setter/rebuild path for both collapse and restore so committed output is actually rendered from the collapsed child tree.

Bash/eval coverage is explicit: if these components expose expandable execution output, they must implement `renderCommitted(width)` with the same collapsed-state save/restore. If inspection shows they are not expandable or are already always canonical in committed render, add a short code comment/test assertion documenting that exclusion.
Branch summary, hook/custom-style messages, and TTSR notification coverage is explicit: if inspection shows they have expansion state or can expose long hidden content, they must implement `renderCommitted(width)`. If a component is non-expandable and always renders canonical bounded content, document that with a focused test or code comment so future changes do not silently reintroduce expanded committed output.

### 2.7 MODIFY `packages/coding-agent/src/session/session-manager.ts`

Add a visible transcript projection that walks active branch raw entries without applying compaction pruning.

Candidate helper structure:

```ts
export function buildVisibleTranscriptContext(
	entries: SessionEntry[],
	leafId?: string | null,
	byId?: Map<string, SessionEntry>,
): SessionContext {
	// Same path walk and state extraction as buildSessionContext().
	// Difference: append every message/custom_message/branch_summary/compaction entry on the active path.
	// compaction entry becomes createCompactionSummaryMessage(...).
}
```

Rules:

- It must preserve state fields from `buildSessionContext()`:
  - `thinkingLevel`
  - `serviceTier`
  - `models`
  - `injectedTtsrRules`
  - `selectedMCPToolNames`
  - `hasPersistedMCPToolSelection`
  - `mode`
  - `modeData`
- It must append raw transcript messages in branch order:
  - `message` → `entry.message`
  - `custom_message` → `createCustomMessage(...)`
  - `branch_summary` → `createBranchSummaryMessage(...)`
  - `compaction` → `createCompactionSummaryMessage(...)`
- It must not include provider remote replacement history as message replay source.
- It must not alter existing `buildSessionContext()` semantics.

Implementation note:

- To avoid duplicating too much state extraction, execution can extract the path/state scan into small helpers if localized and covered by tests.
- Do not use `any`; use existing `SessionEntry`/`SessionContext` types.

### 2.8 MODIFY `SessionManager` class in `packages/coding-agent/src/session/session-manager.ts`

Add method:

```ts
buildVisibleTranscriptContext(): SessionContext {
	return buildVisibleTranscriptContext(this.getEntries(), this.#leafId);
}
```

Use actual private field names from the class during execution. The current class uses `#fileEntries`, `#byId`, and `#leafId`; prefer `this.getEntries()` to preserve the same materialized/resident-blob behavior as existing context builders.

### 2.9 MODIFY `packages/coding-agent/src/session/agent-session.ts`

Change display context only:

Before:

```ts
buildDisplaySessionContext(): SessionContext {
	return deobfuscateSessionContext(this.sessionManager.buildSessionContext(), this.#obfuscator);
}
```

After:

```ts
buildDisplaySessionContext(): SessionContext {
	return deobfuscateSessionContext(this.sessionManager.buildVisibleTranscriptContext(), this.#obfuscator);
}
```

Audit every `buildDisplaySessionContext()` call in this file:

- Calls used for UI/reload/resume display should remain `buildDisplaySessionContext()`.
- Calls used for `agent.replaceMessages(...)` after compaction, history rewrite, session switch, or branch navigation must use compacted model context instead:

```ts
const sessionContext = deobfuscateSessionContext(this.sessionManager.buildSessionContext(), this.#obfuscator);
this.agent.replaceMessages(sessionContext.messages);
```

Known search hits that require audit:

- around `rewriteEntries()` / history rewrite
- around compaction append success
- around session switch/reload
- around branch navigation

Acceptance criterion:

- TUI display uses visible transcript projection.
- Agent/model messages use compacted model projection.

### 2.9.1 MODIFY branch/tree navigation context split in `packages/coding-agent/src/session/agent-session.ts`

Audit `navigateTree()` and any branch/tree APIs that return a `sessionContext` later passed to `renderInitialMessages(result.sessionContext)`.

Required behavior:

```ts
const modelContext = this.sessionManager.buildSessionContext();
const displayContext = this.sessionManager.buildVisibleTranscriptContext();

this.agent.replaceMessages(deobfuscateSessionContext(modelContext, this.#obfuscator).messages);

return {
	...result,
	sessionContext: deobfuscateSessionContext(displayContext, this.#obfuscator),
};
```

Rules:

- Return visible transcript context to UI callers.
- Use compacted model context for `agent.replaceMessages(...)`.
- Do not pass compacted model context as the prebuilt UI context after tree/branch navigation.
- Apply the same split to any session reload/switch path where one context is used for both model replacement and UI rendering.

Concrete `agent.replaceMessages(...)` / returned-context ownership audit:

- `compact(...)` success paths after appending compaction entries:
  - `agent.replaceMessages(...)` must use compacted `sessionManager.buildSessionContext()`.
  - UI rebuild must use `buildDisplaySessionContext()` / visible transcript.
- history rewrite / pruning / tool-output rewrite paths:
  - model replacement must use compacted `buildSessionContext()`.
  - any UI refresh must use visible transcript.
- `switchSession(...)` / reload paths:
  - restore MCP/model/mode state from compacted state as today where model semantics require it.
  - visible chat rebuild uses `buildDisplaySessionContext()`.
- `navigateTree()` / branch navigation:
  - `agent.replaceMessages(...)` uses compacted model context.
  - returned `sessionContext` for `renderInitialMessages(result.sessionContext)` is visible transcript context.
- `sdk.ts` startup `existingSession` remains model context unless it is also used for TUI rendering; interactive initial render must use visible display context.

### 2.10 MODIFY `packages/coding-agent/src/modes/interactive-mode.ts`

`rebuildChatFromMessages()` can keep calling `this.session.buildDisplaySessionContext()` after that method is fixed.

Update comments only if needed:

Before:

```ts
const context = this.session.buildDisplaySessionContext();
```

After:

```ts
const context = this.session.buildDisplaySessionContext(); // visible transcript projection
```

No visual banner/scroll model edits.

### 2.11 ADD/MODIFY tests

Add or extend `packages/coding-agent/test/session-manager/build-context.test.ts`:

1. new test: `visible transcript context preserves pre-compaction messages`

Fixture:

```ts
const entries: SessionEntry[] = [
	msg("u1", null, "user", "script before compact"),
	msg("a1", "u1", "assistant", "answer before compact"),
	compaction("cp1", "a1", "summary", "a1"),
	msg("u2", "cp1", "user", "after compact"),
];
```

Expect:

- `buildSessionContext(entries).messages` does not include `script before compact` when `firstKeptEntryId` excludes it.
- `buildVisibleTranscriptContext(entries).messages` includes `script before compact`, `answer before compact`, compaction summary, and `after compact` in order.

2. new test: `visible transcript context preserves raw history across nested compactions`

Expect:

- visible projection includes all raw branch messages and compaction markers.
- model projection remains latest-compaction compacted.

Add focused UI/input tests if existing harness supports partial `InteractiveModeContext` fixtures:

- `setToolsExpanded skips committed chat children and updates live children`.
- `commitFinalizedBacklog uses renderCommitted when present`.

If no existing harness exists, add small unit tests beside the relevant test suite without broad TUI instantiation.

Add keybinding/hotkey test if existing keybinding tests exist:

- default `app.thinking.toggle` keys are empty.
- `ctrl+t` is not advertised as thinking toggle in generated hotkeys markdown.
- branch/tree navigation with a prebuilt `renderInitialMessages(result.sessionContext)` context preserves visible pre-compaction transcript while agent/model messages remain compacted.
- `ctrl+o` after compaction, `/resume`, tree navigation, or branch navigation does not expand historical rebuilt transcript components; only the current live/uncommitted turn changes.
- representative non-tool expandable components (`branch-summary`, `custom/hook/skill`, compaction summary, and TTSR if expandable) either commit collapsed through `renderCommitted()` or are explicitly tested as non-expandable/canonical.
- `packages/coding-agent/test/modes/utils/render-initial-messages-dedupe.test.ts` or its current successor must be updated because `renderInitialMessages()` fallback changes from `sessionManager.buildSessionContext()` to `session.buildDisplaySessionContext()`.
- Existing test harnesses must provide `session.buildDisplaySessionContext()` and keep the prebuilt-context no-second-walk assertion.

## 3. Verification plan

Run focused tests first:

```bash
bun test packages/coding-agent/test/session-manager/build-context.test.ts
```

Run tests covering touched UI/keybinding utilities if present after inspection:

```bash
bun test packages/coding-agent/test/<focused-ui-or-keybinding-test>.test.ts
```
- If a compaction marker render-order test is added separately:
  - verify visible transcript rendering keeps compaction markers in branch order.
  - verify legacy “defer compaction summary to bottom” behavior is removed or only active behind an explicit option not used by visible transcript.

Run package check:

```bash
bun --cwd=packages/coding-agent run check
```

Manual smoke after implementation:

1. Start jwc TUI in a test session.
2. Produce a tool/thinking output.
3. Press `ctrl+o`: current output opens.
4. Send a new prompt: previous turn commits collapsed.
5. Press `ctrl+o`: only current live/uncommitted output changes.
6. Press `ctrl+t`: no thinking toggle occurs by default.
7. Run `/compact` or trigger compaction in a test session with known user script text.
8. Confirm previous user script and conversation remain visible in TUI transcript.
9. Confirm model context remains compacted by checking context report or focused unit test.
10. Confirm `alt+t` still opens the existing tool transcript overlay and was not remapped or removed.

## 4. Risks and mitigations

| Risk | Mitigation |
|---|---|
| Display projection accidentally feeds model old raw messages | Keep `buildSessionContext()` unchanged; audit every `agent.replaceMessages(...)` call; add projection separation tests. |
| `renderCommitted()` state save/restore mutates live component state incorrectly | Use try/finally; add unit test with expanded component committed collapsed while state remains expanded after render. |
| Hotkey row shows blank key for `app.thinking.toggle` | Make hotkeys markdown skip unbound actions or remove thinking row. |
| Compaction summary appears twice in visible transcript | Visible projection should append exactly one compaction marker per compaction entry in branch order; tests cover nested compactions. |
| Large raw transcript display after compaction is expensive | This restores prior expected visible history. Future transcript overlay can virtualize; current phase preserves behavior correctness. |
| `alt+t` tool transcript overlay regresses while changing `ctrl+t` | Do not change `app.tools.transcript`, `ToolTranscriptOverlayComponent`, or the `alt+t` binding; add manual smoke coverage. |

## 5. Non-goals

- Do not implement full `ctrl+t` transcript overlay/screen in this slice.
- Do not remove `app.thinking.toggle` action entirely; only remove the default `ctrl+t` binding.
- Do not rewrite TUI visual banner or scroll/fill model.
- Do not clear terminal scrollback destructively.
- Do not change model compaction semantics or stale `firstKeptEntryId` defense.
- Do not change `app.tools.transcript`, `ToolTranscriptOverlayComponent`, or `alt+t` behavior.

## 6. Acceptance criteria

- `ctrl+o` toggles only components explicitly marked live/current-turn eligible (`liveToggleEligible === true`) plus live tool container/streaming tail.
- Old/committed/rebuilt transcript output is not opened/closed by `ctrl+o`, even when rebuilt components are visible but not terminal-committed.
- Finalized committed lines are canonical collapsed even if the live component was expanded.
- `ctrl+t` is no longer the default thinking toggle.
- Compaction no longer makes previous user scripts/conversation disappear from TUI display.
- Model/agent context after compaction remains compacted and does not receive old raw messages.
- Focused tests and package check pass.
