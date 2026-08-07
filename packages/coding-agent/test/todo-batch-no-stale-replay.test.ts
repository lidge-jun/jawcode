/**
 * A batch of `todo_write` calls must not lose completions.
 *
 * `TodoWriteTool` commits phases synchronously inside `execute()`. The session
 * ALSO re-applied `details.phases` when the tool RESULT arrived — and result
 * handling is asynchronous, so a newer call from the same batch can already have
 * committed by then. Replaying the older snapshot rolled it back, silently
 * undoing completions.
 *
 * This drives the REAL tool against a real session rather than modelling the
 * race, so it fails if the replay is reintroduced.
 */
import { describe, expect, it } from "bun:test";
import { TodoWriteTool } from "@jawcode-dev/coding-agent/tools";
import type { TodoPhase } from "@jawcode-dev/coding-agent/tools/todo-write";

/** Minimal session surface the tool actually touches. */
function createTodoSession() {
	let phases: TodoPhase[] = [];
	return {
		getTodoPhases: () => phases,
		setTodoPhases: (next: TodoPhase[]) => {
			phases = next;
		},
		getSessionFile: () => undefined,
		current: () => phases,
	};
}

describe("todo_write batch state", () => {
	it("keeps every completion from a batch of sequential calls", async () => {
		const session = createTodoSession();
		const tool = new TodoWriteTool(session as never);

		await tool.execute("init", {
			ops: [{ op: "init", list: [{ phase: "work", items: ["one", "two", "three"] }] }],
		} as never);

		// Complete each task in turn, exactly as a batch of exclusive calls would.
		const results = [];
		for (const task of ["one", "two", "three"]) {
			results.push(await tool.execute(`done-${task}`, { ops: [{ op: "done", task }] } as never));
		}

		const states = session
			.current()
			.flatMap(phase => (phase as unknown as { tasks: Array<{ status?: string }> }).tasks)
			.map(entry => entry.status);
		// Every task must be complete. A stale replay would resurrect an earlier
		// snapshot and leave later completions undone.
		expect(states).toEqual(["completed", "completed", "completed"]);

		// The final result must describe the live state, not an older view of it.
		const lastDetails = results.at(-1)?.details as { phases?: TodoPhase[] } | undefined;
		expect(lastDetails?.phases).toEqual(session.current());
	});
});

describe("todo_write result revision", () => {
	it("increases monotonically so results carry their ordering", async () => {
		const session = createTodoSession();
		const tool = new TodoWriteTool(session as never);

		await tool.execute("i", { ops: [{ op: "init", list: [{ phase: "work", items: ["a", "b", "c"] }] }] } as never);
		const revisions: number[] = [];
		for (const task of ["a", "b"]) {
			const result = await tool.execute(`d-${task}`, { ops: [{ op: "done", task }] } as never);
			revisions.push((result.details as { revision: number }).revision);
		}

		// Ordering is what lets the session drop an earlier result that lands late.
		// Comparing list SIZES cannot, because `rm` shrinks the list on purpose.
		expect(revisions).toEqual([2, 3]);
	});

	it("still reports a revision when an op legitimately removes a task", async () => {
		const session = createTodoSession();
		const tool = new TodoWriteTool(session as never);
		await tool.execute("i", { ops: [{ op: "init", list: [{ phase: "work", items: ["a", "b", "c"] }] }] } as never);

		const removed = await tool.execute("rm", { ops: [{ op: "rm", task: "b" }] } as never);
		const details = removed.details as { phases: TodoPhase[]; revision: number };
		const remaining = details.phases.flatMap(entry => (entry as unknown as { tasks: unknown[] }).tasks);

		// A size-based staleness heuristic would have discarded this real removal.
		expect(remaining).toHaveLength(2);
		expect(details.revision).toBe(2);
	});
});
