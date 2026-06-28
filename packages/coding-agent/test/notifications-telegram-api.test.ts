import { describe, expect, it } from "bun:test";
import {
	classifyTelegramError,
	getTelegramUpdates,
	nextBackoffMs,
	sendTelegramMessage,
} from "../src/notifications/telegram-api";

function fetchReturning(body: unknown, status = 200, onUrl?: (url: string) => void): typeof fetch {
	return (async (url: string) => {
		onUrl?.(url);
		return new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
	}) as unknown as typeof fetch;
}

describe("telegram api client", () => {
	it("getUpdates returns the result array and sends offset+timeout", async () => {
		let captured = "";
		const outcome = await getTelegramUpdates({
			token: "BOT:TOKEN",
			offset: 5,
			timeoutSec: 10,
			fetchImpl: fetchReturning({ ok: true, result: [{ update_id: 1 }] }, 200, url => {
				captured = url;
			}),
		});
		expect(outcome).toEqual({ ok: true, result: [{ update_id: 1 }] });
		expect(captured).toContain("offset=5");
		expect(captured).toContain("timeout=10");
		expect(captured).toContain("/getUpdates");
	});

	it("getUpdates treats a 409 as a fatal single-owner conflict", async () => {
		const outcome = await getTelegramUpdates({
			token: "Z9:Q7",
			fetchImpl: fetchReturning({ ok: false, description: "Conflict: terminated by other getUpdates" }, 409),
		});
		expect(outcome.ok).toBe(false);
		if (!outcome.ok) {
			expect(outcome.retryable).toBe(false);
			expect(outcome.reason).toContain("conflict");
		}
	});

	it("getUpdates treats a 429 as retryable with retryAfterMs", async () => {
		const outcome = await getTelegramUpdates({
			token: "t",
			fetchImpl: fetchReturning(
				{ ok: false, description: "Too Many Requests", parameters: { retry_after: 3 } },
				429,
			),
		});
		expect(outcome.ok).toBe(false);
		if (!outcome.ok) {
			expect(outcome.retryable).toBe(true);
			expect(outcome.retryAfterMs).toBe(3000);
		}
	});

	it("getUpdates retries on 5xx and on a thrown fetch without leaking the token", async () => {
		const serverError = await getTelegramUpdates({ token: "t", fetchImpl: fetchReturning({ ok: false }, 503) });
		expect(serverError.ok).toBe(false);
		if (!serverError.ok) expect(serverError.retryable).toBe(true);

		const throwing = (async () => {
			throw new Error("network down for LEAK:TOKEN");
		}) as unknown as typeof fetch;
		const networkError = await getTelegramUpdates({ token: "LEAK:TOKEN", fetchImpl: throwing });
		expect(networkError.ok).toBe(false);
		if (!networkError.ok) {
			expect(networkError.retryable).toBe(true);
			expect(networkError.reason).not.toContain("LEAK:TOKEN");
		}
	});

	it("sendMessage returns the message id and 401 is fatal", async () => {
		const ok = await sendTelegramMessage({
			token: "t",
			chatId: "123",
			text: "hi",
			fetchImpl: fetchReturning({ ok: true, result: { message_id: 7 } }),
		});
		expect(ok).toEqual({ ok: true, result: { message_id: 7 } });

		const unauthorized = await sendTelegramMessage({
			token: "t",
			chatId: "123",
			text: "hi",
			fetchImpl: fetchReturning({ ok: false, description: "Unauthorized" }, 401),
		});
		expect(unauthorized.ok).toBe(false);
		if (!unauthorized.ok) expect(unauthorized.retryable).toBe(false);
	});

	it("classifyTelegramError maps status codes", () => {
		expect(classifyTelegramError(409, {}).retryable).toBe(false);
		expect(classifyTelegramError(429, { parameters: { retry_after: 2 } })).toMatchObject({
			retryable: true,
			retryAfterMs: 2000,
		});
		expect(classifyTelegramError(500, {}).retryable).toBe(true);
		expect(classifyTelegramError(400, {}).retryable).toBe(false);
		expect(classifyTelegramError(undefined, undefined).retryable).toBe(true);
	});

	it("nextBackoffMs grows exponentially and caps", () => {
		expect(nextBackoffMs(0)).toBe(500);
		expect(nextBackoffMs(1)).toBe(1000);
		expect(nextBackoffMs(3)).toBe(4000);
		expect(nextBackoffMs(20)).toBe(30_000);
	});
});

describe("telegram forum topics", () => {
	it("createForumTopic returns the message_thread_id", async () => {
		const { createForumTopic } = await import("../src/notifications/telegram-api");
		let captured = "";
		const outcome = await createForumTopic({
			token: "BOT:TOKEN",
			chatId: "123",
			name: "jwc/main",
			fetchImpl: fetchReturning({ ok: true, result: { message_thread_id: 42 } }, 200, url => {
				captured = url;
			}),
		});
		expect(outcome).toEqual({ ok: true, result: { message_thread_id: 42 } });
		expect(captured).toContain("/createForumTopic");
	});

	it("deleteForumTopic resolves true and tolerates failure (best-effort)", async () => {
		const { deleteForumTopic } = await import("../src/notifications/telegram-api");
		const ok = await deleteForumTopic({
			token: "t",
			chatId: "123",
			messageThreadId: 42,
			fetchImpl: fetchReturning({ ok: true, result: true }),
		});
		expect(ok).toEqual({ ok: true, result: true });

		const failed = await deleteForumTopic({
			token: "t",
			chatId: "123",
			messageThreadId: 42,
			fetchImpl: fetchReturning({ ok: false, description: "topic not found" }, 400),
		});
		expect(failed.ok).toBe(false); // caller treats as best-effort
	});
});
