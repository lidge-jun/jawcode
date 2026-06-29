import { afterEach, describe, expect, it } from "bun:test";
import { Settings } from "../src/config/settings";
import {
	getNotificationConfig,
	isNotificationConnectTokenAccepted,
	maskChatId,
	maskToken,
	toNotificationStatusJson,
} from "../src/notifications/config";

const ENV_KEYS = [
	"JWC_NOTIFICATIONS",
	"GJC_NOTIFICATIONS",
	"JWC_NOTIFICATIONS_TOKEN",
	"GJC_NOTIFICATIONS_TOKEN",
	"JWC_NOTIFICATIONS_CHAT_ID",
	"GJC_NOTIFICATIONS_CHAT_ID",
] as const;

const savedEnv = new Map<string, string | undefined>();

for (const key of ENV_KEYS) {
	savedEnv.set(key, Bun.env[key]);
}

afterEach(() => {
	for (const key of ENV_KEYS) {
		const value = savedEnv.get(key);
		if (value === undefined) delete Bun.env[key];
		else Bun.env[key] = value;
	}
});

function clearNotificationEnv(): void {
	for (const key of ENV_KEYS) {
		delete Bun.env[key];
	}
}

describe("notification config", () => {
	it("masks token and chat id without exposing raw values", () => {
		expect(maskToken("1234567890")).toBe("1234...(len 10)");
		expect(maskChatId("987654321")).toBe("98...21(len 9)");
		expect(maskChatId("123")).toBe("(set)");
	});

	it("requires complete token and chat config before enablement", () => {
		clearNotificationEnv();
		Bun.env.JWC_NOTIFICATIONS = "1";
		Bun.env.JWC_NOTIFICATIONS_TOKEN = "token-only";
		const settings = Settings.isolated({ "notifications.enabled": true });

		const config = getNotificationConfig(settings);

		expect(config.envRequested).toBe(true);
		expect(config.configured).toBe(false);
		expect(config.enabled).toBe(false);
	});

	it("lets JWC env override settings and legacy GJC fallback", () => {
		clearNotificationEnv();
		Bun.env.GJC_NOTIFICATIONS = "1";
		Bun.env.GJC_NOTIFICATIONS_TOKEN = "legacy-token";
		Bun.env.GJC_NOTIFICATIONS_CHAT_ID = "legacy-chat";
		Bun.env.JWC_NOTIFICATIONS_TOKEN = "jwc-token";
		const settings = Settings.isolated({
			"notifications.enabled": false,
			"notifications.telegram.botToken": "settings-token",
			"notifications.telegram.chatId": "settings-chat",
		});

		const config = getNotificationConfig(settings);

		expect(config.enabled).toBe(true);
		expect(config.botToken).toBe("jwc-token");
		expect(config.chatId).toBe("legacy-chat");
	});

	it("hard opt-out wins over complete settings", () => {
		clearNotificationEnv();
		Bun.env.JWC_NOTIFICATIONS = "0";
		const settings = Settings.isolated({
			"notifications.enabled": true,
			"notifications.telegram.botToken": "settings-token",
			"notifications.telegram.chatId": "settings-chat",
		});

		const config = getNotificationConfig(settings);

		expect(config.hardDisabled).toBe(true);
		expect(config.configured).toBe(true);
		expect(config.enabled).toBe(false);
	});

	it("renders stable status json with masked secrets", () => {
		clearNotificationEnv();
		const settings = Settings.isolated({
			"notifications.enabled": true,
			"notifications.telegram.botToken": "abcd-secret",
			"notifications.telegram.chatId": "chat-secret",
			"notifications.redact": false,
			"notifications.verbosity": "verbose",
			"notifications.daemon.idleTimeoutMs": 42,
		});

		const status = toNotificationStatusJson(getNotificationConfig(settings));

		expect(status).toEqual({
			enabled: true,
			configured: true,
			botTokenMasked: "abcd...(len 11)",
			chatIdMasked: "ch...et(len 11)",
			redact: false,
			verbosity: "verbose",
			idleTimeoutMs: 42,
		});
		expect(JSON.stringify(status)).not.toContain("abcd-secret");
		expect(JSON.stringify(status)).not.toContain("chat-secret");
	});

	it("accepts only the exact presented connect token", () => {
		expect(isNotificationConnectTokenAccepted("secret-token", "secret-token")).toBe(true);
		expect(isNotificationConnectTokenAccepted("secret-token", "wrong-token")).toBe(false);
		expect(isNotificationConnectTokenAccepted("secret-token", undefined)).toBe(false);
		expect(isNotificationConnectTokenAccepted("secret-token", "")).toBe(false);
	});
});
