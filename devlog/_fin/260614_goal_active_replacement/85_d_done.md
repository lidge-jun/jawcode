# D-stage done — active goal slash replacement

Date: 2026-06-14
Status: complete

## P/A/B/C summary

- P: Planned cli-jaw-style active goal replacement for TUI and ACP/text `/goal`, `/goal plan`, `/goalplan`, and `/goal-plan`, with paused-goal replacement deferred.
- A: Initial audits failed on durable-plan semantics and TUI/ACP divergence; plan was repaired and final audit passed.
- B: Implemented active replacement paths, durable rewrite for active replacement/plan-mode paths, tests, devlog evidence, and read-only verifier DONE.
- C: Focused tests, package check, and workspace check passed after gate cleanup formatting in task actor files.

## Acceptance criteria met

- Active TUI `/goal objective B` replaces active objective A, submits objective B, and rewrites durable `.jwc/goal` for the replacement objective.
- Active TUI `/goal plan hint` / `/goalplan hint` replaces the active goal with the planning sentinel objective and submits only the AI planning prompt.
- ACP/text `/goal objective B`, `/goal plan hint`, `/goalplan hint`, and `/goal-plan hint` replace instead of emitting the old active-goal diagnostic.
- Paused goal replacement remains blocked.
- Existing goal interrupt no-respawn regressions stay green.

## Verification receipts

- Focused + adjacent tests: `106 pass, 0 fail, 446 expect() calls`.
- `bun run check` from `packages/coding-agent`: pass.
- `bun run check` from repo root: pass.
- B verifier: `12-GoalActiveBVerifier`, verdict `DONE`.

## WONDER

- Historical superseded-goal archive parity with cli-jaw remains intentionally out of scope; Jawcode now creates a fresh active session goal and rewrites the durable active plan.
- Initial TUI direct `/goal <objective>` remains session-goal only to avoid changing `goal({op:"complete"})` into a strict durable checkpoint flow.
- A-stage round cap was exceeded during plan repair; the final repair audit passed, but the process showed the workflow should make delta repair after cap less awkward.

## REFLECT

- The spec should have explicitly distinguished session goal state from durable `.jwc/goal` plan state at the start.
- Acceptance criteria should have said whether cli-jaw archive/history parity was required.
- A better ontology would name three surfaces separately: TUI slash side-effect submission, ACP/text `{ prompt }` return, and native durable goal plan files.
