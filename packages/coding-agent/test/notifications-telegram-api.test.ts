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

describe("telegram media senders (multipart)", () => {
	function capturingFetch(body: unknown, status: number, capture: { url?: string; init?: RequestInit }): typeof fetch {
		return (async (url: string, init?: RequestInit) => {
			capture.url = url;
			capture.init = init;
			return new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
		}) as unknown as typeof fetch;
	}

	it("sendTelegramDocument POSTs multipart with chat/thread/caption and the file", async () => {
		const { sendTelegramDocument } = await import("../src/notifications/telegram-api");
		const cap: { url?: string; init?: RequestInit } = {};
		const outcome = await sendTelegramDocument({
			token: "BOT:SECRET",
			chatId: "123",
			data: new Uint8Array([1, 2, 3]),
			fileName: "report.pdf",
			caption: "see attached",
			messageThreadId: 7,
			fetchImpl: capturingFetch({ ok: true, result: { message_id: 9 } }, 200, cap),
		});
		expect(outcome).toEqual({ ok: true, result: { message_id: 9 } });
		expect(cap.url).toContain("/sendDocument");
		expect(cap.init?.method).toBe("POST");
		const form = cap.init?.body as FormData;
		expect(form.get("chat_id")).toBe("123");
		expect(form.get("message_thread_id")).toBe("7");
		expect(form.get("caption")).toBe("see attached");
		expect(form.get("document")).toBeInstanceOf(Blob);
	});

	it("sendTelegramPhoto uses the photo field and omits optional fields when unset", async () => {
		const { sendTelegramPhoto } = await import("../src/notifications/telegram-api");
		const cap: { url?: string; init?: RequestInit } = {};
		const outcome = await sendTelegramPhoto({
			token: "t",
			chatId: "555",
			data: new Uint8Array([9]),
			fileName: "shot.png",
			fetchImpl: capturingFetch({ ok: true, result: { message_id: 1 } }, 200, cap),
		});
		expect(outcome.ok).toBe(true);
		expect(cap.url).toContain("/sendPhoto");
		const form = cap.init?.body as FormData;
		expect(form.get("photo")).toBeInstanceOf(Blob);
		expect(form.get("caption")).toBeNull();
		expect(form.get("message_thread_id")).toBeNull();
	});

	it("sanitizes the bot token out of multipart error reasons", async () => {
		const { sendTelegramDocument } = await import("../src/notifications/telegram-api");
		const token = "BOT:SUPERSECRET";
		const outcome = await sendTelegramDocument({
			token,
			chatId: "1",
			data: new Uint8Array([1]),
			fileName: "f.bin",
			fetchImpl: (async () => {
				throw new Error(`connect failed to https://api.telegram.org/bot${token}/sendDocument`);
			}) as unknown as typeof fetch,
		});
		expect(outcome.ok).toBe(false);
		if (!outcome.ok) {
			expect(outcome.reason).not.toContain(token);
			expect(outcome.reason).toContain("***");
		}
	});
});
