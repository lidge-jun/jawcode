# 27 C Failure Synthesis R3 — Shared Active-State Restoration

Date: 2026-06-15
Stage: PABCD C
Reviewer: `36-AdversarialReviewCR3`
Verdict: FAIL

## Passing evidence before failure

- `bun run check` → PASS.
- Affected tests → PASS, 90 pass / 0 fail / 480 expects.

## Finding

### C3-FAIL-1 — Shared/root active-state is not restored when session activation overwrote the root aggregate entry

Reviewer evidence: shared `jwc interview --write`, then session `jwc interview --write --session-id sess-A`, then session `jwc orchestrate p` leaves shared/root `jaw-interview-state.json` active, but root `skill-active-state.json` has no active jaw-interview. The C2 fix removed the root authoritative active entry with matching `session_id`, but did not restore the still-active shared/root mode state into the root aggregate.

Root cause: `syncSkillActiveState()` writes session activation to both root and session active-entry stores. The root active-entry store can hold only one `jaw-interview` entry; a session activation can supersede the shared/root entry. When retiring the session entry, removing the matching root active entry is necessary but insufficient; if root mode state remains active, it must be restored to root active-state.

Decision: accept. Route to B as implementation bug.

## Rejected routes

- Route to P: rejected. Scope isolation and active-state consistency are already acceptance criteria.
- Route to I: rejected. Requirement is clear.
- Environment/tooling: rejected. The repro is deterministic source behavior.

## Fix plan

1. After removing a same-session root active entry, read root `jaw-interview-state.json`.
2. If root mode state is valid and `active:true`, restore root active-state via `syncSkillActiveState({ sessionId: undefined, active:true, phase:<root current_phase> })`.
3. If no root active mode exists, keep the root snapshot empty/inactive.
4. Add regression: shared `runNativeJawInterviewCommand --write`, session `runNativeJawInterviewCommand --write --session-id session-A`, session `orchestrate p`; assert session retired and root mode/root active-state remain active.
5. Rerun focused tests, Biome, verifier, C gates and adversarial review.
