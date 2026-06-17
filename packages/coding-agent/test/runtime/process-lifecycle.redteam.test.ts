import { describe, expect, it } from "bun:test";
import { spawnOwnedProcess } from "../../src/runtime/process-lifecycle";

describe("runtime process lifecycle redteam", () => {
	it("escalates disposal when a child ignores SIGTERM", async () => {
		if (process.platform === "win32") return;
		const owner = spawnOwnedProcess(["sh", "-c", "trap '' TERM; while true; do sleep 1; done"], {
			gracefulMs: 25,
			name: "test:sigterm-ignore",
		});

		await owner.dispose();
		const result = await owner.awaitExit({ timeoutMs: 1_000 });

		expect(owner.disposed).toBe(true);
		expect(result.exited).toBe(true);
	});
});
