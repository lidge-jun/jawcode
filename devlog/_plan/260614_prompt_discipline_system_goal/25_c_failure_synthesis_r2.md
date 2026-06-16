# 25 C Failure Synthesis R2 — Runtime Active Entry Leak

Date: 2026-06-15
Stage: PABCD C
Reviewer: `34-AdversarialReviewCR2`
Verdict: FAIL

## Passing evidence before failure

- `bun run check` → PASS.
- Affected tests → PASS, 89 pass / 0 fail / 474 expects.

## Finding

### C2-FAIL-1 — Real runtime-created session active entries leave stale root aggregate active-state

Reviewer evidence: `syncSkillActiveState()` writes session activation to both root active entry `.jwc/state/active/jaw-interview.json` and session active entry `.jwc/state/sessions/<id>/active/jaw-interview.json`. The C-FAIL-1 fix removed only the session active entry/snapshot. For real runtime-created session entries, root `skill-active-state.json` can still report active `jaw-interview` with the same `session_id` after session retire.

Local source evidence:

- `packages/coding-agent/src/skill-state/active-state.ts`: `syncSkillActiveState()` writes root entry first and session entry second when `sessionId` exists.
- `packages/coding-agent/src/jwc-runtime/state-writer.ts`: authoritative active entries live under `active/<skill>.json`; snapshots are rebuilt from those entries.
- Current tests seeded derived snapshots only, so they missed the stale root authoritative active entry case.

Decision: accept. Route to B as implementation bug.

## Rejected routes

- Route to P: rejected. Plan already requires active-state snapshots no longer report stale jaw-interview after runtime cleanup; this is an implementation/test-fixture miss.
- Route to I: rejected. Requirement is clear.
- Environment/tooling: rejected. Reviewer reproduced source behavior.

## Fix plan

1. In `retireJawInterviewActiveState()`, when `sessionId` is set:
   - remove/rebuild the session active entry as before;
   - read root active entries;
   - if the root `jaw-interview` active entry has `session_id === input.sessionId`, remove/rebuild the root active entry/snapshot too;
   - if root `jaw-interview` has no session or a different session, preserve it.
2. Add a runtime-created regression test using `runNativeJawInterviewCommand --write --session-id session-A` followed by session `orchestrate p`, then assert both session and root snapshots have no active `jaw-interview` for `session-A`.
3. Keep the previous preservation test for a truly shared/root active entry.
4. Rerun focused tests, Biome, B verifier, and C gates.
