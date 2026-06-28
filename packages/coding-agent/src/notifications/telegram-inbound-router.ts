import type { RemoteActionContext, RemoteAnswerKind } from "./remote-answer";
import type { TelegramUpdate } from "./telegram-api";
import { decideTelegramCallbackInbound, extractTelegramCallbackQuery } from "./telegram-callback-ingest";
import { decideTelegramMessageInbound } from "./telegram-message-ingest";
import { classifyThreadInboundUpdate, type ThreadInboundUpdate, type ThreadTopicRegistry } from "./threaded-surface";
import { fingerprintSecret } from "./transport-state";

/**
 * Telegram inbound dispatch router (chase 10.032 live routing, gates 1/2).
 *
 * Composes the individually-tested deciders into a single side-effect-free dispatch plan:
 *   callback_query -> chat/topic resolution + `decideTelegramCallbackInbound`
 *   text message   -> `classifyThreadInboundUpdate` (thread->session, fail-closed) + `decideTelegramMessageInbound`
 *
 * The router owns NO live state: the caller injects `resolveActionContext(sessionId)` (the pending ask's
 * RemoteActionContext) and the dedupe hooks, then executes the returned plan
 * (`answerTelegramCallbackQuery` + `forwardTelegramReplyToSession`). Token/chat/session secrets are never
 * embedded in or echoed by the plan.
 *
 * Fail-closed policy:
 *   - foreign chat / missing chat / missing topic  -> silent `drop` (no ack, reveals nothing).
 *   - legit chat but unmapped/stale topic or no active ask -> ack the callback as `rejected` (clear the
 *     user's spinner) / for text, `drop`.
 *   - a rejected free-text answer (not allowed, already answered, ...) -> `drop`, never injected.
 *   - in-topic free text with NO active ask -> `forward_reply` (an ordinary reply for the caller).
 */

export type InboundDispatchAction =
	| { kind: "answer_callback"; callbackQueryId: string; outcome: "accepted" | "rejected"; reason?: string }
	| { kind: "deliver_answer"; sessionId: string; value: string; source: RemoteAnswerKind; ackMessageId?: number }
	| { kind: "forward_reply"; sessionId: string; text: string; updateId: number }
	| { kind: "drop"; reason: string };

export type InboundDispatchPlan = InboundDispatchAction[];

export interface InboundRouterContext {
	expectedChatIdFingerprint: string;
	presentedToken?: string;
	registry: ThreadTopicRegistry;
	isDuplicateUpdate: (updateId: number) => boolean;
	recordUpdateId?: (updateId: number) => void;
	resolveActionContext: (sessionId: string) => RemoteActionContext | undefined;
}

function asRecord(value: unknown): Record<string, unknown> | null {
	return typeof value === "object" && value !== null ? (value as Record<string, unknown>) : null;
}

function readNumber(value: unknown): number | undefined {
	return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}

const ATTACHMENT_KEYS = ["photo", "document", "video", "voice", "audio", "sticker", "animation"] as const;

function messageHasAttachment(message: Record<string, unknown>): boolean {
	return ATTACHMENT_KEYS.some(key => message[key] !== undefined);
}

function routeCallback(update: TelegramUpdate, ctx: InboundRouterContext): InboundDispatchPlan {
	const callback = extractTelegramCallbackQuery(update);
	if (!callback) return [];
	const callbackQueryId = callback.id;

	const updateId = readNumber(update.update_id);
	if (updateId !== undefined && ctx.isDuplicateUpdate(updateId)) {
		return [{ kind: "answer_callback", callbackQueryId, outcome: "rejected", reason: "duplicate_update" }];
	}

	// Foreign / missing chat: silent drop, reveal nothing (do not ack).
	if (callback.chatId === undefined) return [{ kind: "drop", reason: "missing_chat" }];
	if (fingerprintSecret(String(callback.chatId)) !== ctx.expectedChatIdFingerprint) {
		return [{ kind: "drop", reason: "wrong_chat" }];
	}
	if (callback.messageThreadId === undefined) return [{ kind: "drop", reason: "no_topic" }];

	const topic = ctx.registry.findByThread(ctx.expectedChatIdFingerprint, callback.messageThreadId);
	if (!topic || topic.stale) {
		return [{ kind: "answer_callback", callbackQueryId, outcome: "rejected", reason: "stale_action" }];
	}

	if (updateId !== undefined) ctx.recordUpdateId?.(updateId);

	const context = ctx.resolveActionContext(topic.sessionId);
	if (!context) {
		return [{ kind: "answer_callback", callbackQueryId, outcome: "rejected", reason: "stale_action" }];
	}

	const decision = decideTelegramCallbackInbound({ update, presentedToken: ctx.presentedToken, context });
	if (decision.mode === "accepted") {
		return [
			{ kind: "answer_callback", callbackQueryId, outcome: "accepted" },
			{
				kind: "deliver_answer",
				sessionId: context.sessionId,
				value: decision.answer.value,
				source: decision.answer.kind,
			},
		];
	}
	if (decision.mode === "rejected") {
		return [{ kind: "answer_callback", callbackQueryId, outcome: "rejected", reason: decision.reason }];
	}
	return [{ kind: "drop", reason: decision.reason }];
}

function toThreadInboundUpdate(update: TelegramUpdate, message: Record<string, unknown>): ThreadInboundUpdate {
	return {
		updateId: update.update_id,
		chatId: asRecord(message.chat)?.id,
		messageThreadId: message.message_thread_id,
		text: message.text,
		caption: message.caption,
		hasAttachment: messageHasAttachment(message),
	};
}

function routeMessage(update: TelegramUpdate, ctx: InboundRouterContext): InboundDispatchPlan {
	const message = asRecord(update.message);
	if (!message) return [{ kind: "drop", reason: "unroutable" }];

	const classified = classifyThreadInboundUpdate(toThreadInboundUpdate(update, message), ctx.registry, {
		expectedChatIdFingerprint: ctx.expectedChatIdFingerprint,
		isDuplicateUpdate: ctx.isDuplicateUpdate,
		recordUpdateId: ctx.recordUpdateId,
	});
	if (classified.mode === "drop") return [{ kind: "drop", reason: classified.reason }];

	const context = ctx.resolveActionContext(classified.sessionId);
	if (!context) {
		return [
			{
				kind: "forward_reply",
				sessionId: classified.sessionId,
				text: classified.text,
				updateId: classified.updateId,
			},
		];
	}

	const decision = decideTelegramMessageInbound({ update, presentedToken: ctx.presentedToken, context });
	if (decision.mode === "accepted") {
		return [
			{
				kind: "deliver_answer",
				sessionId: context.sessionId,
				value: decision.answer.value,
				source: decision.answer.kind,
				ackMessageId: decision.ackMessageId,
			},
		];
	}
	if (decision.mode === "rejected") return [{ kind: "drop", reason: decision.reason }];
	return [{ kind: "drop", reason: decision.reason }];
}

/**
 * Route one inbound Telegram update into a dispatch plan. callback_query updates take the button path;
 * everything else is treated as a (possibly text) message. Returns an empty plan only when an update is
 * structurally neither (never reached in practice — message path returns an explicit drop).
 */
export function routeTelegramInboundUpdate(update: TelegramUpdate, ctx: InboundRouterContext): InboundDispatchPlan {
	if (asRecord(update.callback_query)) return routeCallback(update, ctx);
	return routeMessage(update, ctx);
}
