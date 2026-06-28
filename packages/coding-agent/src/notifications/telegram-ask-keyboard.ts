import { stripTelegramOptionPrefix } from "./remote-answer";

/**
 * Telegram inline-keyboard rendering + callback decoding for remote ask answers
 * (chase 10.032, split 2 — button rendering half of gate 1, all of gate 5).
 *
 * Telegram's Bot API hard-limits `callback_data` to 1–64 bytes, so the full WS
 * loopback payload (`buildTelegramCallbackPayload`, 256 bytes) is unsuitable here.
 * Buttons instead carry a compact `jwc1:<index>:<nonce>` token; the canonical
 * option value is resolved server-side against the active action's allowedValues.
 * No session id, token, or chat id ever enters callback_data.
 */

const CALLBACK_DATA_PREFIX = "jwc1";
/** Telegram Bot API limit for inline keyboard callback_data. */
export const TELEGRAM_CALLBACK_DATA_MAX_BYTES = 64;
/** Conservative display clamp for a button label. */
const MAX_BUTTON_TEXT_LENGTH = 120;

export interface InlineKeyboardButton {
	text: string;
	callback_data: string;
}

export type InlineKeyboard = InlineKeyboardButton[][];

export interface BuildAskInlineKeyboardInput {
	/** Option labels as presented to the user (may carry leading "1." numbering). */
	options: readonly string[];
	/** Per-ask nonce used as the idempotency seed; must be non-empty. */
	nonce: string;
	/** Buttons per row (default 1). Values < 1 are treated as 1. */
	columns?: number;
}

export interface DecodedAskCallback {
	index: number;
	nonce: string;
}

export type DecodeAskCallbackResult =
	| { ok: true; decoded: DecodedAskCallback }
	| { ok: false; code: "invalid_callback" };

export interface ResolveAskButtonInput {
	callbackData: string;
	allowedValues: readonly string[];
}

export type ResolveAskButtonResult =
	| { ok: true; value: string; index: number; nonce: string }
	| { ok: false; reason: "invalid_button_value" };

function byteLength(value: string): number {
	return new TextEncoder().encode(value).byteLength;
}

function clampButtonText(text: string): string {
	const trimmed = text.trim();
	if (trimmed.length <= MAX_BUTTON_TEXT_LENGTH) return trimmed;
	return `${trimmed.slice(0, MAX_BUTTON_TEXT_LENGTH - 1)}…`;
}

function encodeCallbackData(index: number, nonce: string): string {
	const data = `${CALLBACK_DATA_PREFIX}:${index}:${nonce}`;
	if (byteLength(data) > TELEGRAM_CALLBACK_DATA_MAX_BYTES) {
		// Fail fast: never silently truncate routing identity (index/nonce).
		throw new Error("callback_data_too_large");
	}
	return data;
}

/**
 * Build a Telegram inline keyboard for an ask. Button text is the option label
 * with any embedded "1." / "2)" numbering stripped (avoids double-numbering),
 * and callback_data is a compact, 64-byte-safe `jwc1:<index>:<nonce>` token.
 *
 * @throws Error("callback_data_too_large") if the nonce is so long that a
 *   callback_data would exceed Telegram's 64-byte limit.
 */
export function buildAskInlineKeyboard(input: BuildAskInlineKeyboardInput): InlineKeyboard {
	const nonce = input.nonce.trim();
	if (nonce.length === 0) {
		throw new Error("ask_keyboard_empty_nonce");
	}
	const columns = Math.max(1, Math.trunc(input.columns ?? 1));
	const buttons: InlineKeyboardButton[] = input.options.map((label, index) => ({
		text: clampButtonText(stripTelegramOptionPrefix(label)),
		callback_data: encodeCallbackData(index, nonce),
	}));

	const rows: InlineKeyboard = [];
	for (let i = 0; i < buttons.length; i += columns) {
		rows.push(buttons.slice(i, i + columns));
	}
	return rows;
}

/** Decode a `jwc1:<index>:<nonce>` callback_data token. Nonce may contain ":". */
export function decodeAskCallbackData(data: string): DecodeAskCallbackResult {
	if (byteLength(data) > TELEGRAM_CALLBACK_DATA_MAX_BYTES) {
		return { ok: false, code: "invalid_callback" };
	}
	const prefix = `${CALLBACK_DATA_PREFIX}:`;
	if (!data.startsWith(prefix)) return { ok: false, code: "invalid_callback" };
	const body = data.slice(prefix.length);
	const sep = body.indexOf(":");
	if (sep <= 0) return { ok: false, code: "invalid_callback" };
	const indexPart = body.slice(0, sep);
	const nonce = body.slice(sep + 1);
	if (!/^\d+$/.test(indexPart) || nonce.length === 0) {
		return { ok: false, code: "invalid_callback" };
	}
	const index = Number.parseInt(indexPart, 10);
	if (!Number.isSafeInteger(index)) return { ok: false, code: "invalid_callback" };
	return { ok: true, decoded: { index, nonce } };
}

/**
 * Resolve a button callback to its canonical option value by decoding the
 * index and looking it up in the active action's allowedValues. Out-of-range
 * indices and malformed callbacks reject with `invalid_button_value`, matching
 * RemoteAnswerRejectionReason so the caller can feed decideRemoteAnswer directly.
 */
export function resolveAskButtonAnswer(input: ResolveAskButtonInput): ResolveAskButtonResult {
	const decoded = decodeAskCallbackData(input.callbackData);
	if (!decoded.ok) return { ok: false, reason: "invalid_button_value" };
	const { index, nonce } = decoded.decoded;
	if (index < 0 || index >= input.allowedValues.length) {
		return { ok: false, reason: "invalid_button_value" };
	}
	const value = input.allowedValues[index];
	if (typeof value !== "string" || value.trim().length === 0) {
		return { ok: false, reason: "invalid_button_value" };
	}
	return { ok: true, value, index, nonce };
}
