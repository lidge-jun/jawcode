import { describe, expect, it } from "bun:test";
import { DEFAULT_TASK_AGENT, resolveTaskAgent } from "../../src/task/index";
import { getTaskSchema } from "../../src/task/types";

/**
 * Regression: the task tool's `agent` parameter is optional (JWC-adapted from upstream
 * OMP 9ccd83a13). The schema must accept a task spawn that omits `agent`; the execute path
 * then normalizes a missing/blank value to the hidden general-purpose `task` worker via the
 * production `resolveTaskAgent` helper shared by `execute()` and `#executeSync()`.
 */
describe("task agent default", () => {
	it.each([
		{ isolationEnabled: true, simpleMode: "default" },
		{ isolationEnabled: false, simpleMode: "default" },
	] as const)("schema parses tasks shape without agent in %#", options => {
		const schema = getTaskSchema(options);
		const parsed = schema.safeParse({
			tasks: [{ id: "Probe", description: "probe", assignment: "do the thing with full context" }],
		});
		expect(parsed.success).toBe(true);
		if (parsed.success) {
			expect(parsed.data.agent).toBeUndefined();
		}
	});

	it("schema still accepts an explicit agent", () => {
		const schema = getTaskSchema({ isolationEnabled: true, simpleMode: "default" });
		const parsed = schema.safeParse({
			agent: "executor",
			tasks: [{ id: "Probe", description: "probe", assignment: "do the thing with full context" }],
		});
		expect(parsed.success).toBe(true);
		if (parsed.success) {
			expect(parsed.data.agent).toBe("executor");
		}
	});

	it("resolveTaskAgent normalizes missing/blank agent to the default worker", () => {
		expect(DEFAULT_TASK_AGENT).toBe("task");
		expect(resolveTaskAgent(undefined)).toBe("task");
		expect(resolveTaskAgent("")).toBe("task");
		expect(resolveTaskAgent("   ")).toBe("task");
	});

	it("resolveTaskAgent preserves an explicit agent", () => {
		expect(resolveTaskAgent("executor")).toBe("executor");
		expect(resolveTaskAgent("executor_ext")).toBe("executor_ext");
		expect(resolveTaskAgent("planner")).toBe("planner");
	});
});
