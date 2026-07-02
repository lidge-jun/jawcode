# 260702 — D-phase final review gate (codex gpt-5.5 xhigh, read-only)

Scope: the whole uncommitted working-tree diff (260630 seam layer + 260702 stabilization
layer + new tests), after A-audit PASS and B-verify DONE.

## Round 1 — FAIL (1 blocker)

**Blocker: realign double-write with a pending backlog.** A background/detached tool can
stay in `ctx.pendingTools` while its component is parked in `chatContainer` across the
turn boundary (event-controller.ts:776/823/836). On submit while overflowed,
`realignOverflowedFrame()` scrolled the visible tail — including that component's rows —
into the scrollback, but the contiguous-prefix sweep stops at the pending component
(ui-helpers commitFinalizedBacklog), leaving it uncommitted in the diff frame: the
forced rebuild redraws the same rows in the viewport → the content exists twice
(scrollback + live frame), and a third copy could follow when the tool finally commits.

**Fix:** new `canMarkEntireBacklog(ctx)` (ui-helpers) — false when any uncommitted
chatContainer child is the streaming component or a pending tool. The submit gate is now
`commitLaneEnabled() && canMarkEntireBacklog(ctx) && realignOverflowedFrame(...)`: turns
with a boundary-spanning background tool skip the realign entirely (pre-260702 behavior
for that turn; the next clean boundary realigns). Regression: 3 new cases in
`turn-boundary-realign.test.ts` (13/13 with the suite), biome + tsgo clean.

## Round 2 — FAIL (1 warn; round-1 blocker confirmed closed)

**Warn: legacy byte-identity leak via the ctrl+o freeze (260630 layer).** With the
composer pin off (no ViewportFill sentinel), `setToolsExpanded` still set
`#overflowFloorFrozen` and the renderer honored it without checking
`#fillSentinelPresent` — frozen growth was routed through `viewportRepaint` in a mode
whose contract is byte-identical legacy behavior.

**Fix:** both freeze consumers (the append-growth suppression and the frozen-growth
guard in the diff path) now require `#overflowFloorFrozen && #fillSentinelPresent`.
Regression: "legacy no-sentinel frames ignore the floor freeze (byte-identical
contract)" in `scroll-misalignment.test.ts` (physical scroll still happens with the
flag set and no sentinel). Suites 45/45, biome + tsgo clean.

## Round 3 — FAIL (1 warn + 1 info; round-2 warn confirmed closed)

**Warn: stopper-set gap for user `!`/`$` executions.** A still-running
BashExecution/EvalExecution component flushed into chatContainer at submit is neither
`streamingComponent` nor in `pendingTools`, so the markOnly sweep committed it mid-run —
committed children are skipped by the renderer, so the running command vanished and its
final output could never render. (The same gap existed in the normal commit path.)
**Fix:** shared `stopsBacklogSweep()` predicate used by BOTH `commitFinalizedBacklog`
and `canMarkEntireBacklog` (they must stay identical), extended with an optional
component contract `isBacklogCommittable()` — implemented on BashExecutionComponent and
EvalExecutionComponent as `status !== "running"`, matching SoT §6b-3's "add similar
lifecycles to this guard" instruction. Between-turn fixture-safety guard added earlier
(partial mocks without pendingTools skip realign instead of throwing — caught by the
full-suite diff, input-controller-escape).

**Info: legacy freeze regression test was loose.** The no-sentinel case now starts from
a FITTING frame (viewportY 0 asserted) before freezing and growing, so the observed
physical scroll strictly post-dates the freeze — the guard is pinned tightly.

Suites: targeted 66/67 (the 1 failure is the documented pre-existing
commit-time-folding agent_end case, baseline-identical), tsgo clean both packages.

## Round 4 — **PASS**

Both round-3 fixes confirmed closed (shared `stopsBacklogSweep()` gating both sweep and
realign including the bash/eval `isBacklogCommittable()` contract; the no-sentinel
freeze test proves an unscrolled start before freezing). The 66/67 targeted claim was
corroborated as the documented pre-existing commit-time-folding agent_end case. No
additional material issue found in the diff or the untracked tests.

## Post-PASS user e2e follow-up — duplicated welcome banner

User e2e (real jwc session) confirmed the folding residue is gone but found the welcome
banner reappearing once per turn boundary. Cause: the F3 realign's forced rebuild
repaints the frame preamble (config warnings, spacers, WelcomeComponent, changelog —
direct UI children mounted ABOVE chatContainer), which the mark-only sweep cannot reach;
each turn boundary pushed a fresh banner copy into history.

**Fix:** `markPreambleCommitted(ctx)` (ui-helpers) — on realign success, every UI child
before chatContainer is flagged `committed` (frame assembly skips it; its pixels are
already in the scrollback as-streamed), EXCEPT the ViewportFill spacer which must stay
live (it carries the pin sentinel). Wired in the submit path: `if (realigned)
markPreambleCommitted(ctx)`. Unit case in `turn-boundary-realign.test.ts`
(preamble marked, fill live, chatContainer/composer untouched). Suites 51/51, tsgo
clean.

## D summary

- **P**: RCA with live xterm repro (viewportRepaint inflation → plain-diff shrink drift)
  + two codex investigations (residue producers / history-restore death spiral) →
  diff-level plan `00_plan.md`.
- **A**: codex gpt-5.5 plan audit, 3 rounds (13 findings → 1 → PASS).
- **B**: F1 quarantine · freezeEnd physical-seam clamp · Fixed-C guard · F3 scroll-out
  realign + markOnly sweep + cluster measurement · F2b command fold; independent codex
  verify (NEEDS_FIX ×2 → DONE). Records: `10_implementation.md`, `11_codex_verify.md`.
- **C**: full two-package suite 6968 pass / 119 fail — failure set byte-identical to the
  pre-change baseline (zero new); targeted suites green except the documented
  pre-existing agent_end case; biome + tsgo clean; SoT `structure/31_scroll.md` updated.
- **D**: gpt-5.5 xhigh adversarial review, 4 rounds (blocker: pending-backlog
  double-write → canMarkEntireBacklog; warn: legacy freeze leak → sentinel-gated freeze;
  warn: user-execution stopper gap → isBacklogCommittable; info: loose test → pinned) →
  **PASS**.
- Working tree left uncommitted by policy (no proactive git actions).
- Follow-ups: real-terminal e2e (Ghostty/tmux) is the user's call; agent_end still
  defers repair to the next submit (accepted, documented); the 119 pre-existing CI
  failures belong to the 260630 CI-green thread.
