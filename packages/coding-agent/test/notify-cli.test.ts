import { afterEach, beforeEach, describe, expect, it, vi } from "bun:test";
import * as fs from "node:fs/promises";
import * as os from "node:os";
import * as path from "node:path";
import { getConfigRootDir, setAgentDir } from "@jawcode-dev/utils";
import { parseNotifyFlags, runNotifyCommand } from "../src/cli/notify-cli";
import { resetSettingsForTest } from "../src/config/settings";

let testAgentDir = "";
const originalAgentDir = process.env.GJC_CODING_AGENT_DIR;
const fallbackAgentDir = path.join(getConfigRootDir(), "agent");

beforeEach(async () => {
	resetSettingsForTest();
	testAgentDir = await fs.mkdtemp(path.join(os.tmpdir(), "jwc-notify-cli-"));
	setAgentDir(testAgentDir);
});

afterEach(async () => {
	vi.restoreAllMocks();
	resetSettingsForTest();
	if (originalAgentDir) {
		setAgentDir(originalAgentDir);
	} else {
		setAgentDir(fallbackAgentDir);
		delete process.env.GJC_CODING_AGENT_DIR;
	}
	await fs.rm(testAgentDir, { recursive: true, force: true });
});

describe("notify CLI", () => {
	it("prints status without raw secrets", async () => {
		const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});

		await runNotifyCommand({
			action: "setup",
			token: "abcd-secret-token",
			chatId: "chat-secret-id",
			flags: {},
		});
		await runNotifyCommand({ action: "status", flags: {} });

		const output = logSpy.mock.calls.map(call => String(call[0] ?? "")).join("\n");
		expect(output).toContain("Bot token: abcd...(len 17)");
		expect(output).toContain("Chat id: ch...id(len 14)");
		expect(output).not.toContain("abcd-secret-token");
		expect(output).not.toContain("chat-secret-id");
	});

	it("emits stable json status with masked fields", async () => {
		const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});

		await runNotifyCommand({
			action: "setup",
			token: "wxyz-secret-token",
			chatId: "chat-json-secret",
			redact: false,
			verbosity: "verbose",
			flags: { json: true },
		});

		const payload = String(logSpy.mock.calls.at(-1)?.[0] ?? "");
		const parsed = JSON.parse(payload) as {
			enabled: boolean;
			configured: boolean;
			botTokenMasked: string;
			chatIdMasked: string;
			redact: boolean;
			verbosity: string;
			idleTimeoutMs: number;
		};
		expect(parsed).toMatchObject({
			enabled: true,
			configured: true,
			botTokenMasked: "wxyz...(len 17)",
			chatIdMasked: "ch...et(len 16)",
			redact: false,
			verbosity: "verbose",
			idleTimeoutMs: 300000,
		});
		expect(payload).not.toContain("wxyz-secret-token");
		expect(payload).not.toContain("chat-json-secret");
	});

	it("requires token and chat id for setup", async () => {
		await expect(runNotifyCommand({ action: "setup", token: "token", flags: {} })).rejects.toThrow(
			"Usage: jwc notify setup --token <token> --chat-id <id>",
		);
	});

	it("parses explicit redact boolean values", () => {
		expect(parseNotifyFlags({ redact: "true" }).redact).toBe(true);
		expect(parseNotifyFlags({ redact: "false" }).redact).toBe(false);
		expect(() => parseNotifyFlags({ redact: "maybe" })).toThrow("Invalid redact");
	});

	it("verify accepts a private chat and labels threaded mode without leaking the token", async () => {
		const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});
		await runNotifyCommand({
			action: "verify",
			token: "verify-secret-token",
			chatId: "private-chat",
			flags: {},
			fetchImpl: (async () =>
				new Response(JSON.stringify({ ok: true, result: { type: "private" } }))) as unknown as typeof fetch,
		});
		const output = logSpy.mock.calls.map(call => String(call[0] ?? "")).join("\n");
		expect(output).toContain("Pairing: accepted (private chat)");
		expect(output).toContain("Threaded Mode: unknown");
		expect(output).not.toContain("verify-secret-token");
	});

	it("verify rejects a non-private chat pairing", async () => {
		vi.spyOn(console, "log").mockImplementation(() => {});
		await expect(
			runNotifyCommand({
				action: "verify",
				token: "t",
				chatId: "group-chat",
				flags: {},
				fetchImpl: (async () =>
					new Response(JSON.stringify({ ok: true, result: { type: "supergroup" } }))) as unknown as typeof fetch,
			}),
		).rejects.toThrow(/not a private chat/);
	});
});
