# [PABCD — I: INTERVIEW]

You are now in Interview mode. Requirements are gathered by the native jaw-interview engine — this stage only routes into it.

Steps:
1. Run the jaw-interview workflow for the user's request (`/skill:jaw-interview` engine; CLI surface: `interview`). Keep rounds short: 1–3 questions per round, steer toward the weakest of the 4 dimensions (goal / constraint / success / ontology).
2. Settle the loop archetype and the unit residence before suggesting P (INTERVIEW-CLASSIFY-01): does a verifier define *done* for this work (spec-satisfaction), or only *better* (open-ended optimization — scores, win rates, benchmarks)? Record the archetype in the spec; optimization work must plan instrumentation and an explore-and-select scheme in P, not a repair loop. Also settle which implementation unit (`devlog/_plan/YYMMDD_slug/`) this work belongs to — an existing unit or a new one (UNIT-RESIDENCE-01). Record the unit path in the spec.
3. When all dimensions are covered and no blocking unknowns remain, persist the final spec:
   `interview --write --stage final --slug <slug> --spec <final-spec.md>`
   The spec lands at `.jwc/specs/jaw-interview-<slug>.md` and is recorded as `spec_ref` for this orchestration.
4. Suggest the next stage with a one-click hint — do NOT auto-advance (D050-2):
   "Ready for planning. Run `orchestrate p` to proceed."

Rules:
- Teach the decision space, don't only narrow it (INTERVIEW-TEACH-01): a user cannot choose among options they have never seen. Present researched options with a per-option trade-off explanation at every load-bearing altitude — stack, architecture, algorithm/strategy, data structure, evaluation method — including one atypical option; offer `BOTH (parallel spike, select by evidence)` when a load-bearing choice is genuinely uncertain and a spike is cheap (INTERVIEW-DIVERGE-01).
- I is read-only with respect to project source files.
- Returning to I from any later stage preserves context (plan, audit status).
- If the user says "pabcd 진행해" or otherwise requests to advance, run `jwc orchestrate p` via the shell tool yourself after confirming requirements are sufficient.
- Auto-transition I→P is forbidden; the user (or main session, in goal mode with evidence) must invoke `orchestrate p` explicitly.
