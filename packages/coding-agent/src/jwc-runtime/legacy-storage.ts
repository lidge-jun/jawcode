import * as fs from "node:fs/promises";
import * as path from "node:path";
import type { CanonicalJwcWorkflowSkill } from "../skill-state/workflow-state-contract";

function encodeSessionSegment(value: string): string {
	return encodeURIComponent(value).replaceAll(".", "%2E");
}

function workflowStateDir(cwd: string, sessionId: string | undefined): string {
	const base = path.join(cwd, ".jwc", "state");
	if (!sessionId) return base;
	return path.join(base, "sessions", encodeSessionSegment(sessionId));
}

function receiptMutatedAtMs(value: Record<string, unknown> | null): number {
	if (!value) return 0;
	const receipt = value.receipt;
	if (!receipt || typeof receipt !== "object" || Array.isArray(receipt)) return 0;
	const mutatedAt = (receipt as Record<string, unknown>).mutated_at;
	if (typeof mutatedAt !== "string") return 0;
	const ms = Date.parse(mutatedAt);
	return Number.isFinite(ms) ? ms : 0;
}

async function readJsonObjectIfExists(filePath: string): Promise<Record<string, unknown> | null> {
	try {
		const raw = await fs.readFile(filePath, "utf-8");
		const parsed = JSON.parse(raw) as unknown;
		if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
			return parsed as Record<string, unknown>;
		}
		return null;
	} catch (error) {
		const err = error as NodeJS.ErrnoException;
		if (error instanceof SyntaxError) return null;
		if (err.code === "ENOENT") return null;
		throw error;
	}
}

async function fileExists(filePath: string): Promise<boolean> {
	try {
		await fs.access(filePath);
		return true;
	} catch {
		return false;
	}
}

/** Canonical on-disk workflow mode-state filename (plan writer run state uses planphase-state.json separately). */
export function canonicalModeStateFileName(skill: CanonicalJwcWorkflowSkill): string {
	return `${skill}-state.json`;
}

export function legacyModeStateFileNames(skill: CanonicalJwcWorkflowSkill): string[] {
	switch (skill) {
		case "plan":
			return ["ralplan-state.json"];
		case "goal":
			return ["ultragoal-state.json"];
		default:
			return [];
	}
}

export async function resolveModeStatePaths(
	cwd: string,
	skill: CanonicalJwcWorkflowSkill,
	sessionId?: string,
): Promise<{ canonicalPath: string; readPath: string; legacyPaths: string[] }> {
	const dir = workflowStateDir(cwd, sessionId);
	const canonicalPath = path.join(dir, canonicalModeStateFileName(skill));
	const legacyPaths = legacyModeStateFileNames(skill).map(name => path.join(dir, name));

	const canonical = await readJsonObjectIfExists(canonicalPath);
	let readPath = canonicalPath;
	let bestMs = receiptMutatedAtMs(canonical);
	let hasAny = canonical !== null;

	for (const legacyPath of legacyPaths) {
		const legacy = await readJsonObjectIfExists(legacyPath);
		if (!legacy) continue;
		const legacyMs = receiptMutatedAtMs(legacy);
		if (!hasAny || legacyMs > bestMs) {
			readPath = legacyPath;
			bestMs = legacyMs;
		}
		hasAny = true;
	}

	if (!hasAny) readPath = canonicalPath;
	else if (canonical && receiptMutatedAtMs(canonical) >= bestMs) readPath = canonicalPath;

	return { canonicalPath, readPath, legacyPaths };
}

export async function readWorkflowModeStateJson(
	cwd: string,
	skill: CanonicalJwcWorkflowSkill,
	sessionId?: string,
): Promise<{ state: Record<string, unknown>; storagePath: string }> {
	const resolved = await resolveModeStatePaths(cwd, skill, sessionId);
	const state = (await readJsonObjectIfExists(resolved.readPath)) ?? {};
	return { state, storagePath: resolved.readPath };
}

export async function resolveGoalStoragePaths(cwd: string): Promise<{
	dir: string;
	briefPath: string;
	goalsPath: string;
	ledgerPath: string;
}> {
	const canonicalDir = path.join(cwd, ".jwc", "goal");
	const legacyDir = path.join(cwd, ".jwc", "ultragoal");
	const canonicalGoals = path.join(canonicalDir, "goals.json");
	const legacyGoals = path.join(legacyDir, "goals.json");
	const hasCanonical = await fileExists(canonicalGoals);
	const hasLegacy = await fileExists(legacyGoals);
	let dir = canonicalDir;
	if (!hasCanonical && hasLegacy) dir = legacyDir;
	else if (hasCanonical && hasLegacy) {
		const c = (await fs.stat(canonicalGoals)).mtimeMs;
		const l = (await fs.stat(legacyGoals)).mtimeMs;
		if (l > c) dir = legacyDir;
	}
	return {
		dir,
		briefPath: path.join(dir, "brief.md"),
		goalsPath: path.join(dir, "goals.json"),
		ledgerPath: path.join(dir, "ledger.jsonl"),
	};
}
