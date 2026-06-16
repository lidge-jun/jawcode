# Jaw-Interview Handoff Cleanup / Stale Guard Plan

Date: 2026-06-15

## User report

When the workflow leaves `jaw-interview` for `p`/planning or returns to idle, the interview phase can remain active and keep enforcing interview-only mutation rules. This should not depend on the ambiguity threshold: even if ambiguity is above the normal ≤5% completion gate, once the runtime state has ended or handed off, the interview guard must stop treating the session as actively interviewing.

The user also asked for external `executor_ext` investigation before implementation.

## External executor_ext investigation

Read-only external probes were dispatched with omitted `.model`, so they used the configured `EXECUTOR_EXT` default lane rather than an explicit per-task model.

- `21-InterviewRuntimeExit`
  - Focus: `jaw-interview-runtime.ts` state persistence and handoff behavior.
  - Finding: `persistJawInterviewSpec()` writes `active: true` and `current_phase: "handoff"`; `syncJawInterviewHud({ phase: "handoff" })` keeps active state true because HUD sync uses `active: options.phase !== "complete"`.
- `22-PabcdTransitionCleanup`
  - Focus: `orchestrate-runtime.ts` transition/reset behavior.
  - Finding: `jwc orchestrate p` and other PABCD transitions update PABCD state only. They do not demote/clear canonical `jaw-interview` skill state. `jwc orchestrate reset` deletes only PABCD state, leaving other workflow state files untouched.
- `23-MutationGuardActive`
  - Focus: `jaw-interview-mutation-guard.ts` active-state decision.
  - Finding: `isActiveJawInterview()` blocks when the active-state row exists and the mode state is not terminal. `isTerminalModeState()` omits `handoff`, so `active: true + current_phase: "handoff"` keeps product/source mutations blocked.

No further external research is currently required to explain the bug. A second external pass is useful only after a patch exists, to review whether the cleanup semantics are too broad.

## Local source evidence

### 1. `packages/coding-agent/src/jwc-runtime/jaw-interview-runtime.ts`

`persistJawInterviewSpec()` currently writes the persisted spec state as an active handoff:

```ts
const payload: Record<string, unknown> = {
	...existing,
	active: true,
	current_phase: "handoff",
	skill: "jaw-interview",
	...
};
...
await syncJawInterviewHud({
	cwd,
	sessionId: resolved.sessionId,
	phase: "handoff",
	specStatus: "persisted",
});
```

`syncJawInterviewHud()` maps every phase except `complete` to active HUD state:

```ts
await syncSkillActiveState({
	cwd: options.cwd,
	skill: "jaw-interview",
	active: options.phase !== "complete",
	phase: options.phase,
	...
});
```

`handleSpecWrite()` only runs the sanctioned demotion path when the explicit handoff path is selected:

```ts
const shouldHandoff = resolved.deliberate || resolved.handoff === "plan" || resolved.handoff === "ralplan";
...
const handoffArgs = ["handoff", "--mode", "jaw-interview", "--to", "plan", "--json"];
const handoffResult = await runNativeStateCommand(handoffArgs, cwd);
```

Therefore plain spec persistence can leave a canonical `jaw-interview` state file in `handoff` but still active. If the subsequent P-stage is entered through native `jwc orchestrate p` rather than the state handoff command, no demotion is guaranteed.

### 2. `packages/coding-agent/src/skill-state/jaw-interview-mutation-guard.ts`

The guard releases only these phases:

```ts
return ["complete", "completed", "failed", "cancelled", "canceled", "inactive"].includes(phase);
```

It does not include `handoff`. The guard then treats the still-active row as an active interview:

```ts
const activeJawInterview = listActiveSkills(skillState).find(...);
if (!activeJawInterview) return false;

const modeState = await readVisibleModeState(cwd, "jaw-interview", sessionId);
if (isTerminalModeState(modeState)) return false;
...
return true;
```

This is the direct block cause for product/source edits after handoff.

### 3. `packages/coding-agent/src/hooks/skill-state.ts`

The general active-state hook already has a more nuanced terminal/release model:

```ts
return ["complete", "completed", "handoff", "failed", "cancelled", "canceled", "inactive"].includes(phase);
...
if (!handoffRequired && phase === "handoff") return true;
```

That means the mutation guard has drifted from the broader skill-state semantics. The patch should consciously decide whether `jaw-interview` handoff is terminal for mutation blocking even if it may still require a chain guard elsewhere.

### 4. `packages/coding-agent/src/jwc-runtime/orchestrate-runtime.ts`

PABCD transitions persist only the PABCD envelope:

```ts
const envelope: PabcdEnvelope = {
	skill: "pabcd",
	current_phase: target,
	active: target !== "complete",
	...
};
const written = await persist(cwd, envelope, parsed, `orchestrate ${target}`, from ?? undefined, target);
```

`resetPabcdState()` intentionally deletes only `pabcd-state.json`:

```ts
// Deletes ONLY pabcd-state.json (the session dir hosts other state files).
```

So stale `jaw-interview` activity cannot be fixed by PABCD state updates unless an explicit cross-workflow cleanup hook is added.

## Root cause

Two independent assumptions conflict:

1. `jaw-interview` uses `current_phase: "handoff"` as a durable state after final spec persistence.
2. The mutation guard treats `handoff` as still active because it is not in the guard's terminal-phase list.

A third issue makes the stale state persist across native PABCD operation:

3. `jwc orchestrate p` / `reset` do not retire `jaw-interview` active state, because they only own PABCD state.

The ambiguity threshold is not the root cause. A high ambiguity score should prevent automatic completion/spec acceptance, but it should not keep mutation blocking alive after a workflow has explicitly handed off, ended, or been reset to idle.

## Product semantics to preserve

- `jaw-interview` remains a requirements/interview workflow and must block product/source edits while `current_phase: "interviewing"` or equivalent active interview phases are live.
- The allowed document/mockup exception remains narrow: `.md` and static mockup `.html` edits only when governed by the active interview prompt.
- `.jwc/**` workflow state remains runtime-owned; direct agent mutation stays blocked.
- Native handoff through `jwc state ... handoff` remains the preferred atomic demotion/promotion path.
- PABCD should not silently rewrite arbitrary workflow state except for a narrow stale-interview cleanup that is tied to leaving interview/returning idle.

## Recommended patch shape

### A. Minimal correctness fix: guard-level release

Modify `packages/coding-agent/src/skill-state/jaw-interview-mutation-guard.ts`:

- Add `"handoff"` to `isTerminalModeState()`.
- Add a comment explaining that `handoff` releases mutation blocking because the interview has stopped collecting requirements, even if another chain guard may still require a state handoff/clear before activating a different workflow.

Regression tests in `packages/coding-agent/test/jaw-interview-mutation-guard.test.ts`:

- `active:true + current_phase:"handoff" + current_ambiguity:0.9 + threshold:0.05` must not block a product/source `write`/`edit` target.
- `active:true + current_phase:"interviewing" + current_ambiguity:0.9` must still block product/source mutation.
- `.jwc/**` state mutation remains blocked regardless of interview terminal handling.

This is the smallest patch that fixes the observed user-facing edit failure.

### B. Runtime cleanup fix: retire stale interview on PABCD/idle transition

Add a sanctioned runtime helper, preferably near `jaw-interview-runtime.ts` or a shared workflow-state helper, for best-effort retirement of stale `jaw-interview` activity:

```ts
export async function retireJawInterviewStateForWorkflowExit(input: {
	cwd: string;
	sessionId?: string;
	reason: "orchestrate-p" | "orchestrate-reset" | "orchestrate-complete" | "idle";
}): Promise<void>
```

Expected behavior:

- If no jaw-interview state exists, no-op.
- If state exists and is already inactive/complete, no-op.
- If state is `interviewing`, do **not** silently complete a live interview unless the caller is an explicit reset/idle path.
- If state is `handoff`, set `active:false` and `current_phase:"handoff"` or `"inactive"` using `writeWorkflowEnvelopeAtomic()` with audit receipt.
- Sync `skill-active-state.json` for `jaw-interview` to inactive/terminal via `syncSkillActiveState()`.

Hook candidates:

- `jwc orchestrate p` with `--spec-ref` or when transitioning from idle/I-derived context into P: retire stale `handoff` interview state after the PABCD write succeeds.
- `jwc orchestrate reset`: retire stale `jaw-interview` state only for the same session/shared target that reset touched, because reset semantically returns the orchestration to idle.
- `jwc orchestrate d --complete`: consider retiring stale `jaw-interview` if it is only `handoff`, but avoid expanding scope unless tests show it matters.

This patch aligns behavior with the user's stronger expectation that the stale phase should “disappear” when the workflow has moved to P or idle, not merely stop blocking edits.

### C. Prompt/policy follow-up

If source behavior changes, update `packages/coding-agent/src/defaults/jwc/skills/jaw-interview/SKILL.md` checklist language if needed:

- Keep “State cleaned up after approved workflow handoff.”
- Add a more explicit sentence that handoff/idle exit must demote or retire the active interview state and must not depend on ambiguity being below threshold.

Avoid documenting a workaround before the runtime behavior is corrected.

## Recommended implementation order

1. Patch guard terminal handling and focused guard tests.
2. Patch runtime cleanup helper and PABCD transition/reset tests.
3. Update jaw-interview skill prompt/checklist only if the source behavior requires operator-facing guidance.
4. Run focused tests.
5. Ask one `executor_ext` read-only review after the patch if the runtime cleanup touches cross-workflow state, because that is the riskiest part.

## Focused verification plan

Run at minimum:

```sh
bun test packages/coding-agent/test/jaw-interview-mutation-guard.test.ts
bun test packages/coding-agent/test/jwc-runtime/jaw-interview-runtime.test.ts packages/coding-agent/test/jwc-runtime/orchestrate-state.test.ts packages/coding-agent/test/jwc-runtime/orchestrate-reset.test.ts
bunx biome check packages/coding-agent/src/skill-state/jaw-interview-mutation-guard.ts packages/coding-agent/src/jwc-runtime/jaw-interview-runtime.ts packages/coding-agent/src/jwc-runtime/orchestrate-runtime.ts packages/coding-agent/test/jaw-interview-mutation-guard.test.ts packages/coding-agent/test/jwc-runtime/jaw-interview-runtime.test.ts packages/coding-agent/test/jwc-runtime/orchestrate-state.test.ts packages/coding-agent/test/jwc-runtime/orchestrate-reset.test.ts
```

Adjust the exact test list to the files actually touched. If only the guard-level minimal fix lands, the runtime test commands can be skipped.

## Acceptance criteria

- A stale `jaw-interview` state with `current_phase:"handoff"` no longer blocks product/source mutation tools.
- Active `jaw-interview` phases still block product/source mutation tools.
- `.md` and static mockup `.html` interview-document exceptions continue to work while interview is active.
- Direct `.jwc/**` workflow state mutation remains blocked.
- Entering PABCD planning or resetting to idle does not leave a stale active jaw-interview HUD/state that causes future sessions to appear stuck in interview.
- Behavior is covered by focused regression tests.

## Risks / open decisions

- Treating `handoff` as terminal for mutation blocking is likely correct for this bug, but some skill-chain hooks intentionally keep handoff-required workflows blocked until a demotion/clear occurs. The patch must not accidentally relax those general stop hooks unless explicitly intended.
- Runtime cleanup must be session-aware. Do not clear a shared or different-session interview when a session-scoped PABCD command runs.
- Reset semantics currently say “Deletes ONLY pabcd-state.json.” Expanding reset to retire jaw-interview active state is a product behavior change and should be documented/test-covered if implemented.
- If only the guard fix is implemented, stale HUD/state may still visually show `jaw-interview` even though edits are no longer blocked. That is acceptable as an emergency unblock but incomplete relative to the user's “state disappears” expectation.
