/**
 * Verifies a Telegram notification pairing via the Bot API `getChat` endpoint.
 *
 * Fail-closed and token-safe: only a private chat is accepted, and the bot token is never logged nor
 * included in any returned `reason` (caught error text is sanitized). `fetchImpl` is injectable so the
 * check is unit-testable with no live token.
 */

export type ThreadedModeCapability = "verified" | "unverified" | "unknown";

export interface TelegramPairingResult {
	/** True only when the paired chat is a private DM. */
	ok: boolean;
	chatType: string;
	threadedMode: ThreadedModeCapability;
	/** Human-readable rejection/error explanation. Never contains the bot token. */
	reason?: string;
}

const TELEGRAM_API_BASE = "https://api.telegram.org";

interface GetChatResponse {
	ok?: boolean;
	description?: string;
	result?: { type?: string; is_forum?: boolean };
}

function classifyThreadedMode(isForum: boolean | undefined): ThreadedModeCapability {
	if (isForum === true) return "verified";
	if (isForum === false) return "unverified";
	return "unknown";
}

export async function verifyTelegramPairing(opts: {
	token: string;
	chatId: string;
	fetchImpl?: typeof fetch;
}): Promise<TelegramPairingResult> {
	const fetchImpl = opts.fetchImpl ?? fetch;
	const url = `${TELEGRAM_API_BASE}/bot${opts.token}/getChat?chat_id=${encodeURIComponent(opts.chatId)}`;
	// Strip the token from any text that may surface in `reason` (some fetch errors echo the URL).
	const sanitize = (text: string): string => (opts.token ? text.split(opts.token).join("***") : text);
	try {
		const response = await fetchImpl(url);
		const body = (await response.json()) as GetChatResponse;
		if (!body.ok || !body.result) {
			const detail = body.description ?? `getChat failed (HTTP ${response.status})`;
			return { ok: false, chatType: "unknown", threadedMode: "unknown", reason: sanitize(detail) };
		}
		const chatType = body.result.type ?? "unknown";
		const threadedMode = classifyThreadedMode(body.result.is_forum);
		if (chatType !== "private") {
			return {
				ok: false,
				chatType,
				threadedMode,
				reason: `pairing rejected: chat type '${chatType}' is not a private chat`,
			};
		}
		return { ok: true, chatType, threadedMode };
	} catch (error) {
		return {
			ok: false,
			chatType: "unknown",
			threadedMode: "unknown",
			reason: sanitize(`getChat request failed: ${(error as Error).message}`),
		};
	}
}
