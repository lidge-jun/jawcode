import { describe, expect, it } from "bun:test";
import * as fs from "node:fs/promises";
import * as os from "node:os";
import * as path from "node:path";
import {
	clearDaemonControl,
	type DaemonControlRequest,
	daemonControlPath,
	decideDaemonControl,
	readDaemonControl,
	writeDaemonControl,
} from "../src/notifications/daemon-control";
import type { TransportOwnerState } from "../src/notifications/transport-state";

function owner(overrides: Partial<TransportOwnerState> = {}): TransportOwnerState {
	return {
		version: 1,
		ownerId: "owner-A",
		pid: 100,
		startedAt: 1_000,
		heartbeatAt: 1_000,
		tokenFingerprint: "tok",
		chatIdFingerprint: "chat",
		...overrides,
	};
}

function request(overrides: Partial<DaemonControlRequest> = {}): DaemonControlRequest {
	return { version: 1, kind: "stop", targetOwnerId: "owner-A", requestedAt: 2_000, ...overrides };
}

describe("decideDaemonControl", () => {
	it("ignores when there is no request", () => {
		expect(decideDaemonControl({ current: owner(), request: null })).toEqual({
			action: "ignore",
			reason: "no-request",
		});
	});

	it("ignores when there is no owner", () => {
		expect(decideDaemonControl({ current: null, request: request() })).toEqual({
			action: "ignore",
			reason: "owner-mismatch",
		});
	});

	it("ignores a request that targets a different owner (no newer-owner clobber)", () => {
		expect(decideDaemonControl({ current: owner({ ownerId: "owner-B" }), request: request() })).toEqual({
			action: "ignore",
			reason: "owner-mismatch",
		});
	});

	it("ignores a stale request that predates the current owner", () => {
		expect(
			decideDaemonControl({ current: owner({ startedAt: 5_000 }), request: request({ requestedAt: 1_000 }) }),
		).toEqual({ action: "ignore", reason: "stale-request" });
	});

	it("honors stop and reload for the matching owner", () => {
		expect(decideDaemonControl({ current: owner(), request: request({ kind: "stop" }) })).toEqual({
			action: "honor-stop",
			reason: "owner-match",
		});
		expect(decideDaemonControl({ current: owner(), request: request({ kind: "reload" }) })).toEqual({
			action: "honor-reload",
			reason: "owner-match",
		});
	});
});

describe("daemon control file I/O", () => {
	it("writes (0600), reads back, and clears idempotently", async () => {
		const agentDir = await fs.mkdtemp(path.join(os.tmpdir(), "jwc-daemon-control-"));
		try {
			expect(await readDaemonControl(agentDir)).toBeNull();
			await writeDaemonControl(agentDir, request({ kind: "reload", requestedAt: 4_000 }));
			expect(await readDaemonControl(agentDir)).toEqual(request({ kind: "reload", requestedAt: 4_000 }));
			if (process.platform !== "win32") {
				expect((await fs.stat(daemonControlPath(agentDir))).mode & 0o777).toBe(0o600);
			}
			await clearDaemonControl(agentDir);
			await clearDaemonControl(agentDir); // idempotent
			expect(await readDaemonControl(agentDir)).toBeNull();
		} finally {
			await fs.rm(agentDir, { recursive: true, force: true });
		}
	});
});
