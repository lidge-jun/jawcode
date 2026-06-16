# 260615 — PABCD synthesis-first review loops

> Status: design/devlog note only; no product/source code changes in this artifact.
> Trigger: PABCD P/A/B/C review loops can become too passive when the main session accepts subagent audit/verifier findings serially. The desired behavior is main-session root-cause synthesis, targeted investigation, and compromise design before re-review/re-verification.

## 1. Problem statement

Current PABCD prompts preserve independent review lanes, but the main session can still behave like a passive patch relay:

- P: Critic returns `ITERATE`/`REJECT`; main patches plan directly against findings and re-runs Critic.
- A: Planner/Architect return `FAIL`; main patches plan directly and re-runs delta audit.
- B: Verifier returns `NEEDS_FIX`; main fixes issues and re-verifies.
- C: Mechanical/adversarial failures route back to B/P/I, but route selection can be accepted from the first reviewer label rather than synthesized from evidence.

This causes excessive rounds because the main session does not have to prove it understood the shared cause, original design intent, reviewer concern, and selected compromise before sending the next review.

## 2. Product direction

Negative review/verifier output must trigger a **main-session synthesis gate** before another review loop.

The main session owns:

1. root-cause analysis;
2. conflict analysis between the approved design, repo conventions, reviewer findings, and prior-art evidence;
3. targeted investigation;
4. compromise selection;
5. explicit rejection or deferral of reviewer suggestions when warranted;
6. exact plan/code section changes;
7. re-review packet construction.

Subagents remain independent auditors/verifiers. They must not mutate the plan/code or negotiate the compromise for the main session.

## 3. Investigation doctrine

When reviewer findings conflict with the approved design, repository conventions, each other, or the main session's implementation strategy, the main session must not accept them passively. It must run a targeted investigation layer.

Investigation order:

1. **Local repo facts**
   - Use `read`, `search`, `ast_grep`, maintained `structure/` docs, exact files/symbols, imports, callsites, and tests.
   - Prefer AST/repo-structure inspection for code-shape questions.
2. **Read-only executor investigator**
   - Use a bounded `executor` subagent for unfamiliar or multi-file repo fact gathering.
   - Scope to 3-5 exact files/questions where possible.
   - Assignment must say read-only, no product/source edits, no `.jwc` mutation, no formatters, no project-wide gates.
3. **Web-first external/prior-art layer**
   - Use web research first for common implementation patterns, workflow designs, tradeoffs, current ecosystem practice, and prior art.
   - Web evidence can be sufficient by itself when the question is broad design/prior-art rather than library API syntax.
4. **Context7 parallel/supplemental layer**
   - Context7 may run in parallel or as a supplement for library/framework/tooling documentation and examples.
   - Do not block on Context7 when web evidence is enough.

External/prior-art evidence does not override the approved design or repo facts by itself. It informs the compromise. The synthesis must state how the evidence changed or did not change the chosen patch.

## 4. Stage-specific behavior

### P — Critic `ITERATE` / `REJECT`

Before editing the devlog plan after a negative Critic verdict, the main session must write a Critic failure synthesis:

- each Critic finding;
- failure category: missing acceptance criterion, ambiguous scope, missing file/path, inconsistent sequence, unverifiable claim, bad routing, or requirements ambiguity;
- original plan intent;
- repo/AST facts checked;
- web/prior-art evidence checked when conflict or uncertainty exists;
- Context7/library evidence when used;
- chosen compromise;
- rejected suggestions and why;
- exact plan sections changed;
- findings routed back to I or deferred with reason.

Do not spawn the next Critic against an unchanged plan.

Runtime follow-up: `p_review_passed` should gate P→A unless the user explicitly overrides. Recording `OKAY` should set the gate; `ITERATE`/`REJECT` should keep it closed.

### A — Planner/Architect `FAIL`

Before any re-audit, the main session must synthesize both lenses:

- stable finding IDs by lens;
- shared root cause;
- conflicts between Planner and Architect suggestions;
- original design intent;
- repo/AST evidence;
- web-first prior-art/common-practice evidence when conflict or uncertainty exists;
- Context7/library evidence when used;
- selected compromise;
- rejected alternatives;
- exact plan sections changed;
- residual risk.

Delta re-audit packet should include the synthesis plus changed plan sections and unresolved prior finding IDs, not a vague full-plan retry.

Runtime follow-up: Stage A should track lens-level verdicts and `synthesis_required` so a later PASS cannot overwrite an unresolved FAIL. Dual mode should pass only after Planner and Architect both PASS the same post-synthesis revision.

### B — Verifier `NEEDS_FIX`

Before patching after verifier `NEEDS_FIX`, the main session must synthesize:

- verifier issues;
- reproduced or inspected evidence;
- root cause category: implementation bug, missed plan step, bad plan assumption, spec ambiguity, environment/tooling issue;
- repo/AST facts;
- read-only executor investigation when diagnosis crosses unfamiliar multi-file areas;
- web-first prior-art/common-practice evidence when strategy is disputed or uncertain;
- Context7/library evidence when used;
- chosen code patch or route back to P/I;
- exact changed files;
- verification evidence and residual risk.

Do not re-run verifier against unchanged code unless the previous verifier output lacked enough evidence and the re-run is explicitly evidence-gathering.

Runtime follow-up: B already gates B→C on `verification_status=done`; prompt strengthening is likely enough unless a persisted synthesis artifact becomes required.

### C — Mechanical/adversarial final check

Before routing red C results back to B/P/I, the main session must synthesize:

- command output, diff evidence, or adversarial finding;
- acceptance criteria affected;
- root cause route: code issue → B, plan issue → P, spec/requirements issue → I, or environment/tooling issue;
- repo/AST facts checked;
- web-first prior-art/common-practice evidence when route/strategy is disputed;
- Context7/library evidence when used;
- reason the chosen route is correct.

The reviewer can propose a route, but the main session owns the route decision.

## 5. Patch targets

Likely files:

- `packages/coding-agent/src/prompts/jaw/orchestrate-p.md`
- `packages/coding-agent/src/prompts/jaw/orchestrate-a.md`
- `packages/coding-agent/src/prompts/jaw/orchestrate-b.md`
- `packages/coding-agent/src/prompts/jaw/orchestrate-c.md`
- `packages/coding-agent/src/prompts/jaw/orchestrate-audit-planner.md`
- `packages/coding-agent/src/prompts/jaw/orchestrate-audit-architect.md`
- `packages/coding-agent/src/jwc-runtime/orchestrate-state.ts`
- `packages/coding-agent/src/jwc-runtime/orchestrate-runtime.ts`

## 6. Acceptance criteria

- Negative P/A/B/C review loops require main-session synthesis before re-review/re-verification/routing.
- The prompts explicitly prohibit passive acceptance of reviewer findings when they conflict with design, repo facts, or each other.
- Web-first external/prior-art research is available for conflict/uncertainty/common-practice checks; Context7 can run in parallel or supplement library/framework docs.
- Read-only executor investigation is explicitly allowed for bounded repo fact gathering and explicitly forbidden from mutating source, `.jwc`, or running broad gates.
- P→A is runtime-gated on `p_review_passed` unless explicitly user-approved.
- A-stage runtime no longer allows a single later PASS to hide unresolved lens-level FAILs.
- Existing independent auditor/verifier gates remain intact.

## 7. Verification plan

Focused verification after implementation:

1. Prompt content assertions or snapshot checks for P/A/B/C synthesis language, web-first research layer, Context7 supplemental layer, and read-only executor investigator constraints.
2. Runtime transition test: P→A rejects when `p_review_passed !== true`; accepts after recorded `OKAY`; explicit user override remains explicit if retained.
3. Runtime A-state test: dual-mode FAIL sets synthesis-required/lens failure; later single-lens PASS does not mark overall audit pass; both lenses PASS on the same post-synthesis revision marks pass.
4. Runtime B regression: `NEEDS_FIX` rejects B→C and `DONE` allows B→C.
5. Existing visible-definition/workflow gates if bundled workflow prompt changes affect public workflow surface.
