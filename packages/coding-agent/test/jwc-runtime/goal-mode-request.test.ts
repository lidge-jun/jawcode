import { afterEach, describe, expect, it } from "bun:test";
import * as fs from "node:fs/promises";
import * as path from "node:path";
import {
	consumePendingGoalModeRequest,
	GJC_SESSION_FILE_ENV,
	GJC_SESSION_ID_ENV,
	isGoalCreateGoalsInvocation,
	JWC_SESSION_FILE_ENV,
	JWC_SESSION_ID_ENV,
	readCurrentSessionGoalModeState,
	readGoalJwcObjective,
	resolveCliWorkflowSessionId,
	writeCurrentSessionGoalModeState,
	writePendingGoalModeRequest,
} from "@gajae-code/coding-agent/jwc-runtime/goal-mode-request";
import {
	buildSessionContext,
	loadEntriesFromFile,
	type SessionEntry,
} from "@gajae-code/coding-agent/session/session-manager";

async function withSessionEnv<T>(
	env: { jwc?: string; gjc?: string; sessionFile?: string },
	fn: () => T | Promise<T>,
): Promise<T> {
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
		if (previous.JWC_SESSION_ID === undefined) delete process.env.JWC_SESSION_ID;
		else process.env.JWC_SESSION_ID = previous.JWC_SESSION_ID;
		if (previous.GJC_SESSION_ID === undefined) delete process.env.GJC_SESSION_ID;
		else process.env.GJC_SESSION_ID = previous.GJC_SESSION_ID;
		if (previous.JWC_SESSION_FILE === undefined) delete process.env.JWC_SESSION_FILE;
		else process.env.JWC_SESSION_FILE = previous.JWC_SESSION_FILE;
		if (previous.GJC_SESSION_FILE === undefined) delete process.env.GJC_SESSION_FILE;
		else process.env.GJC_SESSION_FILE = previous.GJC_SESSION_FILE;
	}
}
const tempRoots: string[] = [];

async function tempDir(): Promise<string> {
	const dir = await fs.mkdtemp(path.join(process.cwd(), ".tmp-goal-mode-"));
	tempRoots.push(dir);
	return dir;
}

afterEach(async () => {
	await Promise.all(tempRoots.splice(0).map(dir => fs.rm(dir, { recursive: true, force: true })));
});

describe("GJC goal goal mode request", () => {
	it("detects create-goals invocations without matching flags", () => {
		expect(isGoalCreateGoalsInvocation(["create-goals", "--brief", "ship it"])).toBe(true);
		expect(isGoalCreateGoalsInvocation(["create", "--brief", "ship it"])).toBe(true);
		expect(isGoalCreateGoalsInvocation(["--json", "status"])).toBe(false);
		expect(isGoalCreateGoalsInvocation(["--create-goals"])).toBe(false);
		expect(isGoalCreateGoalsInvocation(["status", "--filter", "create-goals"])).toBe(false);
	});

	it("resolves CLI workflow session id with flag, JWC, then GJC precedence", async () => {
		await withSessionEnv({ jwc: "env-jwc", gjc: "env-gjc" }, async () => {
			expect(resolveCliWorkflowSessionId({ flagSessionId: "flag-session" })).toBe("flag-session");
			expect(resolveCliWorkflowSessionId()).toBe("env-jwc");
		});
		await withSessionEnv({ gjc: "env-gjc" }, async () => {
			expect(resolveCliWorkflowSessionId()).toBe("env-gjc");
		});
		await withSessionEnv({}, async () => {
			expect(resolveCliWorkflowSessionId()).toBeUndefined();
		});
	});

	it("reads jwcObjective from the generated goal plan", async () => {
		const root = await tempDir();
		const goalsPath = path.join(root, ".jwc", "goal", "goals.json");
		await fs.mkdir(path.dirname(goalsPath), { recursive: true });
		await Bun.write(goalsPath, JSON.stringify({ jwcObjective: "Complete .jwc/goal/goals.json" }));

		const result = await readGoalJwcObjective(root);

		expect(result.objective).toBe("Complete .jwc/goal/goals.json");
		expect(result.goalsPath).toBe(goalsPath);
	});

	it("writes and consumes a pending runtime goal mode request", async () => {
		const root = await tempDir();
		await writePendingGoalModeRequest({ cwd: root, objective: "Complete goal", goalsPath: "goals.json" });

		const request = await consumePendingGoalModeRequest(root);
		const consumedAgain = await consumePendingGoalModeRequest(root);

		expect(request?.objective).toBe("Complete goal");
		expect(request?.source).toBe("goal");
		expect(consumedAgain).toBeNull();
	});

	it("does not let a concurrent session consume another session's pending request", async () => {
		const root = await tempDir();
		await writePendingGoalModeRequest({
			cwd: root,
			objective: "Complete goal",
			goalsPath: "goals.json",
			sessionId: "session-A",
		});

		// A different, independent session must not pick up session-A's request.
		const leaked = await consumePendingGoalModeRequest(root, "session-B");
		expect(leaked).toBeNull();

		// The request is left intact for its rightful owner to consume.
		const owned = await consumePendingGoalModeRequest(root, "session-A");
		expect(owned?.objective).toBe("Complete goal");
		expect(owned?.sessionId).toBe("session-A");

		// Once consumed by the owner it is gone for everyone.
		expect(await consumePendingGoalModeRequest(root, "session-A")).toBeNull();
	});

	it("lets the owning session consume its own session-scoped request", async () => {
		const root = await tempDir();
		await writePendingGoalModeRequest({
			cwd: root,
			objective: "Complete goal",
			sessionId: "session-A",
		});

		const owned = await consumePendingGoalModeRequest(root, "session-A");
		expect(owned?.sessionId).toBe("session-A");
	});

	it("keeps consuming legacy unscoped requests from any session", async () => {
		const root = await tempDir();
		await writePendingGoalModeRequest({ cwd: root, objective: "Complete goal" });

		// No sessionId stamped (legacy/CLI-only producer) → consumable by any session.
		const request = await consumePendingGoalModeRequest(root, "session-X");
		expect(request?.objective).toBe("Complete goal");
		expect(request?.sessionId).toBeUndefined();
	});

	it("writes goal mode state into the current session file", async () => {
		const root = await tempDir();
		const sessionFile = path.join(root, "session.jsonl");
		const timestamp = new Date().toISOString();
		await Bun.write(
			sessionFile,
			[
				JSON.stringify({ type: "session", version: 3, id: "session-1", timestamp, cwd: root }),
				JSON.stringify({
					type: "message",
					id: "user-1",
					parentId: null,
					timestamp,
					message: { role: "user", content: [{ type: "text", text: "start goal" }] },
				}),
				"",
			].join("\n"),
		);

		const result = await writeCurrentSessionGoalModeState({
			sessionFile,
			objective: "Complete generated goal plan",
		});
		const entries = (await loadEntriesFromFile(sessionFile)).filter(
			(entry): entry is SessionEntry => entry.type !== "session",
		);
		const context = buildSessionContext(entries);

		expect(result.status).toBe("updated");
		expect(context.mode).toBe("goal");
		expect(context.modeData?.goal).toMatchObject({
			objective: "Complete generated goal plan",
			status: "active",
			tokensUsed: 0,
		});
	});

	it("does not overwrite an existing active session goal", async () => {
		const root = await tempDir();
		const sessionFile = path.join(root, "session.jsonl");
		const timestamp = new Date().toISOString();
		const existingGoal = {
			id: "goal-1",
			objective: "Existing goal",
			status: "active" as const,
			tokensUsed: 0,
			timeUsedSeconds: 0,
			createdAt: 1,
			updatedAt: 1,
		};
		await Bun.write(
			sessionFile,
			[
				JSON.stringify({ type: "session", version: 3, id: "session-1", timestamp, cwd: root }),
				JSON.stringify({
					type: "mode_change",
					id: "mode-1",
					parentId: null,
					timestamp,
					mode: "goal",
					data: { goal: existingGoal },
				}),
				"",
			].join("\n"),
		);

		const before = await Bun.file(sessionFile).text();
		const result = await writeCurrentSessionGoalModeState({
			sessionFile,
			objective: "New goal objective",
		});
		const after = await Bun.file(sessionFile).text();

		expect(result).toEqual({ status: "existing_goal", goal: existingGoal });
		expect(after).toBe(before);
	});

	it("reads the current session goal-mode state from a session file", async () => {
		const root = await tempDir();
		const sessionFile = path.join(root, "session.jsonl");
		const timestamp = new Date().toISOString();
		const existingGoal = {
			id: "goal-1",
			objective: "Existing goal",
			status: "active" as const,
			tokensUsed: 0,
			timeUsedSeconds: 0,
			createdAt: 1,
			updatedAt: 1,
		};
		await Bun.write(
			sessionFile,
			[
				JSON.stringify({ type: "session", version: 3, id: "session-1", timestamp, cwd: root }),
				JSON.stringify({
					type: "mode_change",
					id: "mode-1",
					parentId: null,
					timestamp,
					mode: "goal",
					data: { goal: existingGoal },
				}),
				"",
			].join("\n"),
		);

		const result = await readCurrentSessionGoalModeState({ sessionFile });
		expect(result).toMatchObject({ mode: "goal", goal: { objective: "Existing goal", status: "active" } });
	});

	it("reports missing_session_file when no session file env or argument exists", async () => {
		await withSessionEnv({}, async () => {
			expect(await readCurrentSessionGoalModeState()).toEqual({ reason: "missing_session_file" });
		});
	});

	it("reports empty_session_file when the session file has no entries", async () => {
		const root = await tempDir();
		const sessionFile = path.join(root, "empty-session.jsonl");
		await Bun.write(sessionFile, "");
		expect(await readCurrentSessionGoalModeState({ sessionFile })).toEqual({ reason: "empty_session_file" });
	});

	it("normalizes legacy budget-limited session goals", async () => {
		const root = await tempDir();
		const sessionFile = path.join(root, "session.jsonl");
		const timestamp = new Date().toISOString();
		const existingGoal = {
			id: "goal-1",
			objective: "Existing goal",
			status: "budget-limited",
			tokenBudget: 10,
			tokensUsed: 12,
			timeUsedSeconds: 0,
			createdAt: 1,
			updatedAt: 1,
		};
		await Bun.write(
			sessionFile,
			[
				JSON.stringify({ type: "session", version: 3, id: "session-1", timestamp, cwd: root }),
				JSON.stringify({
					type: "mode_change",
					id: "mode-1",
					parentId: null,
					timestamp,
					mode: "goal",
					data: { goal: existingGoal },
				}),
				"",
			].join("\n"),
		);

		const result = await writeCurrentSessionGoalModeState({
			sessionFile,
			objective: "New goal objective",
		});

		expect(result.status).toBe("existing_goal");
		if (result.status !== "existing_goal") throw new Error("expected existing goal");
		expect(result.goal).toMatchObject({ status: "active", tokensUsed: 12 });
		expect("tokenBudget" in result.goal).toBe(false);
	});

	it("queues a pending activation request even when the session file already has an active goal", async () => {
		const root = await tempDir();
		const sessionFile = path.join(root, "session.jsonl");
		const timestamp = new Date().toISOString();
		const existingGoal = {
			id: "goal-1",
			objective: "Existing goal",
			status: "active",
			tokensUsed: 0,
			timeUsedSeconds: 0,
			createdAt: 1,
			updatedAt: 1,
		};
		await Bun.write(
			sessionFile,
			[
				JSON.stringify({ type: "session", version: 3, id: "session-1", timestamp, cwd: root }),
				JSON.stringify({
					type: "mode_change",
					id: "mode-1",
					parentId: null,
					timestamp,
					mode: "goal",
					data: { goal: existingGoal },
				}),
				"",
			].join("\n"),
		);

		const cliPath = path.resolve(import.meta.dir, "..", "..", "src", "cli.ts");

		const result = Bun.spawnSync(["bun", cliPath, "goal", "set", "Ship native goal"], {
			cwd: root,
			env: {
				...process.env,
				[GJC_SESSION_FILE_ENV]: sessionFile,
				[JWC_SESSION_FILE_ENV]: sessionFile,
				[GJC_SESSION_ID_ENV]: "session-owner",
				[JWC_SESSION_ID_ENV]: "session-owner",
			},
			stdout: "pipe",
			stderr: "pipe",
		});

		expect(result.exitCode, result.stderr.toString()).toBe(0);
		// The pending request is stamped with the producing session and must not
		// leak into a concurrent independent session sharing the same cwd.
		expect(await consumePendingGoalModeRequest(root, "other-session")).toBeNull();
		const pending = await consumePendingGoalModeRequest(root, "session-owner");
		expect(pending?.objective).toBe("Ship native goal");
		expect(pending?.sessionId).toBe("session-owner");
		const entries = (await loadEntriesFromFile(sessionFile)).filter(
			(entry): entry is SessionEntry => entry.type !== "session",
		);
		const context = buildSessionContext(entries);
		expect(context.modeData?.goal).toMatchObject(existingGoal);
	});

	it("surfaces corrupt pending request json", async () => {
		const root = await tempDir();
		const requestPath = path.join(root, ".jwc", "state", "goal-mode-request.json");
		await fs.mkdir(path.dirname(requestPath), { recursive: true });
		await Bun.write(requestPath, "{");

		await expect(consumePendingGoalModeRequest(root)).rejects.toThrow(SyntaxError);
	});

	it("surfaces corrupt goal goals json", async () => {
		const root = await tempDir();
		const goalsPath = path.join(root, ".jwc", "goal", "goals.json");
		await fs.mkdir(path.dirname(goalsPath), { recursive: true });
		await Bun.write(goalsPath, "{");

		await expect(readGoalJwcObjective(root)).rejects.toThrow(SyntaxError);
	});
});
