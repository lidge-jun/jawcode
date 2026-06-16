import { describe, expect, it } from "bun:test";
import * as path from "node:path";
import type { Message } from "@gajae-code/ai";
import { CURRENT_SESSION_VERSION, SessionManager } from "../src/session/session-manager";
import {
	MemorySessionStorage,
	type SessionStorage,
	type SessionStorageStat,
	type SessionStorageWriter,
} from "../src/session/session-storage";

const LARGE_TEXT = `${"single load ".repeat(60_000)}TEXT_TAIL`;
const LARGE_IMAGE = Buffer.from(`${"single-load-image".repeat(20_000)}IMAGE_TAIL`).toString("base64");
const TRUNCATION_NOTICE = "[Session persistence truncated large content]";

class CountingSessionStorage implements SessionStorage {
	readonly inner = new MemorySessionStorage();
	#readTextCounts = new Map<string, number>();

	readTextCountFor(filePath: string): number {
		return this.#readTextCounts.get(path.resolve(filePath)) ?? 0;
	}

	ensureDirSync(dir: string): void {
		this.inner.ensureDirSync(dir);
	}

	existsSync(filePath: string): boolean {
		return this.inner.existsSync(path.resolve(filePath));
	}

	writeTextSync(filePath: string, content: string): void {
		this.inner.writeTextSync(path.resolve(filePath), content);
	}

	readTextSync(filePath: string): string {
		return this.inner.readTextSync(path.resolve(filePath));
	}

	statSync(filePath: string): SessionStorageStat {
		return this.inner.statSync(path.resolve(filePath));
	}

	listFilesSync(dir: string, pattern: string): string[] {
		return this.inner.listFilesSync(path.resolve(dir), pattern);
	}

	exists(filePath: string): Promise<boolean> {
		return this.inner.exists(path.resolve(filePath));
	}

	readText(filePath: string): Promise<string> {
		const resolved = path.resolve(filePath);
		this.#readTextCounts.set(resolved, this.readTextCountFor(resolved) + 1);
		if (!this.inner.existsSync(resolved)) {
			const err = new Error(`File not found: ${resolved}`) as NodeJS.ErrnoException;
			err.code = "ENOENT";
			return Promise.reject(err);
		}
		return this.inner.readText(resolved);
	}

	readTextPrefix(filePath: string, maxBytes: number): Promise<string> {
		return this.inner.readTextPrefix(path.resolve(filePath), maxBytes);
	}

	writeText(filePath: string, content: string): Promise<void> {
		return this.inner.writeText(path.resolve(filePath), content);
	}

	rename(filePath: string, nextPath: string): Promise<void> {
		return this.inner.rename(path.resolve(filePath), path.resolve(nextPath));
	}

	renameSync(filePath: string, nextPath: string): void {
		this.inner.renameSync(path.resolve(filePath), path.resolve(nextPath));
	}

	unlink(filePath: string): Promise<void> {
		return this.inner.unlink(path.resolve(filePath));
	}

	unlinkSync(filePath: string): void {
		this.inner.unlinkSync(path.resolve(filePath));
	}

	deleteSessionWithArtifacts(sessionPath: string): Promise<void> {
		return this.inner.deleteSessionWithArtifacts(path.resolve(sessionPath));
	}

	openWriter(filePath: string, options?: { flags?: "a" | "w"; onError?: (err: Error) => void }): SessionStorageWriter {
		return this.inner.openWriter(path.resolve(filePath), options);
	}
}

function largeUserMessage() {
	return {
		role: "user" as const,
		content: [
			{ type: "text" as const, text: LARGE_TEXT },
			{ type: "image" as const, data: LARGE_IMAGE, mimeType: "image/png" },
		],
		timestamp: 1,
	};
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

function jsonl(entries: Array<Record<string, unknown>>): string {
	return `${entries.map(entry => JSON.stringify(entry)).join("\n")}\n`;
}

describe("SessionManager.open single-load", () => {
	it("opens a resident-heavy session with one read while preserving resident materialization", async () => {
		const storage = new CountingSessionStorage();
		const session = SessionManager.create("/cwd", "/sessions", storage);
		session.appendMessage(largeUserMessage());
		session.appendMessage(assistantMessage());
		await session.flush();
		const sessionFile = session.getSessionFile()!;
		await session.close();

		const reopened = await SessionManager.open(sessionFile, "/sessions", storage);
		expect(storage.readTextCountFor(path.resolve(sessionFile))).toBe(1);
		const contextJson = JSON.stringify(reopened.buildSessionContext().messages);
		expect(contextJson.includes("TEXT_TAIL") || contextJson.includes(TRUNCATION_NOTICE)).toBe(true);
		expect(contextJson).toContain(LARGE_IMAGE.slice(0, 100));
		const capturedJson = JSON.stringify(reopened.captureState().fileEntries);
		expect(capturedJson).not.toContain(LARGE_TEXT.slice(0, 100));
		expect(capturedJson).not.toContain(LARGE_IMAGE.slice(0, 100));
	});

	it("preserves empty explicit session file behavior with one attempted read", async () => {
		const storage = new CountingSessionStorage();
		const sessionFile = path.resolve("/sessions/missing.jsonl");

		const opened = await SessionManager.open(sessionFile, "/sessions", storage);

		expect(storage.readTextCountFor(sessionFile)).toBe(1);
		expect(opened.getSessionFile()).toBe(sessionFile);
		expect(storage.existsSync(sessionFile)).toBe(true);
	});

	it("preserves migrated-session cold full rewrite after a single read", async () => {
		const storage = new CountingSessionStorage();
		const sessionFile = path.resolve("/sessions/old-version.jsonl");
		storage.writeTextSync(
			sessionFile,
			jsonl([
				{
					type: "session",
					version: CURRENT_SESSION_VERSION - 1,
					id: "sess-old",
					timestamp: "2026-01-01T00:00:00.000Z",
					cwd: "/cwd",
				},
				{
					type: "message",
					id: "msg-user",
					parentId: null,
					timestamp: "2026-01-01T00:00:01.000Z",
					message: { role: "user", content: "old", timestamp: 1 },
				},
			]),
		);

		const opened = await SessionManager.open(sessionFile, "/sessions", storage);
		expect(storage.readTextCountFor(sessionFile)).toBe(1);

		opened.appendMessage(assistantMessage());
		await opened.flush();

		const persisted = storage.readTextSync(sessionFile);
		const lines = persisted.trim().split("\n");
		expect(JSON.parse(lines[0]).version).toBe(CURRENT_SESSION_VERSION);
		expect(lines.some(line => line.includes("msg-user"))).toBe(true);
		expect(lines).toHaveLength(opened.captureState().fileEntries.length);
	});
});
