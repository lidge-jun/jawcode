import { describe, expect, it } from "bun:test";
import { buildTaskReceipt } from "../src/task/receipt";
import type { SingleResult } from "../src/task/types";

function baseResult(overrides: Partial<SingleResult>): SingleResult {
	return {
		index: 0,
		id: "ExecutorSlice",
		agent: "executor",
		agentSource: "bundled",
		task: "Do work",
		exitCode: 0,
		output: "done",
		stderr: "",
		truncated: false,
		durationMs: 1,
		tokens: 0,
		...overrides,
	};
}

describe("executor self-fork cache-affinity metadata", () => {
	it("preserves self-fork cache-affinity diagnostics in task receipts", () => {
		const receipt = buildTaskReceipt(
			baseResult({ cacheAffinity: { affine: true, reason: "self_fork", prewarm: "skipped" } }),
		);

		expect(receipt.cacheAffinity).toEqual({ affine: true, reason: "self_fork", prewarm: "skipped" });
	});

	it("marks executor_ext diagnostics as non-cache-affine", () => {
		const receipt = buildTaskReceipt(
			baseResult({
				agent: "executor_ext",
				cacheAffinity: { affine: false, reason: "executor_ext" },
			}),
		);

		expect(receipt.cacheAffinity).toEqual({ affine: false, reason: "executor_ext" });
	});
});
