import * as fs from "node:fs";
import * as path from "node:path";
import type { Model } from "@gajae-code/ai";
import { getMemoriesDir } from "@gajae-code/utils";
import type { ModelRegistry } from "../config/model-registry";
import { formatModelString, resolveModelRoleValue } from "../config/model-resolver";
import type { Settings } from "../config/settings";
import type { AgentSession } from "../session/agent-session";

export interface MemoryModelResolutionRecord {
	pattern: string;
	provider: string;
	modelId: string;
	resolvedAt: number;
	source: "memories.modelRolePattern" | "modelRoles.memory" | "modelRoles.fallback" | "session.model";
}

function memoryRootFor(agentDir: string, cwd: string): string {
	const encoded = `--${cwd.replace(/^[/\\]/, "").replace(/[/\\:]/g, "-")}--`;
	return path.join(getMemoriesDir(agentDir), encoded);
}

/** Pick the configured pattern for background memory jobs (stage1 / phase2). */
export function resolveMemoryModelPattern(
	settings: Settings,
	fallbackRole: string,
	modelRolePattern?: string,
): { pattern?: string; source: MemoryModelResolutionRecord["source"] } {
	const explicit = (modelRolePattern ?? settings.get("memories.modelRolePattern"))?.trim();
	if (explicit) return { pattern: explicit, source: "memories.modelRolePattern" };
	const memoryRole = settings.getModelRole("memory")?.trim();
	if (memoryRole) return { pattern: memoryRole, source: "modelRoles.memory" };
	const fallback = settings.getModelRole(fallbackRole)?.trim();
	if (fallback) return { pattern: fallback, source: "modelRoles.fallback" };
	const defaultRole = settings.getModelRole("default")?.trim();
	if (defaultRole) return { pattern: defaultRole, source: "modelRoles.fallback" };
	return { pattern: undefined, source: "session.model" };
}

export function resolveMemoryModelFromPattern(
	pattern: string | undefined,
	session: AgentSession,
	modelRegistry: ModelRegistry,
): Model | undefined {
	if (pattern) {
		const resolved = resolveModelRoleValue(pattern, modelRegistry.getAll(), {
			settings: session.settings,
			matchPreferences: { usageOrder: session.settings.getStorage()?.getModelUsageOrder() },
			modelRegistry,
		});
		if (resolved.model) return resolved.model;
	}
	return session.model ?? modelRegistry.getAll()[0];
}

export async function persistMemoryModelResolution(
	agentDir: string,
	cwd: string,
	record: MemoryModelResolutionRecord,
): Promise<void> {
	const memoryRoot = memoryRootFor(agentDir, cwd);
	await fs.promises.mkdir(memoryRoot, { recursive: true });
	const filePath = path.join(memoryRoot, "resolution.json");
	await Bun.write(filePath, `${JSON.stringify(record, null, 2)}\n`);
}

export async function readMemoryModelResolution(
	agentDir: string,
	cwd: string,
): Promise<MemoryModelResolutionRecord | null> {
	const filePath = path.join(memoryRootFor(agentDir, cwd), "resolution.json");
	try {
		const raw = await Bun.file(filePath).text();
		const parsed = JSON.parse(raw) as MemoryModelResolutionRecord;
		if (typeof parsed.pattern !== "string" || typeof parsed.provider !== "string") return null;
		return parsed;
	} catch {
		return null;
	}
}

export function formatResolvedMemoryModelLine(model: Model): string {
	return formatModelString(model);
}
