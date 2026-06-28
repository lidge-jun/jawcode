import { describe, expect, it } from "bun:test";
import { verifyTelegramPairing } from "../src/notifications/telegram-pairing";

function fetchReturning(body: unknown, status = 200): typeof fetch {
	return (async () =>
		new Response(JSON.stringify(body), {
			status,
			headers: { "content-type": "application/json" },
		})) as unknown as typeof fetch;
}

describe("verifyTelegramPairing", () => {
	it("accepts a private chat (threaded mode unknown when no forum field)", async () => {
		const result = await verifyTelegramPairing({
			token: "BOT:TOKEN",
			chatId: "123",
			fetchImpl: fetchReturning({ ok: true, result: { type: "private" } }),
		});
		expect(result).toEqual({ ok: true, chatType: "private", threadedMode: "unknown" });
	});

	it("rejects group/supergroup/channel pairings without leaking the token", async () => {
		for (const type of ["group", "supergroup", "channel"]) {
			const result = await verifyTelegramPairing({
				token: "SECRET:TOKEN",
				chatId: "x",
				fetchImpl: fetchReturning({ ok: true, result: { type } }),
			});
			expect(result.ok).toBe(false);
			expect(result.chatType).toBe(type);
			expect(result.reason).toContain(type);
			expect(JSON.stringify(result)).not.toContain("SECRET:TOKEN");
		}
	});

	it("labels threaded mode verified/unverified from is_forum", async () => {
		const verified = await verifyTelegramPairing({
			token: "t",
			chatId: "x",
			fetchImpl: fetchReturning({ ok: true, result: { type: "supergroup", is_forum: true } }),
		});
		expect(verified.threadedMode).toBe("verified");
		const unverified = await verifyTelegramPairing({
			token: "t",
			chatId: "x",
			fetchImpl: fetchReturning({ ok: true, result: { type: "supergroup", is_forum: false } }),
		});
		expect(unverified.threadedMode).toBe("unverified");
	});

	it("returns unknown and sanitizes the token from a Telegram error description", async () => {
		const result = await verifyTelegramPairing({
			token: "LEAK:TOKEN",
			chatId: "x",
			fetchImpl: fetchReturning({ ok: false, description: "Unauthorized for LEAK:TOKEN" }, 401),
		});
		expect(result.ok).toBe(false);
		expect(result.chatType).toBe("unknown");
		expect(result.reason).not.toContain("LEAK:TOKEN");
		expect(result.reason).toContain("***");
	});

	it("returns unknown when the fetch throws", async () => {
		const throwing = (async () => {
			throw new Error("network down");
		}) as unknown as typeof fetch;
		const result = await verifyTelegramPairing({ token: "t", chatId: "x", fetchImpl: throwing });
		expect(result.ok).toBe(false);
		expect(result.threadedMode).toBe("unknown");
	});
});
