import {
	decideRemoteAnswer,
	type NormalizedRemoteAnswer,
	type RemoteActionContext,
	type RemoteActionContextPatch,
	type RemoteAnswerRejectionReason,
} from "./remote-answer";
import type { TelegramUpdate } from "./telegram-api";
import { resolveAskButtonAnswer } from "./telegram-ask-keyboard";

/**
 * Inbound Telegram callback_query (inline-button tap) ingestion (chase 10.032).
 *
 * Bridges a tapped ask button through:
 *   decode compact callback_data -> resolveAskButtonAnswer (against allowedValues)
 *   -> decideRemoteAnswer (token auth + race + idempotency, owned by remote-answer.ts).
 *
 * Pure / side-effect-free. The decision always surfaces `callbackQueryId` so the
 * caller can `answerTelegramCallbackQuery` to clear the spinner. No token, chat id,
 * or session secret is embedded in callback_data or echoed in the decision.
 */

export interface TelegramCallbackQuery {
	id: string;
	data?: string;
	fromId?: number;
	chatId?: number;
	messageThreadId?: number;
}

export type TelegramCallbackIgnoreReason = "not_a_callback" | "empty_callback_data";

export type TelegramCallbackDecision =
	| { mode: "ignore"; reason: TelegramCallbackIgnoreReason }
	| {
			mode: "accepted";
			callbackQueryId: string;
			answer: NormalizedRemoteAnswer;
			contextPatch: RemoteActionContextPatch;
	  }
	| { mode: "rejected"; callbackQueryId: string; reason: RemoteAnswerRejectionReason };

export interface DecideTelegramCallbackInput {
	update: TelegramUpdate;
	presentedToken?: string;
	context?: RemoteActionContext;
}

function asRecord(value: unknown): Record<string, unknown> | null {
	return typeof value === "object" && value !== null ? (value as Record<string, unknown>) : null;
}

function readString(value: unknown): string | undefined {
	return typeof value === "string" && value.length > 0 ? value : undefined;
}

function readNumber(value: unknown): number | undefined {
	return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}

/**
 * Safely extract a Telegram callback_query from a (loosely typed) update.
 * Returns null for non-callback updates or structurally invalid payloads.
 */
export function extractTelegramCallbackQuery(update: TelegramUpdate): TelegramCallbackQuery | null {
	const cb = asRecord(update.callback_query);
	if (!cb) return null;
	const id = readString(cb.id);
	if (!id) return null;
	const from = asRecord(cb.from);
	const message = asRecord(cb.message);
	const chat = message ? asRecord(message.chat) : null;
	return {
		id,
		data: readString(cb.data),
		fromId: from ? readNumber(from.id) : undefined,
		chatId: chat ? readNumber(chat.id) : undefined,
		messageThreadId: message ? readNumber(message.message_thread_id) : undefined,
	};
}

/**
 * Decide what to do with an inbound callback_query. Token authorization, action
 * staleness, session match, and idempotency are all enforced by decideRemoteAnswer.
 */
export function decideTelegramCallbackInbound(input: DecideTelegramCallbackInput): TelegramCallbackDecision {
	const callback = extractTelegramCallbackQuery(input.update);
	if (!callback) return { mode: "ignore", reason: "not_a_callback" };
	if (!callback.data) return { mode: "ignore", reason: "empty_callback_data" };

	const context = input.context;
	if (!context) {
		return { mode: "rejected", callbackQueryId: callback.id, reason: "stale_action" };
	}

	const resolved = resolveAskButtonAnswer({
		callbackData: callback.data,
		allowedValues: context.allowedValues ?? [],
	});
	if (!resolved.ok) {
		return { mode: "rejected", callbackQueryId: callback.id, reason: resolved.reason };
	}

	const decision = decideRemoteAnswer(
		{
			sessionId: context.sessionId,
			actionId: context.actionId,
			idempotencyKey: resolved.nonce,
			transport: "telegram",
			kind: "button",
			value: resolved.value,
			presentedToken: input.presentedToken,
		},
		context,
	);

	if (decision.status === "accepted") {
		return {
			mode: "accepted",
			callbackQueryId: callback.id,
			answer: decision.answer,
			contextPatch: decision.contextPatch,
		};
	}
	return { mode: "rejected", callbackQueryId: callback.id, reason: decision.reason };
}
