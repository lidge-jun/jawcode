# 01 — Architect audit round 1

> Status: FAIL / BLOCK
> Source: `agent://3-PabcdSynthesisArchAudit`, persisted by architect lane at `.jwc/plans/planphase/2026-06-14-1443-a05a/stage-01-architect.md`.

## Summary

The architect auditor agrees with the synthesis-first direction but blocks implementation until the runtime contract is made more explicit.

## Findings

1. **[HIGH] A-stage lens/revision identity is underspecified**
   - Current runtime records only scalar `ctx.audit_status` and can overwrite a prior FAIL with a later PASS.
   - Required fix: add explicit Stage-A verdict identity, for example `--audit-lens planner|architect`, `ctx.a_revision_id`, `ctx.a_synthesis_required`, and per-lens verdict state.
   - Aggregate PASS only when solo mode has Architect PASS on current revision, or dual mode has Planner and Architect PASS on the same current revision with synthesis not required.

2. **[HIGH] P→A is not runtime-gated on `p_review_passed`**
   - Current transition logic does not reject P→A when the Critic has not returned `OKAY`.
   - Required fix: add `from === "p" && to === "a"` gate requiring `ctx.p_review_passed === true` unless explicit user approval is present; update status guidance.

3. **[MEDIUM] Read-only executor investigation is prompt-only**
   - Executor is normally an implementation lane, not intrinsically read-only.
   - Required fix: either prefer planner/architect for read-only repo facts, or keep executor allowed only with strict read-only assignment constraints and discard mutation-oriented output.

4. **[MEDIUM] Web-first wording can be misread as web-before-repo**
   - Required fix: keep local repo facts first for repository decisions; make web-first mean first within the external/prior-art layer. Official/library docs remain authoritative for concrete APIs.

5. **[MEDIUM] A prompt must define aggregate PASS behavior**
   - Required fix: update A prompt so both lens verdicts are recorded, any FAIL triggers synthesis before edits, and PASS is reported only when runtime aggregate status is pass.

6. **[LOW] C route evidence should be explicit**
   - Required fix: add C red-result routing note with command output/finding, affected acceptance criterion, chosen route, rejected routes, and reason.

## Single most likely breakage

A-stage verdict recording: `ctx.audit_status` is a single overwritten scalar and cannot prove both independent lenses passed the same post-synthesis revision.
