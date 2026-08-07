/**
 * A session transition must own the queue.
 *
 * `clearContext()` / `/new` / `compact()` call `#disconnectFromAgent()` and
 * then `await abort()`. A hidden queued message that starts a turn inside that
 * window snapshots the STILL-OLD context, races `agent.reset()`, and once the
 * session reconnects appends its late output to the fresh session — a reply to
 * a cancelled request, in a conversation that is supposed to have started
 * clean. A disconnected session also has no listener to render or persist it.
 *
 * Upstream hit this as oh-my-pi #5800 (`4d685bf76`).
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
import { Snowflake } from "@jawcode-dev/utils";

/** A hidden agent-authored steer, the shape that bit upstream. */
function hiddenSteer(customType: string, content: string): never {
	return {
		role: "custom",
		customType,
		content,
		display: false,
		attribution: "agent",
		timestamp: Date.now(),
	} as never;
}

describe("session transition as an atomic boundary", () => {
	let session: AgentSession;
	let tempDir: string;
	let mock: MockModelHandle;
	let authStorage: AuthStorage | undefined;

	beforeEach(async () => {
		tempDir = path.join(os.tmpdir(), `jwc-new-boundary-${Snowflake.next()}`);
		fs.mkdirSync(tempDir, { recursive: true });

		const model = getBundledModel("anthropic", "claude-sonnet-4-5");
		if (!model) throw new Error("Test model not found in registry");

		authStorage = await AuthStorage.create(path.join(tempDir, "testauth.db"));
		authStorage.setRuntimeApiKey("anthropic", "test-key");
		const modelRegistry = new ModelRegistry(authStorage, path.join(tempDir, "models.yml"));

		mock = createMockModel({ handler: () => ({ content: ["ok"] }) });

		const agent = new Agent({
			initialState: { model, systemPrompt: ["Test"], tools: [], messages: [] },
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

	it("does not start a provider turn from a message queued during the transition", async () => {
		await session.prompt("first turn");
		await Bun.sleep(20);
		const callsBeforeTransition = mock.calls.length;

		// Queue a triggering hidden steer WHILE the transition is in flight: the
		// session is disconnected here, but agent.reset() has not run yet.
		const transition = session.clearContext();
		session.queueDeferredMessageForTests(hiddenSteer("test-mid-transition", "stale queued steer"), true);
		await transition;
		await Bun.sleep(80);

		expect(mock.calls.length).toBe(callsBeforeTransition);
	});

	it("still runs a hidden steer queued during normal operation", async () => {
		// The guard must not disable the feature: outside a transition the session
		// is connected and a triggering hidden message should start its turn.
		await session.prompt("first turn");
		await Bun.sleep(20);
		const before = mock.calls.length;

		session.queueDeferredMessageForTests(hiddenSteer("test-normal", "legitimate steer"), true);
		await Bun.sleep(120);

		expect(mock.calls.length).toBeGreaterThan(before);
	});
});
