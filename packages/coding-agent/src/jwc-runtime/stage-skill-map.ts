/**
 * 057 §6 P10 — stage → cli-jaw dev-skill injection map. Mirrors cli-jaw's
 * role/phase skill guidance so the dev skill ecosystem is read naturally by
 * the jwc orchestrate workflow. Pure data + a resolver that only points at
 * skills that actually exist on this machine; absent skills are silently
 * skipped (the map is guidance, not a hard dependency).
 */
import { existsSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { isJawBrand } from "../discovery/helpers";

export const STAGE_SKILL_MAP: Readonly<Record<string, readonly string[]>> = {
	p: ["dev", "dev-architecture"],
	a: ["dev-code-reviewer"],
	b: ["dev"],
	c: ["dev-testing"],
};

/** Audit-lens map for spawned read-only auditors (057 P10 M5-2). */
export const AUDIT_LENS_SKILL_MAP: Readonly<Record<string, readonly string[]>> = {
	planner: ["dev"],
	architect: ["dev-architecture"],
};

function defaultSkillsRoot(): string {
	return path.join(os.homedir(), ".cli-jaw", "skills");
}

function resolvePointer(names: readonly string[] | undefined, skillsRoot: string): string | null {
	if (!isJawBrand()) return null;
	if (!names || names.length === 0) return null;
	if (!existsSync(skillsRoot)) return null;
	const present = names.filter(name => existsSync(path.join(skillsRoot, name, "SKILL.md")));
	if (present.length === 0) return null;
	const refs = present.map(name => `/skill:${name}`).join(" and ");
	return `⛔ Before starting this stage, read ${refs} for the project's dev conventions.`;
}

/** Pointer block appended to a pabcd stage prompt; null when nothing applies. */
export function buildStageSkillPointer(stage: string, skillsRoot: string = defaultSkillsRoot()): string | null {
	return resolvePointer(STAGE_SKILL_MAP[stage], skillsRoot);
}

/** Pointer line appended to a spawned auditor prompt; null when nothing applies. */
export function buildAuditLensSkillPointer(lens: string, skillsRoot: string = defaultSkillsRoot()): string | null {
	return resolvePointer(AUDIT_LENS_SKILL_MAP[lens], skillsRoot);
}
