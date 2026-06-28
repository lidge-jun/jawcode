import { describe, expect, it } from "bun:test";
import {
	classifyTelegramMedia,
	TELEGRAM_DOCUMENT_MAX_BYTES,
	TELEGRAM_PHOTO_MAX_BYTES,
} from "../src/notifications/telegram-media-policy";

describe("classifyTelegramMedia", () => {
	it("routes a small png to sendPhoto", () => {
		expect(classifyTelegramMedia({ fileName: "shot.png", sizeBytes: 1024 })).toEqual({
			ok: true,
			method: "sendPhoto",
		});
	});

	it("normalizes uppercase extensions", () => {
		expect(classifyTelegramMedia({ fileName: "SHOT.JPG", sizeBytes: 1024 })).toEqual({
			ok: true,
			method: "sendPhoto",
		});
	});

	it("falls back to sendDocument for an oversize photo within the document cap", () => {
		expect(classifyTelegramMedia({ fileName: "huge.png", sizeBytes: TELEGRAM_PHOTO_MAX_BYTES + 1 })).toEqual({
			ok: true,
			method: "sendDocument",
		});
	});

	it("routes a pdf to sendDocument", () => {
		expect(classifyTelegramMedia({ fileName: "report.pdf", sizeBytes: 20 * 1024 * 1024 })).toEqual({
			ok: true,
			method: "sendDocument",
		});
	});

	it("rejects files larger than the document cap", () => {
		expect(classifyTelegramMedia({ fileName: "blob.bin", sizeBytes: TELEGRAM_DOCUMENT_MAX_BYTES + 1 })).toEqual({
			ok: false,
			reason: "too_large",
		});
	});

	it("rejects empty/zero-byte files", () => {
		expect(classifyTelegramMedia({ fileName: "empty.png", sizeBytes: 0 })).toEqual({
			ok: false,
			reason: "empty_file",
		});
	});

	it("does not trust a declared MIME for routing (extension wins)", () => {
		// .bin with an image MIME still goes to sendDocument by extension.
		expect(classifyTelegramMedia({ fileName: "x.bin", sizeBytes: 100, declaredMime: "image/png" })).toEqual({
			ok: true,
			method: "sendDocument",
		});
	});
});
