import { describe, expect, it } from "bun:test";
import type { RemoteActionContext } from "../src/notifications/remote-answer";
import { answerTelegramCallbackQuery, type TelegramUpdate } from "../src/notifications/telegram-api";
import { buildAskInlineKeyboard } from "../src/notifications/telegram-ask-keyboard";
import {
	decideTelegramCallbackInbound,
	extractTelegramCallbackQuery,
} from "../src/notifications/telegram-callback-ingest";

const TOKEN = "tok-secret-123";
const NONCE = "abc123def456";
const ALLOWED = ["Yes, proceed", "No, stop", "Maybe later"];

function baseContext(overrides: Partial<RemoteActionContext> = {}): RemoteActionContext {
	return {
		sessionId: "sess-1",
		actionId: "act-1",
		expectedToken: TOKEN,
		allowedValues: ALLOWED,
		...overrides,
	};
}

function callbackUpdate(callbackData: string, id = "cbq-1"): TelegramUpdate {
	return {
		update_id: 100,
		callback_query: {
			id,
			data: callbackData,
			from: { id: 42 },
			message: { chat: { id: -100 }, message_thread_id: 7 },
		},
	};
}

function buttonCallbackData(index: number): string {
	const kb = buildAskInlineKeyboard({ options: ALLOWED, nonce: NONCE });
	return kb.flat()[index].callback_data;
}

describe("extractTelegramCallbackQuery", () => {
	it("returns null for a plain message update", () => {
		expect(extractTelegramCallbackQuery({ update_id: 1, message: { text: "hi" } })).toBeNull();
	});

	it("returns null for a malformed callback (missing id)", () => {
		expect(extractTelegramCallbackQuery({ update_id: 1, callback_query: { data: "x" } })).toBeNull();
	});

	it("extracts id/data/chat/thread from a well-formed callback", () => {
		const cb = extractTelegramCallbackQuery(callbackUpdate("jwc1:0:n"));
		expect(cb).toEqual({ id: "cbq-1", data: "jwc1:0:n", fromId: 42, chatId: -100, messageThreadId: 7 });
	});
});

describe("decideTelegramCallbackInbound", () => {
	it("ignores a non-callback update", () => {
		const d = decideTelegramCallbackInbound({ update: { update_id: 1, message: {} }, context: baseContext() });
		expect(d).toEqual({ mode: "ignore", reason: "not_a_callback" });
	});

	it("ignores a callback with no data", () => {
		const d = decideTelegramCallbackInbound({
			update: { update_id: 1, callback_query: { id: "cbq-9" } },
			context: baseContext(),
		});
		expect(d).toEqual({ mode: "ignore", reason: "empty_callback_data" });
	});

	it("accepts a valid button tap and resolves to the canonical value", () => {
		const d = decideTelegramCallbackInbound({
			update: callbackUpdate(buttonCallbackData(1)),
			presentedToken: TOKEN,
			context: baseContext(),
		});
		expect(d.mode).toBe("accepted");
		if (d.mode === "accepted") {
			expect(d.callbackQueryId).toBe("cbq-1");
			expect(d.answer.value).toBe("No, stop");
			expect(d.answer.kind).toBe("button");
			expect(d.contextPatch.answeredBy).toBe("telegram");
		}
	});

	it("rejects an out-of-range / garbage callback with invalid_button_value + callbackQueryId", () => {
		const d = decideTelegramCallbackInbound({
			update: callbackUpdate("jwc1:9:nonce"),
			presentedToken: TOKEN,
			context: baseContext(),
		});
		expect(d).toEqual({ mode: "rejected", callbackQueryId: "cbq-1", reason: "invalid_button_value" });
	});

	it("rejects when no active action context is present", () => {
		const d = decideTelegramCallbackInbound({ update: callbackUpdate(buttonCallbackData(0)) });
		expect(d).toEqual({ mode: "rejected", callbackQueryId: "cbq-1", reason: "stale_action" });
	});

	it("rejects a wrong presented token as unauthorized (enforced by decideRemoteAnswer)", () => {
		const d = decideTelegramCallbackInbound({
			update: callbackUpdate(buttonCallbackData(0)),
			presentedToken: "wrong-token",
			context: baseContext(),
		});
		expect(d).toEqual({ mode: "rejected", callbackQueryId: "cbq-1", reason: "unauthorized" });
	});

	it("rejects a replayed nonce with a conflicting value as idempotency_conflict", () => {
		const d = decideTelegramCallbackInbound({
			update: callbackUpdate(buttonCallbackData(1)),
			presentedToken: TOKEN,
			context: baseContext({
				idempotencyRecords: [{ key: NONCE, valueHash: "deadbeefdeadbeef", status: "accepted" }],
			}),
		});
		expect(d).toEqual({ mode: "rejected", callbackQueryId: "cbq-1", reason: "idempotency_conflict" });
	});

	it("rejects a second answer once the action is already answered", () => {
		const d = decideTelegramCallbackInbound({
			update: callbackUpdate(buttonCallbackData(0)),
			presentedToken: TOKEN,
			context: baseContext({ answeredBy: "local" }),
		});
		expect(d).toEqual({ mode: "rejected", callbackQueryId: "cbq-1", reason: "already_answered" });
	});
});

describe("answerTelegramCallbackQuery", () => {
	it("issues answerCallbackQuery with the callback id and optional text", async () => {
		let calledUrl = "";
		const fetchImpl = (async (url: string) => {
			calledUrl = url;
			return new Response(JSON.stringify({ ok: true, result: true }), { status: 200 });
		}) as unknown as typeof fetch;
		const out = await answerTelegramCallbackQuery({
			token: TOKEN,
			callbackQueryId: "cbq-1",
			text: "Got it",
			fetchImpl,
		});
		expect(out.ok).toBe(true);
		expect(calledUrl).toContain("answerCallbackQuery");
		expect(calledUrl).toContain("callback_query_id=cbq-1");
		expect(calledUrl).toContain("text=Got+it");
	});

	it("sanitizes the token out of error reasons", async () => {
		const fetchImpl = (async () =>
			new Response(JSON.stringify({ ok: false, description: `bad ${TOKEN}` }), {
				status: 400,
			})) as unknown as typeof fetch;
		const out = await answerTelegramCallbackQuery({ token: TOKEN, callbackQueryId: "cbq-1", fetchImpl });
		expect(out.ok).toBe(false);
		if (!out.ok) expect(out.reason).not.toContain(TOKEN);
	});
});
