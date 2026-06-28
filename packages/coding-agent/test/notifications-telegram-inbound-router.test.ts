import { describe, expect, it } from "bun:test";
import type { RemoteActionContext } from "../src/notifications/remote-answer";
import type { TelegramUpdate } from "../src/notifications/telegram-api";
import { buildAskInlineKeyboard } from "../src/notifications/telegram-ask-keyboard";
import { type InboundRouterContext, routeTelegramInboundUpdate } from "../src/notifications/telegram-inbound-router";
import { ThreadTopicRegistry } from "../src/notifications/threaded-surface";
import { fingerprintSecret } from "../src/notifications/transport-state";

const TOKEN = "tok-secret-123";
const NONCE = "abc123def456";
const ALLOWED = ["Yes, proceed", "No, stop", "Maybe later"];
const CHAT_ID = -100;
const CHAT_FP = fingerprintSecret(String(CHAT_ID));
const THREAD = 7;

function registryWithSession(sessionId = "sess-1"): ThreadTopicRegistry {
	const registry = new ThreadTopicRegistry();
	registry.upsert({ sessionId, messageThreadId: THREAD, chatIdFingerprint: CHAT_FP, title: "t", updatedAt: 1 });
	return registry;
}

function baseContext(overrides: Partial<RemoteActionContext> = {}): RemoteActionContext {
	return {
		sessionId: "sess-1",
		actionId: "act-1",
		expectedToken: TOKEN,
		allowedValues: ALLOWED,
		...overrides,
	};
}

function routerCtx(overrides: Partial<InboundRouterContext> = {}): InboundRouterContext {
	return {
		expectedChatIdFingerprint: CHAT_FP,
		presentedToken: TOKEN,
		registry: registryWithSession(),
		isDuplicateUpdate: () => false,
		resolveActionContext: () => baseContext(),
		...overrides,
	};
}

function buttonData(index: number): string {
	return buildAskInlineKeyboard({ options: ALLOWED, nonce: NONCE }).flat()[index].callback_data;
}

function callbackUpdate(data: string, chatId = CHAT_ID, threadId: number | undefined = THREAD): TelegramUpdate {
	const message: Record<string, unknown> = { chat: { id: chatId } };
	if (threadId !== undefined) message.message_thread_id = threadId;
	return { update_id: 100, callback_query: { id: "cbq-1", data, from: { id: 42 }, message } };
}

function textUpdate(
	text: string,
	opts: { chatId?: number; threadId?: number; messageId?: number } = {},
): TelegramUpdate {
	return {
		update_id: 200,
		message: {
			message_id: opts.messageId ?? 555,
			text,
			from: { id: 42 },
			chat: { id: opts.chatId ?? CHAT_ID },
			message_thread_id: opts.threadId ?? THREAD,
		},
	};
}

describe("routeTelegramInboundUpdate — callback path", () => {
	it("accepts a button tap into an ack + a delivered answer", () => {
		const plan = routeTelegramInboundUpdate(callbackUpdate(buttonData(0)), routerCtx());
		expect(plan).toEqual([
			{ kind: "answer_callback", callbackQueryId: "cbq-1", outcome: "accepted" },
			{ kind: "deliver_answer", sessionId: "sess-1", value: "Yes, proceed", source: "button" },
		]);
	});

	it("acks a rejected callback (already answered) without delivering", () => {
		const plan = routeTelegramInboundUpdate(
			callbackUpdate(buttonData(1)),
			routerCtx({ resolveActionContext: () => baseContext({ answeredBy: "local" }) }),
		);
		expect(plan).toEqual([
			{ kind: "answer_callback", callbackQueryId: "cbq-1", outcome: "rejected", reason: "already_answered" },
		]);
	});

	it("silently drops a foreign-chat callback (no ack)", () => {
		const plan = routeTelegramInboundUpdate(callbackUpdate(buttonData(0), 999), routerCtx());
		expect(plan).toEqual([{ kind: "drop", reason: "wrong_chat" }]);
	});

	it("acks rejected for a legit chat with an unmapped topic", () => {
		const plan = routeTelegramInboundUpdate(callbackUpdate(buttonData(0), CHAT_ID, 9999), routerCtx());
		expect(plan).toEqual([
			{ kind: "answer_callback", callbackQueryId: "cbq-1", outcome: "rejected", reason: "stale_action" },
		]);
	});

	it("acks rejected when there is no active ask context", () => {
		const plan = routeTelegramInboundUpdate(
			callbackUpdate(buttonData(0)),
			routerCtx({ resolveActionContext: () => undefined }),
		);
		expect(plan).toEqual([
			{ kind: "answer_callback", callbackQueryId: "cbq-1", outcome: "rejected", reason: "stale_action" },
		]);
	});

	it("acks rejected (duplicate) for a redelivered callback update", () => {
		const plan = routeTelegramInboundUpdate(
			callbackUpdate(buttonData(0)),
			routerCtx({ isDuplicateUpdate: () => true }),
		);
		expect(plan).toEqual([
			{ kind: "answer_callback", callbackQueryId: "cbq-1", outcome: "rejected", reason: "duplicate_update" },
		]);
	});

	it("records the update id once the callback resolves a mapped topic", () => {
		const recorded: number[] = [];
		routeTelegramInboundUpdate(callbackUpdate(buttonData(0)), routerCtx({ recordUpdateId: id => recorded.push(id) }));
		expect(recorded).toEqual([100]);
	});
});

describe("routeTelegramInboundUpdate — text path", () => {
	it("delivers a free-text answer against an allowFreeText ask with an ack id", () => {
		const plan = routeTelegramInboundUpdate(
			textUpdate("my custom reply"),
			routerCtx({ resolveActionContext: () => baseContext({ allowFreeText: true }) }),
		);
		expect(plan).toEqual([
			{
				kind: "deliver_answer",
				sessionId: "sess-1",
				value: "my custom reply",
				source: "free_text",
				ackMessageId: 555,
			},
		]);
	});

	it("forwards in-topic free text as an ordinary reply when there is no active ask", () => {
		const plan = routeTelegramInboundUpdate(
			textUpdate("just chatting"),
			routerCtx({ resolveActionContext: () => undefined }),
		);
		expect(plan).toEqual([{ kind: "forward_reply", sessionId: "sess-1", text: "just chatting", updateId: 200 }]);
	});

	it("drops a free-text answer when the ask does not allow free text", () => {
		const plan = routeTelegramInboundUpdate(
			textUpdate("nope"),
			routerCtx({ resolveActionContext: () => baseContext({ allowFreeText: false }) }),
		);
		expect(plan).toEqual([{ kind: "drop", reason: "free_text_not_allowed" }]);
	});

	it("drops a foreign-chat text message", () => {
		const plan = routeTelegramInboundUpdate(textUpdate("hi", { chatId: 999 }), routerCtx());
		expect(plan).toEqual([{ kind: "drop", reason: "wrong_chat" }]);
	});

	it("drops a text message for an unknown topic", () => {
		const plan = routeTelegramInboundUpdate(textUpdate("hi", { threadId: 9999 }), routerCtx());
		expect(plan).toEqual([{ kind: "drop", reason: "unknown_topic" }]);
	});
});
