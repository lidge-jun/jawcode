import { afterEach, describe, expect, test } from "bun:test";
import {
	collectGcReport,
	computeExitCode,
	defaultGcAdapters,
	type GcContext,
	type GcPidProbe,
	type GcRecord,
	type GcStoreAdapter,
	gcPidProbe,
	runJwcGcCommand,
} from "@jawcode-dev/coding-agent/jwc-runtime/gc-runtime";

const originalKill = process.kill.bind(process);

afterEach(() => {
	process.kill = originalKill;
});

function stubKill(impl: (pid: number) => void): void {
	process.kill = ((pid: number, _sig?: string | number) => {
		impl(pid);
		return true;
	}) as typeof process.kill;
}

function errnoError(code: string): NodeJS.ErrnoException {
	const err = new Error(code) as NodeJS.ErrnoException;
	err.code = code;
	return err;
}

const keepProbe: GcPidProbe = () => ({ status: "keep", reason: "alive" });

function fakeAdapter(
	store: GcStoreAdapter["store"],
	records: GcRecord[],
	prune?: (record: GcRecord) => Promise<{ removed: boolean; error?: string; skipped?: string }>,
): GcStoreAdapter {
	return {
		store,
		async collect() {
			return { records: records.map(r => ({ ...r })), errors: [] };
		},
		async prune(record) {
			return prune ? prune(record) : { removed: true };
		},
	};
}

function ctx(probe: GcPidProbe = keepProbe): GcContext {
	return { probe, force: false, env: {}, cwd: "/tmp" };
}

function record(over: Partial<GcRecord> = {}): GcRecord {
	return {
		store: "file_locks",
		id: over.id ?? "r1",
		status: over.status ?? "dead",
		stale: over.stale ?? true,
		removable: over.removable ?? true,
		action: "none",
		reason: over.reason ?? "test",
		...over,
	};
}

describe("gcPidProbe (liveness-only, fail-closed)", () => {
	test("alive process => keep/alive", () => {
		stubKill(() => {});
		expect(gcPidProbe(1234)).toEqual({ status: "keep", reason: "alive" });
	});

	test("ESRCH => dead (the only removable status)", () => {
		stubKill(() => {
			throw errnoError("ESRCH");
		});
		expect(gcPidProbe(1234)).toEqual({ status: "dead" });
	});

	test("EPERM => keep/eperm", () => {
		stubKill(() => {
			throw errnoError("EPERM");
		});
		expect(gcPidProbe(1234)).toEqual({ status: "keep", reason: "eperm" });
	});

	test("invalid pid => keep/unknown", () => {
		expect(gcPidProbe(0).status).toBe("keep");
		expect(gcPidProbe(-1).reason).toBe("unknown");
	});
});

describe("collectGcReport dry-run vs prune", () => {
	test("dry-run marks removable records would_remove and deletes nothing", async () => {
		const adapter = fakeAdapter("file_locks", [record({ id: "dead-1" })]);
		const report = await collectGcReport([adapter], ctx(), false);
		expect(report.dry_run).toBe(true);
		expect(report.stores.file_locks[0].action).toBe("would_remove");
		expect(report.counts.would_remove).toBe(1);
		expect(report.counts.removed).toBe(0);
	});

	test("prune removes removable records and counts them", async () => {
		const adapter = fakeAdapter("file_locks", [record({ id: "dead-1" })]);
		const report = await collectGcReport([adapter], ctx(), true);
		expect(report.dry_run).toBe(false);
		expect(report.stores.file_locks[0].action).toBe("removed");
		expect(report.counts.removed).toBe(1);
	});

	test("prune respects skipped outcome (TOCTOU became live)", async () => {
		const adapter = fakeAdapter("file_locks", [record({ id: "race" })], async () => ({
			removed: false,
			skipped: "became_live",
		}));
		const report = await collectGcReport([adapter], ctx(), true);
		expect(report.stores.file_locks[0].action).toBe("skipped");
		expect(report.stores.file_locks[0].reason).toBe("became_live");
		expect(report.counts.removed).toBe(0);
	});

	test("non-removable records are kept", async () => {
		const adapter = fakeAdapter("file_locks", [record({ id: "live", removable: false, stale: false })]);
		const report = await collectGcReport([adapter], ctx(), true);
		expect(report.stores.file_locks[0].action).toBe("none");
		expect(report.counts.would_remove).toBe(0);
	});
});

describe("computeExitCode", () => {
	test("clean dry-run => 0", async () => {
		const report = await collectGcReport([fakeAdapter("file_locks", [])], ctx(), false);
		expect(computeExitCode(report)).toBe(0);
	});

	test("prune failure => 1", async () => {
		const adapter = fakeAdapter("file_locks", [record({ id: "x" })], async () => ({
			removed: false,
			error: "boom",
		}));
		const report = await collectGcReport([adapter], ctx(), true);
		expect(report.counts.failed).toBe(1);
		expect(computeExitCode(report)).toBe(1);
	});
});

describe("runJwcGcCommand arg parsing + branding", () => {
	test("--help emits jwc gc help, status 0", async () => {
		const res = await runJwcGcCommand(["--help"], "/tmp", {}, []);
		expect(res.status).toBe(0);
		expect(res.stdout).toContain("jwc gc");
		expect(res.stdout).not.toContain("gjc gc");
	});

	test("unknown flag => status 2 usage error", async () => {
		const res = await runJwcGcCommand(["--nope"], "/tmp", {}, []);
		expect(res.status).toBe(2);
		expect(res.stderr).toContain("jwc gc:");
		expect(res.stderr).toContain("unknown_flag:--nope");
	});

	test("--dry-run overrides --prune", async () => {
		const adapter = fakeAdapter("file_locks", [record({ id: "d" })]);
		const res = await runJwcGcCommand(["--prune", "--dry-run", "--json"], "/tmp", {}, [adapter]);
		const report = JSON.parse(res.stdout);
		expect(report.dry_run).toBe(true);
		expect(report.stores.file_locks[0].action).toBe("would_remove");
	});
});

describe("defaultGcAdapters wires only file_locks this phase", () => {
	test("returns exactly the file_locks adapter", () => {
		const adapters = defaultGcAdapters();
		expect(adapters.map(a => a.store)).toEqual(["file_locks"]);
	});
});
