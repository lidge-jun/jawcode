import { afterEach, describe, expect, test } from "bun:test";
import * as fs from "node:fs/promises";
import * as os from "node:os";
import * as path from "node:path";
import {
	harnessLeasesGcAdapter,
	registryEntriesGcAdapter,
} from "@jawcode-dev/coding-agent/harness-control-plane/gc-adapter";
import type { GcContext, GcPidProbe } from "@jawcode-dev/coding-agent/jwc-runtime/gc-runtime";
import { teamWorkersGcAdapter } from "@jawcode-dev/coding-agent/jwc-runtime/team-gc";

const DEAD_PID = 4242;
const ALIVE_PID = 4243;
const tempDirs: string[] = [];

afterEach(async () => {
	for (const dir of tempDirs.splice(0)) await fs.rm(dir, { recursive: true, force: true });
});

async function makeTemp(): Promise<string> {
	const dir = await fs.mkdtemp(path.join(os.tmpdir(), "jwc-gc-stores-"));
	tempDirs.push(dir);
	return dir;
}

const splitProbe: GcPidProbe = pid => (pid === DEAD_PID ? { status: "dead" } : { status: "keep", reason: "alive" });

function ctxFor(base: string, registryDir: string): GcContext {
	return {
		probe: splitProbe,
		force: false,
		env: { ...process.env, GJC_HARNESS_ROOT_REGISTRY_DIR: registryDir },
		cwd: base,
	};
}

async function writeJson(file: string, value: unknown): Promise<void> {
	await fs.mkdir(path.dirname(file), { recursive: true });
	await fs.writeFile(file, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

function lease(sessionId: string, pid: number) {
	const now = new Date();
	return {
		ownerId: `owner-${sessionId}`,
		sessionId,
		pid,
		leaseTokenHash: "deadbeef",
		endpoint: null,
		eventsPath: "events.jsonl",
		heartbeatAt: now.toISOString(),
		expiresAt: new Date(now.getTime() + 3_600_000).toISOString(),
		leaseEpoch: 1,
		writer: { ownerId: `owner-${sessionId}`, leaseEpoch: 1 },
	};
}

describe("harnessLeasesGcAdapter", () => {
	test("reaps a dead-pid lease but keeps a live-pid lease", async () => {
		const base = await makeTemp();
		const root = path.join(base, "state", "harness");
		const registryDir = path.join(base, "registry");
		await writeJson(path.join(registryDir, "dead.json"), {
			sessionId: "dead",
			roots: [{ root, updatedAt: new Date().toISOString() }],
		});
		await writeJson(path.join(registryDir, "live.json"), {
			sessionId: "live",
			roots: [{ root, updatedAt: new Date().toISOString() }],
		});
		const deadLease = path.join(root, "sessions", "dead", "lease.json");
		await writeJson(deadLease, lease("dead", DEAD_PID));
		await writeJson(path.join(root, "sessions", "live", "lease.json"), lease("live", ALIVE_PID));

		const ctx = ctxFor(base, registryDir);
		const { records } = await harnessLeasesGcAdapter.collect(ctx);
		const dead = records.find(record => record.id === "dead");
		const live = records.find(record => record.id === "live");
		expect(dead?.removable).toBe(true);
		expect(live?.removable).toBe(false);
		expect(await harnessLeasesGcAdapter.prune(dead!, ctx)).toEqual({ removed: true });
		expect(await fs.exists(deadLease)).toBe(false);
	});
});

describe("registryEntriesGcAdapter", () => {
	test("removes registry files whose session roots are all dangling", async () => {
		const base = await makeTemp();
		const root = path.join(base, "state", "harness");
		const registryDir = path.join(base, "registry");
		const registryFile = path.join(registryDir, "gone.json");
		await writeJson(registryFile, {
			sessionId: "gone",
			roots: [{ root, updatedAt: new Date().toISOString() }],
		});

		const ctx = ctxFor(base, registryDir);
		const { records } = await registryEntriesGcAdapter.collect(ctx);
		const dangling = records.find(record => record.id === "gone");
		expect(dangling?.removable).toBe(true);
		expect(await registryEntriesGcAdapter.prune(dangling!, ctx)).toEqual({ removed: true });
		expect(await fs.exists(registryFile)).toBe(false);
	});
});

describe("teamWorkersGcAdapter", () => {
	test("requires every recorded worker pid to be dead before pruning", async () => {
		const base = await makeTemp();
		const harnessRoot = path.join(base, "state", "harness");
		const teamRoot = path.join(base, "state", "team");
		const registryDir = path.join(base, "registry");
		await writeJson(path.join(registryDir, "team.json"), {
			sessionId: "team",
			roots: [{ root: harnessRoot, updatedAt: new Date().toISOString() }],
		});
		const deadWorker = path.join(teamRoot, "alpha", "workers", "dead");
		const mixedWorker = path.join(teamRoot, "alpha", "workers", "mixed");
		await writeJson(path.join(deadWorker, "heartbeat.json"), { pid: DEAD_PID });
		await writeJson(path.join(deadWorker, "lifecycle.json"), { pid: DEAD_PID, lifecycle_state: "running" });
		await writeJson(path.join(mixedWorker, "heartbeat.json"), { pid: DEAD_PID });
		await writeJson(path.join(mixedWorker, "lifecycle.json"), { pid: ALIVE_PID, lifecycle_state: "failed" });

		const ctx = ctxFor(base, registryDir);
		const { records } = await teamWorkersGcAdapter.collect(ctx);
		const dead = records.find(record => record.id === "alpha/dead");
		const mixed = records.find(record => record.id === "alpha/mixed");
		expect(dead?.removable).toBe(true);
		expect(mixed?.removable).toBe(false);
		expect(await teamWorkersGcAdapter.prune(dead!, ctx)).toEqual({ removed: true });
		expect(await fs.exists(deadWorker)).toBe(false);
	});
});
