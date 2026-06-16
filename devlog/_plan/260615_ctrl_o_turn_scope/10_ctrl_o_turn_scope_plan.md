# P PLAN — Ctrl+O current-turn expansion/collapse scope

## Objective

Fix Ctrl+O tool/thinking expansion so it applies to the current assistant turn since the immediately previous user message, then collapses that same range back completely. Preserve concurrent Ctrl+T/full-transcript work by not changing the transcript overlay path.

User repro shape:

```text
user
jawjawjaw  (assistant turn with thinking/tool output)
user
```

When Ctrl+O is pressed during or after the active `jawjawjaw` assistant turn:

- expand: reveal tool/thinking output from the current assistant turn only, bounded by the immediately previous user message;
- collapse: collapse the same range back fully, not just reduce it by roughly 2/3.

## Current code diagnosis

### Current Ctrl+O path

`packages/coding-agent/src/modes/controllers/input-controller.ts:1216-1245`:

- `toggleToolOutputExpansion()` toggles `ctx.toolOutputExpanded` and delegates to `setToolsExpanded()`.
- `setToolsExpanded()` currently iterates:
  - `ctx.chatContainer.children` filtered by `isLiveToggleEligible(child)`;
  - `ctx.liveToolContainer.children` filtered by `isLiveToggleEligible(child)`;
  - `ctx.streamingComponent?.setThinkingExpanded(expanded)`.

### Why the range is wrong

`packages/coding-agent/src/modes/utils/ui-helpers.ts:97-110`:

- `commitFinalizedBacklog()` marks committed children `liveToggleEligible=false`.
- The live-zone overflow/de-facto commit path also makes some current-turn pixels no longer behave like simple live DOM children.

Therefore Ctrl+O is currently scoped by “still live-toggle eligible DOM components”, not by “all components in the assistant turn after the immediately previous user message”.

### Why collapse is partial

`packages/coding-agent/src/modes/components/tool-execution.ts:440-486,511-538`:

- `ToolExecutionComponent.setExpanded(false)` only disables expanded rendering.
- Full one-line summary mode requires `#minimized && !#expanded`.
- Current Ctrl+O collapse only calls `setExpanded(false)` and does not restore `setMinimized(true)`, so some tools remain in normal collapsed preview mode instead of the fully minimized summary.

## Patch plan

### MODIFY `packages/coding-agent/src/modes/types.ts`

Add a current-turn boundary to `InteractiveModeContext` state:

```ts
/** Index immediately after the latest real user message in chatContainer. Ctrl+O bulk toggle starts here. */
currentTurnStartIndex: number;
```

Rationale: this is UI state, not session state. It tracks the visible chat-container component boundary for the current assistant turn without altering persisted messages or Ctrl+T transcript replay.

### MODIFY `packages/coding-agent/src/modes/components/user-message.ts`

Expose a non-rendering marker for boundary detection:

```ts
readonly isSyntheticUserMessage: boolean;

constructor(text: string, synthetic = false) {
	super();
	this.isSyntheticUserMessage = synthetic;
	...
}
```

Implementation may use a getter instead, but it must not alter rendered user-message output. The marker lets rebuild-boundary logic find the last real user component without parsing labels or text.

### MODIFY `packages/coding-agent/src/modes/interactive-mode.ts`

Add the field to `InteractiveMode`:

```ts
currentTurnStartIndex = 0;
```

Also add a private helper to recompute the boundary after full chat rebuilds:

```ts
#resetCurrentTurnStartIndexFromChat(): void {
	for (let i = this.chatContainer.children.length - 1; i >= 0; i--) {
		const child = this.chatContainer.children[i];
		if (child instanceof UserMessageComponent && !child.isSyntheticUserMessage) {
			this.currentTurnStartIndex = i + 1;
			return;
		}
	}
	this.currentTurnStartIndex = this.chatContainer.children.length;
}

Call this helper only after full chat rebuild entrypoints:

- at the end of `InteractiveMode.renderInitialMessages()` after it delegates to `#uiHelpers.renderInitialMessages()`;
- at the end of `InteractiveMode.rebuildChatFromMessages()` after it clears/repopulates via `#uiHelpers.rebuildChatFromMessages()` or equivalent.

Do **not** hook bare `InteractiveMode.renderSessionContext()` in this cycle because it can be an incremental render surface; resetting the boundary there would make unrelated render calls move the Ctrl+O range.

Rationale: resumed sessions, branch reloads, compaction rebuilds, and initial loads repopulate `chatContainer` without receiving a fresh `message_start` event. Ctrl+O must still start after the last real user message in the rebuilt visible chat.

### MODIFY `packages/coding-agent/src/modes/interactive-mode.ts` optimistic submit boundary

In `startPendingSubmission()`, after the optimistic real user message is appended with `this.addMessageToChat({ role: "user", ... })`, immediately set:

```ts
this.currentTurnStartIndex = this.chatContainer.children.length;
```

Only do this in the existing `if (!submission.customType)` branch that appends a real local user message. Do not move the boundary for custom submissions that do not render a real user prompt.

Rationale: Ctrl+O can be pressed after optimistic local submit and before the later `message_start` echo. Without this hook, the range still points to the previous user and can toggle the previous assistant turn.

### MODIFY `packages/coding-agent/src/modes/controllers/event-controller.ts`

In `#handleMessageStart()`, update `currentTurnStartIndex` only inside the existing `else if (event.message.role === "user")` branch, only for non-synthetic real user prompts, and only after the optimistic/non-optimistic add logic completes.

Current user branch shape:

```ts
} else if (event.message.role === "user") {
	const wasOptimistic = ...;
	if (!wasOptimistic) {
		this.ctx.addMessageToChat(event.message);
	}
	if (wasOptimistic) {
		...
	}
	if (!event.message.synthetic) {
		...
	}
	this.ctx.ui.requestRender();
}
```

Required shape:

```ts
} else if (event.message.role === "user") {
	const wasOptimistic = ...;
	if (!wasOptimistic) {
		this.ctx.addMessageToChat(event.message);
	}
	if (wasOptimistic) {
		...
	}
	if (!event.message.synthetic) {
		this.ctx.currentTurnStartIndex = this.ctx.chatContainer.children.length;
		...
	}
	this.ctx.ui.requestRender();
}
```

Rules:

- Update the boundary after the latest real user is represented in `chatContainer`.
- For optimistic local submissions, the user component is already present; setting the boundary to current length is still correct.
- Do not update this boundary for synthetic user messages.
- Do not update this boundary for assistant, tool, system/status/custom, Ctrl+T replay, or background messages.
### MODIFY `packages/coding-agent/src/modes/controllers/input-controller.ts`

#### 1. Add a minimizable guard

Near `Expandable`:

```ts
interface Minimizable {
	setMinimized(minimized: boolean): void;
}

function isMinimizable(obj: unknown): obj is Minimizable {
	return typeof obj === "object" && obj !== null && "setMinimized" in obj && typeof obj.setMinimized === "function";
}
```

#### 2. Add current-turn target collection

Add a private helper:

```ts
#currentTurnToggleTargets(): unknown[] {
	const start = Math.max(0, Math.min(this.ctx.currentTurnStartIndex, this.ctx.chatContainer.children.length));
	const targets = new Set<unknown>();
	for (const child of this.ctx.chatContainer.children.slice(start)) {
		targets.add(child);
	}
	for (const child of this.ctx.liveToolContainer.children) {
		targets.add(child);
	}
	if (this.ctx.streamingComponent) targets.add(this.ctx.streamingComponent);
	return [...targets];
}
```

Rationale: current assistant turn may contain components that are no longer `liveToggleEligible` because of commit/de-facto commit mechanics; Ctrl+O should still reverse the current turn's expansion.

#### 3. Replace `setToolsExpanded()` sweep

Before:

```ts
for (const child of this.ctx.chatContainer.children) {
	if (!isLiveToggleEligible(child)) continue;
	if (isExpandable(child)) child.setExpanded(expanded);
}
for (const child of this.ctx.liveToolContainer.children) { ... }
this.ctx.streamingComponent?.setThinkingExpanded(expanded);
```

After:

```ts
this.ctx.toolOutputExpanded = expanded;
const activeTools = new Set(this.ctx.pendingTools.values());
const liveTools = new Set(this.ctx.liveToolContainer.children);
for (const child of this.#currentTurnToggleTargets()) {
	if (isExpandable(child)) child.setExpanded(expanded);
	if (!expanded && isMinimizable(child) && !activeTools.has(child as ToolExecutionHandle) && !liveTools.has(child)) {
		child.setMinimized(true);
	}
}
this.ctx.streamingComponent?.setThinkingExpanded(expanded);
this.ctx.ui.requestRender();
```

Implementation note:

- It is acceptable for `streamingComponent` to be visited twice only if behavior is idempotent; prefer the `Set` helper to avoid duplicates.
- Keep `isLiveToggleEligible` import only if other methods in the file still use it (tool focus collection currently does).
- Do not call `setMinimized(false)` on expand; expanded rendering already overrides minimized mode in `ToolExecutionComponent`, and collapse should restore full summary mode.

Do not minimize active/partial tools still present in `ctx.pendingTools` or `liveToolContainer`; their minimized state is owned by the streaming/event lifecycle. Completed current-turn tools in `chatContainer` should be fully minimized on collapse.
Add `import type { ToolExecutionHandle } from "../components/tool-execution";` (or the correct existing relative path) to `input-controller.ts` for the active-tool guard.

### MODIFY `packages/coding-agent/test/input-controller-keybindings.test.ts`

Replace/extend the Ctrl+O tests around current lines 617-665.

#### Test 1 — current-turn boundary controls range

Add a test with fake components:

```ts
it("expands and collapses the current assistant turn since the previous user boundary", async () => {
	const { InputController, ctx } = await createContext();
	const olderSetExpanded = vi.fn();
	const currentSetExpanded = vi.fn();
	const currentSetMinimized = vi.fn();
	const liveToolSetExpanded = vi.fn();

	(ctx.chatContainer.children as unknown[]).push(
		{ setExpanded: olderSetExpanded, setMinimized: vi.fn(), liveToggleEligible: true },
		{ render: () => ["user boundary"] },
		{ setExpanded: currentSetExpanded, setMinimized: currentSetMinimized, liveToggleEligible: false },
	);
	ctx.currentTurnStartIndex = 2;
	(ctx.liveToolContainer.children as unknown[]).push({ setExpanded: liveToolSetExpanded, setMinimized: vi.fn() });

	const controller = new InputController(ctx);
	controller.toggleToolOutputExpansion();
	controller.toggleToolOutputExpansion();

	expect(olderSetExpanded).not.toHaveBeenCalled();
	expect(currentSetExpanded).toHaveBeenNthCalledWith(1, true);
	expect(currentSetExpanded).toHaveBeenNthCalledWith(2, false);
	expect(currentSetMinimized).toHaveBeenCalledWith(true);
	expect(liveToolSetExpanded).toHaveBeenNthCalledWith(1, true);
	expect(liveToolSetExpanded).toHaveBeenNthCalledWith(2, false);
});
```

This replaces the old contract “only live-toggle eligible current-turn components” with the new contract “all components since currentTurnStartIndex”.

#### Test 0 — optimistic submit moves boundary before message_start

Add this case to `packages/coding-agent/test/interactive-mode-current-turn-boundary.test.ts` using the real `InteractiveMode` harness described in Test 4:

- Before submit, an older assistant/tool component exists before `currentTurnStartIndex`.
- Call `mode.startPendingSubmission({ text: "next user" })`.
- Assert `mode.currentTurnStartIndex === mode.chatContainer.children.length` immediately, before any `message_start` is simulated.
- Instantiate `InputController` with `mode` as the `InteractiveModeContext` (or call the public Ctrl+O delegate if one exists), then assert a following Ctrl+O range does not target the older assistant/tool component.
- Assert custom submissions (`customType` set) do not move the boundary.
#### Test 2 — user message moves boundary

This test is owned by `packages/coding-agent/test/modes/controllers/event-controller-message-start.test.ts`; see the fixture wiring below. It verifies event-driven user boundary movement after `message_start`, while Test 0 covers the optimistic-submit window before `message_start`.

Mandate these cases in `packages/coding-agent/test/modes/controllers/event-controller-message-start.test.ts`:

- Update the test `createContext()` fixture to initialize `currentTurnStartIndex: 0`.
- Start with `ctx.currentTurnStartIndex = 0`.
- Push an older assistant/tool component into `ctx.chatContainer.children`.
- Handle `{ type: "message_start", message: realUser }` through `EventController.handleEvent(...)`.
- Assert `ctx.currentTurnStartIndex === ctx.chatContainer.children.length` after the user component is added.
- Add a sibling test for `{ role: "user", synthetic: true }` and assert it does **not** move `currentTurnStartIndex`.

Fixture wiring requirement for this file:

```ts
const chatContainer = new Container();
const ctx = {
	...
	chatContainer,
	currentTurnStartIndex: 0,
	addMessageToChat: vi.fn(message => {
		const component = new UserMessageComponent("user", Boolean("synthetic" in message && message.synthetic));
		chatContainer.addChild(component);
		return [component];
	}),
	...
}
```

The exact fixture may differ, but `addMessageToChat` must mutate `chatContainer.children`; otherwise the boundary assertion is meaningless.

#### Test 3 — committed current-turn output collapses fully

Update the existing “preserves expanded current-turn output when it becomes ineligible after commit” test because the old behavior conflicts with the user requirement.

New expectation:

- A current-turn child after `ctx.currentTurnStartIndex` is expanded.
- Then `child.liveToggleEligible = false` to simulate commit/de-facto commit.
- Second Ctrl+O still calls `setExpanded(false)` and `setMinimized(true)` because it is in the current-turn range.

Add a real-component assertion for the complete-collapse behavior:

- Create a `ToolExecutionComponent` with enough output to render more than the one-line minimized summary.
- Put it after `ctx.currentTurnStartIndex`.
- Press Ctrl+O once and render to prove expanded output appears.
- Press Ctrl+O again and assert render output is the minimized summary shape (or at minimum strictly smaller than collapsed preview and consistent with `setMinimized(true)`), not just the normal partial preview.

#### Test harness requirements

- Update every `createContext()` / `InteractiveModeContext` test fixture touched by this cycle to include `currentTurnStartIndex: 0` and `toolOutputExpanded: false`.
- In `packages/coding-agent/test/input-controller-keybindings.test.ts`, keep the Ctrl+O range test local by manually setting `ctx.currentTurnStartIndex = 2`.
- In `packages/coding-agent/test/modes/controllers/event-controller-message-start.test.ts`, own all event-boundary movement assertions; fixture must include a real `Container` as `chatContainer` and an `addMessageToChat` mock/helper that mutates `chatContainer.children`.

#### Test 4 — rebuild paths reset boundary after last real user

Add a dedicated test file: `packages/coding-agent/test/interactive-mode-current-turn-boundary.test.ts`.

The test must call an `InteractiveMode` public rebuild entrypoint, not a `UiHelpers`-only path and not a private method.

Required cases:

- Reuse the real `InteractiveMode` construction pattern from `packages/coding-agent/test/interactive-mode-editor-component.test.ts` (`TempDir`, isolated `Settings`, `AuthStorage`, `ModelRegistry`, `AgentSession`, `new InteractiveMode(session, "test")`) or create an equivalent dedicated real-`InteractiveMode` harness.
- Rebuild chat with `[older assistant, synthetic user/replay marker, real user, current assistant]`.
- Assert `mode.currentTurnStartIndex` equals the index immediately after the last non-synthetic `UserMessageComponent`.
- Assert synthetic/replay user components are ignored.
- Add a mandatory subsequent Ctrl+O range assertion: after rebuild, append a current-turn expandable component and verify older pre-boundary components are not toggled.

### Non-goals

- Do not modify Ctrl+T full transcript overlay or session replay code.
- Do not change `commitFinalizedBacklog()` commit semantics.
- Do not change `toggleThinkingBlockVisibility()` in this cycle; Ctrl+T/full transcript and thinking-block visibility remain on their existing eligibility contracts unless a separate Ctrl+T plan changes them.
- Do not make historical turns globally reversible after the next user boundary.
- Do not touch TUI scroll/fill/banner visual code.

## Acceptance criteria

1. Ctrl+O expands all expandable tool/thinking components since `ctx.currentTurnStartIndex`, even when they are no longer `liveToggleEligible`.
2. Ctrl+O does not expand components before the immediately previous user boundary.
3. Ctrl+O collapse fully collapses completed minimizable tool components by calling `setMinimized(true)` after `setExpanded(false)` while skipping active tools still present in `pendingTools`.
4. User `message_start` advances `currentTurnStartIndex` to the component index immediately after the latest real user message.
5. Optimistic local real-user submit advances `currentTurnStartIndex` immediately before the `message_start` echo.
6. After full chat rebuild/initial render paths, `currentTurnStartIndex` is reset to the component index immediately after the last real user message, or `children.length` when no real user exists.
7. Ctrl+T transcript overlay tests remain untouched/unaffected.
8. Focused verification passes:
   - `bun test packages/coding-agent/test/input-controller-keybindings.test.ts packages/coding-agent/test/modes/controllers/event-controller-message-start.test.ts`
   - `bun test packages/coding-agent/test/interactive-mode-current-turn-boundary.test.ts`
   - `bun biome check packages/coding-agent/src/modes/types.ts packages/coding-agent/src/modes/interactive-mode.ts packages/coding-agent/src/modes/components/user-message.ts packages/coding-agent/src/modes/controllers/event-controller.ts packages/coding-agent/src/modes/controllers/input-controller.ts packages/coding-agent/test/input-controller-keybindings.test.ts packages/coding-agent/test/modes/controllers/event-controller-message-start.test.ts packages/coding-agent/test/interactive-mode-current-turn-boundary.test.ts`
9. Package typecheck attempted:
   - `bun --cwd=packages/coding-agent run check:types`
   - If blocked by unrelated worktree changes, record exact blocker in C synthesis.

## Commit strategy

- Commit only this cycle's source/test/devlog files.
- Avoid `.jwc/goal/*` and unrelated dirty worktree files.
- Suggested implementation commit: `fix: scope ctrl-o to current turn`.
