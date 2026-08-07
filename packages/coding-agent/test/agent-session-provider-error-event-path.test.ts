/**
 * The provider-error log line must be reachable through the REAL session event
 * path, not only by calling the helper.
 *
 * The C-phase audit caught that `provider-turn-error-log.test.ts` imports
 * `logProviderTurnError` directly, so deleting the `agent_end` call site left
 * those tests green while the feature was gone. This drives a real
 * `AgentSession` against a provider stream that fails, and asserts both that
 * the warn is emitted and that the credential in the provider text does not
 * survive into the log.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "bun:test";
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
import { logger, Snowflake } from "@jawcode-dev/utils";

/** A provider failure that echoes the request, the way real 401s do. */
const LEAKY_PROVIDER_ERROR =
	"401 Unauthorized for account jun@example.com (authorization: Bearer sk-live-AAAABBBBCCCCDDDD)";

describe("AgentSession provider-error logging (event path)", () => {
	let session: AgentSession;
	let tempDir: string;
	let mock: MockModelHandle;
	let authStorage: AuthStorage | undefined;

	beforeEach(async () => {
		tempDir = path.join(os.tmpdir(), `jwc-provider-error-path-${Snowflake.next()}`);
		fs.mkdirSync(tempDir, { recursive: true });

		const model = getBundledModel("anthropic", "claude-sonnet-4-5");
		if (!model) throw new Error("Test model not found in registry");

		authStorage = await AuthStorage.create(path.join(tempDir, "testauth.db"));
		authStorage.setRuntimeApiKey("anthropic", "test-key");
		const modelRegistry = new ModelRegistry(authStorage, path.join(tempDir, "models.yml"));

		mock = createMockModel({ handler: () => ({ throw: LEAKY_PROVIDER_ERROR }) });

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
		vi.restoreAllMocks();
	});

	it("logs a redacted provider error when a real turn dies on a provider failure", async () => {
		const warn = vi.spyOn(logger, "warn").mockImplementation(() => {});

		await session.prompt("do something");

		const providerWarns = warn.mock.calls.filter(([message]) =>
			typeof message === "string" ? message.includes("provider error") : false,
		);
		// Reaching the log at all is the regression this guards: removing the
		// `agent_end` call site is invisible to a direct-import test.
		expect(providerWarns).toHaveLength(1);

		const fields = providerWarns[0]?.[1] as { errorMessage?: string; provider?: string } | undefined;
		// The provider identity has to survive redaction, otherwise the log says a
		// turn failed without saying who failed it.
		expect(fields?.provider).toBe(mock.model.provider);
		const logged = fields?.errorMessage ?? "";
		expect(logged).toContain("401");
		expect(logged).not.toContain("sk-live-AAAABBBBCCCCDDDD");
		expect(logged).not.toContain("jun@example.com");
	});
});
