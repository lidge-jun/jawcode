import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import * as fs from "node:fs/promises";
import * as os from "node:os";
import * as path from "node:path";
import {
	actorRegistryPath,
	allocateActorRecord,
	buildWorkflowActorKey,
	buildWorkflowActorLane,
	markActorIdle,
	markActorMaintained,
	markActorRunning,
	readActorRegistry,
	resolveCompatibleActor,
	retireNamespaceActors,
	retireStageActors,
	upsertActor,
	writeActorRegistryAtomic,
} from "../../src/jwc-runtime/actor-registry";

describe("workflow actor registry", () => {
	let cwd: string;

	beforeEach(async () => {
		cwd = await fs.mkdtemp(path.join(os.tmpdir(), "actor-registry-test-"));
	});

	afterEach(async () => {
		await fs.rm(cwd, { recursive: true, force: true });
	});

	const baseKey = () =>
		buildWorkflowActorKey({
			namespaceId: "pabcd-run-1",
			workflowSessionId: "session.one",
			stage: "a",
			roleAgent: "architect",
			taskId: "ArchitectAudit",
			description: "architect audit",
			modelId: "xai/grok",
			provider: "xai",
			rolePromptHash: "rolehash",
			cwdOrWorktree: cwd,
			writablePolicy: "workspace",
			toolSurfaceHash: "toolhash",
		});

	it("normalizes PABCD lanes for stage-scoped resume actors", () => {
		expect(buildWorkflowActorLane({ stage: "p", roleAgent: "critic", taskId: "x" })).toBe("p:critic");
		expect(buildWorkflowActorLane({ stage: "a", roleAgent: "planner", taskId: "x" })).toBe("a:planner-auditor");
		expect(buildWorkflowActorLane({ stage: "b", roleAgent: "architect", taskId: "x" })).toBe("b:verifier");
		expect(buildWorkflowActorLane({ stage: "b", roleAgent: "self-fork", taskId: "SliceOne" })).toBe(
			"b:executor:sliceone",
		);
		expect(buildWorkflowActorLane({ stage: "c", roleAgent: "architect", taskId: "x" })).toBe(
			"c:mechanical-check-reviewer",
		);
	});

	it("persists and resolves idle compatible actors", async () => {
		const key = baseKey();
		const actor = allocateActorRecord(key, path.join(cwd, ".jwc/state/sessions/session%2Eone/actor.jsonl"));
		await writeActorRegistryAtomic(
			cwd,
			"session.one",
			upsertActor(await readActorRegistry(cwd, "session.one"), actor),
		);

		const registry = await readActorRegistry(cwd, "session.one");
		expect(actorRegistryPath(cwd, "session.one")).toContain(path.join("sessions", "session%2Eone", "actors.json"));
		expect(resolveCompatibleActor(registry, key)?.id).toBe(actor.id);
	});

	it("does not select running actors and retires by stage or namespace", () => {
		const key = baseKey();
		const actor = allocateActorRecord(key, "/tmp/actor.jsonl");
		const running = markActorRunning(upsertActor({ version: 1, actors: [] }, actor), actor.id, "job-1");
		expect(resolveCompatibleActor(running, key)).toBeUndefined();

		const idle = markActorIdle(running, actor.id, actor.sessionFile, "job-1");
		expect(resolveCompatibleActor(idle, key)?.status).toBe("idle");
		expect(retireStageActors(idle, "pabcd-run-1", "a").actors[0]?.status).toBe("retired");
		expect(retireNamespaceActors(idle, "pabcd-run-1").actors[0]?.status).toBe("retired");
	});

	it("records actor-local maintenance without retiring actor", () => {
		const key = baseKey();
		const actor = { ...allocateActorRecord(key, "/tmp/actor.jsonl"), needsCompact: true };
		const registry = markActorMaintained(upsertActor({ version: 1, actors: [] }, actor), actor.id, {
			compactedAt: "2026-06-14T00:00:00.000Z",
			needsCompact: false,
		});
		const maintained = registry.actors[0];
		expect(maintained?.status).toBe("idle");
		expect(maintained?.compactedAt).toBe("2026-06-14T00:00:00.000Z");
		expect(maintained?.needsCompact).toBe(false);
	});
});
