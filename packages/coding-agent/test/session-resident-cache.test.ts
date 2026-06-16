import { describe, expect, it } from "bun:test";
import type { ImageContent, Message, TextContent } from "@gajae-code/ai";
import { SessionManager } from "@gajae-code/coding-agent/session/session-manager";
import { MemorySessionStorage } from "@gajae-code/coding-agent/session/session-storage";

const LARGE_TEXT = `${"resident text ".repeat(60_000)}TEXT_TAIL`;
const LARGE_IMAGE = Buffer.from("resident image bytes".repeat(20_000)).toString("base64");
const LARGE_PROVIDER_IMAGE_URL = `data:image/png;base64,${Buffer.from("provider image".repeat(20_000)).toString("base64")}`;
const LARGE_PROVIDER_OBJECT_IMAGE_URL = `data:image/png;base64,${Buffer.from("provider object".repeat(20_000)).toString("base64")}`;
const LARGE_PROVIDER_OBJECT_SIBLING = `${"object sibling ".repeat(40_000)}OBJECT_TAIL`;
const BLOB_REF = "blob:sha256:";

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
		providerPayload: {
			type: "openaiResponsesHistory",
			provider: "openai",
			items: [
				{ type: "message", role: "user", content: [{ type: "input_image", image_url: LARGE_PROVIDER_IMAGE_URL }] },
				{
					type: "message",
					role: "user",
					content: [
						{
							type: "input_image",
							image_url: { url: LARGE_PROVIDER_OBJECT_IMAGE_URL, detail: LARGE_PROVIDER_OBJECT_SIBLING },
						},
					],
				},
			],
		},
		timestamp: 1,
	};
}

function residentJson(session: SessionManager): string {
	return JSON.stringify(session.captureState().fileEntries);
}

describe("SessionManager resident cache", () => {
	it("keeps resident state bounded while reader APIs materialize full content", async () => {
		const storage = new MemorySessionStorage();
		const session = SessionManager.create("/cwd", "/sessions", storage);
		const id = session.appendMessage(largeUserMessage());
		session.appendMessage(assistantMessage());
		await session.flush();

		const stateJson = residentJson(session);
		expect(stateJson).toContain(BLOB_REF);
		expect(stateJson).not.toContain(LARGE_TEXT.slice(0, 100));
		expect(stateJson).not.toContain(LARGE_IMAGE.slice(0, 100));
		expect(stateJson).not.toContain(LARGE_PROVIDER_IMAGE_URL.slice(0, 100));
		expect(stateJson).not.toContain(LARGE_PROVIDER_OBJECT_SIBLING.slice(-100));
		expect(stateJson.length).toBeLessThan(20_000);

		const entry = session.getEntry(id);
		expect(JSON.stringify(entry)).toContain(LARGE_TEXT);
		expect(JSON.stringify(session.getEntries())).toContain(LARGE_IMAGE);
		expect(JSON.stringify(session.getBranch())).toContain(LARGE_PROVIDER_IMAGE_URL);
		expect(JSON.stringify(session.getChildren(id))).toContain("ok");
		expect(JSON.stringify(session.getLeafEntry())).toContain("ok");
		expect(JSON.stringify(session.buildSessionContext().messages)).toContain(LARGE_PROVIDER_OBJECT_SIBLING);
	});

	it("materializes identical resident bytes independently as text and image data", () => {
		const storage = new MemorySessionStorage();
		const session = SessionManager.inMemory("/cwd", storage);
		const sameBytes = Buffer.from("same bytes for text and image".repeat(30_000));
		const text = sameBytes.toString("utf8");
		const image = sameBytes.toString("base64");
		const id = session.appendMessage({
			role: "user",
			content: [
				{ type: "text", text },
				{ type: "image", data: image, mimeType: "image/png" },
			] satisfies (TextContent | ImageContent)[],
			timestamp: 1,
		});

		const entry = session.getEntry(id);
		const content =
			entry?.type === "message" && "content" in entry.message && Array.isArray(entry.message.content)
				? entry.message.content
				: [];
		expect(content[0]).toEqual({ type: "text", text });
		expect(content[1]).toEqual({ type: "image", data: image, mimeType: "image/png" });
	});
});
