import { describe, expect, it } from "bun:test";
import {
	buildTelegramCallbackPayload,
	decideRemoteAnswer,
	normalizeRemoteAnswerValue,
	parseTelegramCallbackPayload,
	type RemoteActionContext,
	type RemoteAnswerInput,
	stripTelegramOptionPrefix,
} from "../src/notifications/remote-answer";

function context(overrides: Partial<RemoteActionContext> = {}): RemoteActionContext {
	return {
		sessionId: "session-1",
		actionId: "action-1",
		expectedToken: "connect-token",
		allowedValues: ["Deploy", "Skip"],
		allowFreeText: true,
		...overrides,
	};
}

function input(overrides: Partial<RemoteAnswerInput> = {}): RemoteAnswerInput {
	return {
		sessionId: "session-1",
		actionId: "action-1",
		idempotencyKey: "idem-1",
		transport: "telegram",
		kind: "button",
		value: "1. Deploy",
		presentedToken: "connect-token",
		...overrides,
	};
}

describe("notification remote answers", () => {
	it("accepts an authorized Telegram button answer and returns an atomic context patch", () => {
		const decision = decideRemoteAnswer(input(), context());

		expect(decision).toMatchObject({
			status: "accepted",
			answer: {
				sessionId: "session-1",
				actionId: "action-1",
				idempotencyKey: "idem-1",
				source: "telegram",
				kind: "button",
				value: "Deploy",
			},
			contextPatch: {
				answeredBy: "telegram",
				idempotencyRecord: { key: "idem-1", status: "accepted" },
			},
		});
		expect(JSON.stringify(decision)).not.toContain("connect-token");
	});

	it("rejects unauthorized, stale, mismatched, and already-answered remote answers", () => {
		expect(decideRemoteAnswer(input({ presentedToken: "wrong" }), context())).toMatchObject({
			status: "rejected",
			reason: "unauthorized",
		});
		expect(decideRemoteAnswer(input({ sessionId: "other-session" }), context())).toMatchObject({
			status: "rejected",
			reason: "session_mismatch",
		});
		expect(decideRemoteAnswer(input({ actionId: "old-action" }), context())).toMatchObject({
			status: "rejected",
			reason: "stale_action",
		});
		expect(decideRemoteAnswer(input(), context({ answeredBy: "local" }))).toMatchObject({
			status: "rejected",
			reason: "already_answered",
		});
	});

	it("handles idempotent replay and same-key body conflicts", () => {
		const first = decideRemoteAnswer(input(), context());
		expect(first.status).toBe("accepted");
		if (first.status !== "accepted") throw new Error("expected accepted");
		const replayContext = context({
			idempotencyRecords: [first.contextPatch.idempotencyRecord],
		});

		expect(decideRemoteAnswer(input(), replayContext)).toMatchObject({
			status: "accepted",
			answer: { value: "Deploy" },
		});
		expect(decideRemoteAnswer(input({ value: "2. Skip" }), replayContext)).toEqual({
			status: "rejected",
			reason: "idempotency_conflict",
		});
	});

	it("accepts free text only when allowed and non-empty", () => {
		expect(
			decideRemoteAnswer(
				input({ kind: "free_text", value: "  custom path  " }),
				context({ allowedValues: undefined }),
			),
		).toMatchObject({
			status: "accepted",
			answer: { kind: "free_text", value: "custom path" },
		});
		expect(
			decideRemoteAnswer(
				input({ kind: "free_text", value: "custom path" }),
				context({ allowedValues: undefined, allowFreeText: false }),
			),
		).toEqual({ status: "rejected", reason: "free_text_not_allowed" });
		expect(
			decideRemoteAnswer(input({ kind: "free_text", value: "   " }), context({ allowedValues: undefined })),
		).toEqual({ status: "rejected", reason: "empty_free_text" });
	});

	it("strips duplicate option numbering and rejects unknown button values", () => {
		expect(stripTelegramOptionPrefix("1. Deploy")).toBe("Deploy");
		expect(stripTelegramOptionPrefix("2) Skip")).toBe("Skip");
		expect(normalizeRemoteAnswerValue(input({ value: "2) Skip" }))).toBe("Skip");
		expect(decideRemoteAnswer(input({ value: "3. Destroy" }), context())).toEqual({
			status: "rejected",
			reason: "invalid_button_value",
		});
	});

	it("builds and parses bounded callback payloads without token or chat values", () => {
		const payload = buildTelegramCallbackPayload({
			sessionId: "session-1",
			actionId: "action-1",
			value: "1. Deploy",
			nonce: "idem-1",
		});
		expect(payload).not.toContain("connect-token");
		expect(parseTelegramCallbackPayload(payload)).toEqual({
			ok: true,
			input: {
				sessionId: "session-1",
				actionId: "action-1",
				idempotencyKey: "idem-1",
				transport: "telegram",
				kind: "button",
				value: "1. Deploy",
			},
		});
		expect(parseTelegramCallbackPayload("not-json")).toEqual({ ok: false, code: "invalid_payload" });
		expect(() =>
			buildTelegramCallbackPayload({
				sessionId: "session-1",
				actionId: "action-1",
				value: "x".repeat(300),
				nonce: "idem-1",
			}),
		).toThrow("callback_payload_too_large");
	});
});
