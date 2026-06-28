import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import * as fs from "node:fs/promises";
import * as os from "node:os";
import * as path from "node:path";
import { Settings } from "../src/config/settings";
import { readNotificationDiscoveryRecord } from "../src/notifications/discovery";
import type { NotificationLoopbackServer } from "../src/notifications/server";
import { maybeStartNotificationServer } from "../src/notifications/session-lifecycle";

const ENV_KEYS = [
	"JWC_NOTIFICATIONS",
	"GJC_NOTIFICATIONS",
	"JWC_NOTIFICATIONS_TOKEN",
	"GJC_NOTIFICATIONS_TOKEN",
	"JWC_NOTIFICATIONS_CHAT_ID",
	"GJC_NOTIFICATIONS_CHAT_ID",
] as const;

const savedEnv = new Map<string, string | undefined>();

beforeEach(() => {
	for (const key of ENV_KEYS) {
		savedEnv.set(key, Bun.env[key]);
		delete Bun.env[key];
	}
});

afterEach(() => {
	for (const key of ENV_KEYS) {
		const value = savedEnv.get(key);
		if (value === undefined) delete Bun.env[key];
		else Bun.env[key] = value;
	}
});

function enabledSettings(): Settings {
	return Settings.isolated({
		"notifications.enabled": true,
		"notifications.telegram.botToken": "test-bot-token",
		"notifications.telegram.chatId": "test-chat-id",
	});
}

function cleanupCollector(): {
	registerCleanup: (name: string, cleanup: () => Promise<void> | void) => void;
	cleanups: Map<string, () => Promise<void> | void>;
} {
	const cleanups = new Map<string, () => Promise<void> | void>();
	return { cleanups, registerCleanup: (name, cleanup) => cleanups.set(name, cleanup) };
}

describe("notification session lifecycle", () => {
	it("skips when notifications are disabled", async () => {
		const { registerCleanup, cleanups } = cleanupCollector();
		const server = await maybeStartNotificationServer({
			settings: Settings.isolated({ "notifications.enabled": false }),
			sessionId: "session-disabled",
			cwd: "/tmp/does-not-matter",
			registerCleanup,
		});
		expect(server).toBeNull();
		expect(cleanups.size).toBe(0);
	});

	it("skips subagent sessions even when enabled", async () => {
		const { registerCleanup, cleanups } = cleanupCollector();
		const server = await maybeStartNotificationServer({
			settings: enabledSettings(),
			sessionId: "session-subagent",
			cwd: "/tmp/does-not-matter",
			taskDepth: 1,
			registerCleanup,
		});
		expect(server).toBeNull();
		expect(cleanups.size).toBe(0);
	});

	it("starts the server, writes discovery, and registers a stop cleanup when enabled", async () => {
		const cwd = await fs.mkdtemp(path.join(os.tmpdir(), "jwc-notif-lifecycle-"));
		const { registerCleanup, cleanups } = cleanupCollector();
		let server: NotificationLoopbackServer | null = null;
		try {
			server = await maybeStartNotificationServer({
				settings: enabledSettings(),
				sessionId: "session-live",
				cwd,
				taskDepth: 0,
				registerCleanup,
			});
			expect(server).not.toBeNull();
			const stateRoot = path.join(cwd, ".jwc", "state");
			expect(await readNotificationDiscoveryRecord(stateRoot, "session-live")).not.toBeNull();
			expect(cleanups.has("notifications")).toBe(true);

			await cleanups.get("notifications")?.();
			expect(await readNotificationDiscoveryRecord(stateRoot, "session-live")).toBeNull();
		} finally {
			await server?.stop();
			await fs.rm(cwd, { recursive: true, force: true });
		}
	});

	it("swallows a start failure without throwing or registering cleanup", async () => {
		const { registerCleanup, cleanups } = cleanupCollector();
		const failingStart = (async () => {
			throw new Error("boom");
		}) as typeof import("../src/notifications/server").NotificationLoopbackServer.start;

		const server = await maybeStartNotificationServer({
			settings: enabledSettings(),
			sessionId: "session-fail",
			cwd: "/tmp/does-not-matter",
			registerCleanup,
			startServer: failingStart,
		});
		expect(server).toBeNull();
		expect(cleanups.size).toBe(0);
	});
});
