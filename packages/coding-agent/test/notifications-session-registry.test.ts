import { describe, expect, it } from "bun:test";
import * as fs from "node:fs/promises";
import * as os from "node:os";
import * as path from "node:path";
import {
	type NotificationEndpointRecord,
	readNotificationDiscoveryRecord,
	writeNotificationDiscoveryRecord,
} from "../src/notifications/discovery";
import {
	markStaleNotificationDiscoveryRecord,
	type NotificationConnectSnapshot,
	NotificationSessionRegistry,
} from "../src/notifications/session-registry";

function registry(): NotificationSessionRegistry {
	return new NotificationSessionRegistry({
		sessionId: "session-1",
		connectToken: "connect-token",
	});
}

function endpointRecord(sessionId: string): NotificationEndpointRecord {
	return {
		version: 1,
		sessionId,
		url: "ws://127.0.0.1:1234",
		host: "127.0.0.1",
		port: 1234,
		token: "connect-token",
		startedAt: 1782586800000,
		updatedAt: 1782586800000,
		pid: 123,
	};
}

function expectSnapshot(value: ReturnType<NotificationSessionRegistry["connect"]>): NotificationConnectSnapshot {
	expect("rejected" in value).toBe(false);
	if ("rejected" in value) throw new Error("expected authorized snapshot");
	return value;
}

describe("notification session registry", () => {
	it("rejects missing or wrong connect tokens without replaying pending actions", () => {
		const session = registry();
		session.enqueueAction({ actionId: "action-1", prompt: "Deploy?", options: ["Deploy", "Skip"] });

		expect(session.connect(undefined)).toEqual({ rejected: true, reason: "unauthorized" });
		expect(session.connect("wrong")).toEqual({ rejected: true, reason: "unauthorized" });
		expect(JSON.stringify(session.connect("wrong"))).not.toContain("connect-token");
	});

	it("returns hello and unresolved action replay for authorized connects", () => {
		const session = registry();
		session.enqueueAction({ actionId: "action-1", prompt: "Deploy?", options: ["Deploy", "Skip"] });

		const snapshot = expectSnapshot(session.connect("connect-token"));

		expect(snapshot).toEqual({
			sessionId: "session-1",
			frames: [
				{ type: "hello", version: 1, sessionId: "session-1" },
				{ type: "action_needed", actionId: "action-1", prompt: "Deploy?", options: ["Deploy", "Skip"] },
			],
		});
		expect(JSON.stringify(snapshot)).not.toContain("connect-token");
	});

	it("maps remote accepted, idempotent replay, and local-won races to wire frames", () => {
		const session = registry();
		session.enqueueAction({ actionId: "action-1", prompt: "Deploy?", options: ["Deploy"], allowFreeText: false });

		expect(
			session.resolveRemote({
				sessionId: "session-1",
				actionId: "action-1",
				idempotencyKey: "idem-1",
				transport: "telegram",
				kind: "button",
				value: "1. Deploy",
				presentedToken: "connect-token",
			}),
		).toEqual({ type: "action_resolved", actionId: "action-1" });
		expect(
			session.resolveRemote({
				sessionId: "session-1",
				actionId: "action-1",
				idempotencyKey: "idem-1",
				transport: "telegram",
				kind: "button",
				value: "1. Deploy",
				presentedToken: "connect-token",
			}),
		).toEqual({ type: "action_resolved", actionId: "action-1" });
		expect(
			session.resolveRemote({
				sessionId: "session-1",
				actionId: "action-1",
				idempotencyKey: "idem-2",
				transport: "telegram",
				kind: "button",
				value: "1. Deploy",
				presentedToken: "connect-token",
			}),
		).toEqual({
			type: "reply_rejected",
			actionId: "action-1",
			reason: "already_answered",
			source: "telegram",
		});

		const local = registry();
		local.enqueueAction({ actionId: "local-action", prompt: "Deploy?", options: ["Deploy"] });
		expect(local.resolveLocal("local-action")).toEqual({ type: "action_resolved", actionId: "local-action" });
		expect(
			local.resolveRemote({
				sessionId: "session-1",
				actionId: "local-action",
				idempotencyKey: "idem-local",
				transport: "telegram",
				kind: "button",
				value: "Deploy",
				presentedToken: "connect-token",
			}),
		).toEqual({
			type: "reply_rejected",
			actionId: "local-action",
			reason: "already_answered",
			source: "telegram",
		});
	});

	it("marks discovery records stale through private discovery helpers", async () => {
		const root = await fs.mkdtemp(path.join(os.tmpdir(), "jwc-notifications-stale-"));
		try {
			await writeNotificationDiscoveryRecord(root, endpointRecord("session-1"));

			const stale = await markStaleNotificationDiscoveryRecord(root, "session-1", 1782586805000);

			expect(stale).toMatchObject({ sessionId: "session-1", stale: true, stoppedAt: 1782586805000 });
			expect(await readNotificationDiscoveryRecord(root, "session-1")).toMatchObject({
				sessionId: "session-1",
				stale: true,
				updatedAt: 1782586805000,
				stoppedAt: 1782586805000,
			});
			if (process.platform !== "win32") {
				const file = path.join(root, "notifications", "session-1.json");
				expect((await fs.stat(file)).mode & 0o777).toBe(0o600);
			}
			expect(await markStaleNotificationDiscoveryRecord(root, "missing", 1)).toBeNull();
		} finally {
			await fs.rm(root, { recursive: true, force: true });
		}
	});
});
