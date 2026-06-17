# MOC: Jaw Interview Fresh Fork Evaluation

**Date**: 2026-06-16  
**Status**: Done — implementation, B verification, C mechanical gates, and C adversarial review completed for this patch  
**Context**: User is refining the I-stage architecture for jaw-interview after native state/spec persistence moved into JWC runtime.

## Summary

Jaw Interview should keep the native runtime as the state/persistence/gate kernel, while using fresh fork-context agents to perform critical semantic evaluation and next-question generation. The main agent remains the user-facing host and recorder. Forks do not mutate source, do not hand off workflows, and do not execute implementation.

The preferred loop is not a separate permanent `executor`-style interviewer. It is a fresh read-only fork per round that receives the current canonical interview state, evaluates the new answer against established facts and prior scores, then returns ambiguity deltas, blocker gaps, and the next single highest-leverage question.

## Current Decisions

1. **Main-as-host, native-as-kernel, fork-as-critical-brain**
   - Main agent owns user conversation, asks the rendered question, records raw answers, and coordinates state updates.
   - Native runtime owns threshold resolution, session scoping, HUD/state persistence, spec write, and final handoff gate.
   - Fresh fork owns semantic critique: contradictions, ambiguity scoring, weak dimension selection, and next question proposal.

2. **Do not use `executor` as the interview persona**
   - `executor` has implementation gravity and is write-capable by default.
   - Interview forks must be read-only and scoped to requirements critique.
   - MVP can reuse fork mechanics with an internal prompt fragment before introducing a public callable role.

3. **Per-round loop shape**

   ```text
   main records current state
     -> fresh fork receives state snapshot + transcript summary + prior metrics
     -> fork evaluates current situation and proposes next question
     -> main asks user
     -> main records raw answer
     -> next fresh fork evaluates the answer and repeats
   ```

4. **Previous ambiguity is passed, but only as a baseline**
   - Earlier idea of hiding prior ambiguity completely is rejected.
   - GJC convergence depends on carrying `prior_ambiguity`, prior dimension scores, established facts, and trigger metadata.
   - The fork must independently re-score the transcript, but explain deltas against prior metrics.

5. **Ambiguity must be bidirectional and trigger-based**
   - Ambiguity may increase when a user answer contradicts established facts, introduces inconsistency, evades the targeted gap, or expands scope.
   - Ambiguity should not increase merely because an auditor can imagine more optional questions.
   - A red-team finding must identify a material execution-blocking gap or a GJC-style trigger.

6. **Established facts are the convergence anchor**
   - Stable confirmed decisions should be promoted into `established_facts` with source-round evidence.
   - Fresh forks should challenge contradictions against those facts, not re-litigate every confirmed decision from scratch.

7. **Final closure should copy GJC's closure model, not pure infinite redteam**
   - Threshold pass is necessary but insufficient.
   - Run a closure/acceptance guard: active topology components must have goal/constraint/criteria coverage and no material unresolved trigger.
   - Then run a restated-goal gate: one-sentence outcome confirmed by the user before spec crystallization.

## GJC Mechanisms to Reconcile Back into JWC

Current JWC jaw-interview prompt has checkpoint external audit and fixed challenge modes, but the GJC upstream design contains stronger convergence machinery that should be considered for restoration/adaptation:

- `established_facts`
- `auto_answer_streak`
- `refined_rounds`
- `closure_overrides`
- `restated_goal`
- `ambiguity_milestone`
- `lateral_reviews`
- bidirectional/non-monotonic scoring
- trigger-based ambiguity rise
- milestone-triggered lateral review panel
- free-text answer refinement before scoring
- closure acceptance guard
- restated goal confirmation gate

## Target Implementation Shape

User selected **native gate enforcement from the first patch** and **fresh fork every round**.

1. Add an internal read-only prompt fragment for per-round fresh-fork evaluation, e.g. `interview-turn-evaluator.md`.
2. Run the fresh fork on every scored interview round:
   - input: state snapshot, transcript summary, established facts, prior ambiguity/dimension scores, latest raw/refined answer
   - output: trigger analysis, updated ambiguity, dimension deltas, material gaps, next question proposal
3. Add or restore prompt instructions for:
   - established facts
   - prior ambiguity as baseline
   - trigger-based ambiguity rise
   - next question generation from the weakest material gap
4. Add a final closure prompt/gate modeled after GJC:
   - closure acceptance guard
   - one-sentence restated goal confirmation
5. Enforce the closure gate natively before final spec write in strict interview mode. The native gate should reject crystallization when required closure/restatement state is missing or failing.
6. Gate override semantics:
   - If ambiguity is `<= threshold` (default 5%), native gate should mark the interview as ready for a pre-P summary, not immediately enter P.
   - If the user explicitly says to proceed, move on, run `/orchestrate p`, or run `jwc orchestrate p`, treat that as intent to begin the pre-P summary gate, not as permission to skip it.
   - `jwc orchestrate reset` / reset intent remains an immediate escape hatch and must not be trapped by the interview gate.
   - Above-threshold progression should be recorded as an explicit human override / early-exit status rather than silently pretending the 5% gate passed.
7. Pre-P summary confirmation gate:
   - Even when ambiguity is `<= threshold`, do **not** immediately invoke `jwc orchestrate p`.
   - First present a very short, easy full-spec summary to the user: objective, scope, key constraints, acceptance signal, unresolved/override status, and next stage.
   - After the summary, explicitly ask the user to confirm they understand and want to proceed.
   - Only after the user answers with an explicit acknowledgement/proceed signal such as "알았어", "좋아", "진행해", "proceed", or equivalent may the workflow run `jwc orchestrate p --spec-ref <spec>`.
   - If the user does not confirm, remain in I/interview handoff state and do not enter P.

## Open Questions for User

1. Should this be a **prompt-layer restoration first** or a **runtime-enforced gate** from the first patch?
2. Should a fresh fork run **every round** or only at **scoring/checkpoint/closure moments**?
3. Should the per-round fork be an internal **skill fragment** only, or should we introduce a named read-only role such as `interview_critic` later?
4. Should JWC restore the full GJC state fields (`established_facts`, `closure_overrides`, `restated_goal`, `lateral_reviews`, etc.) or start with a smaller subset?
5. Should the default 5% threshold remain the hard readiness target, with the clarified meaning: "no material executor guessing," not "no possible remaining question"?
## Interview R1 Answers

- Implementation scope: **native gate from the first patch**.
- Fork cadence: **fresh fork every round**.
- GJC restore scope: unresolved; the phrase "convergence mechanism" was unclear and needs a more concrete follow-up question.
## Interview R2 Answer

- Native gate should permit progression when ambiguity is at or below the configured 5% threshold.
- Human override must remain absolute for explicit proceed / P-stage / reset intent; the interview gate should not block `/orchestrate p` or `/orchestrate reset`.
- Above-threshold human progression should be recorded as an explicit override/early-exit, preserving auditability without trapping the user.
## Interview R3 Answer

- Above-threshold human override should still create a handoff artifact.
- The workflow should crystallize the current transcript/spec draft as an early-exit spec with `BELOW_THRESHOLD_EARLY_EXIT` or equivalent metadata, then run `jwc orchestrate p --spec-ref <spec>`.
- Direct P transition without a spec is rejected for this workflow because it loses auditability and weakens plan-stage context.
## Interview R4 Answer

- Threshold pass (`<= 5%`) must not auto-skip user comprehension.
- Before P-stage transition, the main agent must summarize the full spec in simple terms and only then proceed.
- This pre-P summary requirement applies to normal threshold pass and to human override handoff.
## Interview R5 Answer

- The pre-P summary must not be a one-way announcement.
- The workflow must ask for the user's explicit acknowledgement after the short full-spec summary.
- P-stage transition is allowed only after that acknowledgement; prior proceed intent before the summary is insufficient.
- Current correction: the accidental P state was returned to I before updating this contract.

## Readiness

Requirements are sufficient to present the short full-spec summary and ask for explicit P-stage confirmation, but not to run `jwc orchestrate p` until the user acknowledges the summary.
