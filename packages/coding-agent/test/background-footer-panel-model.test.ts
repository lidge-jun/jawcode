import { describe, expect, test } from "bun:test";
import {
	buildBackgroundDetailItems,
	buildBackgroundFooterModel,
} from "../src/modes/components/background-footer-panel-model";
import { EMPTY_JOBS_SNAPSHOT, type JobsSnapshot } from "../src/modes/jobs-observer";

function snapshot(over: Partial<JobsSnapshot> = {}): JobsSnapshot {
	return {
		...EMPTY_JOBS_SNAPSHOT,
		...over,
	};
}

describe("background footer panel model", () => {
	test("returns no compact copy for zero background rows", () => {
		const model = buildBackgroundFooterModel(
			snapshot({ backgroundCounts: { sub: 9, sh: 9, mon: 9, cron: 9, q: 9 } }),
		);

		expect(model.compactText).toBeUndefined();
		expect(model.rows).toEqual([]);
	});
	test("builds compact bg copy in kind order with latched attention", () => {
		const model = buildBackgroundFooterModel(
			snapshot({
				backgroundRows: [
					{ id: "sh-1", kind: "sh", label: "shell", status: "running", terminalLatched: false, startTime: 1 },
					{ id: "sub-1", kind: "sub", label: "agent", status: "failed", terminalLatched: true, startTime: 2 },
					{ id: "cron-1", kind: "cron", label: "every hour", status: "scheduled", terminalLatched: false },
				],
			}),
		);

		expect(model.compactText).toBe("bg 1sub! 1sh 1cron · ctrl+j");
		expect(model.attention).toBe(true);
		expect(model.rows.map(row => row.id)).toEqual(["sub-1", "sh-1", "cron-1"]);
	});

	test("sorts attention, running or queued, paused, then scheduled rows newest-first", () => {
		const model = buildBackgroundFooterModel(
			snapshot({
				backgroundRows: [
					{
						id: "cron-1",
						kind: "cron",
						label: "later cron",
						status: "scheduled",
						terminalLatched: false,
						nextFireAt: 10,
					},
					{ id: "paused-1", kind: "q", label: "paused", status: "paused", terminalLatched: false, startTime: 4 },
					{ id: "run-old", kind: "sh", label: "old", status: "running", terminalLatched: false, startTime: 1 },
					{ id: "run-new", kind: "sub", label: "new", status: "queued", terminalLatched: false, startTime: 5 },
					{ id: "fail-1", kind: "mon", label: "failed", status: "failed", terminalLatched: true, startTime: 2 },
				],
			}),
		);

		expect(model.rows.map(row => row.id)).toEqual(["fail-1", "run-new", "run-old", "paused-1", "cron-1"]);
	});

	test("detail items include age, schedule, result, and terminal previews", () => {
		const items = buildBackgroundDetailItems(
			snapshot({
				backgroundRows: [
					{
						id: "sh-1",
						kind: "sh",
						label: "failing shell",
						status: "failed",
						description: "exits with code 1",
						terminalLatched: true,
						outputPreview: "last stdout",
						resultPreview: "result summary",
						startTime: 1,
						nextFireAt: 2,
						errorPreview: "boom",
					},
				],
			}),
			"sh-1",
		);

		expect(items).toContainEqual({ value: "noop:output", label: "Output", description: "last stdout" });
		expect(items).toContainEqual({ value: "noop:kind", label: "Kind", description: "sh" });
		expect(items).toContainEqual({ value: "noop:label", label: "Label", description: "failing shell" });
		expect(items).toContainEqual({ value: "noop:status", label: "Status", description: "failed" });
		expect(items).toContainEqual({
			value: "noop:description",
			label: "Description",
			description: "exits with code 1",
		});
		expect(items).toContainEqual({ value: "noop:error", label: "Error", description: "boom" });
		expect(items).toContainEqual({ value: "noop:result", label: "Result", description: "result summary" });
		expect(items.some(item => item.value === "noop:age")).toBe(true);
		expect(items.some(item => item.value === "noop:next")).toBe(true);
		expect(items.at(-1)?.value).toBe("back");
	});
});
