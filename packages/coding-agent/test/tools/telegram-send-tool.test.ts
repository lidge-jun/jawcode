import { afterAll, beforeAll, describe, expect, it } from "bun:test";
import { mkdir, mkdtemp, rm, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { Settings } from "@jawcode-dev/coding-agent/config/settings";
import type { ToolSession } from "@jawcode-dev/coding-agent/tools";
import { TelegramSendTool } from "@jawcode-dev/coding-agent/tools/telegram-send";

const BOT_TOKEN = "123456:FAKE-BOT-TOKEN-do-not-log";
const CHAT_ID = "-1009998887776";

/** Minimal settings stub returning notification config values getNotificationConfig reads. */
function settingsStub(overrides: Record<string, unknown> = {}): Settings {
	const base: Record<string, unknown> = {
		"notifications.enabled": true,
		"notifications.telegram.botToken": BOT_TOKEN,
		"notifications.telegram.chatId": CHAT_ID,
		"notifications.redact": false,
		"notifications.verbosity": "lean",
		"notifications.daemon.idleTimeoutMs": 60_000,
		...overrides,
	};
	return { get: (key: string) => base[key] } as unknown as Settings;
}

function fakeSession(opts: { cwd: string; connected?: boolean; settings?: Settings }): ToolSession {
	return {
		cwd: opts.cwd,
		hasUI: false,
		getSessionFile: () => null,
		getSessionSpawns: () => "*",
		settings: opts.settings ?? settingsStub(),
		getNotificationServer: opts.connected === false ? () => undefined : () => ({}) as never,
	} as unknown as ToolSession;
}

/** Counting fake fetch that returns a successful sendDocument/sendPhoto response. */
function countingFetch(): { impl: typeof fetch; calls: () => number } {
	let calls = 0;
	const impl = (async () => {
		calls += 1;
		return new Response(JSON.stringify({ ok: true, result: { message_id: 42 } }), { status: 200 });
	}) as unknown as typeof fetch;
	return { impl, calls: () => calls };
}

let root: string;
let workspace: string;
let insideFile: string;
let emptyFile: string;
let subdir: string;
let outsideFile: string;
let symlinkEscape: string;

beforeAll(async () => {
	root = await mkdtemp(join(tmpdir(), "tg-send-"));
	workspace = join(root, "ws");
	subdir = join(workspace, "sub");
	await mkdir(subdir, { recursive: true });
	insideFile = join(workspace, "report.txt");
	emptyFile = join(workspace, "empty.bin");
	outsideFile = join(root, "secret.txt");
	symlinkEscape = join(workspace, "link.txt");
	await writeFile(insideFile, "hello telegram");
	await writeFile(emptyFile, "");
	await writeFile(outsideFile, "top secret");
	await symlink(outsideFile, symlinkEscape);
});

afterAll(async () => {
	await rm(root, { recursive: true, force: true });
});

describe("TelegramSendTool.createIf — connection gate (done-gate 2)", () => {
	it("returns null when the session has no notification transport", () => {
		const tool = TelegramSendTool.createIf(fakeSession({ cwd: workspace, connected: false }));
		expect(tool).toBeNull();
	});

	it("returns null when Telegram is not configured (no bot token)", () => {
		const session = fakeSession({
			cwd: workspace,
			settings: settingsStub({ "notifications.telegram.botToken": undefined }),
		});
		expect(TelegramSendTool.createIf(session)).toBeNull();
	});

	it("returns null when notifications are disabled", () => {
		const session = fakeSession({
			cwd: workspace,
			settings: settingsStub({ "notifications.enabled": false }),
		});
		expect(TelegramSendTool.createIf(session)).toBeNull();
	});

	it("constructs the tool when connected and configured", () => {
		const tool = TelegramSendTool.createIf(fakeSession({ cwd: workspace }));
		expect(tool).not.toBeNull();
		expect(tool?.name).toBe("telegram_send");
	});
});

describe("TelegramSendTool.execute — egress safety", () => {
	it("sends an in-workspace file and never leaks the token", async () => {
		const { impl, calls } = countingFetch();
		const tool = new TelegramSendTool(fakeSession({ cwd: workspace }), { fetchImpl: impl });
		const result = await tool.execute("call-1", { path: "report.txt" });
		expect(calls()).toBe(1);
		expect(result.isError).toBeUndefined();
		expect(result.details?.sent).toBe(true);
		expect(result.details?.method).toBe("sendDocument");
		expect(result.details?.relativePath).toBe("report.txt");
		const text = result.content.map(c => ("text" in c ? c.text : "")).join("");
		expect(text).not.toContain(BOT_TOKEN);
		expect(JSON.stringify(result.details)).not.toContain(BOT_TOKEN);
	});

	it("rejects an absolute path outside the workspace without any egress", async () => {
		const { impl, calls } = countingFetch();
		const tool = new TelegramSendTool(fakeSession({ cwd: workspace }), { fetchImpl: impl });
		const result = await tool.execute("call-2", { path: outsideFile });
		expect(calls()).toBe(0);
		expect(result.isError).toBe(true);
		expect(result.details?.rejected).toBe("outside_workspace");
	});

	it("rejects a relative-escape path without any egress", async () => {
		const { impl, calls } = countingFetch();
		const tool = new TelegramSendTool(fakeSession({ cwd: workspace }), { fetchImpl: impl });
		const result = await tool.execute("call-3", { path: "../secret.txt" });
		expect(calls()).toBe(0);
		expect(result.isError).toBe(true);
		expect(result.details?.rejected).toBe("outside_workspace");
	});

	it("rejects a symlink that escapes the workspace without any egress", async () => {
		const { impl, calls } = countingFetch();
		const tool = new TelegramSendTool(fakeSession({ cwd: workspace }), { fetchImpl: impl });
		const result = await tool.execute("call-4", { path: "link.txt" });
		expect(calls()).toBe(0);
		expect(result.isError).toBe(true);
		expect(result.details?.rejected).toBe("outside_workspace");
	});

	it("rejects a directory without any egress", async () => {
		const { impl, calls } = countingFetch();
		const tool = new TelegramSendTool(fakeSession({ cwd: workspace }), { fetchImpl: impl });
		const result = await tool.execute("call-5", { path: "sub" });
		expect(calls()).toBe(0);
		expect(result.isError).toBe(true);
		expect(result.details?.rejected).toBe("not_regular_file");
	});

	it("rejects a missing file without any egress", async () => {
		const { impl, calls } = countingFetch();
		const tool = new TelegramSendTool(fakeSession({ cwd: workspace }), { fetchImpl: impl });
		const result = await tool.execute("call-6", { path: "nope.txt" });
		expect(calls()).toBe(0);
		expect(result.isError).toBe(true);
		expect(result.details?.rejected).toBe("file_not_found");
	});

	it("rejects an empty file via media policy before any egress", async () => {
		const { impl, calls } = countingFetch();
		const tool = new TelegramSendTool(fakeSession({ cwd: workspace }), { fetchImpl: impl });
		const result = await tool.execute("call-7", { path: "empty.bin" });
		expect(calls()).toBe(0);
		expect(result.isError).toBe(true);
		expect(result.details?.rejected).toBe("empty_file");
	});
});
