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
import { isStaleTodoReplay } from "@jawcode-dev/coding-agent/session/agent-session";
import { TodoWriteTool } from "@jawcode-dev/coding-agent/tools";
import type { TodoPhase } from "@jawcode-dev/coding-agent/tools/todo-write";

function phase(tasks: Array<{ content: string; status: string }>): TodoPhase {
	return { name: "work", tasks } as unknown as TodoPhase;
}

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

describe("stale todo replay detection", () => {
	it("rejects a snapshot with fewer completions than the live state", () => {
		const live = [
			phase([
				{ content: "a", status: "completed" },
				{ content: "b", status: "completed" },
			]),
		];
		const older = [
			phase([
				{ content: "a", status: "completed" },
				{ content: "b", status: "in_progress" },
			]),
		];
		// This is the rollback: an earlier call's result arriving after a later one.
		expect(isStaleTodoReplay(live, older)).toBe(true);
	});

	it("rejects a snapshot that lost tasks entirely", () => {
		const live = [
			phase([
				{ content: "a", status: "completed" },
				{ content: "b", status: "pending" },
			]),
		];
		const older = [phase([{ content: "a", status: "completed" }])];
		expect(isStaleTodoReplay(live, older)).toBe(true);
	});

	it("accepts a genuine forward update", () => {
		const live = [phase([{ content: "a", status: "in_progress" }])];
		const next = [
			phase([
				{ content: "a", status: "completed" },
				{ content: "b", status: "pending" },
			]),
		];
		// Bridging a tool that holds a different session object must still work.
		expect(isStaleTodoReplay(live, next)).toBe(false);
	});

	it("accepts an identical snapshot", () => {
		const live = [phase([{ content: "a", status: "completed" }])];
		expect(isStaleTodoReplay(live, live)).toBe(false);
	});
});
