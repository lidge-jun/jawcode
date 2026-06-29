/**
 * Token-safe Telegram Bot API client for the managed daemon's poll loop.
 *
 * `fetchImpl` is injectable for unit tests (no live token). The bot token goes in the request URL and
 * is sanitized out of every returned `reason`. Errors are classified retryable/fatal so the daemon
 * can back off transient failures and stop on a 409 single-owner conflict.
 */

const TELEGRAM_API_BASE = "https://api.telegram.org";

export interface TelegramUpdate {
	update_id: number;
	[key: string]: unknown;
}

export type TelegramCallOutcome<T> =
	| { ok: true; result: T }
	| { ok: false; retryable: boolean; status?: number; retryAfterMs?: number; reason: string };

interface TelegramErrorBody {
	description?: string;
	parameters?: { retry_after?: number };
}

export function classifyTelegramError(
	status: number | undefined,
	body: TelegramErrorBody | undefined,
): { retryable: boolean; retryAfterMs?: number; reason: string } {
	const description = body?.description ?? (status ? `telegram error (HTTP ${status})` : "telegram request failed");
	if (status === 409) return { retryable: false, reason: `conflict: ${description}` };
	if (status === 429) {
		const retryAfter = body?.parameters?.retry_after;
		return {
			retryable: true,
			retryAfterMs: retryAfter !== undefined ? retryAfter * 1000 : undefined,
			reason: `rate limited: ${description}`,
		};
	}
	if (status !== undefined && status >= 500) return { retryable: true, reason: `server error: ${description}` };
	if (status === 401 || status === 400) return { retryable: false, reason: `fatal: ${description}` };
	return { retryable: true, reason: description };
}

/** Exponential backoff with a cap: min(cap, base * 2^attempt). */
export function nextBackoffMs(attempt: number, base = 500, cap = 30_000): number {
	const exponent = Math.max(0, Math.floor(attempt));
	return Math.min(cap, base * 2 ** exponent);
}

interface TelegramCallOptions {
	token: string;
	method: string;
	query?: Record<string, string>;
	fetchImpl?: typeof fetch;
	signal?: AbortSignal;
}

async function telegramCall<T>(opts: TelegramCallOptions): Promise<TelegramCallOutcome<T>> {
	const fetchImpl = opts.fetchImpl ?? fetch;
	const sanitize = (text: string): string => (opts.token ? text.split(opts.token).join("***") : text);
	const params = new URLSearchParams(opts.query ?? {});
	const qs = params.toString();
	const url = `${TELEGRAM_API_BASE}/bot${opts.token}/${opts.method}${qs ? `?${qs}` : ""}`;
	try {
		const response = await fetchImpl(url, { signal: opts.signal });
		let body: { ok?: boolean; result?: T } & TelegramErrorBody;
		try {
			body = (await response.json()) as typeof body;
		} catch {
			body = {};
		}
		if (response.ok && body.ok && body.result !== undefined) {
			return { ok: true, result: body.result };
		}
		const classified = classifyTelegramError(response.status, body);
		return {
			ok: false,
			retryable: classified.retryable,
			status: response.status,
			retryAfterMs: classified.retryAfterMs,
			reason: sanitize(classified.reason),
		};
	} catch (error) {
		const classified = classifyTelegramError(undefined, undefined);
		return {
			ok: false,
			retryable: classified.retryable,
			reason: sanitize(`request failed: ${(error as Error).message}`),
		};
	}
}

export async function getTelegramUpdates(opts: {
	token: string;
	offset?: number;
	timeoutSec?: number;
	fetchImpl?: typeof fetch;
	signal?: AbortSignal;
}): Promise<TelegramCallOutcome<TelegramUpdate[]>> {
	const query: Record<string, string> = { timeout: String(opts.timeoutSec ?? 30) };
	if (opts.offset !== undefined) query.offset = String(opts.offset);
	return telegramCall<TelegramUpdate[]>({
		token: opts.token,
		method: "getUpdates",
		query,
		fetchImpl: opts.fetchImpl,
		signal: opts.signal,
	});
}

export async function sendTelegramMessage(opts: {
	token: string;
	chatId: string;
	text: string;
	fetchImpl?: typeof fetch;
}): Promise<TelegramCallOutcome<{ message_id: number }>> {
	return telegramCall<{ message_id: number }>({
		token: opts.token,
		method: "sendMessage",
		query: { chat_id: opts.chatId, text: opts.text },
		fetchImpl: opts.fetchImpl,
	});
}

export async function createForumTopic(opts: {
	token: string;
	chatId: string;
	name: string;
	fetchImpl?: typeof fetch;
}): Promise<TelegramCallOutcome<{ message_thread_id: number }>> {
	return telegramCall<{ message_thread_id: number }>({
		token: opts.token,
		method: "createForumTopic",
		query: { chat_id: opts.chatId, name: opts.name },
		fetchImpl: opts.fetchImpl,
	});
}

export async function deleteForumTopic(opts: {
	token: string;
	chatId: string;
	messageThreadId: number;
	fetchImpl?: typeof fetch;
}): Promise<TelegramCallOutcome<true>> {
	return telegramCall<true>({
		token: opts.token,
		method: "deleteForumTopic",
		query: { chat_id: opts.chatId, message_thread_id: String(opts.messageThreadId) },
		fetchImpl: opts.fetchImpl,
	});
}

/**
 * Acknowledge a tapped inline-keyboard button so Telegram clears the button
 * spinner. Optional `text` shows a transient toast to the user. Token-safe.
 */
export async function answerTelegramCallbackQuery(opts: {
	token: string;
	callbackQueryId: string;
	text?: string;
	fetchImpl?: typeof fetch;
}): Promise<TelegramCallOutcome<true>> {
	const query: Record<string, string> = { callback_query_id: opts.callbackQueryId };
	if (opts.text !== undefined) query.text = opts.text;
	return telegramCall<true>({
		token: opts.token,
		method: "answerCallbackQuery",
		query,
		fetchImpl: opts.fetchImpl,
	});
}

interface TelegramMultipartCallOptions {
	token: string;
	method: string;
	form: FormData;
	fetchImpl?: typeof fetch;
	signal?: AbortSignal;
}

async function telegramMultipartCall<T>(opts: TelegramMultipartCallOptions): Promise<TelegramCallOutcome<T>> {
	const fetchImpl = opts.fetchImpl ?? fetch;
	const sanitize = (text: string): string => (opts.token ? text.split(opts.token).join("***") : text);
	const url = `${TELEGRAM_API_BASE}/bot${opts.token}/${opts.method}`;
	try {
		const response = await fetchImpl(url, { method: "POST", body: opts.form, signal: opts.signal });
		let body: { ok?: boolean; result?: T } & TelegramErrorBody;
		try {
			body = (await response.json()) as typeof body;
		} catch {
			body = {};
		}
		if (response.ok && body.ok && body.result !== undefined) {
			return { ok: true, result: body.result };
		}
		const classified = classifyTelegramError(response.status, body);
		return {
			ok: false,
			retryable: classified.retryable,
			status: response.status,
			retryAfterMs: classified.retryAfterMs,
			reason: sanitize(classified.reason),
		};
	} catch (error) {
		const classified = classifyTelegramError(undefined, undefined);
		return {
			ok: false,
			retryable: classified.retryable,
			reason: sanitize(`request failed: ${(error as Error).message}`),
		};
	}
}

export interface SendTelegramFileOptions {
	token: string;
	chatId: string;
	/** Raw file bytes (already workspace-confined and size/MIME-checked by the caller). */
	data: Uint8Array;
	fileName: string;
	caption?: string;
	messageThreadId?: number;
	fetchImpl?: typeof fetch;
	signal?: AbortSignal;
}

function buildMediaForm(opts: SendTelegramFileOptions, field: "photo" | "document"): FormData {
	const form = new FormData();
	form.append("chat_id", opts.chatId);
	if (opts.messageThreadId !== undefined) form.append("message_thread_id", String(opts.messageThreadId));
	if (opts.caption !== undefined) form.append("caption", opts.caption);
	form.append(field, new Blob([opts.data]), opts.fileName);
	return form;
}

/** Upload a workspace-confined image as a Telegram photo. Token-safe. */
export async function sendTelegramPhoto(
	opts: SendTelegramFileOptions,
): Promise<TelegramCallOutcome<{ message_id: number }>> {
	return telegramMultipartCall<{ message_id: number }>({
		token: opts.token,
		method: "sendPhoto",
		form: buildMediaForm(opts, "photo"),
		fetchImpl: opts.fetchImpl,
		signal: opts.signal,
	});
}

/** Upload a workspace-confined file as a Telegram document. Token-safe. */
export async function sendTelegramDocument(
	opts: SendTelegramFileOptions,
): Promise<TelegramCallOutcome<{ message_id: number }>> {
	return telegramMultipartCall<{ message_id: number }>({
		token: opts.token,
		method: "sendDocument",
		form: buildMediaForm(opts, "document"),
		fetchImpl: opts.fetchImpl,
		signal: opts.signal,
	});
}
