# WP10 — 10.042 deep-interview ask + goal-state (ADAPT)

> Card: struct_har/chase/10.042_gjc_chase_deep_interview_ask_goal_state.md
> Goal f8909338-255 · cluster C (goal/interview) 2nd card · sibling of 10.059 (closed).
> Source: GJC `devlog/_gjc_chase/gajae-code` @ `a791d72a`. Read-only evidence.
> Judgment: **ADAPT** (Decision A confirmed 2026-07-01).

## P — Sub-feature triage (per-feature, not per-commit)

GJC cluster spans deep-interview-recorder/state, ultragoal-runtime, ask, skill-state.
JWC architecture differs fundamentally: **rounds are written by the host AI via
`jwc state write` (state-runtime.ts), there is no GJC-style `deep-interview-recorder`
lifecycle/trigger model.** HUD already syncs from persisted rounds (buildHudForMode),
ambiguity delta + dimensions already render (workflow-hud.ts 99.04.03). ask.ts already
has inline "Other" + wheel-stays-with-terminal. So most GJC commits are already-covered
or have no JWC surface.

| # | GJC sub-feature | source | JWC state | decision |
|---|---|---|---|---|
| 1 | HUD sync with persisted round metadata (#594) | 18db6df8 | JWC `buildHudForMode("jaw-interview")` already reads `rounds`/`current_ambiguity`/dimensions/delta from the persisted envelope on every `jwc state write` | **already-covered** (confirm-only) |
| 2 | reflect written revision so HUD sync not stale-skipped (#951/#20) | 5bd59525, babb4a97 | JWC `syncSkillActiveState` runs unconditionally after each write (state-runtime.ts:1058+); no GJC recorder/lock revision path exists in JWC | **already-covered** (confirm-only) |
| 3 | validate scored transitions before persisting (#606/#609) | 39229246 | JWC `validateWorkflowStateEnvelope` is GENERIC — no jaw-interview round-shape validation. A malformed/regressing `rounds[]` (non-numeric ambiguity, scores out of 0..3, ambiguity going backwards while claimed improving) persists silently and corrupts HUD | **ADAPT** → add JWC-native round-shape validator (Slice A) |
| 4 | ask inline "Other"/custom-input + selector wheel scroll (#999/#1014/#1164) | e341b495, ad09b70a, 08c073e0 | JWC ask.ts already has OTHER_OPTION, inline customInput list slot, and "wheel stays with terminal / keyboard paging scrolls" (ask.ts:117/188/259) | **already-covered** (confirm-only) |
| 5 | ultragoal live red-team verification + review mode (#610) | 5bcf585c (2955 lines) | No JWC `ultragoal-runtime`/`ultragoal-guard` surface; JWC goal-engine has different model. Large net-new feature, no JWC landing surface | **DEFER③** (no JWC surface) |
| 6 | ralplan continuation active flag / AgentBusyError loop stop | (ultragoal/ralplan) | JWC AgentBusyError retry-loop guard already exists (agent-session.ts:8793-8859, "non-recoverable AgentBusyError loop" guard) | **already-covered** (confirm-only) |

Net implementable JWC slice: **#3 only** — adapt the scored-transition invariant to JWC's
AI-written round model as a round-shape + monotonicity validator, wired into the
`jwc state write` jaw-interview path (fail-closed before persist).

## Slice A — jaw-interview round validation (ADAPT of GJC #606)

GJC model: trigger-based bidirectional invariant on a recorder lifecycle JWC doesn't have.
JWC adaptation: validate the **persisted round shape** that JWC's own HUD consumes
(`rounds[].ambiguity` number in 0..1, `rounds[].dimensions.{goal,constraint,success,ontology}`
integers in 0..3 when present, `current_ambiguity` number in 0..1). Reject obviously
corrupt rounds at write time so the HUD cannot render NaN/out-of-range chips and a
falsely-converging interview cannot persist.

### Files
- NEW `packages/coding-agent/src/jwc-runtime/jaw-interview-round-validation.ts`
  - `export function validateJawInterviewRounds(state: unknown): StateValidationResult`
  - Pure, fail-closed, additive. Only validates when `rounds`/`current_ambiguity` present
    (backward-compatible: absent fields pass). Mirrors GJC's "missing metrics cannot prove"
    fail-safe direction but adapted to JWC shape (no triggers).
- MODIFY `packages/coding-agent/src/jwc-runtime/state-validation.ts`
  - In `validateWorkflowStateEnvelope`, when `skill === "jaw-interview"`, after the generic
    checks call the new round validator and surface its error. Keep generic path untouched
    for plan/goal/team.
- NEW `packages/coding-agent/test/jwc-runtime/jaw-interview-round-validation.test.ts`
  - valid rounds pass; non-numeric ambiguity fails; ambiguity out of [0,1] fails; dimension
    out of 0..3 fails; non-integer dimension fails; absent fields (legacy) pass;
    backward-compat with WP9 seed `{rounds:[]}` passes.

### Invariants
- Additive only: existing valid writes keep working; only malformed jaw-interview rounds rejected.
- No new gjc/gajae/ultragoal/ralplan literals (added lines).
- `jwc state write` jaw-interview already calls `validateWorkflowStateEnvelope("jaw-interview", merged)`
  twice (pre-default + final) → the new check rides the existing call site, no new wiring in state-runtime.ts.

### Acceptance
| check | expectation |
|---|---|
| focused test | bun test jaw-interview-round-validation → all pass |
| tsgo | packages/coding-agent check:types EXIT 0 |
| biome | new files clean |
| naming | no new gjc/gajae/ultragoal literals in added lines |
| diff | git diff --check clean |
| regression | existing state-runtime / jaw-interview tests still green |

### Verification
```bash
bun test packages/coding-agent/test/jwc-runtime/jaw-interview-round-validation.test.ts
cd packages/coding-agent && bun run check:types
bunx biome check --write packages/coding-agent/src/jwc-runtime/jaw-interview-round-validation.ts packages/coding-agent/src/jwc-runtime/state-validation.ts packages/coding-agent/test/jwc-runtime/jaw-interview-round-validation.test.ts
```

## PABCD plan
- P: this doc (triage + Slice A diff-level).
- A: independent gpt-5.4 explorer audits triage (is #3 the only real JWC gap? any missed apply site / contract conflict in routing the validator through validateWorkflowStateEnvelope?).
- B: implement Slice A + test; independent reviewer PASS.
- C: focused test + tsgo + biome + naming + diff.
- D: attest, then close card → _fin/10, update MOC/007/009/10.001/slice-map.

## Depends / feeds
- Depends: WP9 (10.059) closed (interview wording/ask gate). 
- Feeds: cluster D identity cards (11/12) unaffected.
