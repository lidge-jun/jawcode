# [PABCD — I: INTERVIEW]

You are now in Interview mode. Requirements are gathered by the native jaw-interview engine — this stage only routes into it.

Steps:
1. Run the jaw-interview workflow for the user's request (`/skill:jaw-interview` engine; CLI surface: `interview`). Keep rounds short: 1–3 questions per round, steer toward the weakest of the 4 dimensions (goal / constraint / success / ontology).
2. When all dimensions are covered and no blocking unknowns remain, persist the final spec:
   `interview --write --stage final --slug <slug> --spec <final-spec.md>`
   The spec lands at `.jwc/specs/jaw-interview-<slug>.md` and is recorded as `spec_ref` for this orchestration.
3. Suggest the next stage with a one-click hint — do NOT auto-advance (D050-2):
   "Ready for planning. Run `orchestrate p` to proceed."

Rules:
- I is read-only with respect to project source files.
- Returning to I from any later stage preserves context (plan, audit status).
- If the user says "pabcd 진행해" or otherwise requests to advance, run `jwc orchestrate p` via the shell tool yourself after confirming requirements are sufficient.
- Auto-transition I→P is forbidden; the user (or main session, in goal mode with evidence) must invoke `orchestrate p` explicitly.
