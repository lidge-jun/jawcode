import { describe, expect, it } from "bun:test";
import {
	classifyThreadInboundUpdate,
	renderThreadActionNeeded,
	renderThreadIdentityHeader,
	ThreadTopicRegistry,
} from "../src/notifications";
import { fingerprintSecret } from "../src/notifications/transport-state";

const rawChatId = "123456789";
const chatIdFingerprint = fingerprintSecret(rawChatId);

function registry(): ThreadTopicRegistry {
	const topics = new ThreadTopicRegistry();
	topics.upsert({
		sessionId: "session-1",
		messageThreadId: 42,
		chatIdFingerprint,
		title: "Session one",
		updatedAt: 1,
	});
	return topics;
}

function context(seen = new Set<number>()) {
	return {
		expectedChatIdFingerprint: chatIdFingerprint,
		isDuplicateUpdate: (updateId: number) => seen.has(updateId),
		recordUpdateId: (updateId: number) => {
			seen.add(updateId);
		},
	};
}

describe("notification threaded surface", () => {
	it("dedupes topic records by session id and never stores raw chat ids or tokens", () => {
		const topics = registry();
		topics.markStale("session-1", 2);
		topics.upsert({
			sessionId: "session-1",
			messageThreadId: 84,
			chatIdFingerprint,
			title: "Replacement",
			updatedAt: 3,
			stale: true,
		});

		expect(topics.list()).toEqual([
			{
				sessionId: "session-1",
				messageThreadId: 84,
				chatIdFingerprint,
				title: "Replacement",
				updatedAt: 3,
				stale: false,
			},
		]);
		expect(JSON.stringify(topics.list())).not.toContain(rawChatId);
		expect(JSON.stringify(topics.list())).not.toContain("bot-token");
	});

	it("renders JWC identity and action prompts with bounded text and no double numbering", () => {
		const header = renderThreadIdentityHeader({
			title: undefined,
			repo: "jawcode",
			branch: "main",
			machine: "dev-machine",
			sessionId: "session-1",
		});
		const action = renderThreadActionNeeded({
			type: "action_needed",
			actionId: "action-1",
			prompt: "Deploy?".repeat(40),
			options: ["1. Deploy", "2) Skip"],
		});

		expect(header).toContain("JWC session");
		expect(header).toContain("jwc threaded session");
		expect(header).toContain(".jwc/state/notifications");
		expect(action).toContain("1. Deploy");
		expect(action).toContain("2. Skip");
		expect(action).not.toContain("1. 1. Deploy");
		expect(action.length).toBeLessThan(260);
		expect(JSON.stringify({ header, action })).not.toContain(rawChatId);
		expect(JSON.stringify({ header, action })).not.toContain("bot-token");
	});

	it("routes known text updates inertly and records update ids", () => {
		const seen = new Set<number>();
		const decision = classifyThreadInboundUpdate(
			{ updateId: 1, chatId: rawChatId, messageThreadId: "42", text: "  hello  " },
			registry(),
			context(seen),
		);

		expect(decision).toEqual({ mode: "route", sessionId: "session-1", text: "hello", updateId: 1 });
		expect(seen.has(1)).toBe(true);
		expect(JSON.stringify(decision)).not.toContain("42");
		expect(JSON.stringify(decision)).not.toContain(rawChatId);
	});

	it("drops wrong chat, missing topic, unknown topic, duplicate update, empty text, and stale topics", () => {
		const seen = new Set<number>([4]);
		const topics = registry();
		expect(
			classifyThreadInboundUpdate(
				{ updateId: 1, chatId: "other", messageThreadId: 42, text: "hello" },
				topics,
				context(),
			),
		).toEqual({ mode: "drop", reason: "wrong_chat" });
		expect(classifyThreadInboundUpdate({ updateId: 2, chatId: rawChatId, text: "hello" }, topics, context())).toEqual(
			{
				mode: "drop",
				reason: "no_topic",
			},
		);
		expect(
			classifyThreadInboundUpdate(
				{ updateId: 3, chatId: rawChatId, messageThreadId: 99, text: "hello" },
				topics,
				context(),
			),
		).toEqual({ mode: "drop", reason: "unknown_topic" });
		expect(
			classifyThreadInboundUpdate(
				{ updateId: 4, chatId: rawChatId, messageThreadId: 42, text: "hello" },
				topics,
				context(seen),
			),
		).toEqual({ mode: "drop", reason: "duplicate_update" });
		expect(
			classifyThreadInboundUpdate({ chatId: rawChatId, messageThreadId: 42, text: "hello" }, topics, context()),
		).toEqual({
			mode: "drop",
			reason: "missing_update_id",
		});
		expect(
			classifyThreadInboundUpdate(
				{ updateId: 5, chatId: rawChatId, messageThreadId: 42, text: " " },
				topics,
				context(),
			),
		).toEqual({
			mode: "drop",
			reason: "empty_text",
		});
		topics.markStale("session-1", 5);
		expect(
			classifyThreadInboundUpdate(
				{ updateId: 6, chatId: rawChatId, messageThreadId: 42, text: "hello" },
				topics,
				context(),
			),
		).toEqual({ mode: "drop", reason: "stale_topic" });
	});

	it("fails closed for attachment-bearing updates without routing captions", () => {
		const topics = registry();
		expect(
			classifyThreadInboundUpdate(
				{ updateId: 1, chatId: rawChatId, messageThreadId: 42, hasAttachment: true },
				topics,
				context(),
			),
		).toEqual({ mode: "drop", reason: "attachment_not_supported" });
		expect(
			classifyThreadInboundUpdate(
				{ updateId: 2, chatId: rawChatId, messageThreadId: 42, caption: "caption", hasAttachment: true },
				topics,
				context(),
			),
		).toEqual({ mode: "drop", reason: "attachment_not_supported" });
		expect(
			classifyThreadInboundUpdate(
				{ updateId: 3, chatId: "other", messageThreadId: 42, text: "hello", hasAttachment: true },
				topics,
				context(),
			),
		).toEqual({ mode: "drop", reason: "wrong_chat" });
	});
});
