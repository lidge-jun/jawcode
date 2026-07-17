import { afterEach, describe, expect, it } from "bun:test";
import * as path from "node:path";
import { AgentStorage } from "@jawcode-dev/coding-agent/session/agent-storage";
import { TempDir } from "@jawcode-dev/utils";

describe("AgentStorage model performance", () => {
	let tempDir: TempDir | undefined;
	let dbPath: string | undefined;

	afterEach(() => {
		if (dbPath) AgentStorage.resetInstance(dbPath);
		tempDir?.removeSync();
		tempDir = undefined;
		dbPath = undefined;
	});

	it("persists latency and error-rate aggregates across storage sessions", async () => {
		tempDir = TempDir.createSync("@jwc-model-performance-");
		dbPath = path.join(tempDir.path(), "agent.db");

		const firstSession = await AgentStorage.open(dbPath);
		firstSession.recordModelPerformance("openai/gpt-5", { latencyMs: 100, error: false });
		firstSession.recordModelPerformance("openai/gpt-5", { latencyMs: 200, error: true });
		firstSession.recordModelPerformance("openai/gpt-5", { latencyMs: 300, error: false });

		AgentStorage.resetInstance(dbPath);
		const secondSession = await AgentStorage.open(dbPath);
		const stats = secondSession.getModelPerformance().get("openai/gpt-5");

		expect(stats).toEqual({
			samples: 3,
			errors: 1,
			errorRate: 1 / 3,
			averageLatencyMs: 200,
		});
	});
});
