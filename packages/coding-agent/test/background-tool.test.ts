import { afterEach, describe, expect, test, vi } from "bun:test";
import * as fs from "node:fs/promises";
import * as os from "node:os";
import * as path from "node:path";
import { AsyncJobManager } from "../src/async/job-manager";
import { Settings } from "../src/config/settings";
import { sortBackgroundRows } from "../src/modes/background-row-model";
import { JobsObserver } from "../src/modes/jobs-observer";
import { BackgroundTool } from "../src/tools/background";
import { CronCreateTool, resetCronRegistryForTests } from "../src/tools/cron";
import type { ToolSession } from "../src/tools/index";

const OWNER = "0-Main";

function makeManager(): AsyncJobManager {
	return new AsyncJobManager({ onJobComplete: async () => {}, maxRunningJobs: 150 });
}

function abortable(signal: AbortSignal): Promise<string> {
	const { promise, resolve } = Promise.withResolvers<string>();
	if (signal.aborted) {
		resolve("aborted");
	} else {
		signal.addEventListener("abort", () => resolve("aborted"), { once: true });
	}
	return promise;
}

function makeSession(overrides: Partial<ToolSession> = {}): ToolSession {
	return {
		cwd: process.cwd(),
		hasUI: false,
		settings: Settings.isolated({ "async.enabled": true }),
		getSessionFile: () => null,
		getSessionSpawns: () => null,
		getAgentId: () => OWNER,
		...overrides,
	} as ToolSession;
}

function makeCronSession(ownerId = OWNER): ToolSession {
	return {
		...makeSession({ getAgentId: () => ownerId }),
		getSessionId: () => "background-tool-test",
		steer: () => {},
		sendCustomMessage: async () => {},
		allocateOutputArtifact: async () => ({}),
	} as unknown as ToolSession;
}

const flush = () => Bun.sleep(0);

const tempDirs: string[] = [];

function textContent(result: Awaited<ReturnType<BackgroundTool["execute"]>>): string {
	return result.content.find(item => item.type === "text")?.text ?? "";
}

afterEach(async () => {
	resetCronRegistryForTests();
	const manager = AsyncJobManager.instance();
	AsyncJobManager.setInstance(undefined);
	await manager?.dispose();
	for (const dir of tempDirs.splice(0)) {
		await fs.rm(dir, { recursive: true, force: true });
	}
});

describe("BackgroundTool", () => {
	test("list returns owner-scoped canonical background rows", async () => {
		const manager = makeManager();
		AsyncJobManager.setInstance(manager);
		manager.register("bash", "own shell", async ({ signal }) => abortable(signal), { ownerId: OWNER });
		manager.register("bash", "other shell", async ({ signal }) => abortable(signal), { ownerId: "0-Other" });
		manager.register("bash", "own monitor", async ({ signal }) => abortable(signal), {
			ownerId: OWNER,
			metadata: { monitor: true },
		});
		manager.register("task", "sub task", async ({ signal }) => abortable(signal), {
			ownerId: OWNER,
			metadata: { subagent: { id: "sub-live", agent: "executor", agentSource: "bundled", description: "live sub" } },
		});
		manager.register(
			"bash",
			"failed shell",
			async () => {
				throw new Error("boom");
			},
			{ ownerId: OWNER },
		);
		manager.registerSubagentRecord({
			subagentId: "sub-queued",
			ownerId: OWNER,
			currentJobId: null,
			historicalJobIds: [],
			status: "queued",
			sessionFile: null,
			resumable: true,
			queued: { ownerId: OWNER, seq: 1, message: "queued", createdAt: 1 },
		});
		const cronTool = new CronCreateTool(makeCronSession());
		await cronTool.execute("cron", { cron_expression: "*/5 * * * *", prompt: "check", recurring: true });
		await flush();

		const result = await new BackgroundTool(makeSession()).execute("call", { op: "list" });

		const rows = result.details?.rows ?? [];
		expect(rows.map(row => row.label)).not.toContain("other shell");
		expect(rows.map(row => row.id)).toEqual(sortBackgroundRows(rows).map(row => row.id));
		expect(rows[0]?.status).toBe("failed");
		expect(rows.map(row => row.kind).sort()).toEqual(["cron", "mon", "sh", "sh", "sub", "sub"]);
	});

	test("list enforces explicit and maximum limits with sanitized text", async () => {
		const manager = makeManager();
		AsyncJobManager.setInstance(manager);
		manager.register("bash", "one\twith\nspacing", async ({ signal }) => abortable(signal), { ownerId: OWNER });
		manager.register("bash", "two", async ({ signal }) => abortable(signal), { ownerId: OWNER });

		let result = await new BackgroundTool(makeSession()).execute("call", { op: "list", limit: 1 });
		expect(result.details?.rows).toHaveLength(1);
		const text = textContent(result);
		expect(text).toContain("… 1 more");
		expect(text).not.toContain("\t");

		for (let i = 0; i < 105; i++) {
			manager.register("bash", `extra-${i}`, async ({ signal }) => abortable(signal), { ownerId: OWNER });
		}
		result = await new BackgroundTool(makeSession()).execute("call", { op: "list" });
		expect(result.details?.rows).toHaveLength(20);
		result = await new BackgroundTool(makeSession()).execute("call", { op: "list", limit: 1_000 });
		expect(result.details?.rows).toHaveLength(100);
	});

	test("disposes short-lived JobsObserver snapshots", async () => {
		const manager = makeManager();
		AsyncJobManager.setInstance(manager);
		manager.register("bash", "one", async ({ signal }) => abortable(signal), { ownerId: OWNER });
		const disposeSpy = vi.spyOn(JobsObserver.prototype, "dispose");

		await new BackgroundTool(makeSession()).execute("call", { op: "list" });

		expect(disposeSpy).toHaveBeenCalled();
	});

	test("detail returns attention and verified output ref only when artifact metadata exists", async () => {
		const manager = makeManager();
		AsyncJobManager.setInstance(manager);
		const dir = await fs.mkdtemp(path.join(os.tmpdir(), "background-tool-"));
		tempDirs.push(dir);
		await Bun.write(`${dir}/sub-live.md`, "output");
		await Bun.write(`${dir}/sub-live.md.meta.json`, JSON.stringify({ id: "sub-live", kind: "agent-output" }));
		const jobId = manager.register(
			"task",
			"failed sub",
			async () => {
				throw new Error("boom");
			},
			{
				ownerId: OWNER,
				metadata: {
					subagent: { id: "sub-live", agent: "executor", agentSource: "bundled", description: "failed sub" },
				},
			},
		);
		await flush();

		const result = await new BackgroundTool(makeSession({ getArtifactsDir: () => dir })).execute("call", {
			op: "detail",
			id: jobId,
		});

		expect(result.details?.attention).toBe(true);
		expect(result.details?.outputRef).toBe("agent://sub-live");
		expect(result.details?.detailItems?.some(item => item.label === "Attention")).toBe(true);
		const withoutArtifactMetadata = await new BackgroundTool(makeSession()).execute("call", {
			op: "detail",
			id: jobId,
		});
		expect(withoutArtifactMetadata.details?.outputRef).toBeUndefined();
	});

	test("follow reads bounded output and supports offsets", async () => {
		const manager = makeManager();
		AsyncJobManager.setInstance(manager);
		const jobId = manager.register("bash", "stream", async ({ signal }) => abortable(signal), { ownerId: OWNER });
		manager.appendOutput(jobId, "alpha\n");
		let result = await new BackgroundTool(makeSession()).execute("call", { op: "follow", id: jobId });
		const nextOffset = result.details?.follow?.nextOffset;
		manager.appendOutput(jobId, "beta\n");

		result = await new BackgroundTool(makeSession()).execute("call", { op: "follow", id: jobId, offset: nextOffset });

		expect(result.details?.follow?.status).toBe("ok");
		expect(result.details?.follow?.text).toBe("beta\n");

		result = await new BackgroundTool(makeSession()).execute("call", { op: "follow", id: jobId, limitBytes: 3 });
		expect(result.details?.follow?.text).toBe("alp");
		expect(result.details?.follow?.truncated).toBe(true);
	});

	test("follow supports task-backed sub rows with manager output", async () => {
		const manager = makeManager();
		AsyncJobManager.setInstance(manager);
		const jobId = manager.register("task", "sub stream", async ({ signal }) => abortable(signal), {
			ownerId: OWNER,
			metadata: { subagent: { id: "sub-live", agent: "executor", agentSource: "bundled", description: "live sub" } },
		});
		manager.appendOutput(jobId, "sub output\n");

		const result = await new BackgroundTool(makeSession()).execute("call", { op: "follow", id: jobId });

		expect(result.details?.follow?.status).toBe("ok");
		expect(result.details?.follow?.text).toBe("sub output\n");
	});

	test("follow supports monitor rows with manager output", async () => {
		const manager = makeManager();
		AsyncJobManager.setInstance(manager);
		const jobId = manager.register("bash", "monitor stream", async ({ signal }) => abortable(signal), {
			ownerId: OWNER,
			metadata: { monitor: true },
		});
		manager.appendOutput(jobId, "monitor output\n");

		const result = await new BackgroundTool(makeSession()).execute("call", { op: "follow", id: jobId });

		expect(result.details?.follow?.status).toBe("ok");
		expect(result.details?.follow?.text).toBe("monitor output\n");
	});

	test("follow returns unsupported for rows without manager output", async () => {
		const manager = makeManager();
		AsyncJobManager.setInstance(manager);
		const cronTool = new CronCreateTool(makeCronSession());
		const cron = await cronTool.execute("cron", { cron_expression: "*/5 * * * *", prompt: "check", recurring: true });
		if (!cron.details) throw new Error("expected cron details");

		manager.registerSubagentRecord({
			subagentId: "sub-queued",
			ownerId: OWNER,
			currentJobId: null,
			historicalJobIds: [],
			status: "queued",
			sessionFile: null,
			resumable: true,
			queued: { ownerId: OWNER, seq: 1, createdAt: 1 },
		});
		const queued = await new BackgroundTool(makeSession()).execute("call", { op: "follow", id: "sub-queued" });
		expect(queued.details?.follow?.status).toBe("unsupported");
		const result = await new BackgroundTool(makeSession()).execute("call", { op: "follow", id: cron.details.id });

		expect(result.details?.follow?.status).toBe("unsupported");
	});

	test("cancel is owner-scoped and uses subagent records", async () => {
		const manager = makeManager();
		AsyncJobManager.setInstance(manager);
		const jobId = manager.register("bash", "own", async ({ signal }) => abortable(signal), { ownerId: OWNER });
		const other = manager.register("bash", "other", async ({ signal }) => abortable(signal), { ownerId: "0-Other" });
		const monitorId = manager.register("bash", "monitor", async ({ signal }) => abortable(signal), {
			ownerId: OWNER,
			metadata: { monitor: true },
		});
		const jobOnlySubId = manager.register("task", "job-only sub", async ({ signal }) => abortable(signal), {
			ownerId: OWNER,
			metadata: {
				subagent: { id: "sub-live", agent: "executor", agentSource: "bundled", description: "job-only sub" },
			},
		});
		const pausedJobId = manager.register("bash", "paused", async () => ({ kind: "paused", note: "hold" }), {
			ownerId: OWNER,
		});
		manager.registerSubagentRecord({
			subagentId: "sub-queued",
			ownerId: OWNER,
			currentJobId: null,
			historicalJobIds: [],
			status: "queued",
			sessionFile: null,
			resumable: true,
			queued: { ownerId: OWNER, seq: 1, createdAt: 1 },
		});
		await flush();
		const cancelSubagentSpy = vi.spyOn(manager, "cancelSubagent");
		const cancelJobSpy = vi.spyOn(manager, "cancel");
		const tool = new BackgroundTool(makeSession());

		let result = await tool.execute("call", { op: "cancel", id: jobId });
		expect(result.details?.cancel?.status).toBe("cancelled");
		result = await tool.execute("call", { op: "cancel", id: other });
		expect(result.details?.cancel?.status).toBe("not_found");
		result = await tool.execute("call", { op: "cancel", id: "sub-queued" });
		expect(result.details?.cancel?.status).toBe("cancelled");
		expect(cancelSubagentSpy).toHaveBeenCalledWith("sub-queued", { ownerId: OWNER });
		result = await tool.execute("call", { op: "cancel", id: jobOnlySubId });
		expect(result.details?.cancel?.status).toBe("cancelled");
		expect(cancelSubagentSpy).not.toHaveBeenCalledWith("sub-live", { ownerId: OWNER });
		expect(cancelJobSpy).toHaveBeenCalledWith(jobOnlySubId, { ownerId: OWNER });
		result = await tool.execute("call", { op: "cancel", id: monitorId });
		expect(result.details?.cancel?.status).toBe("cancelled");
		result = await tool.execute("call", { op: "cancel", id: pausedJobId });
		expect(result.details?.cancel?.status).toBe("unsupported");
		const cronTool = new CronCreateTool(makeCronSession());
		const cron = await cronTool.execute("cron", { cron_expression: "*/5 * * * *", prompt: "check", recurring: true });
		if (!cron.details) throw new Error("expected cron details");
		result = await tool.execute("call", { op: "cancel", id: cron.details.id });
		expect(result.details?.cancel?.status).toBe("unsupported");

		const failedJobId = manager.register(
			"bash",
			"failed",
			async () => {
				throw new Error("boom");
			},
			{ ownerId: OWNER },
		);
		await flush();
		result = await tool.execute("call", { op: "cancel", id: failedJobId });
		expect(result.details?.cancel?.status).toBe("already_terminal");
	});

	test("settings returns read-only background keys", async () => {
		const manager = makeManager();
		AsyncJobManager.setInstance(manager);
		const result = await new BackgroundTool(makeSession()).execute("call", { op: "settings" });
		const keys = result.details?.settings?.map(entry => entry.key);

		expect(keys).toEqual([
			"async.enabled",
			"async.maxJobs",
			"async.pollWaitDuration",
			"bash.autoBackground.enabled",
			"bash.autoBackground.thresholdMs",
			"task.maxConcurrency",
			"app.background.expand",
		]);
		expect(result.details?.settings?.find(entry => entry.key === "app.background.expand")?.source).toBe(
			"keybinding-default",
		);
	});
});
