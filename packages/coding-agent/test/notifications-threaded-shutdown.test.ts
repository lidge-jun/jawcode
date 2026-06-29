import { describe, expect, it } from "bun:test";
import { deleteSessionTopics } from "../src/notifications/threaded-shutdown";

function deleteImplReturning(results: boolean[]): {
	calls: number[];
	impl: (opts: {
		token: string;
		chatId: string;
		messageThreadId: number;
	}) => Promise<{ ok: true } | { ok: false; retryable: boolean; reason: string }>;
} {
	const calls: number[] = [];
	let index = 0;
	return {
		calls,
		impl: async opts => {
			calls.push(opts.messageThreadId);
			const ok = results[index++] ?? true;
			return ok ? { ok: true } : { ok: false, retryable: false, reason: "not-found" };
		},
	};
}

describe("deleteSessionTopics", () => {
	it("deletes all topics and tallies success", async () => {
		const { calls, impl } = deleteImplReturning([true, true]);
		const result = await deleteSessionTopics({
			token: "t",
			chatId: "c",
			topics: [{ messageThreadId: 1 }, { messageThreadId: 2 }],
			deleteImpl: impl as never,
		});
		expect(result).toEqual({ attempted: 2, deleted: 2, failed: 0 });
		expect(calls).toEqual([1, 2]);
	});

	it("tallies mixed success/failure without throwing", async () => {
		const { impl } = deleteImplReturning([true, false]);
		const result = await deleteSessionTopics({
			token: "t",
			chatId: "c",
			topics: [{ messageThreadId: 1 }, { messageThreadId: 2 }],
			deleteImpl: impl as never,
		});
		expect(result).toEqual({ attempted: 2, deleted: 1, failed: 1 });
	});

	it("counts a throwing delete as failed and never propagates", async () => {
		const throwing = (async () => {
			throw new Error("network down");
		}) as never;
		const result = await deleteSessionTopics({
			token: "t",
			chatId: "c",
			topics: [{ messageThreadId: 9 }],
			deleteImpl: throwing,
		});
		expect(result).toEqual({ attempted: 1, deleted: 0, failed: 1 });
	});

	it("is a no-op for an empty topic list", async () => {
		const result = await deleteSessionTopics({ token: "t", chatId: "c", topics: [] });
		expect(result).toEqual({ attempted: 0, deleted: 0, failed: 0 });
	});
});
