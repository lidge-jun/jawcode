import { describe, expect, it } from "bun:test";
import { SessionManager } from "@jawcode-dev/coding-agent/session/session-manager";
import { MemorySessionStorage } from "@jawcode-dev/coding-agent/session/session-storage";

const LARGE_TEXT = `${"materialized ".repeat(80_000)}TAIL`;

describe("resident materialization", () => {
	it("keeps reader and context outputs free of resident sentinel internals", () => {
		const session = SessionManager.create("/cwd", "/sessions", new MemorySessionStorage());
		const id = session.appendMessage({ role: "user", content: LARGE_TEXT, timestamp: 1 });

		expect(JSON.stringify(session.getEntry(id))).not.toContain("__gjcResidentBlob");
		expect(JSON.stringify(session.getEntries())).not.toContain("__gjcResidentBlob");
		expect(JSON.stringify(session.getBranch())).not.toContain("__gjcResidentBlob");
		expect(JSON.stringify(session.buildSessionContext().messages)).not.toContain("__gjcResidentBlob");
		expect(JSON.stringify(session.captureState().fileEntries)).toContain("__gjcResidentBlob");
	});

	it("preserves optional model-change provenance while keeping current model semantics", async () => {
		const storage = new MemorySessionStorage();
		const session = SessionManager.create("/cwd", "/sessions", storage);
		session.appendModelChange("provider/old", "default");
		session.appendModelChange("provider/new", "default", {
			previousModel: "provider/old",
			reason: "user-switch",
			thinkingLevel: "medium",
		});
		session.appendMessage({
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
			timestamp: 1,
		});
		await session.flush();

		const reopened = await SessionManager.open(session.getSessionFile()!, "/sessions", storage);
		const modelEntries = reopened.getEntries().filter(entry => entry.type === "model_change");

		expect(reopened.buildSessionContext().models.default).toBe("provider/new");
		expect(modelEntries.at(-1)).toEqual(
			expect.objectContaining({
				previousModel: "provider/old",
				reason: "user-switch",
				thinkingLevel: "medium",
			}),
		);
	});

	it("uses detached JSON-semantic snapshots for resident state", () => {
		const session = SessionManager.create("/cwd", "/sessions", new MemorySessionStorage());
		session.appendCustomEntry("large", { payload: LARGE_TEXT });
		const snapshot = session.captureState();
		const originalSnapshotJson = JSON.stringify(snapshot.fileEntries);

		const mutableCopy = session.captureState();
		const customEntry = mutableCopy.fileEntries.find(entry => entry.type === "custom");
		if (customEntry?.type !== "custom") throw new Error("Expected custom entry");
		customEntry.data = { payload: "mutated" };

		expect(JSON.stringify(snapshot.fileEntries)).toBe(originalSnapshotJson);
		expect(JSON.stringify(snapshot.fileEntries)).not.toContain("mutated");
	});
});
