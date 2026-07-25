import { describe, expect, it } from "bun:test";
import { MAX_LIVE_WRITE_QUEUE_CHUNKS, trimLiveWriteQueue } from "../../src/tools/bash-interactive";

describe("interactive bash live write queue", () => {
	it("compacts consumed chunks, evicts the oldest backlog, and inserts a parser resync", () => {
		const queue = Array.from({ length: MAX_LIVE_WRITE_QUEUE_CHUNKS + 12 }, (_, index) => `chunk-${index}`);
		const offset = trimLiveWriteQueue(queue, 4, true);

		expect(offset).toBe(0);
		expect(queue).toHaveLength(MAX_LIVE_WRITE_QUEUE_CHUNKS + 1);
		expect(queue[0]).toBe("chunk-4");
		expect(queue[1]?.startsWith("\u001b\\")).toBe(true);
		expect(queue.at(-1)).toBe(`chunk-${MAX_LIVE_WRITE_QUEUE_CHUNKS + 11}`);
	});
});
