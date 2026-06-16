/**
 * Harness receipt schemas + validators (M7).
 *
 * Receipts are NEW schemas that FOLLOW the .jwc/state + goal-ledger patterns
 * (atomic, append-indexed, immutable) — not drop-in reuse. Every receipt carries a
 * canonical-JSON sha256 over its content (excluding the hash field) plus referenced
 * artifact hashes; validators recompute and FAIL CLOSED on tamper/mismatch.
 *
 * Families:
 *   - vanish            captures dirty/unknown delta before any restart/fallback (data-loss gate)
 *   - prompt-acceptance proves single-flight acceptance (idle pre-state -> ack -> next agent_start)
 *   - validation        records a verification command result for a specific commit
 *   - completion        the finalize gate: receipt-valid + commit + PR/issue + validations
 */
import { createHash } from "node:crypto";
import {
	type GitDelta,
	isReviewVerdict,
	type ReceiptFamily,
	type RecoveryClassification,
	type ReviewVerdict,
} from "./types";

export interface ReceiptSubject {
	workspace: string;
	branch: string | null;
	head: string | null;
	commit: string | null;
}

export interface ReceiptEnvelope<E = Record<string, unknown>> {
	receiptId: string;
	schemaVersion: number;
	sessionId: string;
	family: ReceiptFamily;
	valid: boolean;
	createdAt: string;
	source: string;
	subject: ReceiptSubject;
	evidence: E;
	/** Hashes of out-of-line artifacts (diff patches, validation logs) folded into the receipt hash. */
	artifactHashes: Record<string, string>;
	sha256: string;
}

export const RECEIPT_SCHEMA_VERSION = 1 as const;

/** Deterministic stringify with sorted keys (stable hash basis). */
export function canonicalJson(value: unknown): string {
	if (value === null || typeof value !== "object") return JSON.stringify(value) ?? "null";
	if (Array.isArray(value)) return `[${value.map(canonicalJson).join(",")}]`;
	const obj = value as Record<string, unknown>;
	const keys = Object.keys(obj).sort();
	return `{${keys.map(k => `${JSON.stringify(k)}:${canonicalJson(obj[k])}`).join(",")}}`;
}

export function sha256Hex(input: string): string {
	return createHash("sha256").update(input).digest("hex");
}

/** Hash basis = canonical JSON of the receipt without `sha256`. */
function hashBasis(receipt: Omit<ReceiptEnvelope<unknown>, "sha256">): string {
	return canonicalJson(receipt);
}

export interface BuildReceiptInput<E> {
	receiptId: string;
	sessionId: string;
	family: ReceiptFamily;
	source: string;
	subject: ReceiptSubject;
	evidence: E;
	artifactHashes?: Record<string, string>;
	createdAt?: string;
	valid?: boolean;
}

export function buildReceipt<E>(input: BuildReceiptInput<E>): ReceiptEnvelope<E> {
	const base: Omit<ReceiptEnvelope<E>, "sha256"> = {
		receiptId: input.receiptId,
		schemaVersion: RECEIPT_SCHEMA_VERSION,
		sessionId: input.sessionId,
		family: input.family,
		valid: input.valid ?? true,
		createdAt: input.createdAt ?? new Date().toISOString(),
		source: input.source,
		subject: input.subject,
		evidence: input.evidence,
		artifactHashes: input.artifactHashes ?? {},
	};
	return { ...base, sha256: sha256Hex(hashBasis(base)) };
}

export interface ValidationOutcome {
	valid: boolean;
	reasons: string[];
}

/** Recompute the hash and run structural family checks. Fail-closed. */
export function validateReceipt(receipt: ReceiptEnvelope<unknown>): ValidationOutcome {
	const reasons: string[] = [];
	const { sha256, ...rest } = receipt;
	if (sha256Hex(hashBasis(rest)) !== sha256) reasons.push("hash-mismatch");
	if (receipt.schemaVersion !== RECEIPT_SCHEMA_VERSION) reasons.push("schema-version-mismatch");
	const familyReasons = validateFamily(receipt);
	reasons.push(...familyReasons);
	return { valid: reasons.length === 0, reasons };
}

// ---- Family evidence shapes ---------------------------------------------------

export interface VanishEvidence {
	classification: RecoveryClassification;
	gitDelta: GitDelta;
	gitStatusPorcelain: string;
	untrackedManifest: { path: string; size: number; sha256: string }[];
	preservation: "snapshot" | "stash" | "block";
	stashRef: string | null;
	snapshotComplete: boolean;
	forbiddenActions: string[];
}

export interface PromptAcceptanceEvidence {
	promptSha256: string;
	rpcCommandId: string;
	preSubmitState: { isStreaming: boolean; steeringQueueDepth: number; followupQueueDepth: number };
	preSubmitCursor: number;
	agentStartCursor: number;
	acceptedAt: string;
	singleFlight: true;
}

export interface ValidationEvidence {
	command: string;
	exactCommand: string;
	cwd: string;
	exitStatus: number;
	pass: boolean;
	commitUnderTest: string | null;
}

export interface CompletionEvidence {
	finalCommit: string;
	branch: string;
	prUrl: string | null;
	issueArtifact: string | null;
	requiredValidationReceiptIds: string[];
	finalLifecycle: string;
	finalizedAt: string;
	blockers: string[];
}

export interface ReviewVerdictEvidence {
	verdict: ReviewVerdict;
	prTarget: string | null;
	finalizedAt: string;
	/** Bounded summary code/reference for the verdict; never raw assistant text. */
	summaryRef: string | null;
	verdictSource?: string;
}

export interface ReviewFailureEvidence {
	/** Machine-actionable reason the review produced no terminal verdict. */
	reason: string;
	prTarget: string | null;
	failedAt: string;
	/** Routing hint for the operator/fallback path. */
	fallback: string;
	assistantDigest?: string;
	assistantSummary?: string;
}

export interface PhaseRollupChildPointer {
	id: string;
	status: string;
	outputUri: string | null;
	outputSha256: string | null;
	receiptSha256: string;
	tokens: number;
	costTotal: number | null;
	clonedTokens: number | null;
	lowRoi: boolean;
}

export interface PhaseRollupEvidence {
	phase: string;
	children: PhaseRollupChildPointer[];
	aggregate: {
		childCount: number;
		completed: number;
		failed: number;
		totalTokens: number;
		totalCostTotal: number | null;
		totalClonedTokens: number | null;
		lowRoiChildIds: string[];
	};
}

function validateFamily(receipt: ReceiptEnvelope<unknown>): string[] {
	switch (receipt.family) {
		case "vanish":
			return validateVanish(receipt.evidence as VanishEvidence);
		case "prompt-acceptance":
			return validatePromptAcceptance(receipt.evidence as PromptAcceptanceEvidence);
		case "validation":
			return validateValidation(receipt.evidence as ValidationEvidence);
		case "completion":
			return validateCompletion(receipt.evidence as CompletionEvidence);
		case "review-verdict":
			return validateReviewVerdict(receipt.evidence as ReviewVerdictEvidence);
		case "review-failure":
			return validateReviewFailure(receipt.evidence as ReviewFailureEvidence);
		case "phase-rollup":
			return validatePhaseRollup(receipt.evidence as PhaseRollupEvidence);
		default:
			return [`unknown-family:${receipt.family}`];
	}
}

function validateVanish(e: VanishEvidence): string[] {
	const reasons: string[] = [];
	if (!e || typeof e.gitDelta !== "string") return ["vanish-missing-evidence"];
	const protectedDelta = e.gitDelta === "dirty" || e.gitDelta === "unknown";
	if (protectedDelta) {
		// Hard data-loss invariant: a dirty/unknown delta must be preserved (never blocked-away),
		// and the destructive actions must be explicitly forbidden.
		if (e.preservation === "block") reasons.push("vanish-dirty-must-preserve-not-block");
		for (const action of ["restart-clean", "delete", "reset"]) {
			if (!Array.isArray(e.forbiddenActions) || !e.forbiddenActions.includes(action)) {
				reasons.push(`vanish-must-forbid-${action}`);
			}
		}
	}
	if (e.preservation === "snapshot" && !e.snapshotComplete) reasons.push("vanish-snapshot-incomplete");
	if (e.preservation === "stash" && !e.stashRef) reasons.push("vanish-stash-missing-ref");
	return reasons;
}

function validatePromptAcceptance(e: PromptAcceptanceEvidence): string[] {
	const reasons: string[] = [];
	if (!e) return ["acceptance-missing-evidence"];
	if (e.singleFlight !== true) reasons.push("acceptance-not-single-flight");
	if (e.preSubmitState?.isStreaming) reasons.push("acceptance-pre-state-streaming");
	if ((e.preSubmitState?.steeringQueueDepth ?? 1) !== 0) reasons.push("acceptance-steering-queue-nonempty");
	if ((e.preSubmitState?.followupQueueDepth ?? 1) !== 0) reasons.push("acceptance-followup-queue-nonempty");
	if (!(e.agentStartCursor > e.preSubmitCursor)) reasons.push("acceptance-agent-start-not-after-cursor");
	return reasons;
}

function validateValidation(e: ValidationEvidence): string[] {
	if (!e || typeof e.exactCommand !== "string") return ["validation-missing-evidence"];
	return e.pass ? [] : ["validation-failed"];
}

function validateCompletion(e: CompletionEvidence): string[] {
	const reasons: string[] = [];
	if (!e) return ["completion-missing-evidence"];
	if (!e.finalCommit) reasons.push("completion-missing-commit");
	if (!e.prUrl && !e.issueArtifact) reasons.push("completion-missing-pr-or-issue");
	if (!Array.isArray(e.requiredValidationReceiptIds) || e.requiredValidationReceiptIds.length === 0) {
		reasons.push("completion-missing-validation-receipts");
	}
	if (Array.isArray(e.blockers) && e.blockers.length > 0) reasons.push("completion-has-blockers");
	return reasons;
}

function validateReviewVerdict(e: ReviewVerdictEvidence): string[] {
	if (!e) return ["review-verdict-missing-evidence"];
	if (!isReviewVerdict(e.verdict)) return ["review-verdict-not-in-vocabulary"];
	return [];
}

function validateReviewFailure(e: ReviewFailureEvidence): string[] {
	if (!e || typeof e.reason !== "string" || e.reason.length === 0) return ["review-failure-missing-reason"];
	return [];
}

function isSha256(value: unknown): boolean {
	return typeof value === "string" && /^[0-9a-f]{64}$/.test(value);
}

function validatePhaseRollup(e: PhaseRollupEvidence): string[] {
	const reasons: string[] = [];
	if (!e) return ["phase-rollup-missing-evidence"];
	if (typeof e.phase !== "string" || e.phase.length === 0) reasons.push("phase-rollup-missing-phase");
	if (!Array.isArray(e.children) || e.children.length === 0) reasons.push("phase-rollup-empty-children");
	const children = Array.isArray(e.children) ? e.children : [];
	for (const child of children) {
		if (!child.id) reasons.push("phase-rollup-child-missing-id");
		if (!isSha256(child.receiptSha256)) reasons.push(`phase-rollup-child-bad-receipt-hash:${child.id}`);
		if (child.outputSha256 !== null && !isSha256(child.outputSha256)) {
			reasons.push(`phase-rollup-child-bad-output-hash:${child.id}`);
		}
	}
	const aggregate = e.aggregate;
	if (!aggregate) return [...reasons, "phase-rollup-missing-aggregate"];
	if (aggregate.childCount !== children.length) reasons.push("phase-rollup-child-count-mismatch");
	const completed = children.filter(child => child.status === "completed").length;
	const failed = children.filter(child => child.status === "failed" || child.status === "merge_failed").length;
	const totalTokens = children.reduce((total, child) => total + child.tokens, 0);
	if (aggregate.completed !== completed) reasons.push("phase-rollup-completed-mismatch");
	if (aggregate.failed !== failed) reasons.push("phase-rollup-failed-mismatch");
	if (aggregate.totalTokens !== totalTokens) reasons.push("phase-rollup-total-tokens-mismatch");
	const anyCost = children.some(child => child.costTotal !== null);
	const costTotal = anyCost ? children.reduce((total, child) => total + (child.costTotal ?? 0), 0) : null;
	if (aggregate.totalCostTotal !== costTotal) reasons.push("phase-rollup-cost-mismatch");
	const anyCloned = children.some(child => child.clonedTokens !== null);
	const clonedTokens = anyCloned ? children.reduce((total, child) => total + (child.clonedTokens ?? 0), 0) : null;
	if (aggregate.totalClonedTokens !== clonedTokens) reasons.push("phase-rollup-cloned-token-mismatch");
	return reasons;
}

/** Classifications that MUST have a valid `vanish` receipt before the action proceeds. */
export function requiresVanishBeforeAction(classification: RecoveryClassification): boolean {
	return (
		classification === "restart-clean" ||
		classification === "restart-preserve-delta" ||
		classification === "fallback-codex-exec"
	);
}
