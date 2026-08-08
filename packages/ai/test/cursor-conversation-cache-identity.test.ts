/**
 * The cursor provider caches per-conversation state in two module-global maps.
 * The key used to be the wire `conversationId`, which falls back to the host
 * session id — stable across a model switch and across accounts. Two different
 * models in one session therefore shared one cached
 * `ConversationStateStructure`, and that state carries model-specific content:
 * `buildCursorSystemPromptJsons` emits an extra edit-discipline prompt for
 * composer models, and the state also holds todos, file states and summaries.
 *
 * Neither map had a delete anywhere, so both grew for the process lifetime.
 */
import { describe, expect, it } from "bun:test";
import * as fs from "node:fs";
import * as path from "node:path";
import {
	CURSOR_MAX_CACHED_CONVERSATIONS,
	conversationCacheForTest,
	conversationCacheKeyForTest,
} from "../src/providers/cursor";
import type { Model } from "../src/types";

function cursorModel(id: string): Model<"cursor-agent"> {
	return {
		api: "cursor-agent",
		provider: "cursor",
		id,
		name: id,
		contextWindow: 200000,
		maxTokens: 64000,
		input: ["text"],
		reasoning: false,
		cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
	} as Model<"cursor-agent">;
}

const SESSION = "host-session-id";

describe("cursor conversation cache identity", () => {
	it("does not share cached state between two models in one session", () => {
		const a = conversationCacheKeyForTest(SESSION, cursorModel("claude-sonnet-4-6"), "key-1");
		const b = conversationCacheKeyForTest(SESSION, cursorModel("composer-1"), "key-1");
		expect(a).not.toBe(b);
	});

	it("does not share cached state between two accounts on one session and model", () => {
		const a = conversationCacheKeyForTest(SESSION, cursorModel("composer-1"), "key-1");
		const b = conversationCacheKeyForTest(SESSION, cursorModel("composer-1"), "key-2");
		expect(a).not.toBe(b);
	});

	it("still reuses cached state for the same session, model and account", () => {
		// Control. Qualifying the key must not degenerate into disabling the
		// cache — a key that never repeats would pass both tests above while
		// making every turn rebuild from scratch.
		const a = conversationCacheKeyForTest(SESSION, cursorModel("composer-1"), "key-1");
		const b = conversationCacheKeyForTest(SESSION, cursorModel("composer-1"), "key-1");
		expect(a).toBe(b);
	});

	it("keeps the api key out of the derived identity", () => {
		const key = conversationCacheKeyForTest(SESSION, cursorModel("composer-1"), "sk-secret-value");
		expect(key).not.toContain("sk-secret-value");
		expect(key).toMatch(/^[0-9a-f]{32}$/);
	});

	it("distinguishes two conversations under one account and model", () => {
		const a = conversationCacheKeyForTest("conversation-a", cursorModel("composer-1"), "key-1");
		const b = conversationCacheKeyForTest("conversation-b", cursorModel("composer-1"), "key-1");
		expect(a).not.toBe(b);
	});
});

describe("cursor conversation cache eviction", () => {
	it("bounds retained conversations", () => {
		const cache = conversationCacheForTest();
		for (let i = 0; i < CURSOR_MAX_CACHED_CONVERSATIONS + 10; i++) {
			cache.write(`conversation-${i}`, `state-${i}`);
		}
		expect(cache.keys().length).toBe(CURSOR_MAX_CACHED_CONVERSATIONS);
	});

	it("evicts the least recently used entry, not the newest", () => {
		const cache = conversationCacheForTest();
		for (let i = 0; i < CURSOR_MAX_CACHED_CONVERSATIONS; i++) {
			cache.write(`conversation-${i}`, `state-${i}`);
		}
		cache.write("overflowing-entry", "state-new");

		expect(cache.read("conversation-0")).toBeUndefined();
		expect(cache.read("overflowing-entry")).toBe("state-new");
		expect(cache.read(`conversation-${CURSOR_MAX_CACHED_CONVERSATIONS - 1}`)).toBe(
			`state-${CURSOR_MAX_CACHED_CONVERSATIONS - 1}`,
		);
	});

	it("spares an entry that keeps being read", () => {
		// A read has to refresh recency, otherwise the conversation being
		// actively streamed is exactly the one evicted by background traffic.
		const cache = conversationCacheForTest();
		cache.write("long-lived", "state-kept");
		for (let i = 0; i < CURSOR_MAX_CACHED_CONVERSATIONS - 1; i++) {
			cache.write(`filler-${i}`, `state-${i}`);
			expect(cache.read("long-lived")).toBe("state-kept");
		}
		cache.write("one-more", "state-more");

		expect(cache.read("long-lived")).toBe("state-kept");
		expect(cache.read("filler-0")).toBeUndefined();
	});

	it("overwrites rather than duplicates a repeated key", () => {
		const cache = conversationCacheForTest();
		cache.write("same", "first");
		cache.write("same", "second");
		expect(cache.keys()).toEqual(["same"]);
		expect(cache.read("same")).toBe("second");
	});
});

/**
 * The tests above exercise the helpers. These pin the call site, because a
 * correct helper is worthless if the stream path stops using it — the exact
 * failure mode that has bitten this session three times.
 */
describe("cursor stream path uses the qualified cache identity", () => {
	const source = fs.readFileSync(path.join(import.meta.dir, "..", "src", "providers", "cursor.ts"), "utf-8");

	it("derives a cache key and never keys a cache on the wire conversation id", () => {
		expect(source).toContain("conversationCacheKey(conversationId, model, apiKey)");
		// Every cache touch must go through the helpers, which take `cacheKey`.
		expect(source).not.toMatch(/conversation(StateCache|BlobStores)\.(get|set)\(conversationId/);
	});

	it("still sends the caller's conversation id on the wire", () => {
		// The server owns this value; qualifying the local cache must not change it.
		expect(source).toContain("conversationId: state.conversationId");
	});

	it("stores the server-echoed checkpoint under the same qualified key", () => {
		const start = source.indexOf("const onConversationCheckpoint =");
		expect(start).toBeGreaterThan(-1);
		const body = source.slice(start, source.indexOf("};", start));
		expect(body).toContain("cacheKey");
		expect(body).not.toMatch(/set\(conversationId/);
	});

	it("routes every conversation-cache write through the bounded helper", () => {
		// A raw `.set` would reintroduce unbounded growth on that path.
		const rawWrites = source.match(/conversation(StateCache|BlobStores)\.set\(/g) ?? [];
		expect(rawWrites).toEqual([]);
	});
});
