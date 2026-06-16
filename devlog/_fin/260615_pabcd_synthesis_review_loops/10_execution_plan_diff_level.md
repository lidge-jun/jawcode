# 10 — Diff-level execution plan: synthesis-first PABCD review loops

> Status: implementation plan only; no product/source code changes in this artifact.
> Supersedes the hard-gate wording in earlier notes: reviewer negative verdicts are not absolute vetoes. The main session may waive/override wrong blockers, but only with evidence-backed synthesis.

## 0. Core decision

Reviewer lanes are strong independent signals, not final authority.

- `OKAY` / `PASS` / `DONE` remains the happy path.
- `ITERATE` / `REJECT` / `FAIL` / `NEEDS_FIX` triggers mandatory main-session synthesis.
- If the reviewer is right, main patches the plan/code and re-runs review.
- If the reviewer is wrong or over-blocking, main records a waiver/override with evidence and may proceed.
- Runtime gates must allow **pass OR explicit evidence-backed override**, not pass-only.

## 1. Files to modify

1. `packages/coding-agent/src/prompts/jaw/orchestrate-p.md`
2. `packages/coding-agent/src/prompts/jaw/orchestrate-a.md`
3. `packages/coding-agent/src/prompts/jaw/orchestrate-b.md`
4. `packages/coding-agent/src/prompts/jaw/orchestrate-c.md`
5. `packages/coding-agent/src/prompts/jaw/orchestrate-audit-planner.md`
6. `packages/coding-agent/src/prompts/jaw/orchestrate-audit-architect.md`
7. `packages/coding-agent/src/jwc-runtime/orchestrate-state.ts`
8. `packages/coding-agent/src/jwc-runtime/orchestrate-runtime.ts`
9. `packages/coding-agent/src/commands/orchestrate.ts`
10. Focused tests under `packages/coding-agent/test/` for orchestrate runtime/prompt behavior.

## 2. Runtime state diff

### 2.1 `orchestrate-state.ts` — add override and A-lens state types

Current shape:

```ts
export interface PabcdCtx {
	a_audit_mode?: PabcdAuditMode;
	a_round?: number;
	p_round?: number;
	p_review_passed?: boolean;
	audit_status?: PabcdAuditVerdict;
	verification_status?: PabcdVerificationVerdict;
	user_approved?: boolean;
	deliberate?: boolean;
	actor_namespace_id?: string;
}
```

Target shape:

```ts
export type PabcdAuditLens = "planner" | "architect";
export type PabcdReviewDecision = "accepted" | "waived" | "partially_accepted" | "routed";

export interface PabcdReviewOverride {
	stage: "p" | "a" | "b" | "c";
	reason: string;
	synthesis_ref?: string;
	recorded_at?: string;
}

export interface PabcdAuditLensVerdict {
	status: "pass" | "fail";
	revision_id: string;
	worker_output_ref?: string;
	recorded_at?: string;
}

export interface PabcdCtx {
	/** D050-21: trivial → "solo" (Architect only), default "dual". */
	a_audit_mode?: PabcdAuditMode;
	a_round?: number;
	a_revision_id?: string;
	a_synthesis_required?: boolean;
	a_lens_verdicts?: Partial<Record<PabcdAuditLens, PabcdAuditLensVerdict>>;
	p_round?: number;
	p_review_passed?: boolean;
	p_review_override?: PabcdReviewOverride;
	audit_status?: PabcdAuditVerdict;
	verification_status?: PabcdVerificationVerdict;
	b_review_override?: PabcdReviewOverride;
	c_route_synthesis_ref?: string;
	user_approved?: boolean;
	deliberate?: boolean;
	actor_namespace_id?: string;
}
```

Notes:

- Keep existing scalar `audit_status` for backward-compatible display/transition checks.
- Additive fields are safe because read/write schemas already use `.passthrough()` for `ctx`.
- `p_review_override` is not a silent bypass. It points to a synthesis/waiver artifact and states why the Critic blocker is waived.
- `b_review_override` is optional evidence metadata only; B→C still requires `verification_status=done` or explicit user approval unless a future product decision adds verifier override.

### 2.2 `orchestrate-state.ts` — transition gate changes

Current P→A behavior: no gate after valid transition.

Target P→A behavior:

```ts
// p → a gated on Critic OKAY, explicit reviewer waiver, or user approval.
if (from === "p" && to === "a") {
	if (ctx?.user_approved) return { ok: true };
	if (ctx?.p_review_passed === true) return { ok: true };
	if (ctx?.p_review_override?.synthesis_ref) return { ok: true };
	return {
		ok: false,
		reason:
			`p → a requires Critic OKAY, a recorded Critic waiver/override synthesis, or explicit user approval. Record OKAY via --worker-output, write a waiver with --review-override-ref, or pass --user-approved.`,
	};
}
```

Current A→B behavior:

```ts
if (from === "a" && to === "b") {
	if (ctx?.user_approved) return { ok: true };
	if (ctx?.audit_status !== "pass") return { ok: false, ... };
}
```

Target A→B behavior:

```ts
if (from === "a" && to === "b") {
	if (ctx?.user_approved) return { ok: true };
	if (ctx?.audit_status === "pass") return { ok: true };
	if (ctx?.a_synthesis_required === false && hasModeCompleteAuditOverride(ctx)) return { ok: true };
	return {
		ok: false,
		reason:
			`a → b requires aggregate audit pass, recorded audit override/waiver synthesis for unresolved lens findings, or explicit user approval.`,
	};
}
```

Where `hasModeCompleteAuditOverride(ctx)` is intentionally conservative:

```ts
function hasModeCompleteAuditOverride(ctx?: PabcdCtx | null): boolean {
	// Minimal v1: do not add separate override object per A lens yet unless needed.
	// A review override can be represented by a_lens_verdicts entries with status fail
	// plus a_synthesis_required === false and synthesis_ref in p/a override metadata, or
	// by a future explicit a_review_override field if product wants stronger tracking.
	return false;
}
```

Recommended implementation choice: **do not enable A override in runtime v1 except via `--user-approved`** unless a concrete `a_review_override` shape is added. The prompt may describe main waiver reasoning, but A→B can require aggregate PASS or explicit user approval for now. This avoids building a weak hidden bypass.

## 3. Runtime CLI arg diff

### 3.1 `commands/orchestrate.ts`

Current flags include:

```ts
"worker-output": Flags.string({
	description: "With the verdict subcommand: parse PASS|FAIL|DONE|NEEDS_FIX from this file",
}),
"user-approved": Flags.boolean({ description: "Explicit user approval override for a gated transition" }),
```

Target additions:

```ts
"audit-lens": Flags.string({
	description: 'With verdict in stage a: audit lens identity, "planner" | "architect"',
}),
"revision-id": Flags.string({
	description: "With verdict in stage a: synthesized plan revision id under audit",
}),
"review-override-ref": Flags.string({
	description: "With verdict/transition: path or section ref containing main-session waiver/override synthesis",
}),
```

Example updates:

```ts
"$ jwc orchestrate verdict --audit-lens planner --revision-id a-r1 --worker-output ./planner-audit.md",
"$ jwc orchestrate a --review-override-ref devlog/_plan/.../02_main_synthesis_round1.md",
```

### 3.2 `orchestrate-runtime.ts` ParsedArgs

Current:

```ts
interface ParsedArgs {
	...
	workerOutput?: string;
	complete: boolean;
}
```

Target:

```ts
interface ParsedArgs {
	...
	workerOutput?: string;
	auditLens?: "planner" | "architect";
	revisionId?: string;
	reviewOverrideRef?: string;
	complete: boolean;
}
```

Parse additions:

```ts
case "--audit-lens":
case "--revision-id":
case "--review-override-ref": {
	const value = argv[++i];
	if (value === undefined) return { error: `missing value for ${arg}` };
	if (arg === "--audit-lens") {
		if (value !== "planner" && value !== "architect") {
			return { error: `--audit-lens must be planner|architect, got: ${value}` };
		}
		parsed.auditLens = value;
	} else if (arg === "--revision-id") parsed.revisionId = value;
	else parsed.reviewOverrideRef = value;
	break;
}
```

## 4. Runtime verdict logic diff

### 4.1 P verdict handling

Current:

```ts
if (criticVerdict === "okay") {
	ctx.p_review_passed = true;
} else {
	ctx.p_review_passed = false;
	ctx.p_round = (ctx.p_round ?? 0) + 1;
}
```

Target:

```ts
if (criticVerdict === "okay") {
	ctx.p_review_passed = true;
	delete ctx.p_review_override;
} else {
	ctx.p_review_passed = false;
	ctx.p_round = (ctx.p_round ?? 0) + 1;
	if (args.reviewOverrideRef) {
		ctx.p_review_override = {
			stage: "p",
			reason: `Critic ${criticVerdict.toUpperCase()} waived by main-session synthesis`,
			synthesis_ref: args.reviewOverrideRef,
			recorded_at: new Date().toISOString(),
		};
	}
}
```

CLI usage:

- Normal negative verdict: `jwc orchestrate verdict --worker-output critic.md`
- Waived negative verdict after synthesis: `jwc orchestrate verdict --worker-output critic.md --review-override-ref devlog/.../02_main_synthesis_round1.md`

Policy:

- A Critic can be wrong.
- Waiver is allowed, but only with a synthesis ref.
- P→A accepts `p_review_passed=true`, `p_review_override.synthesis_ref`, or `--user-approved`.

### 4.2 A verdict handling

Current:

```ts
if (stage === "a" && (verdict === "pass" || verdict === "fail")) {
	ctx.audit_status = verdict;
	if (verdict === "fail") {
		ctx.a_round = (ctx.a_round ?? 0) + 1;
		...
	}
}
```

Target helper:

```ts
function currentARevisionId(ctx: PabcdCtx, args: ParsedArgs): string {
	return args.revisionId ?? ctx.a_revision_id ?? `a-r${ctx.a_round ?? 0}`;
}

function computeAggregateAuditStatus(ctx: PabcdCtx): PabcdAuditVerdict {
	const mode = ctx.a_audit_mode ?? "dual";
	const revision = ctx.a_revision_id;
	const architect = ctx.a_lens_verdicts?.architect;
	const planner = ctx.a_lens_verdicts?.planner;
	if (!revision) return "pending";
	if (ctx.a_synthesis_required) return "fail";
	if (mode === "solo") {
		return architect?.status === "pass" && architect.revision_id === revision ? "pass" : "pending";
	}
	return architect?.status === "pass" &&
		architect.revision_id === revision &&
		planner?.status === "pass" &&
		planner.revision_id === revision
		? "pass"
		: "pending";
}
```

Target Stage-A branch:

```ts
if (stage === "a" && (verdict === "pass" || verdict === "fail")) {
	if (!args.auditLens) {
		return { stderr: "stage a verdict requires --audit-lens planner|architect\n", status: 1 };
	}
	const revisionId = currentARevisionId(ctx, args);
	ctx.a_revision_id = revisionId;
	ctx.a_lens_verdicts = {
		...(ctx.a_lens_verdicts ?? {}),
		[args.auditLens]: {
			status: verdict,
			revision_id: revisionId,
			worker_output_ref: args.workerOutput,
			recorded_at: new Date().toISOString(),
		},
	};
	if (verdict === "fail") {
		ctx.a_synthesis_required = true;
		ctx.audit_status = "fail";
		ctx.a_round = (ctx.a_round ?? 0) + 1;
		// Keep existing cap behavior.
	} else {
		ctx.audit_status = computeAggregateAuditStatus(ctx);
	}
}
```

Synthesis clear path:

- Minimal CLI: reuse `--review-override-ref` with stage command `jwc orchestrate a --review-override-ref <ref> --revision-id a-r2` before re-audit.
- This does not mean pass; it opens the next revision for delta audit.

Target in `nextCtxFor(target === "a")` or stage-entry handling:

```ts
if (target === "a") {
	ctx.a_round = 0;
	ctx.a_revision_id = "a-r0";
	ctx.a_synthesis_required = false;
	ctx.a_lens_verdicts = {};
	ctx.audit_status = "pending";
	ctx.a_audit_mode = ctx.deliberate ? "dual" : (args.auditMode ?? ctx.a_audit_mode ?? "dual");
}
```

Additional command handling for active stage A with `--review-override-ref` and `--revision-id`:

```ts
if (target === "a" && current.envelope?.current_phase === "a" && args.reviewOverrideRef) {
	ctx.a_synthesis_required = false;
	ctx.a_revision_id = args.revisionId ?? `a-r${ctx.a_round ?? 0}`;
	ctx.a_lens_verdicts = {};
	ctx.audit_status = "pending";
	// persist and print: synthesis recorded; run delta re-audit.
}
```

Implementation note: if adding an in-stage `orchestrate a --review-override-ref` path is too much churn, add a subcommand later. Prompt-only synthesis can still reset the revision by passing `--revision-id` on the next `verdict`, but clearing `a_synthesis_required` needs a runtime path.

## 5. Prompt diffs

### 5.1 `orchestrate-p.md`

Current Step 3 negative path:

```md
- On ITERATE/REJECT → patch the devlog plan yourself against the specific Critic findings, then spawn the next read-only Critic. This audit → plan revision → audit loop is the core of P; keep looping until the latest recorded verdict is OKAY, the user changes scope, or the user abandons the workflow. Never spawn another Critic against an unchanged plan.
```

Target:

```md
- On ITERATE/REJECT → do NOT accept the Critic passively. First write a Critic failure synthesis in the devlog plan or adjacent receipt:
  - finding IDs / Critic claims;
  - original plan intent;
  - root-cause category;
  - local repo/AST evidence checked;
  - read-only executor investigation used, if any;
  - web-first prior-art/common-practice evidence when design or implementation strategy is disputed;
  - Context7/library evidence when used;
  - decision for each finding: accept, partially accept, waive, route to I, or defer with reason;
  - exact plan sections changed, or why no plan change is correct.
- If the Critic is right, patch the plan and re-run Critic against the changed sections and synthesis packet.
- If the Critic is wrong/over-blocking, record the negative verdict with `--review-override-ref <synthesis>` and proceed only after the waiver is explicit. A waiver is not silent ignore; it is an evidence-backed main-session decision.
- Never spawn another Critic against an unchanged plan unless the explicit purpose is evidence collection for a waiver.
```

Finalization wording target:

```md
4. Finalize only after the latest P verdict is OKAY or the latest negative Critic verdict has a recorded waiver/override synthesis. The pending-approval packet must include the synthesis when a waiver was used.
```

### 5.2 `orchestrate-a.md`

Current fail path:

```md
3. Record each verdict with `orchestrate verdict --worker-output <report-file>`. If any lens FAILs:
   - YOU fix the plan yourself (auditors never mutate the plan), then re-run a DELTA re-audit on the changed sections.
```

Target:

```md
3. Record each lens verdict with `orchestrate verdict --audit-lens planner|architect --revision-id <a-revision-id> --worker-output <report-file>`. If any lens FAILs:
   - Do NOT accept the auditor passively. Write an A-stage synthesis before changing the plan or requesting re-audit:
     - lens finding IDs;
     - original design intent;
     - shared root cause;
     - conflicts between Planner and Architect suggestions;
     - local repo/AST evidence;
     - read-only executor investigation used, if any;
     - web-first prior-art/common-practice evidence when design or strategy is disputed;
     - Context7/library evidence when used;
     - chosen compromise;
     - waived/rejected findings and why;
     - exact plan sections changed;
     - residual risk.
   - If the auditor is right, revise the plan and record the synthesis for the next revision before delta re-audit.
   - If an auditor finding is wrong/over-blocking, document the waiver in the synthesis. Do not convert the overall audit to PASS by overwriting a scalar verdict; rely on runtime aggregate status or explicit user approval for unresolved waivers.
   - Re-run DELTA re-audit on the synthesis packet plus changed sections and unresolved finding IDs.
```

PASS wording target:

```md
4. On PASS: report PASS only when the runtime aggregate audit status is pass for the current revision: Architect PASS in solo mode; Planner + Architect PASS in dual mode. A single lens PASS is not enough in dual mode.
```

### 5.3 `orchestrate-b.md`

Current:

```md
4. On NEEDS_FIX: YOU fix the issues, then re-verify. On DONE: report results to the user.
```

Target:

```md
4. On NEEDS_FIX: do NOT patch passively. First write a verifier failure synthesis:
   - verifier issues and evidence;
   - reproduced/inspected failure output;
   - root-cause category: implementation bug, missed plan step, bad plan assumption, spec ambiguity, or environment/tooling issue;
   - local repo/AST evidence;
   - read-only executor investigation used, if any;
   - web-first prior-art/common-practice evidence when strategy is disputed;
   - Context7/library evidence when used;
   - decision: code fix, route to P, route to I, or explicit environment/tooling note;
   - exact files changed and verification plan.
   Then fix only the issues whose root cause is implementation. Re-verify changed areas. Do not re-run verifier against unchanged code unless collecting missing evidence.
```

### 5.4 `orchestrate-c.md`

Current:

```md
- All gates must be green. A failed gate routes back: code issue → `orchestrate b`, plan issue → `orchestrate p`, spec issue → `orchestrate i` (3-way reject routing).
```

Target:

```md
- All gates must be green. A red gate/review requires a C failure synthesis before routing:
  - failing command output or adversarial finding;
  - affected acceptance criterion;
  - local repo/AST evidence checked;
  - read-only executor investigation used, if any;
  - web-first prior-art/common-practice evidence when route or strategy is disputed;
  - Context7/library evidence when used;
  - chosen route: code issue → `orchestrate b`, plan issue → `orchestrate p`, spec issue → `orchestrate i`, or environment/tooling issue with evidence;
  - rejected routes and why.
```

### 5.5 A audit prompts

`orchestrate-audit-planner.md` finding format target:

```md
- Then findings, each as: `[severity] PLANNER-A<n> <doc/section or file:line> — problem — concrete fix constraint`.
- In delta re-audit mode, verify the main-session synthesis packet: every prior Planner finding must be accepted, partially accepted, waived with evidence, or routed. A waiver can PASS only when the evidence is sufficient from the Planner lens.
```

`orchestrate-audit-architect.md` finding format target:

```md
- Then findings, each as: `[severity] ARCH-A<n> file:line — problem — concrete fix constraint`.
- In delta re-audit mode, verify the main-session synthesis packet: every prior Architect finding must map to real code/path/signature/gate evidence and be accepted, partially accepted, waived with evidence, or routed. A waiver can PASS only when the evidence is sufficient from the Architect lens.
```

## 6. Status text diff

Current status next action:

```ts
const nextAction =
	stage === "a" && ctx.audit_status !== "pass"
		? "record the audit verdict ..."
		: stage === "b" && ctx.verification_status !== "done"
			? "record the verification verdict ..."
			: ...
```

Target:

```ts
const nextAction =
	stage === "p" && ctx.p_review_passed !== true && !ctx.p_review_override?.synthesis_ref
		? "record Critic OKAY, revise after ITERATE/REJECT, or record a waiver synthesis with --review-override-ref"
		: stage === "a" && ctx.audit_status !== "pass"
			? "record lens audit verdicts with --audit-lens/--revision-id, synthesize FAILs, or pass --user-approved"
			: stage === "b" && ctx.verification_status !== "done"
				? "record the verification verdict (orchestrate verdict --worker-output <file>) or pass --user-approved"
				: ...
```

Optional status fields:

```ts
`Plan review:  ${ctx.p_review_passed ? "okay" : ctx.p_review_override?.synthesis_ref ? "waived" : "pending"}`,
`Audit:        ${ctx.audit_status ?? "pending"}${ctx.a_audit_mode ? ` (${ctx.a_audit_mode}${ctx.a_round ? `, round ${ctx.a_round}` : ""}${ctx.a_revision_id ? `, ${ctx.a_revision_id}` : ""})` : ""}`,
```

## 7. Tests

### 7.1 P transition gate with waiver

Add/update test around `canTransitionPabcd`:

```ts
expect(canTransitionPabcd("p", "a", { p_review_passed: false }).ok).toBe(false);
expect(canTransitionPabcd("p", "a", { p_review_passed: true }).ok).toBe(true);
expect(
	canTransitionPabcd("p", "a", {
		p_review_passed: false,
		p_review_override: { stage: "p", reason: "wrong blocker", synthesis_ref: "devlog/x.md" },
	}),
).toEqual({ ok: true });
expect(canTransitionPabcd("p", "a", { user_approved: true }).ok).toBe(true);
```

### 7.2 A aggregate pass

Add runtime/state tests:

```ts
// dual: planner pass alone does not pass
// dual: architect fail then planner pass does not pass
// dual: both pass on same revision passes
// dual: pass on different revisions does not pass
// solo: architect pass on current revision passes
// stage a verdict without --audit-lens rejects
```

### 7.3 Prompt content

Add snapshot/content tests that assert:

- P prompt contains `Critic failure synthesis`, `waive`, `web-first`, `read-only executor`.
- A prompt contains `--audit-lens`, `revision`, `aggregate audit status`, `waiver`.
- B prompt contains `verifier failure synthesis` and root-cause categories.
- C prompt contains `C failure synthesis`, `chosen route`, `rejected routes`.
- A audit prompts contain `PLANNER-A<n>` / `ARCH-A<n>` and delta synthesis validation.

### 7.4 Regression

- B→C still rejects without `verification_status=done` unless `user_approved`.
- A→B still rejects if neither aggregate PASS nor user approval exists.
- Existing `jwc orchestrate verdict --worker-output` behavior for P and B remains compatible.

## 8. Non-goals

- Do not make reviewers final authorities.
- Do not add a fifth public workflow skill.
- Do not persist full synthesis documents in `ctx`; use devlog/planphase artifacts and keep `ctx` to gate metadata.
- Do not make web evidence override repo facts or approved user decisions.
- Do not allow silent bypass of negative review; every bypass is a recorded waiver or explicit user approval.

## 9. Implementation order

1. Patch prompts P/A/B/C and A audit prompts.
2. Add runtime arg parsing for `--audit-lens`, `--revision-id`, `--review-override-ref`.
3. Add P→A transition gate with Critic OKAY OR waiver OR user approval.
4. Add A lens/revision verdict aggregation.
5. Add status text updates.
6. Add focused tests.
7. Run targeted tests and workflow-definition gates if prompt/default-surface tests require them.
