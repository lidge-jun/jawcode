import { describe, expect, it } from "bun:test";
import type { Message } from "@gajae-code/ai";
import { ResidentBlobMissingError } from "@gajae-code/coding-agent/session/blob-store";
import { SessionManager } from "@gajae-code/coding-agent/session/session-manager";
import { MemorySessionStorage } from "@gajae-code/coding-agent/session/session-storage";

const RESIDENT_BLOB_SENTINEL_KEY = "__gjcResidentBlob";
const MISSING_REF = `blob:sha256:${"a".repeat(64)}`;
const PERSISTED_MISSING_REF = `blob:sha256:${"b".repeat(64)}`;

function sessionHeader() {
	return {
		type: "session",
		version: 3,
		id: "sess-resident-ownership",
		timestamp: "2026-01-01T00:00:00.000Z",
		cwd: "/cwd",
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

describe("SessionManager resident ownership", () => {
	it("throws ResidentBlobMissingError for missing resident image data sentinels", async () => {
		const storage = new MemorySessionStorage();
		const sessionFile = "/sessions/missing-image-data.jsonl";
		const messageEntry = {
			type: "message",
			id: "msg-image-data",
			parentId: null,
			timestamp: "2026-01-01T00:00:01.000Z",
			message: {
				role: "user",
				content: [
					{
						type: "image",
						data: { [RESIDENT_BLOB_SENTINEL_KEY]: true, kind: "imageData", ref: MISSING_REF },
						mimeType: "image/png",
					},
				],
				timestamp: 1,
			},
		};
		storage.writeTextSync(
			sessionFile,
			`${[sessionHeader(), messageEntry].map(entry => JSON.stringify(entry)).join("\n")}\n`,
		);

		const session = await SessionManager.open(sessionFile, "/sessions", storage);

		expect(() => session.getEntry("msg-image-data")).toThrow(ResidentBlobMissingError);
		try {
			session.getEntry("msg-image-data");
		} catch (err) {
			expect(err).toBeInstanceOf(ResidentBlobMissingError);
			expect((err as ResidentBlobMissingError).kind).toBe("imageData");
			expect((err as ResidentBlobMissingError).sessionId).toBe("sess-resident-ownership");
			expect((err as ResidentBlobMissingError).sessionFile).toBe(sessionFile);
		}
	});

	it("throws ResidentBlobMissingError for missing resident provider image URL sentinels", async () => {
		const storage = new MemorySessionStorage();
		const sessionFile = "/sessions/missing-image-url.jsonl";
		const messageEntry = {
			type: "message",
			id: "msg-image-url",
			parentId: null,
			timestamp: "2026-01-01T00:00:01.000Z",
			message: {
				role: "user",
				content: "image url",
				providerPayload: {
					type: "openaiResponsesHistory",
					provider: "openai",
					items: [
						{
							type: "message",
							role: "user",
							content: [
								{
									type: "input_image",
									image_url: { [RESIDENT_BLOB_SENTINEL_KEY]: true, kind: "imageUrl", ref: MISSING_REF },
								},
							],
						},
					],
				},
				timestamp: 1,
			},
		};
		storage.writeTextSync(
			sessionFile,
			`${[sessionHeader(), messageEntry].map(entry => JSON.stringify(entry)).join("\n")}\n`,
		);

		const session = await SessionManager.open(sessionFile, "/sessions", storage);

		expect(() => session.getEntry("msg-image-url")).toThrow(ResidentBlobMissingError);
	});

	it("keeps durable persisted missing image blob refs non-throwing on historical load", async () => {
		const storage = new MemorySessionStorage();
		const sessionFile = "/sessions/missing-durable-image.jsonl";
		const messageEntry = {
			type: "message",
			id: "msg-durable-image",
			parentId: null,
			timestamp: "2026-01-01T00:00:01.000Z",
			message: {
				role: "user",
				content: [{ type: "image", data: PERSISTED_MISSING_REF, mimeType: "image/png" }],
				timestamp: 1,
			},
		};
		storage.writeTextSync(
			sessionFile,
			`${[sessionHeader(), messageEntry].map(entry => JSON.stringify(entry)).join("\n")}\n`,
		);

		const session = await SessionManager.open(sessionFile, "/sessions", storage);
		const entry = session.getEntry("msg-durable-image");

		expect(JSON.stringify(entry)).toContain(PERSISTED_MISSING_REF);
	});

	it("restores captured resident snapshots without stale store aliasing", async () => {
		const storage = new MemorySessionStorage();
		const session = SessionManager.create("/cwd", "/sessions", storage);
		const id = session.appendCustomEntry("large-custom", { arbitraryPayload: "payload".repeat(120_000) });
		session.appendMessage(assistantMessage());
		const snapshot = session.captureState();
		const snapshotJson = JSON.stringify(snapshot.fileEntries);

		session.restoreState(snapshot);

		expect(JSON.stringify(session.getEntry(id))).toContain("payloadpayload");
		expect(JSON.stringify(snapshot.fileEntries)).toBe(snapshotJson);
		expect(JSON.stringify(session.captureState().fileEntries)).not.toContain("payloadpayload");
	});

	it("fails closed when restoring an organically captured resident text snapshot after store reset", async () => {
		const storage = new MemorySessionStorage();
		const session = SessionManager.create("/cwd", "/sessions", storage);
		session.appendCustomEntry("large-custom", { arbitraryPayload: "organic".repeat(120_000) });
		session.appendMessage(assistantMessage());
		const snapshot = session.captureState();
		const ownerSessionId = session.getHeader()?.id;

		await session.newSession();

		expect(() => session.restoreState(snapshot)).toThrow(ResidentBlobMissingError);
		try {
			session.restoreState(snapshot);
		} catch (err) {
			expect(err).toBeInstanceOf(ResidentBlobMissingError);
			expect((err as ResidentBlobMissingError).kind).toBe("text");
			expect((err as ResidentBlobMissingError).sessionId).toBe(ownerSessionId);
		}
	});
});
