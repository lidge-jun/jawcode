/**
 * Size/MIME policy for outbound Telegram media (chase 10.034). Classifies a
 * workspace-confined file (already resolved by `resolveWorkspaceFileForNotification`)
 * into the Telegram method that can carry it, or rejects it when it exceeds the
 * Bot API upload limits. Classification is by file extension only; the optional
 * declared MIME is advisory and never trusted for routing — a mis-typed file
 * simply fails at the Telegram API and returns a classified error.
 */

/** Telegram Bot API multipart upload caps. */
export const TELEGRAM_PHOTO_MAX_BYTES = 10 * 1024 * 1024;
export const TELEGRAM_DOCUMENT_MAX_BYTES = 50 * 1024 * 1024;

const PHOTO_EXTENSIONS = new Set([".jpg", ".jpeg", ".png", ".webp"]);

export type TelegramMediaRejectionReason = "empty_file" | "too_large";

export type TelegramMediaMethod = "sendPhoto" | "sendDocument";

export type TelegramMediaDecision =
	| { ok: true; method: TelegramMediaMethod }
	| { ok: false; reason: TelegramMediaRejectionReason };

function extensionOf(fileName: string): string {
	const dot = fileName.lastIndexOf(".");
	if (dot <= 0 || dot === fileName.length - 1) return "";
	return fileName.slice(dot).toLowerCase();
}

export interface ClassifyTelegramMediaInput {
	fileName: string;
	sizeBytes: number;
	/** Advisory only; not trusted for routing. */
	declaredMime?: string;
}

export function classifyTelegramMedia(input: ClassifyTelegramMediaInput): TelegramMediaDecision {
	const { fileName, sizeBytes } = input;
	if (!Number.isFinite(sizeBytes) || sizeBytes <= 0) return { ok: false, reason: "empty_file" };

	const isPhotoExt = PHOTO_EXTENSIONS.has(extensionOf(fileName));
	if (isPhotoExt && sizeBytes <= TELEGRAM_PHOTO_MAX_BYTES) {
		return { ok: true, method: "sendPhoto" };
	}
	// Oversize photo or any other file: send as a document if within the doc cap.
	if (sizeBytes <= TELEGRAM_DOCUMENT_MAX_BYTES) {
		return { ok: true, method: "sendDocument" };
	}
	return { ok: false, reason: "too_large" };
}
