/**
 * Mem0 Platform API configuration (https://api.mem0.ai).
 *
 * Precedence: MEM0_* env vars override settings schema defaults.
 */

import { logger } from "@jawcode-dev/utils";
import type { Settings } from "../config/settings";

export type Mem0Scoping = "global" | "per-project" | "per-project-tagged";

export interface Mem0Config {
	mem0ApiKey: string | null;
	mem0ApiUrl: string;
	userId: string | null;
	userIdPrefix: string;
	agentId: string;
	scoping: Mem0Scoping;
	autoRecall: boolean;
	autoRetain: boolean;
	retainEveryNTurns: number;
	searchTopK: number;
	recallPreamble: string;
}

const VALID_SCOPINGS: Mem0Scoping[] = ["global", "per-project", "per-project-tagged"];

function envString(value: string | undefined): string | undefined {
	if (value === undefined) return undefined;
	const trimmed = value.trim();
	return trimmed.length > 0 ? trimmed : undefined;
}

function envBool(value: string | undefined): boolean | undefined {
	if (value === undefined) return undefined;
	const v = value.trim().toLowerCase();
	if (v === "1" || v === "true" || v === "yes") return true;
	if (v === "0" || v === "false" || v === "no") return false;
	return undefined;
}

function envInt(value: string | undefined): number | undefined {
	if (value === undefined) return undefined;
	const n = Number.parseInt(value, 10);
	return Number.isFinite(n) ? n : undefined;
}

function pickScoping(value: unknown): Mem0Scoping | undefined {
	return typeof value === "string" && (VALID_SCOPINGS as string[]).includes(value)
		? (value as Mem0Scoping)
		: undefined;
}

const DEFAULT_PREAMBLE =
	"Relevant memories from Mem0 (heuristic — verify against the current repo and user instruction):";

export function loadMem0Config(settings: Settings, env: NodeJS.ProcessEnv = process.env): Mem0Config {
	const settingsScoping = pickScoping(settings.get("mem0.scoping"));
	if (settings.get("mem0.scoping") && !settingsScoping) {
		logger.warn("Mem0: invalid scoping setting, falling back to per-project-tagged", {
			value: settings.get("mem0.scoping"),
		});
	}

	return {
		mem0ApiKey: envString(env.MEM0_API_KEY) ?? settings.get("mem0.apiKey") ?? null,
		mem0ApiUrl: envString(env.MEM0_API_URL) ?? settings.get("mem0.apiUrl") ?? "https://api.mem0.ai",
		userId: envString(env.MEM0_USER_ID) ?? settings.get("mem0.userId") ?? null,
		userIdPrefix: settings.get("mem0.userIdPrefix") ?? "",
		agentId: envString(env.MEM0_AGENT_ID) ?? settings.get("mem0.agentId") ?? "jwc",
		scoping: pickScoping(env.MEM0_SCOPING) ?? settingsScoping ?? "per-project-tagged",
		autoRecall: envBool(env.MEM0_AUTO_RECALL) ?? settings.get("mem0.autoRecall"),
		autoRetain: envBool(env.MEM0_AUTO_RETAIN) ?? settings.get("mem0.autoRetain"),
		retainEveryNTurns: envInt(env.MEM0_RETAIN_EVERY_N_TURNS) ?? settings.get("mem0.retainEveryNTurns"),
		searchTopK: settings.get("mem0.searchTopK"),
		recallPreamble: settings.get("mem0.recallPreamble")?.trim() || DEFAULT_PREAMBLE,
	};
}

export function isMem0Configured(config: Mem0Config): config is Mem0Config & { mem0ApiKey: string } {
	return typeof config.mem0ApiKey === "string" && config.mem0ApiKey.length > 0;
}
