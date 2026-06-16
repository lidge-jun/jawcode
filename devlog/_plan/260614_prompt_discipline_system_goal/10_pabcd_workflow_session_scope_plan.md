# PABCD Workflow Session Scope Implementation Plan

Date: 2026-06-14

## Objective

Implement the workflow session-scope fix for `jwc goal` and `jwc orchestrate`:

- Preserve the cwd-global durable goal ledger (`.jwc/goal`) for compatibility.
- Stop presenting shared/global goal state as the current session goal.
- Align `JWC_SESSION_ID` / `GJC_SESSION_ID` handling across goal and orchestrate adapters.
- Make explicit shared targeting available where a session env would otherwise scope commands.
- Add focused regression tests and update the devlog evidence.

Prompt/system-prompt edits are explicitly out of scope for this PABCD cycle.

## Current facts

- `jwc orchestrate status` already resolves env session id with `(JWC_SESSION_ID ?? GJC_SESSION_ID)` and reads session PABCD strictly.
- `jwc orchestrate --shared` is parsed but only affects `reset`; non-reset status/stage commands ignore it.
- `jwc goal status` reads `.jwc/goal/goals.json` through `getGoalStatus(cwd)` and does not distinguish current session goal-mode state from shared durable ledger state.
- `goal-engine.ts` `reconcileGoalState()` uses `GJC_SESSION_ID` only.
- `goal-cli.ts` `activateGoalMode()` stamps pending requests with `GJC_SESSION_ID` only.
- Current tests cover pending goal-mode request session ownership, but not `jwc goal status/update/done` under `JWC_SESSION_ID` / `GJC_SESSION_ID`.

## Files and diffs

### 1. MODIFY `packages/coding-agent/src/jwc-runtime/goal-mode-request.ts`

Purpose: centralize session env parity and expose session-file goal read helpers for CLI status/guards.

Before:

```ts
export const GJC_SESSION_FILE_ENV = "GJC_SESSION_FILE";
export const GJC_SESSION_ID_ENV = "GJC_SESSION_ID";
export const GJC_SESSION_CWD_ENV = "GJC_SESSION_CWD";
export const JWC_SESSION_FILE_ENV = "JWC_SESSION_FILE";
export const JWC_SESSION_ID_ENV = "JWC_SESSION_ID";
export const JWC_SESSION_CWD_ENV = "JWC_SESSION_CWD";
```

After:

```ts
export const GJC_SESSION_FILE_ENV = "GJC_SESSION_FILE";
export const GJC_SESSION_ID_ENV = "GJC_SESSION_ID";
export const GJC_SESSION_CWD_ENV = "GJC_SESSION_CWD";
export const JWC_SESSION_FILE_ENV = "JWC_SESSION_FILE";
export const JWC_SESSION_ID_ENV = "JWC_SESSION_ID";
export const JWC_SESSION_CWD_ENV = "JWC_SESSION_CWD";

export function resolveCliWorkflowSessionId(input?: { flagSessionId?: string | null }): string | undefined {
	const flag = input?.flagSessionId?.trim();
	if (flag) return flag;
	const envSession = (process.env[JWC_SESSION_ID_ENV] ?? process.env[GJC_SESSION_ID_ENV] ?? "").trim();
	return envSession || undefined;
}

export function resolveCliWorkflowSessionFile(): string | undefined {
	const sessionFile = (process.env[JWC_SESSION_FILE_ENV] ?? process.env[GJC_SESSION_FILE_ENV] ?? "").trim();
	return sessionFile || undefined;
}
```

No new imports are required for `Goal`, `SessionEntry`, `loadEntriesFromFile`, or `buildSessionContext`: `goal-mode-request.ts` already imports them at the top of the file. The patch only exports the new resolver/read helpers and reuses the existing private `goalFromModeData()` helper.

Add exported read helper near `writeCurrentSessionGoalModeState()`:

```ts
export async function readCurrentSessionGoalModeState(input?: {
	sessionFile?: string | null;
}): Promise<{ mode: string; goal: Goal | null; sessionFile: string } | { reason: "missing_session_file" | "empty_session_file" }> {
	const sessionFile = (input?.sessionFile ?? resolveCliWorkflowSessionFile())?.trim();
	if (!sessionFile) return { reason: "missing_session_file" };
	const fileEntries = await loadEntriesFromFile(sessionFile);
	if (fileEntries.length === 0) return { reason: "empty_session_file" };
	const entries = fileEntries.filter((entry): entry is SessionEntry => entry.type !== "session");
	const context = buildSessionContext(entries);
	return { mode: context.mode, goal: goalFromModeData(context.modeData), sessionFile };
}
```

Change `activateGoalMode()` callers indirectly by updating `goal-cli.ts` to use `resolveCliWorkflowSessionId()`.

### 2. MODIFY `packages/coding-agent/src/jwc-runtime/orchestrate-runtime.ts`

Purpose: keep default strict session behavior, but let `--shared` explicitly target shared PABCD for non-reset commands.

Before, `parseArgs()` applies env scope immediately:

```ts
if (!parsed.sessionId) {
	const envSession = (process.env.JWC_SESSION_ID ?? process.env.GJC_SESSION_ID ?? "").trim();
	if (envSession) parsed.sessionId = envSession;
}
```

After, `parseArgs()` only parses flags/positionals. Apply env scope in `runNativeOrchestrateCommand()` after `sub` is known:

```ts
if (sub === "reset") {
	if (!parsed.sessionId) parsed.sessionId = resolveCliWorkflowSessionId();
	return await resetPabcdState(cwd, parsed);
}
if (!parsed.sessionId && !parsed.shared) {
	parsed.sessionId = resolveCliWorkflowSessionId();
}
```

Add import:

```ts
import { resolveCliWorkflowSessionId } from "./goal-mode-request";
```

This removes the reset/non-reset contradiction:
- `reset --shared` first restores the current session id from env, so reset remains additive (session + shared).
- non-reset `--shared` leaves `parsed.sessionId` undefined, so status/stage/verdict explicitly target shared state.
- non-reset without `--shared` keeps strict env-scoped behavior.

`parseArgs()` after the patch must not contain any `process.env.JWC_SESSION_ID` or `process.env.GJC_SESSION_ID` lookup. Env scope is applied only in `runNativeOrchestrateCommand()` after `sub` is known.

Expected behavior after patch:

- env session + `jwc orchestrate status` → session state.
- env session + `jwc orchestrate status --shared` → shared state.
- env session + `jwc orchestrate p --shared` → shared write.
- env session + `jwc orchestrate reset --shared` → reset session + shared.

No fallback from session PABCD to shared PABCD.

### 3. MODIFY `packages/coding-agent/src/commands/orchestrate.ts`

Purpose: expose/document the already parsed `--shared` flag.

Before flags omit `shared`.

After:

```ts
shared: Flags.boolean({ description: "Target shared .jwc/state PABCD state instead of the current session scope" }),
```

Add example:

```ts
`$ ${APP_NAME} orchestrate status --shared`,
```

### 4. MODIFY `packages/coding-agent/src/jwc-runtime/goal-engine.ts`

Purpose: align reconciliation env parity, allow explicit session id injection from `jwc goal --session-id`, and export reconciliation for `jwc goal` adapter reuse.

Before:

```ts
async function reconcileGoalState(cwd: string): Promise<void> {
	const sessionId = process.env.GJC_SESSION_ID?.trim() || undefined;
```

After:

```ts
export async function reconcileGoalState(
	cwd: string,
	options?: { sessionId?: string },
): Promise<void> {
	const sessionId = options?.sessionId ?? resolveCliWorkflowSessionId();
```

Add import:

```ts
import { resolveCliWorkflowSessionId } from "./goal-mode-request";
```

Keep `.jwc/goal` storage unchanged.

### 5. MODIFY `packages/coding-agent/src/jwc-runtime/goal-cli.ts`

Purpose: make `jwc goal` status scope-aware and protect session users from accidental shared mutations.

Imports before:

```ts
import {
	GJC_SESSION_FILE_ENV,
	GJC_SESSION_ID_ENV,
	writeCurrentSessionGoalModeState,
	writePendingGoalModeRequest,
} from "./goal-mode-request";
```

Imports after:

```ts
import {
	GJC_SESSION_FILE_ENV,
	readCurrentSessionGoalModeState,
	resolveCliWorkflowSessionFile,
	resolveCliWorkflowSessionId,
	writeCurrentSessionGoalModeState,
	writePendingGoalModeRequest,
} from "./goal-mode-request";
import { reconcileGoalState } from "./goal-engine";
```

API surface after patch:
- `goal-mode-request.ts` exports `resolveCliWorkflowSessionId`, `resolveCliWorkflowSessionFile`, and `readCurrentSessionGoalModeState`.
- `goal-engine.ts` exports `reconcileGoalState`.
- `goal-mode-request.test.ts` imports `resolveCliWorkflowSessionId` and `readCurrentSessionGoalModeState` in addition to its existing goal-mode-request helpers.

Parser before:

```ts
force: boolean;
qualityGateJson?: string;
```

Parser after:

```ts
sessionId?: string;
force: boolean;
shared: boolean;
qualityGateJson?: string;
```

Add flag parse:

```ts
} else if (arg === "--session-id") {
	const value = argv[++index];
	if (!value) return { error: "--session-id requires a value" };
	sessionId = value;
} else if (arg === "--shared") {
	shared = true;
```

Use the parsed flag when resolving scope:

```ts
const sessionId = resolveCliWorkflowSessionId({ flagSessionId: parsed.sessionId });
```

Define one command scope object immediately after parsing so all helpers use the same flag/env decision:

```ts
interface GoalCommandScope {
	sessionId?: string;
	sessionFile?: string;
	shared: boolean;
}

function resolveGoalCommandScope(parsed: ParsedGoalArgs): GoalCommandScope {
	return {
		sessionId: resolveCliWorkflowSessionId({ flagSessionId: parsed.sessionId }),
		sessionFile: resolveCliWorkflowSessionFile(),
		shared: parsed.shared,
	};
}
```

`activateGoalMode()` before:

```ts
await writeCurrentSessionGoalModeState({ sessionFile: process.env[GJC_SESSION_FILE_ENV], objective });
await writePendingGoalModeRequest({
	cwd,
	objective,
	goalsPath: path.join(cwd, ".jwc", "goal", "goals.json"),
	sessionId: process.env[GJC_SESSION_ID_ENV],
});
```

After:

```ts
await writeCurrentSessionGoalModeState({ sessionFile: scope.sessionFile, objective });
await writePendingGoalModeRequest({
	cwd,
	objective,
	goalsPath: path.join(cwd, ".jwc", "goal", "goals.json"),
	sessionId: scope.sessionId,
});
```

Add helpers in `goal-cli.ts`:

```ts
function isNonTerminalSessionGoal(goal: Goal | null | undefined): goal is Goal {
	return Boolean(goal && goal.status !== "complete" && goal.status !== "dropped");
}

async function buildGoalStatusText(cwd: string, scope: GoalCommandScope): Promise<string> {
	const summary = await getGoalStatus(cwd);
	const plan = await readGoalPlan(cwd);
	const { sessionId, sessionFile, shared } = scope;

	if (shared || (!sessionId && !sessionFile)) {
		return renderSharedGoalStatusText(summary, plan);
	}

	const sessionState = await readCurrentSessionGoalModeState({ sessionFile });
	const sessionGoal = "goal" in sessionState ? sessionState.goal : null;
	const activeShared = plan?.goals.find(goal => goal.status === "active");
	const lines = [
		`Goal:    ${isNonTerminalSessionGoal(sessionGoal) ? sessionGoal.objective : "none (current session)"}`,
		`Status:  ${isNonTerminalSessionGoal(sessionGoal) ? sessionGoal.status : "no active session goal"}`,
		`Scope:   ${sessionId ? `session ${sessionId}` : "session file"}`,
		`Ledger:  shared .jwc/goal${activeShared ? ` (${activeShared.id}:${activeShared.status})` : " (none active)"}`,
		`Stories: ${plan?.goals.map(goal => `${goal.id}:${goal.status}`).join(" ") ?? "-"}`,
	];
	if (!("goal" in sessionState)) lines.push(`Session goal state: unavailable (${sessionState.reason})`);
	if (activeShared) lines.push(`Shared goal: ${activeShared.objective}`);
	if (summary.currentGoal?.evidence) lines.push(`last evidence: ${summary.currentGoal.evidence}`);
	return `${lines.join("\n")}\n`;
}
```

`renderSharedGoalStatusText()` is the current `goal-cli.ts` `status` case body (currently lines 173-191) extracted into a helper; it preserves the existing non-session/shared output shape (`Goal:`, `Status:`, `Mode: goal ledger (.jwc/goal/)`, `ID:`, `Stories:`, `last evidence:`). `status --shared` must call this helper even when a session env is active, satisfying AC3 without duplicating an ellipsis placeholder.

Add mutation guard:

```ts
async function assertGoalMutationScope(cwd: string, scope: GoalCommandScope): Promise<GoalCommandResult | null> {
	if (scope.shared) return null;
	const { sessionId, sessionFile } = scope;
	if (!sessionId && !sessionFile) return null;

	const sessionState = await readCurrentSessionGoalModeState({ sessionFile });
	const sessionGoal = "goal" in sessionState ? sessionState.goal : null;
	if (!isNonTerminalSessionGoal(sessionGoal)) {
		return {
			stderr: "current session has no active goal; refusing to mutate shared .jwc/goal (pass --shared to target the shared ledger explicitly)\n",
			status: 1,
		};
	}
	const sharedGoal = await activeGoal(cwd);
	if ("error" in sharedGoal || sharedGoal.objective !== sessionGoal.objective) {
		return {
			stderr: "current session goal does not match the shared .jwc/goal active story; refusing to mutate shared ledger (pass --shared to target it explicitly)\n",
			status: 1,
		};
	}
	return null;
}
```

Wire the guard by destructuring `shared` from `parsed` and creating `scope` once:

```ts
const { verb, positional, evidence, audit, agent, force, qualityGateJson } = parsed;
const scope = resolveGoalCommandScope(parsed);
```

Call it explicitly at the start of each mutation verb that mutates existing shared ledger/control state:

```ts
case "update": {
	const scopeError = await assertGoalMutationScope(cwd, scope);
	if (scopeError) return scopeError;
	// existing update body continues after the guard
}
case "done": {
	const scopeError = await assertGoalMutationScope(cwd, scope);
	if (scopeError) return scopeError;
	// existing done body continues after the guard
}
case "cancel": {
	const scopeError = await assertGoalMutationScope(cwd, scope);
	if (scopeError) return scopeError;
	// existing cancel body continues after the guard
}
case "pause":
case "resume":
	// Same guard before pause-gate/read-plan mutation.
```

Apply to: `update`, `done`, `cancel`, `pause`, `resume`.

Do **not** apply to: `set`, `plan`, `refine`, `status`, `history`.

Creation/replacement verbs (`set`, `plan`, `refine`) remain intentionally shared-ledger writes because they are explicit goal creation/refinement commands. In a session env they must still call `activateGoalMode()` with the resolved session id so the current session/pending request is updated; their stdout should continue to describe the created/refined goal, and `status` will label the ledger as shared.

Guard matrix:
- `set`, `plan`, `refine`: explicit shared-ledger creation/refinement; allowed under session env, and must also stamp session activation/pending request.
- `status`, `history`: read-only; `status` is scope-labeled, `status --shared` preserves shared headline.
- `update`, `done`, `cancel`, `pause`, `resume`: mutate an existing shared ledger/control state; under session env they require a non-terminal session-file goal whose objective matches the shared active story, otherwise require `--shared`.
- `--shared`: explicit escape hatch that restores old shared-ledger mutation behavior.

Status case before:

```ts
const summary = await getGoalStatus(cwd);
const plan = await readGoalPlan(cwd);
...
return { stdout: `${lines.join("\n")}\n`, status: 0 };
```

After:

```ts
if (scope.shared) return { stdout: await buildGoalStatusText(cwd, scope), status: 0 };
await reconcileGoalState(cwd, { sessionId: scope.sessionId });
return { stdout: await buildGoalStatusText(cwd, scope), status: 0 };
```

`--shared` on status preserves the old shared headline behavior and does not pretend to be a current-session view.

### 6. MODIFY `packages/coding-agent/src/commands/goal.ts`

Purpose: expose explicit shared ledger targeting and explicit session selection for session shells.

Add flag:

```ts
shared: Flags.boolean({ description: "Target the shared .jwc/goal ledger even when a session scope is active" }),
"session-id": Flags.string({ description: "Override session id for workflow-state reconciliation (precedence: flag, JWC_SESSION_ID, GJC_SESSION_ID)" }),
```

`Goal.run()` continues forwarding `this.argv` to `runNativeGoalCommand()`, matching the existing `--evidence` flag behavior in this command class. The implementation must verify with a focused CLI/help assertion that `jwc goal status --session-id my-session` reaches `parseGoalArgs()`; if the command framework strips declared flags, rebuild the argv from parsed flag values before calling `runNativeGoalCommand()`.

Add example:

```ts
`$ ${APP_NAME} goal status --shared`,
`$ ${APP_NAME} goal status --session-id my-session`,
```

### 7. MODIFY `packages/coding-agent/test/jwc-runtime/goal-runtime.test.ts`

Add env helper near top:

```ts
async function withSessionEnv<T>(env: { jwc?: string; gjc?: string; sessionFile?: string }, fn: () => Promise<T>): Promise<T> {
	const previous = {
		JWC_SESSION_ID: process.env.JWC_SESSION_ID,
		GJC_SESSION_ID: process.env.GJC_SESSION_ID,
		JWC_SESSION_FILE: process.env.JWC_SESSION_FILE,
		GJC_SESSION_FILE: process.env.GJC_SESSION_FILE,
	};
	try {
		if (env.jwc === undefined) delete process.env.JWC_SESSION_ID;
		else process.env.JWC_SESSION_ID = env.jwc;
		if (env.gjc === undefined) delete process.env.GJC_SESSION_ID;
		else process.env.GJC_SESSION_ID = env.gjc;
		if (env.sessionFile === undefined) {
			delete process.env.JWC_SESSION_FILE;
			delete process.env.GJC_SESSION_FILE;
		} else {
			process.env.JWC_SESSION_FILE = env.sessionFile;
			process.env.GJC_SESSION_FILE = env.sessionFile;
		}
		return await fn();
	} finally {
		// restore all four env vars exactly
	}
}
```

Add a small `writeSessionFileWithGoal(cwd, goal)` test helper that writes a session JSONL header plus a `mode_change` entry with `mode: "goal"` and `data: { goal: { id, objective, status, tokensUsed: 0, timeUsedSeconds: 0, createdAt, updatedAt } }`.

Add tests:

```ts
it("reports no current-session goal for session-id-only shells without a session file", async () => {
	await runNativeGoalCommand(["set", "shared objective"], cwd);
	const result = await withSessionEnv({ jwc: "session-B" }, () => runNativeGoalCommand(["status"], cwd));
	expect(result.status).toBe(0);
	expect(result.stdout).toContain("Goal:    none (current session)");
	expect(result.stdout).toContain("Session goal state: unavailable (missing_session_file)");
	expect(result.stdout).toContain("Ledger:  shared .jwc/goal");
	expect(result.stdout).toContain("Shared goal: shared objective");
});

it("requires --shared before a foreign session mutates the shared goal ledger", async () => {
	await runNativeGoalCommand(["set", "shared objective"], cwd);
	const refused = await withSessionEnv({ gjc: "session-B" }, () =>
		runNativeGoalCommand(["update", "foreign checkpoint", "--evidence", "proof"], cwd),
	);
	expect(refused.status).toBe(1);
	expect(refused.stderr).toContain("pass --shared");
	const allowed = await withSessionEnv({ gjc: "session-B" }, () =>
		runNativeGoalCommand(["update", "shared checkpoint", "--evidence", "proof", "--shared"], cwd),
	);
	expect(allowed.status).toBe(0);
});

it("also refuses JWC_SESSION_ID-only foreign session mutations without --shared", async () => {
	await runNativeGoalCommand(["set", "shared objective"], cwd);
	const refused = await withSessionEnv({ jwc: "session-B" }, () =>
		runNativeGoalCommand(["update", "foreign checkpoint", "--evidence", "proof"], cwd),
	);
	expect(refused.status).toBe(1);
	expect(refused.stderr).toContain("pass --shared");
});

it("allows matched-session update without --shared", async () => {
	await runNativeGoalCommand(["set", "shared objective"], cwd);
	const sessionFile = await writeSessionFileWithGoal(cwd, { objective: "shared objective", status: "active" });
	const update = await withSessionEnv({ jwc: "session-match", sessionFile }, () =>
		runNativeGoalCommand(["update", "matched checkpoint", "--evidence", "proof"], cwd),
	);
	expect(update.status).toBe(0);
});

it("refuses foreign-session done without --shared", async () => {
	await runNativeGoalCommand(["set", "shared objective"], cwd);
	const done = await withSessionEnv({ jwc: "session-B" }, () =>
		runNativeGoalCommand(["done", "foreign done", "--quality-gate-json", QUALITY_GATE], cwd),
	);
	expect(done.status).toBe(1);
	expect(done.stderr).toContain("pass --shared");
});

it("refuses pause without a matching session goal", async () => {
	await runNativeGoalCommand(["set", "shared objective"], cwd);
	const paused = await withSessionEnv({ gjc: "session-B" }, () => runNativeGoalCommand(["pause"], cwd));
	expect(paused.status).toBe(1);
	expect(paused.stderr).toContain("pass --shared");
});

it("preserves shared status headline with --shared under a session env", async () => {
	await runNativeGoalCommand(["set", "shared objective"], cwd);
	const result = await withSessionEnv({ jwc: "session-B" }, () => runNativeGoalCommand(["status", "--shared"], cwd));
	expect(result.status).toBe(0);
	expect(result.stdout).toContain("Goal:    shared objective");
	expect(result.stdout).toContain("Mode:    goal ledger (.jwc/goal/)");
});

it("honors JWC_SESSION_ID when reconciling goal workflow state", async () => {
	await runNativeGoalCommand(["set", "shared objective"], cwd);
	await withSessionEnv({ jwc: "session-J" }, () => runNativeGoalCommand(["status"], cwd));
	expect(await Bun.file(path.join(cwd, ".jwc", "state", "sessions", "session-J", "goal-state.json")).exists()).toBe(true);
	expect(await Bun.file(path.join(cwd, ".jwc", "state", "goal-state.json")).exists()).toBe(false);
});

it("honors GJC_SESSION_ID when reconciling goal workflow state", async () => {
	await runNativeGoalCommand(["set", "shared objective"], cwd);
	await withSessionEnv({ gjc: "session-G" }, () => runNativeGoalCommand(["status"], cwd));
	expect(await Bun.file(path.join(cwd, ".jwc", "state", "sessions", "session-G", "goal-state.json")).exists()).toBe(true);
	expect(await Bun.file(path.join(cwd, ".jwc", "state", "goal-state.json")).exists()).toBe(false);
});

it("honors explicit --session-id over env session id for goal status reconciliation", async () => {
	await runNativeGoalCommand(["set", "shared objective"], cwd);
	await withSessionEnv({ jwc: "env-session" }, () => runNativeGoalCommand(["status", "--session-id", "flag-session"], cwd));
	expect(await Bun.file(path.join(cwd, ".jwc", "state", "sessions", "flag-session", "goal-state.json")).exists()).toBe(true);
	expect(await Bun.file(path.join(cwd, ".jwc", "state", "sessions", "env-session", "goal-state.json")).exists()).toBe(false);
});

it("keeps legacy shared headline and unguarded update when no session env exists", async () => {
	await runNativeGoalCommand(["set", "shared objective"], cwd);
	const update = await withSessionEnv({}, () =>
		runNativeGoalCommand(["update", "legacy checkpoint", "--evidence", "proof"], cwd),
	);
	expect(update.status).toBe(0);
	const status = await withSessionEnv({}, () => runNativeGoalCommand(["status"], cwd));
	expect(status.stdout).toContain("Goal:    shared objective");
	expect(status.stdout).toContain("Mode:    goal ledger (.jwc/goal/)");
});

it("treats a session file without an active goal as no current-session goal", async () => {
	await runNativeGoalCommand(["set", "shared objective"], cwd);
	const sessionFile = path.join(cwd, "session-without-goal.jsonl");
	await Bun.write(sessionFile, `${JSON.stringify({ type: "session", version: 3, id: "session-empty", timestamp: new Date().toISOString(), cwd })}\n`);
	const result = await withSessionEnv({ jwc: "session-empty", sessionFile }, () => runNativeGoalCommand(["status"], cwd));
	expect(result.stdout).toContain("Goal:    none (current session)");
	expect(result.stdout).toContain("Shared goal: shared objective");
});

it("allows explicit goal creation/refinement verbs to update the shared ledger while stamping session activation", async () => {
	const result = await withSessionEnv({ jwc: "session-create" }, () => runNativeGoalCommand(["set", "session-created objective"], cwd));
	expect(result.status).toBe(0);
	const shared = await runNativeGoalCommand(["status", "--shared"], cwd);
	expect(shared.stdout).toContain("Goal:    session-created objective");
});
```

### 7b. MODIFY `packages/coding-agent/test/jwc-runtime/goal-mode-request.test.ts`

Add resolver/helper coverage:

```ts
it("resolves CLI workflow session id with flag, JWC, then GJC precedence", async () => {
	await withSessionEnv({ jwc: "env-jwc", gjc: "env-gjc" }, () => {
		expect(resolveCliWorkflowSessionId({ flagSessionId: "flag-session" })).toBe("flag-session");
		expect(resolveCliWorkflowSessionId()).toBe("env-jwc");
	});
	await withSessionEnv({ gjc: "env-gjc" }, () => {
		expect(resolveCliWorkflowSessionId()).toBe("env-gjc");
	});
});

it("reads the current session goal-mode state from a session file", async () => {
	const sessionFile = path.join(root, "session.jsonl");
	await Bun.write(sessionFile, [sessionHeaderJson, goalModeChangeJson, ""].join("\n"));
	const result = await readCurrentSessionGoalModeState({ sessionFile });
	expect(result).toMatchObject({ mode: "goal", goal: { objective: "Existing goal", status: "active" } });
});

it("reports missing_session_file when no session file env or argument exists", async () => {
	await withSessionEnv({}, async () => {
		expect(await readCurrentSessionGoalModeState()).toEqual({ reason: "missing_session_file" });
	});
});

it("reports empty_session_file when the session file has no entries", async () => {
	const sessionFile = path.join(root, "empty-session.jsonl");
	await Bun.write(sessionFile, "");
	expect(await readCurrentSessionGoalModeState({ sessionFile })).toEqual({ reason: "empty_session_file" });
});
```

### 8. MODIFY `packages/coding-agent/test/jwc-runtime/orchestrate-state.test.ts`

Add env helper if not present or local scoped helper.

Add tests:

```ts
it("does not read shared PABCD by default when a session env is active", async () => {
	await writeNativeWorkflowEnvelopeAtomic(cwd, { skill: "pabcd", version: WORKFLOW_STATE_VERSION, updated_at: new Date().toISOString(), current_phase: "i", active: true }, { command: "orchestrate i" });
	const result = await withEnv({ JWC_SESSION_ID: "session-B" }, () => runNativeOrchestrateCommand(["status"], cwd));
	expect(result.stdout).toContain("idle");
	expect(result.stdout).not.toContain("Scope:        shared");
});

it("targets shared PABCD explicitly with --shared from a session env", async () => {
	await writeNativeWorkflowEnvelopeAtomic(cwd, { skill: "pabcd", version: WORKFLOW_STATE_VERSION, updated_at: new Date().toISOString(), current_phase: "i", active: true }, { command: "orchestrate i" });
	const result = await withEnv({ JWC_SESSION_ID: "session-B" }, () => runNativeOrchestrateCommand(["status", "--shared"], cwd));
	expect(result.stdout).toContain("Scope:        shared");
});

it("honors GJC_SESSION_ID as a session env alias", async () => {
	const result = await withEnv({ GJC_SESSION_ID: "session-G" }, () => runNativeOrchestrateCommand(["p"], cwd));
	expect(result.status).toBe(0);
	expect(await readPabcdState(cwd, "session-G")).not.toBeNull();
	expect(await readPabcdState(cwd)).toBeNull();
});

it("writes shared PABCD when --shared is passed with a session env", async () => {
	const result = await withEnv({ JWC_SESSION_ID: "session-B" }, () => runNativeOrchestrateCommand(["p", "--shared"], cwd));
	expect(result.status).toBe(0);
	expect(await readPabcdState(cwd)).not.toBeNull();
	expect(await readPabcdState(cwd, "session-B")).toBeNull();
});
});
```

### 9. MODIFY `packages/coding-agent/test/jwc-runtime/orchestrate-reset.test.ts`

Keep the existing `reset --shared` additive behavior test green. If parser changes make `--shared` skip env session id, add the reset-specific resolution described in file 2.

Do not add a brittle substring assertion. Preserve the existing behavior test that checks both `pabcdStatePath(cwd)` and `pabcdStatePath(cwd, "sess-C")` are removed after `reset --shared`; that is the executable contract.

### 10. MODIFY `devlog/_plan/260614_prompt_discipline_system_goal/03_workflow_session_scope_fix.md`

Append implementation evidence after code/test changes:

```md
## Implementation evidence

- Added shared CLI session resolver and JWC/GJC parity.
- Goal status now separates current-session goal state from shared `.jwc/goal` ledger state.
- Goal mutations from a session without an active session goal fail closed unless `--shared` is supplied.
- Orchestrate non-reset `--shared` explicitly targets shared PABCD; default env-scoped behavior remains strict.
- Verification: ...
```

## Acceptance criteria

1. With `JWC_SESSION_ID=session-B` and only shared `.jwc/goal` active, `jwc goal status` must not print the shared objective as the current session `Goal:` headline.
2. With `GJC_SESSION_ID=session-B` and only shared `.jwc/goal` active, `jwc goal update ... --evidence ...` must refuse unless `--shared` is passed.
3. `jwc goal status --shared` keeps the old shared-ledger headline behavior.
4. `JWC_SESSION_ID` and `GJC_SESSION_ID` behave the same for goal reconciliation and orchestrate scoping.
5. With a session env and shared PABCD state only, `jwc orchestrate status` remains strict session scope by default.
6. With a session env, `jwc orchestrate status --shared` reads shared PABCD.
7. With a session env, `jwc orchestrate p --shared` writes shared PABCD, not session PABCD.
8. `jwc orchestrate reset --shared` still resets both the active session PABCD and shared PABCD.
9. Existing goal-ledger workflows without session env retain the current `.jwc/goal` output and mutation behavior.
10. With a session env but no session file, `jwc goal status` reports no active current-session goal and labels the shared ledger separately.
11. `jwc goal set|plan|refine` remain explicit shared-ledger creation/refinement verbs while also stamping session activation/pending request with `JWC_SESSION_ID` / `GJC_SESSION_ID`.
12. `jwc goal --session-id <id>` and `jwc orchestrate --session-id <id>` override both env vars for workflow-state scope selection.
13. Under a session env, `jwc goal update|done|cancel|pause|resume` mutate shared `.jwc/goal` only when the session-file goal matches the shared active story, or when `--shared` is explicit.

## Verification plan

Focused tests:

```sh
JWC_SESSION_ID= GJC_SESSION_ID= bun test packages/coding-agent/test/jwc-runtime/goal-runtime.test.ts packages/coding-agent/test/jwc-runtime/goal-mode-request.test.ts
JWC_SESSION_ID= GJC_SESSION_ID= bun test packages/coding-agent/test/jwc-runtime/orchestrate-state.test.ts packages/coding-agent/test/jwc-runtime/orchestrate-reset.test.ts
```

Type/format checks for touched files:

```sh
bunx biome check packages/coding-agent/src/jwc-runtime/goal-mode-request.ts packages/coding-agent/src/jwc-runtime/goal-cli.ts packages/coding-agent/src/jwc-runtime/goal-engine.ts packages/coding-agent/src/jwc-runtime/orchestrate-runtime.ts packages/coding-agent/src/commands/goal.ts packages/coding-agent/src/commands/orchestrate.ts packages/coding-agent/test/jwc-runtime/goal-runtime.test.ts packages/coding-agent/test/jwc-runtime/goal-mode-request.test.ts packages/coding-agent/test/jwc-runtime/orchestrate-state.test.ts packages/coding-agent/test/jwc-runtime/orchestrate-reset.test.ts
bun run check:types # cwd packages/coding-agent
```

Manual smoke after build uses local CLI:

```sh
JWC_SESSION_ID=session-B jwc goal status
JWC_SESSION_ID=session-B jwc goal status --shared
JWC_SESSION_ID=env-session jwc goal status --session-id flag-session
JWC_SESSION_ID=session-B jwc orchestrate status
JWC_SESSION_ID=session-B jwc orchestrate status --shared
```

## Risks and mitigations

- Risk: session shells intentionally mutating shared `.jwc/goal` now fail without `--shared`.
  - Mitigation: explicit `--shared` is discoverable in CLI help and keeps old behavior.
- Risk: session file may be unavailable in non-interactive shells.
  - Mitigation: status labels missing session goal instead of pretending shared ledger is current; `--shared` remains available.
- Risk: moving `.jwc/goal` to session paths would orphan existing ledgers.
  - Mitigation: this plan does not move ledger storage.
- Risk: silent PABCD fallback from session to shared would recreate scope confusion.
  - Mitigation: default orchestrate reads remain strict; `--shared` is explicit.
