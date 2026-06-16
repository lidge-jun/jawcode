# 02 — Main-session synthesis after architect audit round 1

> Status: synthesis complete; plan requires revision before product/source implementation.
> Inputs: architect audit round 1, local source inspection, prior executor investigation, web-first external/prior-art check.

## 1. Root cause

The original devlog correctly identified passive PABCD review loops, but it mixed two different enforcement levels:

1. **Prompt discipline** — enough for P/B/C behavior shaping and review packet quality.
2. **Runtime gate identity** — required for A dual-audit correctness and P→A transition safety.

The architect audit is correct: without lens/revision identity, A-stage cannot prove that Planner and Architect both passed the same synthesized revision. Without a P→A runtime gate, the P Critic `OKAY` contract remains mostly prompt-enforced.

## 2. Evidence checked

### Local repo/source evidence

- `packages/coding-agent/src/prompts/jaw/orchestrate-p.md`
  - P says main patches plan after `ITERATE`/`REJECT` and must not spawn another Critic against an unchanged plan, but does not require root-cause synthesis or targeted investigation.
- `packages/coding-agent/src/prompts/jaw/orchestrate-a.md`
  - A says main fixes plan after any `FAIL`, but does not define lens-level aggregation or synthesis packet shape.
- `packages/coding-agent/src/prompts/jaw/orchestrate-b.md`
  - B says main fixes after `NEEDS_FIX`, but does not require failure classification or route-back synthesis.
- `packages/coding-agent/src/prompts/jaw/orchestrate-c.md`
  - C routes red checks to B/P/I, but does not require evidence-backed route synthesis.
- `packages/coding-agent/src/jwc-runtime/orchestrate-runtime.ts`
  - P records `p_review_passed`; A records scalar `audit_status`; B records `verification_status`.
- `packages/coding-agent/src/jwc-runtime/orchestrate-state.ts`
  - B→C is gated on `verification_status=done`; A→B is gated on `audit_status=pass`; P→A lacks a corresponding `p_review_passed` gate.

### Existing read-only executor investigation

The earlier bounded executor review found the same broad issue: current A prompt/runtime can allow passive loop behavior and scalar audit overwrite; B/C mainly need prompt discipline; P needs transition gating.

### Web-first external/prior-art evidence

Oracle's Human-in-the-Loop overview says human oversight belongs at critical/strategic points when agentic AI encounters risk, ambiguity, or bottlenecks, and that human guidance improves reliability in complex scenarios. This supports the synthesis gate as a strategic intervention point rather than repeated passive reviewer retries. Source: https://docs.oracle.com/en/cloud/paas/application-integration/human-loop/overview-human-loop-agentic-ai.html

Earlier web research also supported bounded review loops with root-cause synthesis and reviewer packets before re-review; this aligns with the proposed PABCD synthesis packet.

## 3. Finding resolutions

### Finding 1 — A-stage lens/revision identity

Decision: **accept and strengthen**.

Patch direction:

- Add additive ctx fields instead of replacing existing `audit_status`:
  - `a_revision_id?: string`
  - `a_synthesis_required?: boolean`
  - `a_lens_verdicts?: { planner?: AStageLensVerdict; architect?: AStageLensVerdict }`
- `AStageLensVerdict` should include:
  - `status: "pass" | "fail"`
  - `revision_id: string`
  - `recorded_at?: string`
  - `worker_output_ref?: string`
- Add CLI identity for Stage-A verdict recording:
  - preferred: `jwc orchestrate verdict --audit-lens planner|architect --worker-output <file>`
  - Stage A without `--audit-lens` should fail with a targeted error.
- Compute scalar `audit_status` from aggregate state for backward-compatible status/transition display.

Rejected alternative: prompt-only A synthesis. Reason: cannot prevent PASS-overwrites-FAIL scalar bug.

### Finding 2 — P→A gate

Decision: **accept**.

Patch direction:

- Add `from === "p" && to === "a"` branch in transition validation.
- Require `ctx.p_review_passed === true` unless explicit user approval is supplied.
- Status text in P should say to record Critic `OKAY` or revise after `ITERATE`/`REJECT`, not imply stage advance is always available.

Rejected alternative: leave P as prompt-only. Reason: P already has `p_review_passed`; not gating it is inconsistent with A/B gates.

### Finding 3 — read-only executor investigation

Decision: **partially accept**.

User intent explicitly wants executor subagent investigation in this logic. Keep executor allowed, but harden the rule:

- The main session may use `executor` for bounded repo fact investigation.
- The assignment must explicitly say read-only, no product/source edits, no `.jwc` mutation, no formatters, no tests/project-wide gates, no commits.
- If executor output contains mutation-oriented changes, the main session treats it as advisory only and does not claim it as accepted evidence.
- Planner/architect remain valid alternatives for specialist read-only lenses, but executor stays the default repo-fact investigator when the user asks for executor.

Rejected alternative: ban executor for read-only investigation. Reason: conflicts with user direction and existing task-role semantics where executor can be assigned read-only bounded work.

### Finding 4 — web-first wording

Decision: **accept clarification, preserve user intent**.

Patch direction:

- Keep repo facts first for repository-specific decisions.
- Define **web-first** as first inside the external/prior-art research layer.
- For conflicts or uncertain implementation strategy, web research is the default external/prior-art layer.
- Context7 may run in parallel/supplemental mode for library/framework/tooling docs; web alone is acceptable when the question is broad prior art or workflow design.
- External evidence informs the compromise but does not override approved design or repo facts by itself.

Rejected alternative: Context7-first for all library/API questions only. Reason: user explicitly wants web-first for general implementation examples and conflict resolution.

### Finding 5 — A aggregate PASS behavior in prompt

Decision: **accept**.

Patch direction:

- A prompt must say: record lens verdicts, synthesize any FAIL, re-audit changed sections with synthesis packet, and report PASS only when runtime aggregate gate is pass.
- Dual mode PASS requires both Planner and Architect on same current revision.
- Solo mode PASS requires Architect on current revision.

### Finding 6 — C route evidence

Decision: **accept**.

Patch direction:

- C prompt should require a red-result routing note:
  - failing command/output or adversarial finding;
  - affected acceptance criterion;
  - chosen route;
  - rejected routes;
  - exact reason.

## 4. Revised implementation shape

1. Prompt updates for P/A/B/C synthesis discipline.
2. Audit prompt updates for A finding IDs and delta-audit behavior.
3. Runtime P→A gate.
4. Runtime A lens/revision verdict state and aggregate pass calculation.
5. Focused tests for P gate, A aggregate verdicts, B regression, and prompt content.

## 5. Next devlog revision target

Revise `00_moc_pabcd_synthesis_review_loops.md` or create a concrete `10_execution_plan.md` that incorporates this synthesis before any source patch.
