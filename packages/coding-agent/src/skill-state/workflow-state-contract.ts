import * as path from "node:path";
import { normalizeWorkflowSkillSlug } from "../jwc-runtime/state-schema";
import { CANONICAL_JWC_WORKFLOW_SKILLS, type CanonicalJwcWorkflowSkill, SKILL_ACTIVE_STATE_FILE } from "./active-state";
import { WORKFLOW_STATE_RECEIPT_FRESH_MS, WORKFLOW_STATE_RECEIPT_VERSION } from "./workflow-state-version";

export {
	WORKFLOW_STATE_RECEIPT_FRESH_MS,
	WORKFLOW_STATE_RECEIPT_VERSION,
	WORKFLOW_STATE_VERSION,
} from "./workflow-state-version";

export type { CanonicalJwcWorkflowSkill };
export type WorkflowStateMutationOwner = "jwc-state-cli" | "jwc-runtime" | "jwc-hook";

/** gjc-era receipts persist legacy owner strings — normalize on read (260613 flip, read-both). */
export const LEGACY_WORKFLOW_STATE_OWNER_ALIASES: Record<string, WorkflowStateMutationOwner> = {
	"jwc-state-cli": "jwc-state-cli",
	"jwc-runtime": "jwc-runtime",
	"jwc-hook": "jwc-hook",
};

export function normalizeWorkflowStateOwner(value: unknown): WorkflowStateMutationOwner | undefined {
	if (typeof value !== "string") return undefined;
	const aliased = LEGACY_WORKFLOW_STATE_OWNER_ALIASES[value] ?? value;
	return aliased === "jwc-state-cli" || aliased === "jwc-runtime" || aliased === "jwc-hook"
		? (aliased as WorkflowStateMutationOwner)
		: undefined;
}
export type WorkflowStateReceiptStatus = "fresh" | "stale";

export interface WorkflowStateContentChecksum {
	algorithm: "sha256";
	value: string;
	covered_path: string;
	computed_at: string;
}

export interface WorkflowStateReceipt {
	version: 1;
	skill: CanonicalJwcWorkflowSkill;
	owner: WorkflowStateMutationOwner;
	command: string;
	state_path: string;
	storage_path: string;
	mutated_at: string;
	fresh_until: string;
	status: WorkflowStateReceiptStatus;
	mutation_id: string;
	verb?: string;
	from_phase?: string;
	to_phase?: string;
	forced?: boolean;
	paths?: string[];
	content_sha256?: WorkflowStateContentChecksum;
}

export interface AuditEntry {
	ts: string;
	skill?: string;
	category: string;
	verb: string;
	owner: WorkflowStateMutationOwner;
	mutation_id: string;
	from_phase?: string;
	to_phase?: string;
	forced: boolean;
	paths: string[];
}

function safeString(value: unknown): string {
	return typeof value === "string" ? value : "";
}

function encodePathSegment(value: string): string {
	return encodeURIComponent(value).replaceAll(".", "%2E");
}

export function workflowModeStateFileName(skill: CanonicalJwcWorkflowSkill): string {
	return `${skill}-state.json`;
}

export function workflowStateStoragePath(cwd: string, skill: CanonicalJwcWorkflowSkill, sessionId?: string): string {
	const normalizedSessionId = safeString(sessionId).trim();
	if (normalizedSessionId) {
		return path.join(
			cwd,
			".jwc",
			"state",
			"sessions",
			encodePathSegment(normalizedSessionId),
			workflowModeStateFileName(skill),
		);
	}
	return path.join(cwd, ".jwc", "state", workflowModeStateFileName(skill));
}

export function workflowActiveStatePath(cwd: string, sessionId?: string): string {
	const normalizedSessionId = safeString(sessionId).trim();
	if (normalizedSessionId) {
		return path.join(
			cwd,
			".jwc",
			"state",
			"sessions",
			encodePathSegment(normalizedSessionId),
			SKILL_ACTIVE_STATE_FILE,
		);
	}
	return path.join(cwd, ".jwc", "state", SKILL_ACTIVE_STATE_FILE);
}

export function buildWorkflowStateReceipt(input: {
	cwd: string;
	skill: CanonicalJwcWorkflowSkill;
	owner: WorkflowStateMutationOwner;
	command: string;
	sessionId?: string;
	nowIso?: string;
	mutationId?: string;
}): WorkflowStateReceipt {
	const mutatedAt = input.nowIso ?? new Date().toISOString();
	const freshUntil = new Date(Date.parse(mutatedAt) + WORKFLOW_STATE_RECEIPT_FRESH_MS).toISOString();
	return {
		version: WORKFLOW_STATE_RECEIPT_VERSION,
		skill: input.skill,
		owner: input.owner,
		command: input.command,
		state_path: workflowActiveStatePath(input.cwd, input.sessionId),
		storage_path: workflowStateStoragePath(input.cwd, input.skill, input.sessionId),
		mutated_at: mutatedAt,
		fresh_until: freshUntil,
		status: "fresh",
		mutation_id: input.mutationId ?? `${input.skill}:${mutatedAt}`,
	};
}

export function workflowReceiptStatus(
	receipt: WorkflowStateReceipt | undefined,
	nowMs = Date.now(),
): WorkflowStateReceiptStatus | undefined {
	if (!receipt) return undefined;
	const freshUntilMs = Date.parse(receipt.fresh_until);
	if (!Number.isFinite(freshUntilMs)) return "stale";
	return nowMs <= freshUntilMs ? "fresh" : "stale";
}

export function canonicalWorkflowSkill(value: string): CanonicalJwcWorkflowSkill | null {
	const normalized = normalizeWorkflowSkillSlug(value);
	return (CANONICAL_JWC_WORKFLOW_SKILLS as readonly string[]).includes(normalized)
		? (normalized as CanonicalJwcWorkflowSkill)
		: null;
}

export function sanctionedWorkflowStateCommand(skill: CanonicalJwcWorkflowSkill): string {
	return `jwc state ${skill} write --input '<json>'`;
}

export function describeWorkflowStateContract(skill: CanonicalJwcWorkflowSkill): string[] {
	return [
		`Sanctioned mutation path: jwc state ${skill} read|write --input '<json>'`,
		`Canonical active HUD state: .jwc/state/${SKILL_ACTIVE_STATE_FILE} and .jwc/state/sessions/<session>/${SKILL_ACTIVE_STATE_FILE}`,
		`Skill mode state: .jwc/state/${workflowModeStateFileName(skill)} or .jwc/state/sessions/<session>/${workflowModeStateFileName(skill)}`,
		"Receipts include version, skill, owner, command, state_path, storage_path, mutated_at, fresh_until, status, and mutation_id.",
		"Receipts are fresh for 30 minutes; older receipts are stale and render as HUD warnings.",
		"Planning artifacts under .jwc/specs/** and .jwc/plans/** remain writable outside the state command.",
	];
}
