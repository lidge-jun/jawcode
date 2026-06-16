import * as path from "node:path";
import type { Mem0Config } from "./config";

const DEFAULT_USER = "jwc";
const PROJECT_TAG_PREFIX = "project:";
const UNKNOWN_PROJECT = "unknown";

export interface Mem0EntityScope {
	userId: string;
	agentId: string;
	runId?: string;
	searchFilters: Record<string, unknown>;
	retainMetadata: Record<string, unknown>;
}

function projectLabel(directory: string): string {
	const base = path.basename(directory);
	return base.length > 0 ? base : UNKNOWN_PROJECT;
}

function baseUserId(config: Mem0Config): string {
	const raw = config.userId?.trim();
	if (raw && raw.length > 0) return raw;
	const prefix = config.userIdPrefix.trim();
	return prefix.length > 0 ? `${prefix}${DEFAULT_USER}` : DEFAULT_USER;
}

/**
 * Resolve Mem0 V3 `filters` entity scope for a working directory and optional session run id.
 */
export function computeMem0Scope(config: Mem0Config, directory: string, runId?: string): Mem0EntityScope {
	const userId = baseUserId(config);
	const agentId = config.agentId.trim() || "jwc";
	const project = projectLabel(directory);

	const searchFilters: Record<string, unknown> = { user_id: userId, agent_id: agentId };
	const retainMetadata: Record<string, unknown> = { agent_id: agentId };

	if (config.scoping === "per-project" || config.scoping === "per-project-tagged") {
		searchFilters.app_id = project;
		retainMetadata.app_id = project;
	}
	if (config.scoping === "per-project-tagged") {
		const tag = `${PROJECT_TAG_PREFIX}${project}`;
		searchFilters.metadata = { project: tag };
		retainMetadata.project = tag;
	}
	if (runId && runId.trim().length > 0) {
		searchFilters.run_id = runId;
		retainMetadata.run_id = runId;
	}

	return { userId, agentId, runId, searchFilters, retainMetadata };
}
