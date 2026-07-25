# 40 — WP3: ctrl+o fold targeting (260703)

## Loop continuity

WP1 (realign v3) fixed committed-pixel corruption; WP2 fixed duplicate user components.
Remaining e2e symptom: "접기가 이상하게 동작해서 아닌게 접히고 접기가 제대로 안됨" — ctrl+o
toggles the wrong components or visibly does nothing.

## RCA (class C2)

ctrl+o targets `chatContainer.children.slice(currentTurnStartIndex)` plus live
tools/streaming (`input-controller.ts:1307-1318`, `#currentTurnToggleTargets`). Three
defects make the target set wrong:

1. **Mid-run boundary reset.** `event-controller.ts` (`#handleMessageStart`, user branch)
   sets `currentTurnStartIndex = children.length` for EVERY non-synthetic user delivery.
   A steering message delivered mid-run (user submits while streaming → `steer()`)
   arrives after the run's assistant/tool components exist, so the boundary jumps past
   them — the output the user is looking at silently leaves the ctrl+o scope ("아닌게
   접히고"). AUDIT round-1 killed the per-run-flag design (`agent_start` re-fires on
   retry/`agentLoopContinue` with no user opener — agent-loop.ts:176,
   agent-session.ts:8800 — and steers/follow-ups can be emitted later inside the same
   run; custom/synthetic-opened runs have no user opener at all). Correct source of
   truth: the session's own dequeue branch (`agent-session.ts:1906-1921`) already knows
   whether the delivery matched the STEERING queue. Set a transient
   `#lastUserDeliveryFromSteering` there (true on steering-queue match, false otherwise)
   and expose `consumeSteeringUserDelivery(): boolean`; the event pipeline is ordered and
   handled sequentially, so the UI consumes it for exactly that delivery. The
   event-controller then skips the boundary reset for steering deliveries only —
   follow-up dequeues (logical turn starts) and direct prompts keep today's reset,
   retry/custom/synthetic shapes are untouched.
2. **No eligibility filter.** `#currentTurnToggleTargets` adds every child after the
   boundary. Components committed by the turn-boundary sweep stay in `chatContainer`
   (object retained, pixels frozen — `ui-helpers.ts:commitFinalizedBacklog` marks
   `liveToggleEligible = false`), so with any stale boundary they get `setExpanded()`
   called on frozen pixels — state flips invisibly and the global flag desyncs further.
   AUDIT round-1: a require-eligible filter would DROP legitimate targets — bash/eval
   components (command-controller.ts:1054, ui-helpers.ts:930) and non-live custom/skill
   messages are current-turn expandable output but never marked eligible (covered by
   existing keybinding tests at input-controller-keybindings.test.ts:739). Use an
   EXCLUSION filter instead: skip a chat child only when it is explicitly retired —
   `committed === true` (sweep) or `liveToggleEligible === false` (sweep/replay).
   Unmarked components (property absent) stay targetable. Live-tool container children
   and the streaming component keep their explicit adds.
3. **Stale global flag across turns.** `ctx.toolOutputExpanded` persists after a turn
   ends, but the next turn's components start collapsed. If the previous turn ended
   expanded, the first ctrl+o of the new turn sets the flag `false` (collapse of
   already-collapsed components — visibly nothing happens) and only the second press
   expands ("접기가 제대로 안됨"). Reset `toolOutputExpanded`/`thinkingExpanded` to
   `false` at the submit turn boundary (`input-controller.ts` submit path, next to the
   existing `setOverflowFloorFrozen(false)` at `:523`, which already unfreezes the
   expansion-floor coupling for the same reason).

## Fix

- **`agent-session.ts`** — in the `message_start` user dequeue branch (`:1906-1921`),
  record `#lastUserDeliveryFromSteering = steeringIndex !== -1`; add
  `consumeSteeringUserDelivery(): boolean` (returns and clears).
- **`event-controller.ts`** — user branch: consume the session flag; skip only the
  `currentTurnStartIndex` reset when it was a steering delivery (synthetic exclusion,
  `updatePendingMessagesDisplay`, and editor handling unchanged).
- **`input-controller.ts`** — ~~exclusion filter in `#currentTurnToggleTargets`~~
  **WITHDRAWN in B**: existing keybinding tests encode the intended contract — ctrl+o
  scope is index-based by design, and collapse MUST still reach components that became
  committed/ineligible while expanded, or they stay stuck expanded
  (input-controller-keybindings.test.ts "expands and collapses the current assistant
  turn…" constructs a `liveToggleEligible: false` current-turn child and expects it
  toggled; "collapses committed current-turn output even after it becomes ineligible"
  asserts the undo path). With fix 1 restoring boundary correctness at the source, no
  concrete defect remains for the filter to cover. Submit path still resets
  `this.ctx.toolOutputExpanded = false; this.ctx.thinkingExpanded = false;` beside
  `setOverflowFloorFrozen(false)`.

## Residual (recorded, out of scope)

Committed pixels still render their "(ctrl+o to expand)" hint (`execution-shared.ts:89`)
— as-streamed realign pixels cannot be edited, so changing only the commitLines lane
would be inconsistent; the transcript overlay (ctrl+t) remains the way to view committed
output. Candidate follow-up: swap the hint at renderCommitted time.

## Tests

`test/modes/controllers/event-controller-message-start.test.ts`:
- existing "moves the Ctrl+O boundary after adding a real user message" stays green
  (non-steering delivery);
- NEW: a user delivery flagged as steering (session mock returns true from
  `consumeSteeringUserDelivery`) does NOT move the boundary; the flag is consumed
  (next delivery resets again).

`test/input-controller-keybindings.test.ts` (hosts the toggle tests) or a focused new
case: a committed/ineligible component after the boundary is not toggled; an eligible
one is; the boundary-reset on submit clears `toolOutputExpanded`.

## Verification

Affected test files + `bun run check` in packages/coding-agent.

## D — cycle summary (260703 WP3)

- **P**: RCA — mid-run steering deliveries hijack the ctrl+o boundary; stale global
  expansion flags; (initially) missing eligibility filter.
- **A**: Codex gpt-5.5 xhigh audit KILLED two design elements with evidence (agent_start
  refires on retry/continue → per-run flag unsound; bash/eval/custom components unmarked
  → require-eligible filter drops legitimate targets) → redesigned to session-layer
  steering tagging + exclusion filter.
- **B**: implemented; existing keybinding tests then exposed the intended index-based
  scope + collapse-must-reach-committed contract → exclusion filter WITHDRAWN (fix 1
  covers the defect at the source). B-verify round 1 NEEDS_FIX (extension-ordering race
  on the global transient) → replaced with WeakSet keyed by message object identity;
  round 2 DONE (identity survives the pipeline, race-immune, leak-free).
- **C**: 6 affected test files 84/84, biome + tsgo clean.

Files: packages/coding-agent/src/session/agent-session.ts,
src/modes/controllers/{event-controller.ts, input-controller.ts}, 2 test files, this devlog.

Next-direction: WP4 — full-workspace verification pass + pre-existing suite debt triage
(6 render-goldens, issue-825 ×3, interactive-mode-status ×1) + e2e scenario re-check.
