import { describe, expect, it } from "bun:test";
import { spawnOwnedProcess } from "../../src/runtime/process-lifecycle";

describe("runtime process lifecycle", () => {
	it("returns a bounded await result without waiting for process exit", async () => {
		const owner = spawnOwnedProcess(["bun", "--eval", "setTimeout(() => {}, 200)"], {
			name: "test:await-exit-timeout",
		});
		try {
			const result = await owner.awaitExit({ timeoutMs: 10 });

			expect(result.exited).toBe(false);
			expect(owner.disposed).toBe(false);
		} finally {
			await owner.dispose();
		}
	});

	it("disposes idempotently", async () => {
		const owner = spawnOwnedProcess(["bun", "--eval", "setInterval(() => {}, 1_000)"], {
			name: "test:idempotent-dispose",
		});

		const first = owner.dispose();
		const second = owner.dispose();

		expect(second).toBe(first);
		await first;
		expect(owner.disposed).toBe(true);
	});
});
