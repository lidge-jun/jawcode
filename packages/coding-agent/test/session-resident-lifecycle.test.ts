import { afterEach, describe, expect, it } from "bun:test";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import type { Message } from "@jawcode-dev/ai";
import { SessionManager } from "@jawcode-dev/coding-agent/session/session-manager";
import { FileSessionStorage, MemorySessionStorage } from "@jawcode-dev/coding-agent/session/session-storage";
import { getAgentDir, setAgentDir } from "@jawcode-dev/utils";

const LARGE_TEXT = `${"resident lifecycle ".repeat(50_000)}TEXT_TAIL`;
const LARGE_IMAGE = Buffer.from("resident lifecycle image".repeat(20_000)).toString("base64");
const TRUNCATION_NOTICE = "[Session persistence truncated large content]";
const ORIGINAL_AGENT_DIR = getAgentDir();

function tempResidentDirs(): Set<string> {
	return new Set(
		fs
			.readdirSync(os.tmpdir(), { withFileTypes: true })
			.filter(entry => entry.isDirectory() && entry.name.startsWith("jwc-resident-text-"))
			.map(entry => `${os.tmpdir()}/${entry.name}`),
	);
}

function assistantMessage(): Message {
	return {
		role: "assistant",
		content: [{ type: "text", text: "ok" }],
		api: "anthropic-messages",
		provider: "anthropic",
		model: "claude-test",
		usage: {
			input: 1,
			output: 1,
			cacheRead: 0,
			cacheWrite: 0,
			totalTokens: 2,
			premiumRequests: 0,
			cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, total: 0 },
		},
		stopReason: "stop",
		timestamp: 2,
	};
}

function largeUserMessage(): Message {
	return {
		role: "user",
		content: [
			{ type: "text", text: LARGE_TEXT },
			{ type: "image", data: LARGE_IMAGE, mimeType: "image/png" },
		],
		timestamp: 1,
	};
}

function labeledLargeMessage(label: string): Message {
	return {
		role: "user",
		content: [
			{ type: "text", text: `${label}:${LARGE_TEXT}` },
			{ type: "image", data: LARGE_IMAGE, mimeType: "image/png" },
		],
		timestamp: 1,
	};
}

afterEach(() => {
	setAgentDir(ORIGINAL_AGENT_DIR);
});

describe("SessionManager resident lifecycle", () => {
	it("reopens a resident-heavy session with bounded resident state and durable image materialization", async () => {
		const storage = new MemorySessionStorage();
		const agentDir = fs.mkdtempSync(`${os.tmpdir()}/jwc-resident-lifecycle-agent-`);
		setAgentDir(agentDir);
		const session = SessionManager.create("/cwd", "/sessions", storage);
		session.appendMessage(largeUserMessage());
		session.appendMessage(assistantMessage());
		await session.flush();
		const sessionFile = session.getSessionFile()!;
		await session.close();

		const reopened = await SessionManager.open(sessionFile, "/sessions", storage);
		const contextJson = JSON.stringify(reopened.buildSessionContext().messages);
		expect(contextJson).toContain(TRUNCATION_NOTICE);
		expect(contextJson).toContain(LARGE_IMAGE.slice(0, 100));
		expect(JSON.stringify(reopened.captureState().fileEntries)).not.toContain(LARGE_IMAGE.slice(0, 100));
	});

	it("disposes persistent resident text temp dirs on close", async () => {
		const before = tempResidentDirs();
		const storage = new MemorySessionStorage();
		const session = SessionManager.create("/cwd", "/sessions", storage);
		session.appendMessage({ role: "user", content: LARGE_TEXT, timestamp: 1 });
		session.appendMessage(assistantMessage());
		const created = [...tempResidentDirs()].filter(dir => !before.has(dir));
		expect(created.length).toBeGreaterThan(0);

		await session.close();

		for (const dir of created) {
			expect(fs.existsSync(dir)).toBe(false);
		}
	});

	it("preserves the compaction hydration clamp after resident lifecycle changes", () => {
		const session = SessionManager.inMemory("/cwd");
		const oldA = session.appendMessage({ role: "user", content: "old-a", timestamp: 1 });
		session.appendMessage(assistantMessage());
		session.appendCompaction("first summary", undefined, oldA, 100);
		session.appendMessage({ role: "user", content: "after-first-compaction", timestamp: 3 });
		session.appendCompaction("second summary", undefined, oldA, 200);
		session.appendMessage({ role: "user", content: "tail-after-second", timestamp: 4 });

		const contextJson = JSON.stringify(session.buildSessionContext().messages);
		expect(contextJson).toContain("second summary");
		expect(contextJson).toContain("tail-after-second");
		expect(contextJson).not.toContain("old-a");
		expect(contextJson).not.toContain("old-b");
		expect(contextJson).not.toContain("after-first-compaction");
	});

	it("re-externalizes resident entries across fork and branch lifecycle transitions", async () => {
		const storage = new MemorySessionStorage();
		const session = SessionManager.create("/cwd", "/sessions", storage);
		const largeId = session.appendMessage(largeUserMessage());
		session.appendMessage(assistantMessage());

		const forked = await session.fork();
		expect(forked?.newSessionFile).toBeString();
		expect(JSON.stringify(session.getEntry(largeId))).toContain(LARGE_TEXT);
		expect(JSON.stringify(session.captureState().fileEntries)).not.toContain(LARGE_TEXT.slice(0, 100));

		const branchFile = session.createBranchedSession(largeId);
		expect(branchFile).toBeString();
		expect(JSON.stringify(session.getEntry(largeId))).toContain(LARGE_TEXT);
		expect(JSON.stringify(session.captureState().fileEntries)).not.toContain(LARGE_TEXT.slice(0, 100));
	});

	it("resets and repopulates resident stores when switching session files", async () => {
		const storage = new MemorySessionStorage();
		const session = SessionManager.create("/cwd", "/sessions", storage);
		session.appendMessage(labeledLargeMessage("session-a"));
		session.appendMessage(assistantMessage());
		await session.flush();
		const sessionA = session.getSessionFile()!;

		await session.newSession();
		session.appendMessage(labeledLargeMessage("session-b"));
		session.appendMessage(assistantMessage());
		await session.flush();
		const sessionB = session.getSessionFile()!;

		await session.setSessionFile(sessionA);
		const contextA = JSON.stringify(session.buildSessionContext().messages);
		expect(contextA).toContain("session-a");
		expect(contextA).not.toContain("session-b");
		expect(JSON.stringify(session.captureState().fileEntries)).not.toContain(LARGE_TEXT.slice(0, 100));

		await session.setSessionFile(sessionB);
		const contextB = JSON.stringify(session.buildSessionContext().messages);
		expect(contextB).toContain("session-b");
		expect(contextB).not.toContain("session-a");
		expect(JSON.stringify(session.captureState().fileEntries)).not.toContain(LARGE_TEXT.slice(0, 100));
	});

	it("preserves resident materialization and bounded state after moving session cwd", async () => {
		const root = fs.mkdtempSync(`${os.tmpdir()}/jwc-resident-move-`);
		try {
			const oldCwd = path.join(root, "old");
			const newCwd = path.join(root, "new");
			const sessionDir = path.join(root, "sessions");
			fs.mkdirSync(oldCwd, { recursive: true });
			fs.mkdirSync(newCwd, { recursive: true });
			const session = SessionManager.create(oldCwd, sessionDir, new FileSessionStorage());
			session.appendMessage(labeledLargeMessage("moved-session"));
			session.appendMessage(assistantMessage());
			await session.flush();

			await session.moveTo(newCwd);

			const contextJson = JSON.stringify(session.buildSessionContext().messages);
			expect(contextJson).toContain("moved-session");
			expect(contextJson).toContain(LARGE_IMAGE.slice(0, 100));
			expect(JSON.stringify(session.captureState().fileEntries)).not.toContain(LARGE_TEXT.slice(0, 100));
			expect(session.getHeader()?.cwd).toBe(newCwd);
		} finally {
			fs.rmSync(root, { recursive: true, force: true });
		}
	});
});
