import { createHash } from "node:crypto";
import * as fs from "node:fs/promises";
import * as path from "node:path";
import { writeTextAtomic } from "./state-writer";

export type WorkflowActorWorkflow = "pabcd" | "goal" | "team" | "task";
export type WorkflowActorStage = "i" | "p" | "a" | "b" | "c" | "d";
export type WorkflowActorRole =
	| "planner"
	| "architect"
	| "critic"
	| "executor"
	| "verifier"
	| "self-fork"
	| "executor_ext";
export type WorkflowActorStatus = "idle" | "running" | "paused" | "retired" | "failed";

export interface WorkflowActorKey {
	namespaceId: string;
	workflow: WorkflowActorWorkflow;
	workflowSessionId: string;
	stage: WorkflowActorStage;
	lane: string;
	roleAgent: WorkflowActorRole;
	modelId: string;
	provider: string;
	thinkingLevel?: string;
	rolePromptHash: string;
	cwdOrWorktree: string;
	writablePolicy: string;
	toolSurfaceHash: string;
}

export interface WorkflowActorRecord extends WorkflowActorKey {
	id: string;
	sessionFile: string;
	providerCacheSessionId?: string;
	status: WorkflowActorStatus;
	currentJobId?: string;
	historicalJobIds: string[];
	compactedAt?: string;
	needsCompact?: boolean;
	createdAt: string;
	lastUsedAt: string;
	failureReason?: string;
}

export interface WorkflowActorRegistry {
	version: 1;
	actors: WorkflowActorRecord[];
}

export interface WorkflowActorLaneInput {
	stage: WorkflowActorStage;
	roleAgent: string;
	taskId: string;
	description?: string;
}

export interface WorkflowActorKeyInput extends WorkflowActorLaneInput {
	namespaceId: string;
	workflowSessionId: string;
	modelId: string;
	provider: string;
	thinkingLevel?: string;
	rolePromptHash: string;
	cwdOrWorktree: string;
	writablePolicy: string;
	toolSurfaceHash: string;
}

function encodeSessionSegment(value: string): string {
	return encodeURIComponent(value).replaceAll(".", "%2E");
}

export function actorRegistryPath(cwd: string, sessionId: string): string {
	return path.join(cwd, ".jwc", "state", "sessions", encodeSessionSegment(sessionId), "actors.json");
}

function stableHash(value: unknown): string {
	return createHash("sha256").update(JSON.stringify(value)).digest("hex").slice(0, 16);
}

function normalizeTaskSegment(value: string): string {
	const normalized = value
		.trim()
		.toLowerCase()
		.replace(/[^a-z0-9:_-]+/g, "-")
		.replace(/^-+|-+$/g, "");
	return normalized || "task";
}

export function buildWorkflowActorLane(input: WorkflowActorLaneInput): string {
	const role = input.roleAgent.trim().toLowerCase();
	const taskId = normalizeTaskSegment(input.taskId);
	const description = (input.description ?? "").toLowerCase();
	if (input.stage === "p" && role === "critic") return "p:critic";
	if (input.stage === "a" && role === "planner") return "a:planner-auditor";
	if (input.stage === "a" && role === "architect") return "a:architect-auditor";
	if (input.stage === "b" && (role === "architect" || description.includes("verif") || description.includes("검증"))) {
		return "b:verifier";
	}
	if (input.stage === "b" && (role === "executor" || role === "self-fork")) return `b:executor:${taskId}`;
	if (input.stage === "b" && role === "executor_ext") return `b:executor_ext:${taskId}`;
	if (input.stage === "c" && (description.includes("adversarial") || description.includes("review"))) {
		return "c:adversarial-reviewer";
	}
	if (input.stage === "c") return "c:mechanical-check-reviewer";
	return `${input.stage}:${role}:${taskId}`;
}

export function normalizeWorkflowActorRole(roleAgent: string): WorkflowActorRole {
	const normalized = roleAgent.trim().toLowerCase();
	if (normalized === "planner") return "planner";
	if (normalized === "architect") return "architect";
	if (normalized === "critic") return "critic";
	if (normalized === "executor") return "executor";
	if (normalized === "executor_ext") return "executor_ext";
	if (normalized === "self-fork") return "self-fork";
	return "verifier";
}

export function buildWorkflowActorKey(input: WorkflowActorKeyInput): WorkflowActorKey {
	return {
		namespaceId: input.namespaceId,
		workflow: "pabcd",
		workflowSessionId: input.workflowSessionId,
		stage: input.stage,
		lane: buildWorkflowActorLane(input),
		roleAgent: normalizeWorkflowActorRole(input.roleAgent),
		modelId: input.modelId,
		provider: input.provider,
		...(input.thinkingLevel ? { thinkingLevel: input.thinkingLevel } : {}),
		rolePromptHash: input.rolePromptHash,
		cwdOrWorktree: input.cwdOrWorktree,
		writablePolicy: input.writablePolicy,
		toolSurfaceHash: input.toolSurfaceHash,
	};
}

export function workflowActorId(key: WorkflowActorKey): string {
	return `actor-${stableHash(key)}`;
}

export function createEmptyActorRegistry(): WorkflowActorRegistry {
	return { version: 1, actors: [] };
}

function isWorkflowActorRegistry(value: unknown): value is WorkflowActorRegistry {
	if (!value || typeof value !== "object") return false;
	const record = value as { version?: unknown; actors?: unknown };
	return record.version === 1 && Array.isArray(record.actors);
}

export async function readActorRegistry(cwd: string, sessionId: string): Promise<WorkflowActorRegistry> {
	try {
		const text = await Bun.file(actorRegistryPath(cwd, sessionId)).text();
		const parsed: unknown = JSON.parse(text);
		return isWorkflowActorRegistry(parsed) ? parsed : createEmptyActorRegistry();
	} catch (error) {
		if ((error as { code?: string }).code === "ENOENT") return createEmptyActorRegistry();
		return createEmptyActorRegistry();
	}
}

export async function writeActorRegistryAtomic(
	cwd: string,
	sessionId: string,
	registry: WorkflowActorRegistry,
): Promise<string> {
	const target = actorRegistryPath(cwd, sessionId);
	await fs.mkdir(path.dirname(target), { recursive: true });
	return await writeTextAtomic(target, `${JSON.stringify(registry, null, 2)}\n`, {
		cwd,
		audit: { category: "state", verb: "write", owner: "jwc-runtime", skill: "pabcd" },
	});
}

function actorMatchesKey(actor: WorkflowActorRecord, key: WorkflowActorKey): boolean {
	return (
		actor.namespaceId === key.namespaceId &&
		actor.workflow === key.workflow &&
		actor.workflowSessionId === key.workflowSessionId &&
		actor.stage === key.stage &&
		actor.lane === key.lane &&
		actor.roleAgent === key.roleAgent &&
		actor.modelId === key.modelId &&
		actor.provider === key.provider &&
		actor.thinkingLevel === key.thinkingLevel &&
		actor.rolePromptHash === key.rolePromptHash &&
		actor.cwdOrWorktree === key.cwdOrWorktree &&
		actor.writablePolicy === key.writablePolicy &&
		actor.toolSurfaceHash === key.toolSurfaceHash
	);
}

export function resolveCompatibleActor(
	registry: WorkflowActorRegistry,
	key: WorkflowActorKey,
): WorkflowActorRecord | undefined {
	return registry.actors.find(actor => isWorkflowActorSelectable(actor, key));
}

export function isWorkflowActorSelectable(actor: WorkflowActorRecord, key: WorkflowActorKey): boolean {
	return actor.status !== "retired" && actor.status !== "running" && actorMatchesKey(actor, key);
}

export function findRunningActor(
	registry: WorkflowActorRegistry,
	key: WorkflowActorKey,
): WorkflowActorRecord | undefined {
	return registry.actors.find(actor => actor.status === "running" && actorMatchesKey(actor, key));
}

export function allocateActorRecord(
	key: WorkflowActorKey,
	sessionFile: string,
	nowIso = new Date().toISOString(),
): WorkflowActorRecord {
	return {
		...key,
		id: workflowActorId(key),
		sessionFile,
		status: "idle",
		historicalJobIds: [],
		createdAt: nowIso,
		lastUsedAt: nowIso,
	};
}

export function upsertActor(registry: WorkflowActorRegistry, actor: WorkflowActorRecord): WorkflowActorRegistry {
	const next = registry.actors.filter(existing => existing.id !== actor.id);
	return { ...registry, actors: [...next, actor] };
}

function updateActor(
	registry: WorkflowActorRegistry,
	actorId: string,
	update: (actor: WorkflowActorRecord) => WorkflowActorRecord,
): WorkflowActorRegistry {
	return {
		...registry,
		actors: registry.actors.map(actor => (actor.id === actorId ? update(actor) : actor)),
	};
}

export function markActorRunning(
	registry: WorkflowActorRegistry,
	actorId: string,
	jobId: string,
	nowIso = new Date().toISOString(),
): WorkflowActorRegistry {
	return updateActor(registry, actorId, actor => ({
		...actor,
		status: "running",
		currentJobId: jobId,
		lastUsedAt: nowIso,
	}));
}

export function markActorIdle(
	registry: WorkflowActorRegistry,
	actorId: string,
	sessionFile: string,
	jobId: string,
	nowIso = new Date().toISOString(),
): WorkflowActorRegistry {
	return updateActor(registry, actorId, actor => ({
		...actor,
		status: "idle",
		sessionFile,
		currentJobId: undefined,
		historicalJobIds: actor.historicalJobIds.includes(jobId)
			? actor.historicalJobIds
			: [...actor.historicalJobIds, jobId],
		lastUsedAt: nowIso,
	}));
}

export function markActorPaused(
	registry: WorkflowActorRegistry,
	actorId: string,
	sessionFile: string,
	jobId: string,
	nowIso = new Date().toISOString(),
): WorkflowActorRegistry {
	return updateActor(registry, actorId, actor => ({
		...actor,
		status: "paused",
		sessionFile,
		currentJobId: undefined,
		historicalJobIds: actor.historicalJobIds.includes(jobId)
			? actor.historicalJobIds
			: [...actor.historicalJobIds, jobId],
		lastUsedAt: nowIso,
	}));
}
export function markActorMaintained(
	registry: WorkflowActorRegistry,
	actorId: string,
	maintenance: { compactedAt?: string; needsCompact?: boolean },
	nowIso = new Date().toISOString(),
): WorkflowActorRegistry {
	return updateActor(registry, actorId, actor => ({
		...actor,
		...(maintenance.compactedAt !== undefined ? { compactedAt: maintenance.compactedAt } : {}),
		...(maintenance.needsCompact !== undefined ? { needsCompact: maintenance.needsCompact } : {}),
		lastUsedAt: nowIso,
	}));
}

export function markActorFailed(
	registry: WorkflowActorRegistry,
	actorId: string,
	reason: string,
	jobId: string,
	nowIso = new Date().toISOString(),
): WorkflowActorRegistry {
	return updateActor(registry, actorId, actor => ({
		...actor,
		status: "failed",
		currentJobId: undefined,
		failureReason: reason,
		historicalJobIds: actor.historicalJobIds.includes(jobId)
			? actor.historicalJobIds
			: [...actor.historicalJobIds, jobId],
		lastUsedAt: nowIso,
	}));
}

export function retireStageActors(
	registry: WorkflowActorRegistry,
	namespaceId: string,
	stage: WorkflowActorStage,
	nowIso = new Date().toISOString(),
): WorkflowActorRegistry {
	return {
		...registry,
		actors: registry.actors.map(actor =>
			actor.namespaceId === namespaceId && actor.stage === stage && actor.status !== "retired"
				? { ...actor, status: "retired", currentJobId: undefined, lastUsedAt: nowIso }
				: actor,
		),
	};
}

export function retireNamespaceActors(
	registry: WorkflowActorRegistry,
	namespaceId: string,
	nowIso = new Date().toISOString(),
): WorkflowActorRegistry {
	return {
		...registry,
		actors: registry.actors.map(actor =>
			actor.namespaceId === namespaceId && actor.status !== "retired"
				? { ...actor, status: "retired", currentJobId: undefined, lastUsedAt: nowIso }
				: actor,
		),
	};
}
