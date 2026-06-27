import { describe, expect, it } from "bun:test";
import * as fs from "node:fs/promises";
import * as os from "node:os";
import * as path from "node:path";
import { type NotificationEndpointRecord, writeNotificationDiscoveryRecord } from "../src/notifications/discovery";
import {
	decideTransportInbound,
	safeReadTransportEndpoint,
	scanTransportSessions,
} from "../src/notifications/transport-shell";
import { registerTransportRoot } from "../src/notifications/transport-state";

function record(sessionId: string): NotificationEndpointRecord {
	return {
		version: 1,
		sessionId,
		url: "ws://127.0.0.1:1234",
		host: "127.0.0.1",
		port: 1234,
		token: "transport-token-secret",
		startedAt: 1782586800000,
		updatedAt: 1782586800000,
		pid: 456,
	};
}

describe("notification transport shell", () => {
	it("scans registered discovery roots into inert masked observations", async () => {
		const agentDir = await fs.mkdtemp(path.join(os.tmpdir(), "jwc-transport-scan-agent-"));
		const stateRoot = await fs.mkdtemp(path.join(os.tmpdir(), "jwc-transport-scan-state-"));
		try {
			await writeNotificationDiscoveryRecord(stateRoot, record("session-1"));
			await registerTransportRoot(agentDir, stateRoot, 1782586800000);

			const result = await scanTransportSessions({ agentDir });

			expect(result.errors).toEqual([]);
			expect(result.observations).toEqual([
				{
					sessionId: "session-1",
					url: "ws://127.0.0.1:1234",
					tokenMasked: "tran...(len 22)",
					inboundMode: "drop",
				},
			]);
			expect(JSON.stringify(result)).not.toContain("transport-token-secret");
		} finally {
			await fs.rm(agentDir, { recursive: true, force: true });
			await fs.rm(stateRoot, { recursive: true, force: true });
		}
	});

	it("bounds malformed discovery file errors without aborting the scan or leaking tokens", async () => {
		const agentDir = await fs.mkdtemp(path.join(os.tmpdir(), "jwc-transport-errors-agent-"));
		const stateRoot = await fs.mkdtemp(path.join(os.tmpdir(), "jwc-transport-errors-state-"));
		try {
			await writeNotificationDiscoveryRecord(stateRoot, record("good-session"));
			const notificationDir = path.join(stateRoot, "notifications");
			await fs.writeFile(path.join(notificationDir, "bad-json.json"), "{not json", "utf8");
			await fs.writeFile(path.join(notificationDir, "../bad.json"), "{}", "utf8");
			await fs.writeFile(
				path.join(notificationDir, "invalid-record.json"),
				JSON.stringify({ token: "raw-token" }),
				"utf8",
			);
			await registerTransportRoot(agentDir, stateRoot, 1782586800000);

			const result = await scanTransportSessions({ agentDir });

			expect(result.observations).toHaveLength(1);
			expect(result.errors.map(error => error.code).sort()).toEqual(["invalid_json", "invalid_record"]);
			expect(JSON.stringify(result)).not.toContain("raw-token");
			expect(JSON.stringify(result)).not.toContain("transport-token-secret");
		} finally {
			await fs.rm(agentDir, { recursive: true, force: true });
			await fs.rm(stateRoot, { recursive: true, force: true });
		}
	});

	it("returns unsafe-session and read-failed errors through safe read", async () => {
		const stateRoot = await fs.mkdtemp(path.join(os.tmpdir(), "jwc-transport-safe-read-"));
		try {
			const unsafe = await safeReadTransportEndpoint(
				stateRoot,
				path.join(stateRoot, "notifications", "bad session.json"),
			);
			const missing = await safeReadTransportEndpoint(
				stateRoot,
				path.join(stateRoot, "notifications", "missing.json"),
			);

			expect(unsafe).toEqual({
				ok: false,
				error: {
					sessionId: "bad session",
					file: path.join(stateRoot, "notifications", "bad session.json"),
					code: "unsafe_session_id",
				},
			});
			expect(missing).toEqual({
				ok: false,
				error: {
					sessionId: "missing",
					file: path.join(stateRoot, "notifications", "missing.json"),
					code: "read_failed",
				},
			});
		} finally {
			await fs.rm(stateRoot, { recursive: true, force: true });
		}
	});

	it("drops inbound messages until authorization and answer routing exist", () => {
		expect(decideTransportInbound()).toEqual({ mode: "drop", reason: "authorization_not_implemented" });
	});
});
