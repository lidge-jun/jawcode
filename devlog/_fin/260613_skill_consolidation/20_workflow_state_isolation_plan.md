# Workflow state isolation cleanup plan

Date: 2026-06-14
Stage: PABCD P — planning draft
Status: implemented; B-stage verifier DONE

## User decisions captured

- Scope: do the larger state-model cleanup, not only narrow tests.
- Root/sessionless fallback policy: first verify whether fallback is actually source-of-truth. Decision from code audit: for live sessions it is not source-of-truth; it is an aggregate/legacy compatibility surface. Root remains authoritative only for no-session standalone CLI calls.
- jaw-interview settings: native runtime computes `threshold` + `threshold_source`; the skill consumes state and should not direct-read optional settings files.
- Handoff/status: after P and A pass, B-stage implementation owns all planned source/test changes, verification, commit, and push while excluding unrelated user work from the commit.

## Code-fact basis

- `syncSkillActiveState()` writes both root active entries and session-scoped active entries when `sessionId` exists. The session-scoped entry is the live-session source; root is an aggregate/cache and no-session compatibility surface.
- `applyHandoffToActiveState()` comments say session is written first and root last because “the session file is the source of truth for HUD; the root aggregate must never lead the session during a handoff window.”
- Current fallback readers still let root/sessionless state influence live sessions:
  - `readVisibleSkillActiveState(cwd, sessionId)` merges root + session.
  - hook and mutation-guard mode-state readers read session first, then root.
  - `state-runtime.inferModeFromActiveState()` uses the merged reader for `jwc state` commands.
- The PABCD leak fix already made `readPabcdStateWithFallback(cwd, sessionId)` session-strict.
- Critic round 1 required tighter acceptance on strict-vs-legacy reader separation, explicit tests for subskill-session surfaces, and unambiguous jaw-interview Phase 0 source-of-truth wording. This revision incorporates those requirements.
- Critic round 2 returned ITERATE and exposed that the P-stage rule itself was wrong: P is an audit → plan revision → audit loop, not a capped re-review checkpoint. The P-stage prompt/runtime/test rule has since been patched so P can loop until OKAY while still forbidding unchanged re-audits.
- Critic round 3 required wider `jwc state` command coverage for the same inferred-mode path and an explicit no-session legacy fallback regression. This revision incorporates those requirements.
- Critic round 4 returned OKAY after the round-3 fixes; no findings remained.
- Stage-A planner audit round 1 failed on ambiguous HUD test ownership, imprecise `jwc state read/status/clear` expectations, and process-status wording. This revision assigns distinct test-file responsibilities, specifies exact command expectations, and turns the execution note into a handoff item.
- Stage-A planner audit round 2 found that strict mode inference affects every command using `inferModeFromActiveState()`, not only `write/read/status/clear`. This revision explicitly covers `handoff`, `prune`, and `migrate`.
- Stage-A final audits passed after those revisions; B-stage verifier reported DONE after implementation.

## Target behavior

1. A live TUI/agent session with a concrete session id must not inherit root/sessionless workflow state unless a future explicit global marker is introduced.
2. Standalone CLI calls without a session id keep reading/writing root workflow state.
3. Legacy-compatible reader behavior remains available for doctor/migration/aggregate surfaces that intentionally inspect root state.
4. jaw-interview threshold resolution happens in native runtime/state, not through model-issued optional file reads.
5. Strict-vs-legacy split is explicit: live session paths use strict readers; legacy-compatible root/session merge remains intentionally available and tested for aggregate/doctor/migration/no-session callers.

## Planned changes

### MODIFY `packages/coding-agent/src/skill-state/active-state.ts`

Add an explicit strict reader while preserving the existing legacy-compatible reader.

Before:

```ts
export async function readVisibleSkillActiveState(cwd: string, sessionId?: string): Promise<SkillActiveState | null> {
	const { rootPath, sessionPath } = getSkillActiveStatePaths(cwd, sessionId);
	const [rootState, sessionState] = await Promise.all([
		readRawActiveStateForHandoff(rootPath, false),
		sessionPath ? readRawActiveStateForHandoff(sessionPath, false) : Promise.resolve(null),
	]);
	const activeSkills = mergeVisibleEntries(sessionState, rootState, sessionId);
	...
}
```

After outline:

```ts
function buildVisibleSkillActiveState(
	baseState: SkillActiveState | null,
	activeSkills: SkillActiveEntry[],
	sessionId?: string,
): SkillActiveState | null { ... }

export async function readVisibleSkillActiveState(...): Promise<SkillActiveState | null> {
	// existing legacy-compatible root+session merge; used by no-session aggregate/compat paths
}

export async function readSessionStrictSkillActiveState(cwd: string, sessionId?: string): Promise<SkillActiveState | null> {
	if (!sessionId) return await readVisibleSkillActiveState(cwd);
	const { sessionPath } = getSkillActiveStatePaths(cwd, sessionId);
	if (!sessionPath) return null;
	const sessionState = await readRawActiveStateForHandoff(sessionPath, false);
	const activeSkills = mergeVisibleEntries(sessionState, null, sessionId);
	return buildVisibleSkillActiveState(sessionState, activeSkills, sessionId);
}
```

Key constraint: do not change `syncSkillActiveState()` or `applyHandoffToActiveState()` write semantics in this slice.

### MODIFY `packages/coding-agent/src/hooks/skill-state.ts`

Introduce strict read support for live hook paths and strict mode-state reads.

Before:

```ts
export async function readVisibleSkillActiveState(cwd, sessionId, stateDir) {
	if (!stateDir) return await readCanonicalVisibleSkillActiveState(cwd, sessionId);
	...
	if (sessionId) {
		const sessionState = await readValidatedJsonFile(skillStatePath(resolvedStateDir, sessionId), ...);
		if (sessionState) return sessionState;
	}
	return await readValidatedJsonFile(skillStatePath(resolvedStateDir), ...);
}

async function readVisibleModeState(cwd, skill, sessionId, stateDir) {
	if (sessionId) { ... if (sessionState) return sessionState; }
	return rootState;
}
```

After outline:

```ts
import {
	readSessionStrictSkillActiveState as readCanonicalSessionStrictSkillActiveState,
	readVisibleSkillActiveState as readCanonicalVisibleSkillActiveState,
} from "../skill-state/active-state";

interface ReadVisibleSkillActiveStateOptions { strictSession?: boolean }

export async function readVisibleSkillActiveState(cwd, sessionId, stateDir, options?) {
	if (!stateDir) {
		return options?.strictSession
			? await readCanonicalSessionStrictSkillActiveState(cwd, sessionId)
			: await readCanonicalVisibleSkillActiveState(cwd, sessionId);
	}
	const resolvedStateDir = resolveJwcStateDir(cwd, stateDir);
	if (sessionId) {
		const sessionState = await readValidatedJsonFile(skillStatePath(resolvedStateDir, sessionId), ...);
		if (sessionState || options?.strictSession) return sessionState;
	}
	return await readValidatedJsonFile(skillStatePath(resolvedStateDir), ...);
}

async function readVisibleModeState(..., options?: { strictSession?: boolean }) {
	if (sessionId) {
		const sessionStatePath = modeStatePath(resolvedStateDir, skill, sessionId);
		const sessionState = await readValidatedJsonFile(sessionStatePath, ...);
		if (sessionState || options?.strictSession) return sessionState ? { state: sessionState, statePath: sessionStatePath } : null;
	}
	const rootStatePath = modeStatePath(resolvedStateDir, skill);
	const rootState = await readValidatedJsonFile(rootStatePath, ...);
	return rootState ? { state: rootState, statePath: rootStatePath } : null;
}
```

Custom `stateDir` strict semantics are therefore explicit: with a concrete `sessionId`, read only `stateDir/sessions/<encoded-session>/...`; return `null` if absent. With no session id, root `stateDir/...` remains authoritative.

Use `strictSession: true` in:
- `buildActiveGoalPromptContext()`
- `buildSkillStopOutput()`
- `ensureWorkflowSkillActivationState()` existing-state check, so `/skill:<name>` in a fresh session seeds scoped state instead of reusing stale root active state.

### MODIFY `packages/coding-agent/src/skill-state/jaw-interview-mutation-guard.ts`

Switch live-session checks to strict active-state and strict mode-state.

Before:

```ts
const skillState = await readVisibleSkillActiveState(cwd, sessionId);
...
if (sessionId) {
	const sessionState = await readValidatedModeState(modeStatePath(cwd, skill, sessionId));
	if (sessionState) return sessionState;
}
return await readValidatedModeState(modeStatePath(cwd, skill));
```

After outline:

```ts
const skillState = await readSessionStrictSkillActiveState(cwd, sessionId);
...
if (sessionId) return await readValidatedModeState(modeStatePath(cwd, skill, sessionId));
return await readValidatedModeState(modeStatePath(cwd, skill));
```

Acceptance: root/sessionless `jaw-interview` state must not block product writes in a fresh concrete session.

### MODIFY `packages/coding-agent/src/jwc-runtime/state-runtime.ts`

Use strict active-state inference when a session id is present, and make no-mode session commands fail closed instead of falling back to root/sessionless active state.

Before:

```ts
const state = await readVisibleSkillActiveState(cwd, sessionId);
```

After outline:

```ts
const state = await readSessionStrictSkillActiveState(cwd, sessionId);
```

Also update/cover every no-mode command handler that consumes inferred mode:

- `handleRead()`: when `selectors.sessionId` is present and neither explicit mode nor strict inferred mode exists, throw the same missing-mode `StateCommandError` shape instead of reading `activeStateFile(cwd, selectors.sessionId)`.
- `handleWrite()`, `handleStatus()`, `handleClear()`, `handleHandoff()`, `handlePrune()`, and `handleMigrate()`: keep their existing missing-mode error behavior, but ensure each reaches that branch after strict inference rather than root inference.
- For `handleClear()`, `handleHandoff()`, `handlePrune()`, and `handleMigrate()`, add/verify no root mode-state mutation happens when a session id is present and strict inference finds no scoped active mode.

Acceptance: every `jwc state` command that relies on `inferModeFromActiveState()` must use strict inference when `--session-id fresh` is supplied. `write`, `read`, `status`, `clear`, `handoff`, `prune`, and `migrate` without an explicit mode should all return that command's missing-mode error when no scoped active mode exists, and must not read/mutate root-derived mode state. Standalone `jwc state <verb>` without session id keeps root inference.

### MODIFY `packages/coding-agent/src/session/agent-session.ts`

Use strict active-state for live subskill-tool refresh.

Before:

```ts
const activeState = await readVisibleSkillActiveState(this.sessionManager.getCwd(), this.sessionManager.getSessionId());
```

After outline:

```ts
const activeState = await readSessionStrictSkillActiveState(this.sessionManager.getCwd(), this.sessionManager.getSessionId());
```

Acceptance: a stale root active workflow cannot cause a fresh session to load workflow subskill tools.
Test acceptance:
- Build a focused `AgentSession` harness with stale root active-state carrying an active subskill for a workflow and a fresh session id.
- Call `refreshJwcSubskillTools()`.
- Expect no workflow subskill tools are activated until a matching session-scoped active state exists.

### MODIFY `packages/coding-agent/src/modes/components/status-line.ts`

Use strict active-state for the workflow HUD fetch instead of relying on post-filtering.

Before:

```ts
void readVisibleSkillActiveState(cwd, sessionId).then(state => {
	const entries = state?.active_skills ?? [];
	this.#skillHudEntries = sessionId ? entries.filter(e => e.session_id === sessionId) : entries;
})
```

After outline:

```ts
void readSessionStrictSkillActiveState(cwd, sessionId).then(state => {
	this.#skillHudEntries = state?.active_skills ?? [];
})
```

Acceptance: the HUD source is session-strict for live sessions and no longer depends on filtering out root rows after merge.

### MODIFY `packages/coding-agent/src/extensibility/jwc-plugins/injection.ts`

Use strict active-state for phase lookup used by active subskill injection.

Before:

```ts
const state = await readVisibleSkillActiveState(input.cwd, input.sessionId);
```

After outline:

```ts
const state = await readSessionStrictSkillActiveState(input.cwd, input.sessionId);
```
Acceptance:
- `resolveCurrentPhaseForParent({ sessionId: "fresh", parent })` ignores root/sessionless active-state and returns `initialPhaseForSkill(parent)` when no scoped state exists.
- A matching session-scoped active state still returns the persisted phase.

### MODIFY `packages/coding-agent/src/extensibility/jwc-plugins/state.ts`

Use strict active-state for active subskill state lookup in live sessions.

Before:

```ts
const state = await readVisibleSkillActiveState(input.cwd, input.sessionId);
```

After outline:

```ts
const state = await readSessionStrictSkillActiveState(input.cwd, input.sessionId);
```
Acceptance:
- `readActiveSubskillsForParent({ sessionId: "fresh", parent, phase })` ignores root/sessionless active subskills.
- Matching session-scoped active subskills are returned.

### MODIFY `packages/coding-agent/src/defaults/jwc/skills/jaw-interview/SKILL.md`

Remove direct optional settings-file reads from Phase 0. Make state/native runtime the source of truth.

Before intent:

```md
1. **Read threshold settings in precedence order**:
   - User settings: `[$GJC_CONFIG_DIR|~/.jwc]/settings.json`
   - Project settings: `./.jwc/settings.json` (overrides user settings)
2. **Resolve threshold and source**:
...
```

After outline:

```md
1. **Resolve threshold from active jaw-interview state**:
   - Read active state only through `jwc state jaw-interview read --json` or use threshold fields already provided by native activation.
   - Use `threshold` and `threshold_source` when present.
   - Do not directly read `~/.jwc/settings.json`, `./.jwc/settings.json`, or `config.yml` from this skill.
2. **If state lacks threshold**:
   - Use default `0.05` with source `default`.
   - Treat missing optional settings as normal; native `jwc jaw-interview` activation is the only settings/config precedence resolver.
3. **First user-visible line**:
   - Emit `Jaw Interview threshold: <resolvedThresholdPercent> (source: <resolvedThresholdSource>)` using the state/default value.
```

Also update the final checklist from “settings files were read” to “threshold was resolved from native/state or default.”

### MODIFY tests

#### `packages/coding-agent/test/skill-active-state.test.ts`

Add tests:
- `readSessionStrictSkillActiveState` ignores root sessionless active rows for a fresh session.
- strict read still returns exact session rows.
- existing `readVisibleSkillActiveState` legacy-compatible root fallback behavior remains unchanged for no-session aggregate reads.
- legacy sessioned merge behavior remains pinned for intentional compatibility: `readVisibleSkillActiveState(cwd, "sess1")` may still see sessionless root rows, while `readSessionStrictSkillActiveState(cwd, "sess1")` must not.

#### `packages/coding-agent/test/jaw-interview-mutation-guard.test.ts`

Add test:
- Seed root `skill-active-state.json` + root `jaw-interview-state.json` active/sessionless.
- Call `getJawInterviewMutationDecision({ sessionId: "fresh-session", tool: write, args: product path })`.
- Expect `blocked === false`.
- Add the same shape for root active-state plus missing/corrupt root `jaw-interview-state.json` to prove the guard fails open rather than blocking a fresh session.

#### `packages/coding-agent/test/jwc-skill-state-hooks.test.ts`

Add tests:
- Stop hook does not block a fresh concrete session from stale root jaw-interview/ralplan active state.
- Active goal prompt context ignores root `ultragoal-state.json` when a fresh concrete session has no scoped ultragoal state.
- `/skill:<workflow>` activation under a fresh session seeds scoped state even when root has stale active state.
- `resolveCurrentPhaseForParent()` ignores stale root phase and returns initial phase for a fresh session.
- `readActiveSubskillsForParent()` ignores stale root active subskills for a fresh session.

#### `packages/coding-agent/test/skill-hud-bar.test.ts`

Add a dedicated active-skill HUD rendering test:
- Seed root active-state with an active `jaw-interview` entry and no session-scoped state.
- Instantiate or exercise the status-line HUD refresh path with `sessionId: "fresh-session"`.
- Expect rendered HUD entries/bar to be empty for that session.
- Add the positive case: matching session-scoped active-state renders the HUD entry.
- Responsibility: this file owns rendered active-skill HUD behavior for strict session active-state. `packages/coding-agent/test/status-line-workflow-readers.test.ts` remains in the verification command only for existing PABCD/goal workflow-reader regressions and is not the owner for the new active-skill HUD assertions.

#### `packages/coding-agent/test/jwc-subskill-injection.test.ts`

Add an end-user subskill injection test:
- Persist an active subskill only in root/sessionless active-state.
- Build a skill prompt for a fresh concrete session.
- Expect no `<gjc-subskill ...>` block.
- Persist the same active subskill in the matching session-scoped state.
- Expect the subskill block to appear.
#### `packages/coding-agent/test/jwc-runtime/state-runtime.test.ts`

Add tests:
- With stale root active `jaw-interview`, `jwc state write --session-id fresh --input '{...}'` without `--mode` fails with “requires --mode” instead of inferring root `jaw-interview`.
- No-session `jwc state write --input '{...}'` still infers from root active state for legacy CLI compatibility.
- With stale root active `jaw-interview`, `jwc state read --session-id fresh`, `jwc state status --session-id fresh`, and `jwc state clear --session-id fresh` without `--mode` must not infer root `jaw-interview`:
  - `read --session-id fresh`: exits non-zero with the read command's “requires --mode”/missing-mode error; it must not print root `jaw-interview` state or a session active-state fallback envelope.
  - `status --session-id fresh`: exits non-zero with the status command's missing-mode error; it must not name root `jaw-interview` as current/active.
  - `clear --session-id fresh`: exits non-zero with the clear command's missing-mode error unless an explicit `--mode` is supplied; it must not delete or mutate root `jaw-interview-state.json`.
  - `handoff --session-id fresh --to plan`, `prune --session-id fresh`, and `migrate --session-id fresh`: each exits non-zero with its command-specific missing-mode error when no scoped active mode exists; none may mutate root active-state or root mode-state.
- Add an explicit no-session legacy fallback regression for a read/status-style command or equivalent helper path, proving root active-state still drives no-session aggregate/compat callers after strict session reads are introduced.

#### `packages/coding-agent/test/jaw-interview-skill-policy.test.ts`

Add content gate:
- Skill no longer instructs direct reads of `~/.jwc/settings.json` / `./.jwc/settings.json` as a blocking Phase 0 step.
- Skill mentions native/state threshold source.
- Skill explicitly says native runtime, not the skill prompt, owns settings/config precedence.

## Verification commands

Run focused tests:

```bash
bun test packages/coding-agent/test/skill-active-state.test.ts \
  packages/coding-agent/test/jaw-interview-mutation-guard.test.ts \
  packages/coding-agent/test/jwc-skill-state-hooks.test.ts \
  packages/coding-agent/test/jwc-runtime/state-runtime.test.ts \
  packages/coding-agent/test/jaw-interview-skill-policy.test.ts \
  packages/coding-agent/test/skill-hud-bar.test.ts \
  packages/coding-agent/test/jwc-subskill-injection.test.ts \
  packages/coding-agent/test/jwc-runtime/orchestrate-state.test.ts \
  packages/coding-agent/test/status-line-workflow-readers.test.ts
```

Because a bundled workflow skill changes, also run default-surface gates:

```bash
bun scripts/check-visible-definitions.ts
bun scripts/verify-g002-gates.ts
bun scripts/rebrand-inventory.ts --strict
bun test packages/coding-agent/test/default-jwc-definitions.test.ts
```

## Non-goals

- Do not delete root active-state files or root mode-state compatibility.
- Do not change PABCD state behavior already fixed, except keeping tests green.
- Do not introduce migration that rewrites existing `.jwc/state` trees in this slice.
- Do not change `team` runtime state layout under `.jwc/state/team/<team>`.

## Risk controls

- Preserve legacy `readVisibleSkillActiveState()` behavior by adding strict APIs rather than changing all callers at once.
- Move only live-session call paths to strict reads.
- Keep no-session CLI behavior intact.
- Add regression tests before/with implementation so stale root-state leaks are observable.
