import { describe, expect, it } from "bun:test";
import type { RemoteActionContext } from "../src/notifications/remote-answer";
import type { TelegramUpdate } from "../src/notifications/telegram-api";
import { decideTelegramMessageInbound, extractTelegramTextMessage } from "../src/notifications/telegram-message-ingest";

const TOKEN = "tok-secret-123";

function baseContext(overrides: Partial<RemoteActionContext> = {}): RemoteActionContext {
	return {
		sessionId: "sess-1",
		actionId: "act-1",
		expectedToken: TOKEN,
		allowFreeText: true,
		...overrides,
	};
}

function textUpdate(text: string, messageId = 555): TelegramUpdate {
	return {
		update_id: 200,
		message: {
			message_id: messageId,
			text,
			from: { id: 42 },
			chat: { id: -100 },
			message_thread_id: 7,
		},
	};
}

describe("extractTelegramTextMessage", () => {
	it("returns null for a callback_query update (not a text message)", () => {
		expect(extractTelegramTextMessage({ update_id: 1, callback_query: { id: "x", data: "y" } })).toBeNull();
	});

	it("returns null for a message with no text (e.g. a photo)", () => {
		expect(extractTelegramTextMessage({ update_id: 1, message: { message_id: 9, photo: [] } })).toBeNull();
	});

	it("returns null for a message missing message_id", () => {
		expect(extractTelegramTextMessage({ update_id: 1, message: { text: "hi" } })).toBeNull();
	});

	it("extracts id/text/from/chat/thread from a well-formed message", () => {
		expect(extractTelegramTextMessage(textUpdate("custom answer"))).toEqual({
			messageId: 555,
			text: "custom answer",
			fromId: 42,
			chatId: -100,
			messageThreadId: 7,
		});
	});
});

describe("decideTelegramMessageInbound", () => {
	it("ignores a non-text update", () => {
		const decision = decideTelegramMessageInbound({
			update: { update_id: 1, callback_query: { id: "x" } },
			context: baseContext(),
		});
		expect(decision).toEqual({ mode: "ignore", reason: "not_a_text_message" });
	});

	it("ignores whitespace-only text", () => {
		const decision = decideTelegramMessageInbound({ update: textUpdate("   \n  "), context: baseContext() });
		expect(decision).toEqual({ mode: "ignore", reason: "empty_text" });
	});

	it("ignores text when there is no active ask context (ordinary reply, not an answer)", () => {
		const decision = decideTelegramMessageInbound({ update: textUpdate("just chatting"), presentedToken: TOKEN });
		expect(decision).toEqual({ mode: "ignore", reason: "no_active_ask" });
	});

	it("accepts a free-text answer against an allowFreeText ask, with ack + normalized value", () => {
		const decision = decideTelegramMessageInbound({
			update: textUpdate("  my custom reply  "),
			presentedToken: TOKEN,
			context: baseContext(),
		});
		expect(decision.mode).toBe("accepted");
		if (decision.mode !== "accepted") throw new Error("expected accepted");
		expect(decision.ackMessageId).toBe(555);
		expect(decision.answer.kind).toBe("free_text");
		expect(decision.answer.source).toBe("telegram");
		expect(decision.answer.value).toBe("my custom reply");
		expect(decision.answer.idempotencyKey).toBe("tg-msg:555");
		expect(decision.contextPatch.answeredBy).toBe("telegram");
	});

	it("rejects free text when the ask does not allow free text", () => {
		const decision = decideTelegramMessageInbound({
			update: textUpdate("nope"),
			presentedToken: TOKEN,
			context: baseContext({ allowFreeText: false }),
		});
		expect(decision).toEqual({ mode: "rejected", ackMessageId: 555, reason: "free_text_not_allowed" });
	});

	it("rejects an unauthorized token", () => {
		const decision = decideTelegramMessageInbound({
			update: textUpdate("answer"),
			presentedToken: "wrong-token",
			context: baseContext(),
		});
		expect(decision).toEqual({ mode: "rejected", ackMessageId: 555, reason: "unauthorized" });
	});

	it("rejects when the ask is already answered", () => {
		const decision = decideTelegramMessageInbound({
			update: textUpdate("late answer"),
			presentedToken: TOKEN,
			context: baseContext({ answeredBy: "local" }),
		});
		expect(decision).toEqual({ mode: "rejected", ackMessageId: 555, reason: "already_answered" });
	});

	it("treats a redelivered identical message (same message_id + value) as an idempotent accept", () => {
		// First accept produces the idempotency record; replaying the same update is a safe no-op accept.
		const first = decideTelegramMessageInbound({
			update: textUpdate("my answer"),
			presentedToken: TOKEN,
			context: baseContext(),
		});
		if (first.mode !== "accepted") throw new Error("expected first accept");
		expect(first.answer.idempotencyKey).toBe("tg-msg:555");

		const replay = decideTelegramMessageInbound({
			update: textUpdate("my answer"),
			presentedToken: TOKEN,
			context: baseContext({
				answeredBy: "telegram",
				idempotencyRecords: [first.contextPatch.idempotencyRecord],
			}),
		});
		expect(replay.mode).toBe("accepted");
		if (replay.mode !== "accepted") throw new Error("expected replay accept");
		expect(replay.answer.value).toBe("my answer");
	});

	it("rejects a redelivered message_id carrying a different value (idempotency conflict)", () => {
		const first = decideTelegramMessageInbound({
			update: textUpdate("first value"),
			presentedToken: TOKEN,
			context: baseContext(),
		});
		if (first.mode !== "accepted") throw new Error("expected first accept");
		const conflict = decideTelegramMessageInbound({
			update: textUpdate("tampered value"),
			presentedToken: TOKEN,
			context: baseContext({
				answeredBy: "telegram",
				idempotencyRecords: [first.contextPatch.idempotencyRecord],
			}),
		});
		expect(conflict).toEqual({ mode: "rejected", ackMessageId: 555, reason: "idempotency_conflict" });
	});
});
