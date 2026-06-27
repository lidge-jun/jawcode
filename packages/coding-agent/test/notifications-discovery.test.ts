import { describe, expect, it } from "bun:test";
import * as fs from "node:fs/promises";
import * as os from "node:os";
import * as path from "node:path";
import {
	type NotificationEndpointRecord,
	notificationDiscoveryDir,
	notificationDiscoveryPath,
	readNotificationDiscoveryRecord,
	removeNotificationDiscoveryRecord,
	toNotificationEndpointDisplay,
	writeNotificationDiscoveryRecord,
} from "../src/notifications/discovery";

function record(sessionId: string): NotificationEndpointRecord {
	return {
		version: 1,
		sessionId,
		url: "ws://127.0.0.1:1234",
		host: "127.0.0.1",
		port: 1234,
		token: "token-secret",
		startedAt: 1782586800000,
		updatedAt: 1782586800000,
		pid: 123,
		stale: false,
	};
}

describe("notification discovery", () => {
	it("writes EndpointRecord-shaped files under a safe session path", async () => {
		const root = await fs.mkdtemp(path.join(os.tmpdir(), "jwc-notifications-"));
		try {
			const file = await writeNotificationDiscoveryRecord(root, record("session-1"));

			expect(file).toBe(notificationDiscoveryPath(root, "session-1"));
			expect(await readNotificationDiscoveryRecord(root, "session-1")).toEqual(record("session-1"));
			await expect(readNotificationDiscoveryRecord(root, "../bad")).rejects.toThrow("unsafe_session_id");
		} finally {
			await fs.rm(root, { recursive: true, force: true });
		}
	});

	it("uses private directory and file permissions on unix", async () => {
		const root = await fs.mkdtemp(path.join(os.tmpdir(), "jwc-notifications-mode-"));
		try {
			const file = await writeNotificationDiscoveryRecord(root, record("session-2"));
			if (process.platform !== "win32") {
				const dirMode = (await fs.stat(notificationDiscoveryDir(root))).mode & 0o777;
				const fileMode = (await fs.stat(file)).mode & 0o777;
				expect(dirMode).toBe(0o700);
				expect(fileMode).toBe(0o600);
			}
		} finally {
			await fs.rm(root, { recursive: true, force: true });
		}
	});

	it("masks tokens for display and removes records idempotently", async () => {
		const root = await fs.mkdtemp(path.join(os.tmpdir(), "jwc-notifications-display-"));
		try {
			await writeNotificationDiscoveryRecord(root, record("session-3"));
			const stored = await readNotificationDiscoveryRecord(root, "session-3");
			expect(stored).not.toBeNull();
			const display = toNotificationEndpointDisplay(stored!);
			expect(display.tokenMasked).toBe("toke...(len 12)");
			expect(JSON.stringify(display)).not.toContain("token-secret");

			await removeNotificationDiscoveryRecord(root, "session-3");
			await removeNotificationDiscoveryRecord(root, "session-3");
			expect(await readNotificationDiscoveryRecord(root, "session-3")).toBeNull();
		} finally {
			await fs.rm(root, { recursive: true, force: true });
		}
	});
});
