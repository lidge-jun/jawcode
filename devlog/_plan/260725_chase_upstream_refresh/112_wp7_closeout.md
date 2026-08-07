# 112 — wp7 closeout: 20.102 terminal title run state

Outcome: **DONE (partial by design)** — the run-state title slice is implemented, independently re-verified
PASS, and archived to `_fin/20`. The card's other half is deferred with a named residual rather than counted
as finished.

| phase | evidence |
|---|---|
| P | `110` — card probed against the tree first; only one of its two behaviors was a real gap |
| A | Helmholtz **FAIL** (6 MAJOR + 2 MINOR) → folded in `111`; every finding independently reproduced before acceptance |
| B | `9b12fdf` implementation |
| C | Halley **FAIL** (5 defects) → `58d22fc`; Peirce **FAIL** (handoff) → `27938bd`; Peirce **FAIL** (`/fork` + weak test) → `82a6ac5`; Peirce **PASS** |
| _fin | `3cd1f78` — `_fin/20`, MOC row, INDEX 63→64, tier link, follow-index note |

## Two review rounds that changed the outcome, not just the wording

**The A round killed the plan's central claim.** The draft argued the error-notification half of `20.102` was
already satisfied because `event-controller.ts` gates its error toast on `!event.success`. That conflated an
in-TUI toast with a terminal notification. JWC has no `error.notify` key and no `sendErrorNotification` path
at all — verified by search, 0 hits. Had that stood, the card would have closed clean while roughly half of it
was unimplemented. It now closes **ADAPT-partial**.

**The C rounds found five real defects, two of which were mine by omission.** `110` explicitly specified an
`isStreaming` guard on `agent_end`; `9b12fdf` did not have one. The plan also asserted "dispose before
`popTerminalTitle()`" while `shutdown()` calls `popTerminalTitle()` *before* `stop()` — so disposing only in
`stop()` would have fired after the terminal was already handed back, which is the exact leak the plan claimed
to prevent.

The third round caught the subtlest one: the first regression test asserted `setSessionTerminalTitle` clears an
override, which is true but proves the *contract*, not the *wiring*. With the handoff and fork call sites
deleted it stayed green. The replacement drives the real controller commands and asserts emitted OSC bytes;
ablation confirms 2 of its 3 cases go red when either call site is removed.

## What shipped

The separator between the brand and the session label carries the run state — spinner while working, `>` on
the user's turn, `!` when blocked — behind `tui.titleState` (default on, live-togglable).

Three things make it JWC-native rather than an import:

- **Attention is a set, not a flag.** `agent-loop.ts` awaits `Promise.allSettled` over shared tasks, so two
  `ask` prompts can block at once and the first resolution must not clear attention.
- **Plan approval outlives its own turn.** `handlePlanApproval` aborts the agent while its selector is open,
  so that `agent_end` must not clear an id the user is still answering — a `#titleAttentionHeldAcrossTurn`
  set covers it, and release settles to `idle` rather than claiming work that is not running.
- **Every session replacement reasserts the title.** `/drop`, `/switch`, `/resume`, `/branch`, `/fork`,
  `/handoff`, auto-handoff, rename, delete-detach and the three extension paths. `/tree` is correctly
  excluded: it moves the leaf inside the same session file.

## Verification

`check:ts` 0 · `verify-g002-gates` PASS · `check-visible-definitions` PASS · `rebrand-inventory --strict` PASS
· `check:schemas` PASS · `default-jwc-definitions` 21/0 · `ci:test:smoke` ok · title/controller suites
**85 pass / 0 fail**.

Three ablations were run to prove the tests actually bite: single-flag attention (2 red), pre-fix `agent_end`
(2 red), deleted title call sites (2 red).

A pre-existing unrelated failure (`event-controller-idle-compaction`, fixture missing `getCwd`/`getSessionId`)
was repaired so the suite is genuinely green. The two chase gates remain at their exact pre-existing baseline
— 136 offenders, 39 lifecycle violations — and `20.102` contributes zero to either.

`packages/tui/src/tui.ts` and `modes/components/welcome.ts` untouched across all four commits.

## Carried forward

- **Residual from this card:** opt-in terminal error notifications (`error.notify` + a settled `agent_end`
  send path with retry suppression). Its own cycle.
- **Remaining bucket-A cards:** GJC `10.110`, `10.112`; OMP `20.082`, `20.087`, `20.088`, `20.089`.
