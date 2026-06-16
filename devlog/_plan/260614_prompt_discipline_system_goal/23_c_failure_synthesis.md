# 23 C Failure Synthesis — Stale Jaw-Interview Cleanup

Date: 2026-06-15
Stage: PABCD C
Reviewer: `32-AdversarialReviewC`
Verdict: FAIL

## Mechanical gates before adversarial review

- `bun run check` → PASS on final pre-review tree.
- `bun test packages/coding-agent/test/jaw-interview-mutation-guard.test.ts packages/coding-agent/test/jwc-runtime/jaw-interview-runtime.test.ts packages/coding-agent/test/jwc-runtime/orchestrate-state.test.ts packages/coding-agent/test/jwc-runtime/orchestrate-reset.test.ts` → 89 pass, 0 fail, 466 expects.
- `bunx biome check <touched files>` → OK.

## Findings

### C-FAIL-1 — Session-scope cleanup leaks into shared active-state

Reviewer evidence: `retireJawInterviewStateForWorkflowExit({ sessionId })` calls `syncSkillActiveState()`. `syncSkillActiveState()` writes/removes root active entry first and then session entry, so a session retire can remove root/shared `jaw-interview` active-state while leaving root/shared `jaw-interview-state.json` active. This violates the plan's session/shared isolation requirement.

Local source evidence:

- `packages/coding-agent/src/skill-state/active-state.ts`: `syncSkillActiveState()` calls `persistActiveEntry(options.cwd, undefined, entry)` and `rebuildActiveState(options.cwd)` before handling `options.sessionId`.
- `packages/coding-agent/src/jwc-runtime/jaw-interview-runtime.ts`: retire helper currently uses `syncSkillActiveState()` for both shared and session retirement.

Decision: accept. Route to B as implementation bug. Fix helper so session-scoped retire removes/rebuilds only the session active entry/snapshot; shared retire can keep using `syncSkillActiveState()`.

### C-FAIL-2 — `.html` interview-document allowance is too broad

Reviewer evidence: `isInterviewDocumentPath()` allows any `.html` extension, so active interview mode would permit product/source HTML such as `src/index.html` rather than only static mockups.

Decision: accept. Route to B as implementation bug. Restrict `.html` allowance to mockup/prototype/wireframe paths by path segment/name; keep `.md` allowance unchanged.

### C-FAIL-3 — `.jwc/**/*.html` becomes allowed by extension-only logic

Reviewer evidence: because `.html` is an interview document by extension only, non-state `.jwc` HTML artifacts can bypass the runtime-owned `.jwc` mutation guard.

Decision: accept. Route to B as implementation bug. Block `.jwc/**/*.html` regardless of mockup naming; keep existing `.jwc/**/*.md` allowance for interview specs/plans.

## Rejected routes

- Route to P: rejected. Plan already required scope isolation and static mockup-only HTML; implementation drifted from the plan.
- Route to I: rejected. Requirements are clear.
- Environment/tooling issue: rejected. Findings are reproducible source behavior.

## Fix plan

1. In `jaw-interview-runtime.ts`, import `removeActiveEntry` and `rebuildActiveSnapshot` from `state-writer`; add a small session-only active-state retire helper using those sanctioned writer primitives.
2. Use session-only active-state removal when `input.sessionId` is set; use existing `syncSkillActiveState()` only for shared/root retire.
3. In `jaw-interview-mutation-guard.ts`, replace extension-only `.html` allowance with mockup/prototype/wireframe path matching, and make `.jwc/**/*.html` blocked.
4. Add regression tests:
   - session retire does not remove root active `jaw-interview` entry when root state remains active.
   - active interview blocks `src/index.html`.
   - active interview blocks `.jwc/**/*.html`.
   - mockup HTML paths outside `.jwc` remain allowed.
5. Rerun focused tests, Biome, verifier, and C gates.
