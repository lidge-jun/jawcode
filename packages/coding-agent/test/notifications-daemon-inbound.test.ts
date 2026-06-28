import { describe, expect, it } from "bun:test";
import {
	buildRemoteActionContextFromRecord,
	executeInboundDispatchPlan,
	type InboundDispatchEffects,
} from "../src/notifications/daemon-inbound";
import type { NotificationEndpointRecord } from "../src/notifications/discovery";
import type { InboundDispatchPlan } from "../src/notifications/telegram-inbound-router";

function baseRecord(overrides: Partial<NotificationEndpointRecord> = {}): NotificationEndpointRecord {
	return {
		version: 1,
		sessionId: "sess-1",
		url: "ws://127.0.0.1:5500",
		host: "127.0.0.1",
		port: 5500,
		token: "connect-token-xyz",
		startedAt: 1,
		updatedAt: 1,
		pid: 4242,
		...overrides,
	};
}

interface SpyEffects extends InboundDispatchEffects {
	acks: Array<{ callbackQueryId: string; ok: boolean; text?: string }>;
	forwards: Array<{ sessionId: string; value: string }>;
}

function spyEffects(forwardResult: { ok: boolean; reason?: string } = { ok: true }): SpyEffects {
	const acks: SpyEffects["acks"] = [];
	const forwards: SpyEffects["forwards"] = [];
	return {
		acks,
		forwards,
		answerCallback: async input => {
			acks.push(input);
		},
		forwardToSession: async input => {
			forwards.push(input);
			return forwardResult;
		},
	};
}

describe("buildRemoteActionContextFromRecord", () => {
	it("returns undefined when the record advertises no active ask", () => {
		expect(buildRemoteActionContextFromRecord(baseRecord())).toBeUndefined();
	});

	it("returns undefined for a stale record even with a pending action", () => {
		const record = baseRecord({ stale: true, pendingAction: { actionId: "a1", options: ["yes"] } });
		expect(buildRemoteActionContextFromRecord(record)).toBeUndefined();
	});

	it("maps a published snapshot into a preliminary RemoteActionContext", () => {
		const record = baseRecord({
			pendingAction: { actionId: "a1", options: ["Approve", "Reject"], allowFreeText: true },
		});
		const ctx = buildRemoteActionContextFromRecord(record);
		expect(ctx).toEqual({
			sessionId: "sess-1",
			actionId: "a1",
			expectedToken: "connect-token-xyz",
			answeredBy: undefined,
			idempotencyRecords: [],
			allowedValues: ["Approve", "Reject"],
			allowFreeText: true,
		});
	});

	it("copies the options array (no shared reference with the record)", () => {
		const record = baseRecord({ pendingAction: { actionId: "a1", options: ["one"] } });
		const ctx = buildRemoteActionContextFromRecord(record);
		expect(ctx?.allowedValues).not.toBe(record.pendingAction?.options);
	});
});

describe("executeInboundDispatchPlan", () => {
	it("acks an accepted callback and forwards the delivered answer", async () => {
		const effects = spyEffects();
		const plan: InboundDispatchPlan = [
			{ kind: "answer_callback", callbackQueryId: "cq1", outcome: "accepted" },
			{ kind: "deliver_answer", sessionId: "sess-1", value: "Approve", source: "button" },
		];
		const result = await executeInboundDispatchPlan(plan, effects);
		expect(effects.acks).toEqual([{ callbackQueryId: "cq1", ok: true, text: undefined }]);
		expect(effects.forwards).toEqual([{ sessionId: "sess-1", value: "Approve" }]);
		expect(result.acked).toBe(1);
		expect(result.forwarded).toBe(1);
		expect(result.failed).toBe(0);
	});

	it("acks a rejected callback as not-ok and performs no forward", async () => {
		const effects = spyEffects();
		const plan: InboundDispatchPlan = [
			{ kind: "answer_callback", callbackQueryId: "cq2", outcome: "rejected", reason: "stale_action" },
		];
		const result = await executeInboundDispatchPlan(plan, effects);
		expect(effects.acks).toEqual([{ callbackQueryId: "cq2", ok: false, text: "stale_action" }]);
		expect(effects.forwards).toHaveLength(0);
		expect(result.acked).toBe(1);
		expect(result.forwarded).toBe(0);
	});

	it("forwards a plain reply (free text with no active ask)", async () => {
		const effects = spyEffects();
		const plan: InboundDispatchPlan = [
			{ kind: "forward_reply", sessionId: "sess-7", text: "hello there", updateId: 99 },
		];
		const result = await executeInboundDispatchPlan(plan, effects);
		expect(effects.forwards).toEqual([{ sessionId: "sess-7", value: "hello there" }]);
		expect(result.forwarded).toBe(1);
	});

	it("counts a drop and performs no effects", async () => {
		const effects = spyEffects();
		const result = await executeInboundDispatchPlan([{ kind: "drop", reason: "wrong_chat" }], effects);
		expect(effects.acks).toHaveLength(0);
		expect(effects.forwards).toHaveLength(0);
		expect(result.dropped).toBe(1);
		expect(result.executed[0]).toEqual({ kind: "drop", ok: true, detail: "wrong_chat" });
	});

	it("tallies a forward the session did not accept as failed (still ran)", async () => {
		const effects = spyEffects({ ok: false, reason: "already_answered" });
		const plan: InboundDispatchPlan = [
			{ kind: "deliver_answer", sessionId: "sess-1", value: "Reject", source: "button" },
		];
		const result = await executeInboundDispatchPlan(plan, effects);
		expect(result.forwarded).toBe(0);
		expect(result.failed).toBe(1);
		expect(result.executed[0]).toEqual({ kind: "deliver_answer", ok: false, detail: "already_answered" });
	});

	it("swallows a throwing effect, tallies it failed, and keeps running the rest of the plan", async () => {
		const effects = spyEffects();
		effects.answerCallback = async () => {
			throw new Error("network down");
		};
		const plan: InboundDispatchPlan = [
			{ kind: "answer_callback", callbackQueryId: "cq3", outcome: "accepted" },
			{ kind: "drop", reason: "no_topic" },
		];
		const result = await executeInboundDispatchPlan(plan, effects);
		expect(result.failed).toBe(1);
		expect(result.dropped).toBe(1);
		expect(result.executed[0]).toEqual({ kind: "answer_callback", ok: false, detail: "network down" });
	});
});
