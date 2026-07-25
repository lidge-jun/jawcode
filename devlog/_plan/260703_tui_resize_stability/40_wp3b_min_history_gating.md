# 40 — WP3b-min: history-lane gating while the user may be off-bottom

## Loop continuity

WP6a Slice A + WP2.5 hardening shipped (036d1ab). GPT Pro round 5 delivered the gating
policy this slice implements verbatim (scratchpad `gpt-pro-answer-5.md`); fable subagent
runs the adversarial review of the built diff (user directive 260703).

## Policy (GPT Pro round 5, adopted)

- `#canUseHistoryLaneNow()`: overlay open → blocked; not streaming → allowed; streaming
  and `isViewportAtBottom() === false` → blocked; streaming and UNKNOWN bottom → blocked
  only in multiplexers (direct terminals allow in v1; env
  `JWC_TUI_DEFER_UNKNOWN_BOTTOM=1` opts into the conservative policy for diagnostics).
- **New commits vs required drains are different**: blocking a NEW commit is free (the
  caller already treats `commitLines() === false` as "stay in the virtual lane; the
  turn-boundary sweep retries" — boolean semantics preserved, no silent queue-as-true).
  Blocking a growth DRAIN is not always safe: the live zone is about to paint over the
  parked rows, so a skipped scroll-out would erase committed pixels (the class WP3a
  fixed). Rule: while blocked, do not CREATE new parked rows; existing parked rows keep
  the mandatory drain (WP3a absolute-finish barrier already applies) + a metric
  (`tui.historyLane` / `mandatoryDrainWhileBlocked`).
- **Avoid entering blocked streaming with parked rows**: flush once at stream start when
  the lane is usable; flush again at stream end (streaming=false first, so unknown-mux
  no longer blocks) — one discrete write instead of per-frame churn.

## Diff plan

### MODIFY packages/tui/src/tui.ts

1. `#streamingActive = false` + public `setStreamingActive(active: boolean)` —
   agent-agnostic name (TUI stays message-agnostic; "a high-churn output phase is in
   progress").
2. `#canUseHistoryLaneNow()` per the policy above (`$flag("JWC_TUI_DEFER_UNKNOWN_BOTTOM")`).
3. `commitLines()`: add the gate after the existing preconditions.
4. Public `flushHistoryLane()`: no-op unless lane usable-ish (standard lane, no overlay,
   `#committedScreenRows > 0`); scroll out `flushBottom = #committedBottomRow > 0 ?
   #committedBottomRow : #lastFillRows` rows (bottom-aligned rule from round 4), zero the
   counters, `resyncViewport("history lane flush")`. Mirrors stay consistent: the
   flushed region is mirror-blank by contract, and the resync repaints absolutely.
5. S2 drain site: when the drain fires while `!#canUseHistoryLaneNow()`, record the
   mandatory-drain metric (drain itself unchanged — correctness over scroll-comfort).

### MODIFY packages/coding-agent/src/modes/controllers/event-controller.ts

- agent_start: `ui.setStreamingActive?.(true)` after `ui.flushHistoryLane?.()` (flush
  BEFORE the streaming flag so the flush itself is not blocked).
- agent_end: `ui.setStreamingActive?.(false)` then `ui.flushHistoryLane?.()`.

### NEW packages/tui/test/history-lane-gating.test.ts

- streaming + bottom=false (wrapped terminal) → commitLines false; same state not
  streaming → true.
- streaming + unknown bottom + TMUX env → false; unknown bottom without mux → true;
  with JWC_TUI_DEFER_UNKNOWN_BOTTOM=1 → false.
- flushHistoryLane: committed rows land in scrollback in order, viewport intact, second
  flush no-ops.
- existing commit-lane tests unaffected (default streamingActive=false → allowed).

## fable adversarial review (B verification) — findings and dispositions

- **C1 (BLOCKER, fixed):** the ordinary-lane flush scrolled the WHOLE fill region
  (bottom-aligned rows need regionBottom scrolls to cross row 1), empirically dumping a
  fill-height blank gap into scrollback EVERY turn. Geometric, not a bug in the count —
  a blank-free ordinary flush is impossible with a top-anchored region. Fix:
  `flushHistoryLane` is PARKED-ONLY (`#committedBottomRow > 0`, content-only region);
  ordinary rows keep the pre-existing progressive S2 drain. Tests rewritten without the
  blank-filter that had hidden the regression; scrollback-domain blank assertions added
  (note: post-flush blanks INSIDE the viewport are the designed fill region — the
  assertion domain is the scrollback slice only).
- **C2 (accepted v1):** `isViewportAtBottom` has no production implementation — direct
  terminals: gate inert; multiplexers: blanket-block during streaming. Known plan
  tradeoff; the gate's real customer is WP6b's mid-turn commits. A future bottom
  observer upgrades precision.
- **C3 (fixed defensively):** compact()/newSession()/switchSession() mid-stream
  disconnect before abort and swallow agent_end → flag latched one turn. Fix: submit
  path clears `setStreamingActive(false)` before the backlog sweep (hard turn
  boundary). Session-layer wiring cleanup left for a follow-up.
- **C4 (mitigated by C1 fix):** the boundary flush is itself an ungated top-region
  mutation — now fires only when a parked block exists (post-realign overflowed
  sessions), the exact case where one discrete write beats per-frame churn.
- Theoretical (documented, no fix): widened flushBottom===1 one-frame glitch (resync
  covers), RPC child-death emits no agent_end (same class as C3, defensive reset
  covers the interactive path).

## Verification

fable adversarial review of the diff (invariants: mirror-blank contract during flush,
gate vs existing preconditions ordering, event wiring symmetry) before C; full tui suite
+ targeted event-controller tests + coding-agent suite delta.
