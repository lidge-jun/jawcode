import { describe, expect, it } from "bun:test";
import * as fs from "node:fs/promises";
import * as os from "node:os";
import * as path from "node:path";
import { forwardTelegramReplyToSession } from "../src/notifications/reply-bridge";
import { NotificationLoopbackServer } from "../src/notifications/server";

async function tmpStateRoot(): Promise<string> {
	return fs.mkdtemp(path.join(os.tmpdir(), "jwc-reply-bridge-"));
}

describe("forwardTelegramReplyToSession", () => {
	it("injects a reply into the mapped session and resolves its pending ask", async () => {
		const stateRoot = await tmpStateRoot();
		const server = await NotificationLoopbackServer.start({ sessionId: "session-x", stateRoot });
		try {
			server.enqueueAction({ actionId: "a1", prompt: "Deploy?", options: ["yes", "no"] });
			const result = await forwardTelegramReplyToSession({
				stateRoot,
				sessionId: "session-x",
				value: "yes",
				timeoutMs: 2_000,
			});
			expect(result).toEqual({ ok: true, actionId: "a1" });
		} finally {
			await server.stop();
			await fs.rm(stateRoot, { recursive: true, force: true });
		}
	});

	it("fails closed when the session has no endpoint (injects nowhere else)", async () => {
		const stateRoot = await tmpStateRoot();
		try {
			const result = await forwardTelegramReplyToSession({
				stateRoot,
				sessionId: "missing-session",
				value: "yes",
				timeoutMs: 500,
			});
			expect(result).toEqual({ ok: false, reason: "no-endpoint" });
		} finally {
			await fs.rm(stateRoot, { recursive: true, force: true });
		}
	});

	it("reports no-pending-action when the session has no open ask", async () => {
		const stateRoot = await tmpStateRoot();
		const server = await NotificationLoopbackServer.start({ sessionId: "session-y", stateRoot });
		try {
			const result = await forwardTelegramReplyToSession({
				stateRoot,
				sessionId: "session-y",
				value: "yes",
				timeoutMs: 300,
			});
			expect(result).toEqual({ ok: false, reason: "no-pending-action" });
		} finally {
			await server.stop();
			await fs.rm(stateRoot, { recursive: true, force: true });
		}
	});
});
