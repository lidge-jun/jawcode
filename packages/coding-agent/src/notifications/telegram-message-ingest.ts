import {
	decideRemoteAnswer,
	type NormalizedRemoteAnswer,
	type RemoteActionContext,
	type RemoteActionContextPatch,
	type RemoteAnswerRejectionReason,
} from "./remote-answer";
import type { TelegramUpdate } from "./telegram-api";

/**
 * Inbound Telegram free-text message ingestion (chase 10.032, gate 3 + free-text ack).
 *
 * The free-text mirror of `telegram-callback-ingest.ts`: bridges an in-topic text reply through
 *   extract text message -> decideRemoteAnswer(kind:"free_text") (token auth + race + idempotency +
 *   allowFreeText policy, owned by remote-answer.ts).
 *
 * Pure / side-effect-free. A per-message idempotency key (`tg-msg:<messageId>`) makes a redelivered
 * update a safe no-op. No token, chat id, or session secret is embedded or echoed in the decision.
 *
 * Deliberate divergence from the button path: a free-text message with NO active ask context is an
 * ordinary reply (the caller forwards it via `forwardTelegramReplyToSession`), so it is `ignore`d with
 * reason `no_active_ask` rather than `rejected: stale_action` — a tapped button always implies an ask,
 * free text does not.
 */

export interface TelegramTextMessage {
	messageId: number;
	text: string;
	fromId?: number;
	chatId?: number;
	messageThreadId?: number;
}

export type TelegramMessageIgnoreReason = "not_a_text_message" | "empty_text" | "no_active_ask";

export type TelegramMessageDecision =
	| { mode: "ignore"; reason: TelegramMessageIgnoreReason }
	| {
			mode: "accepted";
			ackMessageId: number;
			answer: NormalizedRemoteAnswer;
			contextPatch: RemoteActionContextPatch;
	  }
	| { mode: "rejected"; ackMessageId: number; reason: RemoteAnswerRejectionReason };

export interface DecideTelegramMessageInput {
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
 * Safely extract a Telegram text message from a (loosely typed) update. Returns null for non-message
 * updates (e.g. callback_query), messages with no text, or structurally invalid payloads.
 */
export function extractTelegramTextMessage(update: TelegramUpdate): TelegramTextMessage | null {
	const message = asRecord(update.message);
	if (!message) return null;
	const messageId = readNumber(message.message_id);
	if (messageId === undefined) return null;
	const text = readString(message.text);
	if (text === undefined) return null;
	const from = asRecord(message.from);
	const chat = asRecord(message.chat);
	return {
		messageId,
		text,
		fromId: from ? readNumber(from.id) : undefined,
		chatId: chat ? readNumber(chat.id) : undefined,
		messageThreadId: readNumber(message.message_thread_id),
	};
}

/**
 * Decide what to do with an inbound free-text message. Token authorization, action staleness, session
 * match, idempotency, and the allowFreeText / empty_free_text policy are all enforced by
 * decideRemoteAnswer. With no active ask context the message is left for ordinary reply forwarding.
 */
export function decideTelegramMessageInbound(input: DecideTelegramMessageInput): TelegramMessageDecision {
	const message = extractTelegramTextMessage(input.update);
	if (!message) return { mode: "ignore", reason: "not_a_text_message" };
	if (message.text.trim().length === 0) return { mode: "ignore", reason: "empty_text" };

	const context = input.context;
	if (!context) return { mode: "ignore", reason: "no_active_ask" };

	const decision = decideRemoteAnswer(
		{
			sessionId: context.sessionId,
			actionId: context.actionId,
			idempotencyKey: `tg-msg:${message.messageId}`,
			transport: "telegram",
			kind: "free_text",
			value: message.text,
			presentedToken: input.presentedToken,
		},
		context,
	);

	if (decision.status === "accepted") {
		return {
			mode: "accepted",
			ackMessageId: message.messageId,
			answer: decision.answer,
			contextPatch: decision.contextPatch,
		};
	}
	return { mode: "rejected", ackMessageId: message.messageId, reason: decision.reason };
}
