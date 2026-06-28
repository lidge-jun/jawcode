import { describe, expect, it } from "bun:test";
import {
	buildAskInlineKeyboard,
	decodeAskCallbackData,
	type InlineKeyboard,
	resolveAskButtonAnswer,
	TELEGRAM_CALLBACK_DATA_MAX_BYTES,
} from "../src/notifications/telegram-ask-keyboard";

const NONCE = "3f7a9c1e2b8d4a60"; // 16 hex, realistic per-ask nonce

function flat(keyboard: InlineKeyboard) {
	return keyboard.flat();
}

describe("buildAskInlineKeyboard", () => {
	it("builds one button per option and strips embedded numbering (no double-numbering)", () => {
		const kb = buildAskInlineKeyboard({
			options: ["1. Yes, proceed", "2) No, stop", "Maybe later"],
			nonce: NONCE,
		});
		const buttons = flat(kb);
		expect(buttons.map(b => b.text)).toEqual(["Yes, proceed", "No, stop", "Maybe later"]);
		// one button per row by default
		expect(kb).toHaveLength(3);
		expect(kb.every(row => row.length === 1)).toBe(true);
	});

	it("round-trips index and nonce through decodeAskCallbackData", () => {
		const kb = buildAskInlineKeyboard({ options: ["A", "B", "C"], nonce: NONCE });
		const buttons = flat(kb);
		buttons.forEach((btn, index) => {
			const decoded = decodeAskCallbackData(btn.callback_data);
			expect(decoded.ok).toBe(true);
			if (decoded.ok) {
				expect(decoded.decoded.index).toBe(index);
				expect(decoded.decoded.nonce).toBe(NONCE);
			}
		});
	});

	it("keeps every callback_data within Telegram's 64-byte limit for a realistic UUID nonce", () => {
		const kb = buildAskInlineKeyboard({
			options: Array.from({ length: 12 }, (_, i) => `Option number ${i + 1}`),
			nonce: "550e8400-e29b-41d4-a716-446655440000", // 36-char UUID
		});
		for (const btn of flat(kb)) {
			expect(new TextEncoder().encode(btn.callback_data).byteLength).toBeLessThanOrEqual(
				TELEGRAM_CALLBACK_DATA_MAX_BYTES,
			);
		}
	});

	it("fails fast when the nonce is so long that callback_data would overflow 64 bytes", () => {
		const hugeNonce = "x".repeat(80);
		expect(() => buildAskInlineKeyboard({ options: ["A"], nonce: hugeNonce })).toThrow("callback_data_too_large");
	});

	it("rejects an empty nonce", () => {
		expect(() => buildAskInlineKeyboard({ options: ["A"], nonce: "   " })).toThrow("ask_keyboard_empty_nonce");
	});

	it("lays out buttons by the requested column count", () => {
		const kb = buildAskInlineKeyboard({
			options: ["A", "B", "C", "D", "E"],
			nonce: NONCE,
			columns: 2,
		});
		expect(kb.map(row => row.length)).toEqual([2, 2, 1]);
	});
});

describe("decodeAskCallbackData", () => {
	it("rejects wrong prefix, missing parts, non-numeric index, and oversize data", () => {
		expect(decodeAskCallbackData("jwc:v1:{}").ok).toBe(false);
		expect(decodeAskCallbackData("jwc1:").ok).toBe(false);
		expect(decodeAskCallbackData("jwc1:2").ok).toBe(false);
		expect(decodeAskCallbackData("jwc1:abc:nonce").ok).toBe(false);
		expect(decodeAskCallbackData(`jwc1:0:${"y".repeat(80)}`).ok).toBe(false);
	});
});

describe("resolveAskButtonAnswer", () => {
	const allowedValues = ["Yes, proceed", "No, stop", "Maybe later"];

	it("maps a valid callback to the canonical allowedValues entry", () => {
		const kb = buildAskInlineKeyboard({
			options: ["1. Yes, proceed", "2. No, stop", "3. Maybe later"],
			nonce: NONCE,
		});
		const secondButton = flat(kb)[1];
		const result = resolveAskButtonAnswer({
			callbackData: secondButton.callback_data,
			allowedValues,
		});
		expect(result).toEqual({ ok: true, value: "No, stop", index: 1, nonce: NONCE });
	});

	it("rejects an out-of-range index with invalid_button_value", () => {
		const result = resolveAskButtonAnswer({
			callbackData: `jwc1:9:${NONCE}`,
			allowedValues,
		});
		expect(result).toEqual({ ok: false, reason: "invalid_button_value" });
	});

	it("rejects a malformed callback with invalid_button_value", () => {
		const result = resolveAskButtonAnswer({ callbackData: "not-a-jwc-callback", allowedValues });
		expect(result).toEqual({ ok: false, reason: "invalid_button_value" });
	});
});
