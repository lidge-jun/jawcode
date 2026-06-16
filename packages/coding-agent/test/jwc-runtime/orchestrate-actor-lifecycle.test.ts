import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import * as fs from "node:fs/promises";
import * as os from "node:os";
import * as path from "node:path";
import {
	allocateActorRecord,
	buildWorkflowActorKey,
	readActorRegistry,
	upsertActor,
	writeActorRegistryAtomic,
} from "../../src/jwc-runtime/actor-registry";
import { runNativeOrchestrateCommand } from "../../src/jwc-runtime/orchestrate-runtime";
import { readPabcdStateWithFallback } from "../../src/jwc-runtime/orchestrate-state";

describe("orchestrate actor lifecycle", () => {
	let cwd: string;

	beforeEach(async () => {
		cwd = await fs.mkdtemp(path.join(os.tmpdir(), "orchestrate-actor-test-"));
	});

	afterEach(async () => {
		await fs.rm(cwd, { recursive: true, force: true });
	});

	it("creates a namespace and retires prior-stage actors on transition", async () => {
		const sessionId = "session.one";
		expect((await runNativeOrchestrateCommand(["p", "--session-id", sessionId], cwd)).status).toBe(0);
		const state = await readPabcdStateWithFallback(cwd, sessionId);
		expect(state?.ok).toBe(true);
		const namespaceId = state?.ok ? state.value.ctx?.actor_namespace_id : undefined;
		expect(typeof namespaceId).toBe("string");

		const key = buildWorkflowActorKey({
			namespaceId: namespaceId!,
			workflowSessionId: sessionId,
			stage: "p",
			roleAgent: "critic",
			taskId: "PlanCritic",
			modelId: "openai/gpt",
			provider: "openai",
			rolePromptHash: "rolehash",
			cwdOrWorktree: cwd,
			writablePolicy: "workspace",
			toolSurfaceHash: "toolhash",
		});
		const actor = allocateActorRecord(key, path.join(cwd, ".jwc/state/sessions/session%2Eone/actor.jsonl"));
		await writeActorRegistryAtomic(cwd, sessionId, upsertActor(await readActorRegistry(cwd, sessionId), actor));

		expect((await runNativeOrchestrateCommand(["a", "--session-id", sessionId], cwd)).status).toBe(0);
		const registry = await readActorRegistry(cwd, sessionId);
		expect(registry.actors.find(entry => entry.id === actor.id)?.status).toBe("retired");
		const nextState = await readPabcdStateWithFallback(cwd, sessionId);
		expect(nextState?.ok ? nextState.value.ctx?.actor_namespace_id : undefined).toBe(namespaceId);
	});
});
