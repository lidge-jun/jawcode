/**
 * The todo result-bridge must be exercised through the REAL session event path.
 *
 * `todo-batch-no-stale-replay.test.ts` drives the tool against a stand-in
 * session object, so it cannot see the session-side guard that decides whether
 * to accept a `todo_write` result. That guard is where the staleness bug lived:
 * an earlier version compared LIST SIZES, which silently discarded legitimate
 * `rm`/`drop` results because those shrink the list on purpose.
 *
 * Here the tool holds a DIFFERENT session facade than the AgentSession — the
 * arrangement the bridge exists for — so the only way the session's cached
 * phases can update is through the real tool-result event.
 */
import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { Agent } from "@jawcode-dev/agent-core";
import { getBundledModel } from "@jawcode-dev/ai";
import { createMockModel, type MockModelHandle } from "@jawcode-dev/ai/providers/mock";
import { ModelRegistry } from "@jawcode-dev/coding-agent/config/model-registry";
import { Settings } from "@jawcode-dev/coding-agent/config/settings";
import { AgentSession } from "@jawcode-dev/coding-agent/session/agent-session";
import { AuthStorage } from "@jawcode-dev/coding-agent/session/auth-storage";
import { SessionManager } from "@jawcode-dev/coding-agent/session/session-manager";
import type { ToolSession } from "@jawcode-dev/coding-agent/tools";
import { type TodoPhase, TodoWriteTool } from "@jawcode-dev/coding-agent/tools/todo-write";

/** The separate facade the SDK wires for tools; deliberately NOT the AgentSession. */
function createDetachedToolSession(): ToolSession {
	let phases: TodoPhase[] = [];
	return {
		getTodoPhases: () => phases,
		setTodoPhases: (next: TodoPhase[]) => {
			phases = next;
		},
		getSessionFile: () => null,
	} as unknown as ToolSession;
}

function taskStates(phases: TodoPhase[]): string[] {
	return phases.flatMap(phase => phase.tasks).map(task => task.content);
}

describe("AgentSession todo bridge (event path)", () => {
	let session: AgentSession;
	let tempDir: string;
	let mock: MockModelHandle;
	let authStorage: AuthStorage | undefined;

	beforeEach(async () => {
		tempDir = path.join(os.tmpdir(), `jwc-todo-bridge-path-${Date.now()}-${Math.random().toString(36).slice(2)}`);
		fs.mkdirSync(tempDir, { recursive: true });

		const model = getBundledModel("anthropic", "claude-sonnet-4-5");
		if (!model) throw new Error("Test model not found in registry");

		authStorage = await AuthStorage.create(path.join(tempDir, "testauth.db"));
		authStorage.setRuntimeApiKey("anthropic", "test-key");
		const modelRegistry = new ModelRegistry(authStorage, path.join(tempDir, "models.yml"));

		// One script: seed three tasks, then remove one, then stop.
		mock = createMockModel({
			responses: [
				{
					content: [
						{
							type: "toolCall",
							name: "todo_write",
							arguments: { ops: [{ op: "init", list: [{ phase: "work", items: ["a", "b", "c"] }] }] },
						},
					],
				},
				{
					content: [{ type: "toolCall", name: "todo_write", arguments: { ops: [{ op: "rm", task: "b" }] } }],
				},
				{ content: ["done"] },
			],
		});

		const agent = new Agent({
			initialState: {
				model,
				systemPrompt: ["Test"],
				tools: [new TodoWriteTool(createDetachedToolSession())],
				messages: [],
			},
			streamFn: mock.stream,
		});

		session = new AgentSession({
			agent,
			sessionManager: SessionManager.inMemory(),
			settings: Settings.isolated(),
			modelRegistry,
		});
	});

	afterEach(async () => {
		await session.dispose();
		authStorage?.close();
		authStorage = undefined;
		if (fs.existsSync(tempDir)) fs.rmSync(tempDir, { recursive: true, force: true });
	});

	it("accepts a removal that legitimately shrinks the list", async () => {
		await session.prompt("track some work");

		// A size-based staleness heuristic rejects this result because the list got
		// SMALLER, leaving the session showing a task the model already removed.
		expect(taskStates(session.getTodoPhases())).toEqual(["a", "c"]);
	});
});
