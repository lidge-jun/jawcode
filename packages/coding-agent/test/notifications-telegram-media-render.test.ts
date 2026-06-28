import { describe, expect, it } from "bun:test";
import { TELEGRAM_DOCUMENT_MAX_BYTES, TELEGRAM_PHOTO_MAX_BYTES } from "../src/notifications/telegram-media-policy";
import { renderAndSendTelegramMedia } from "../src/notifications/telegram-media-render";

function fetchCapturing(capture: { method?: string }): typeof fetch {
	return (async (url: string) => {
		capture.method = url.includes("/sendPhoto") ? "sendPhoto" : url.includes("/sendDocument") ? "sendDocument" : "?";
		return new Response(JSON.stringify({ ok: true, result: { message_id: 1 } }), {
			status: 200,
			headers: { "content-type": "application/json" },
		});
	}) as unknown as typeof fetch;
}

function fetchFails(): typeof fetch {
	return (async () => {
		throw new Error("network down");
	}) as unknown as typeof fetch;
}

const base = { token: "t", chatId: "1" };

describe("renderAndSendTelegramMedia", () => {
	it("dispatches an in-policy image to sendPhoto", async () => {
		const cap: { method?: string } = {};
		const res = await renderAndSendTelegramMedia({
			...base,
			data: new Uint8Array([1, 2, 3]),
			fileName: "a.png",
			fetchImpl: fetchCapturing(cap),
		});
		expect(res).toEqual({ ok: true, method: "sendPhoto", result: { message_id: 1 } });
		expect(cap.method).toBe("sendPhoto");
	});

	it("dispatches an oversize image to sendDocument", async () => {
		const cap: { method?: string } = {};
		const res = await renderAndSendTelegramMedia({
			...base,
			data: new Uint8Array(TELEGRAM_PHOTO_MAX_BYTES + 1),
			fileName: "big.png",
			fetchImpl: fetchCapturing(cap),
		});
		expect(res.ok).toBe(true);
		if (res.ok) expect(res.method).toBe("sendDocument");
		expect(cap.method).toBe("sendDocument");
	});

	it("rejects an over-cap file before any network call", async () => {
		const cap: { method?: string } = {};
		const res = await renderAndSendTelegramMedia({
			...base,
			data: new Uint8Array(TELEGRAM_DOCUMENT_MAX_BYTES + 1),
			fileName: "huge.bin",
			fetchImpl: fetchCapturing(cap),
		});
		expect(res).toEqual({ ok: false, rejected: "too_large" });
		expect(cap.method).toBeUndefined();
	});

	it("rejects an empty file before any network call", async () => {
		const cap: { method?: string } = {};
		const res = await renderAndSendTelegramMedia({
			...base,
			data: new Uint8Array(0),
			fileName: "empty.png",
			fetchImpl: fetchCapturing(cap),
		});
		expect(res).toEqual({ ok: false, rejected: "empty_file" });
		expect(cap.method).toBeUndefined();
	});

	it("propagates a Telegram send failure", async () => {
		const res = await renderAndSendTelegramMedia({
			...base,
			data: new Uint8Array([1]),
			fileName: "a.png",
			fetchImpl: fetchFails(),
		});
		expect(res.ok).toBe(false);
		expect("rejected" in res && res.rejected).toBeFalsy();
	});
});
