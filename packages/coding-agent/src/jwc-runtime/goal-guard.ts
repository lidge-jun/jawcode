import * as fs from "node:fs/promises";
import {
	computeGoalPlanGeneration,
	type GoalCompletionVerification,
	type GoalEntry,
	type GoalLedgerEvent,
	type GoalPlan,
	type GoalReceiptKind,
	getGoalPaths,
	getGoalRunCompletionState,
	hashStructuredValue,
	readGoalLedger,
	readGoalPlan,
} from "./goal-engine";
import { DEFAULT_GOAL_OBJECTIVE } from "./goal-mode-request";

export type GoalGuardState =
	| "inactive"
	| "unrelated_goal"
	| "active_verified_complete"
	| "active_missing_receipt"
	| "active_stale_receipt"
	| "active_missing_final_receipt"
	| "active_dirty_quality_gate"
	| "active_review_blocked_unrecorded"
	| "active_review_blocked_recorded"
	| "unreadable_fail_closed";

export interface GoalGuardDiagnostic {
	state: GoalGuardState;
	message: string;
	goalId?: string;
}

export interface CurrentGoalLike {
	objective: string;
	status?: string;
}

function objectiveMatches(currentObjective: string, plan: GoalPlan): boolean {
	const normalized = currentObjective.trim();
	if (!normalized) return false;
	if (normalized === plan.jwcObjective || normalized === DEFAULT_GOAL_OBJECTIVE) return true;
	if (plan.jwcObjectiveAliases?.some(alias => alias === normalized)) return true;
	return plan.goals.some(goal => goal.objective === normalized);
}

function isKnownGoalObjective(currentObjective: string): boolean {
	const normalized = currentObjective.trim();
	return (
		normalized === DEFAULT_GOAL_OBJECTIVE ||
		(normalized.includes(".jwc/goal/goals.json") && normalized.includes(".jwc/goal/ledger.jsonl"))
	);
}

async function hasDurableGoalState(cwd: string): Promise<boolean> {
	try {
		await fs.stat(getGoalPaths(cwd).dir);
		return true;
	} catch (error) {
		if (
			typeof error === "object" &&
			error !== null &&
			"code" in error &&
			(error as { code?: unknown }).code === "ENOENT"
		) {
			return false;
		}
		throw error;
	}
}

function requiredGoals(plan: GoalPlan): GoalEntry[] {
	return plan.goals.filter(goal => goal.status !== "superseded");
}

function findReceiptGoal(
	plan: GoalPlan,
	currentObjective: string,
): { goal: GoalEntry; receiptKind: GoalReceiptKind } | null {
	if (
		currentObjective === plan.jwcObjective ||
		currentObjective === DEFAULT_GOAL_OBJECTIVE ||
		plan.jwcObjectiveAliases?.some(alias => alias === currentObjective)
	) {
		const finalGoal = [...requiredGoals(plan)]
			.reverse()
			.find(goal => goal.completionVerification?.receiptKind === "final-aggregate");
		return finalGoal ? { goal: finalGoal, receiptKind: "final-aggregate" } : null;
	}
	const storyGoal = plan.goals.find(goal => goal.objective === currentObjective);
	return storyGoal ? { goal: storyGoal, receiptKind: "per-goal" } : null;
}

function findLedgerReceiptEvent(
	ledger: readonly GoalLedgerEvent[],
	receipt: GoalCompletionVerification,
): GoalLedgerEvent | null {
	return (
		ledger.find(event => {
			if (event.eventId !== receipt.checkpointLedgerEventId) return false;
			if (event.event !== "goal_checkpointed") return false;
			if (event.goalId !== receipt.goalId) return false;
			const eventReceipt = event.completionVerification as GoalCompletionVerification | undefined;
			return (
				event.status === "complete" &&
				eventReceipt?.receiptId === receipt.receiptId &&
				eventReceipt.receiptKind === receipt.receiptKind &&
				eventReceipt.planGeneration === receipt.planGeneration
			);
		}) ?? null
	);
}

export function validateCompletionReceipt(input: {
	plan: GoalPlan;
	ledger: readonly GoalLedgerEvent[];
	goal: GoalEntry;
	receiptKind: GoalReceiptKind;
}): GoalGuardDiagnostic {
	const receipt = input.goal.completionVerification;
	if (!receipt) {
		return {
			state: input.receiptKind === "final-aggregate" ? "active_missing_final_receipt" : "active_missing_receipt",
			message: `Goal ${input.goal.id} has no ${input.receiptKind} completion verification receipt.`,
			goalId: input.goal.id,
		};
	}
	if (
		receipt.schemaVersion !== 1 ||
		receipt.goalId !== input.goal.id ||
		receipt.receiptKind !== input.receiptKind ||
		!receipt.planGeneration ||
		!receipt.checkpointLedgerEventId
	) {
		return {
			state: "active_stale_receipt",
			message: `Goal ${input.goal.id} receipt is malformed or stale.`,
			goalId: input.goal.id,
		};
	}
	const event = findLedgerReceiptEvent(input.ledger, receipt);
	if (!event) {
		return {
			state: "active_stale_receipt",
			message: `Goal ${input.goal.id} receipt ledger event is missing.`,
			goalId: input.goal.id,
		};
	}
	const generation = computeGoalPlanGeneration({
		plan: input.plan,
		ledger: input.ledger,
		goal: input.goal,
		receiptKind: input.receiptKind,
		beforeStatus: receipt.goalStatusBeforeCheckpoint,
		excludeEventId: receipt.checkpointLedgerEventId,
	});
	if (generation.planGeneration !== receipt.planGeneration) {
		return {
			state: "active_stale_receipt",
			message: `Goal ${input.goal.id} receipt generation is stale.`,
			goalId: input.goal.id,
		};
	}
	if (hashStructuredValue(event.qualityGateJson) !== receipt.qualityGateHash) {
		return {
			state: "active_dirty_quality_gate",
			message: `Goal ${input.goal.id} receipt quality-gate hash does not match ledger.`,
			goalId: input.goal.id,
		};
	}
	if (hashStructuredValue(event.jwcGoalJson) !== receipt.jwcGoalSnapshotHash) {
		return {
			state: "active_stale_receipt",
			message: `Goal ${input.goal.id} receipt goal({"op":"get"}) snapshot hash does not match ledger.`,
			goalId: input.goal.id,
		};
	}
	if (input.goal.updatedAt !== receipt.verifiedAt) {
		return {
			state: "active_stale_receipt",
			message: `Goal ${input.goal.id} receipt target changed after verification.`,
			goalId: input.goal.id,
		};
	}
	if (input.receiptKind === "final-aggregate") {
		const incomplete = requiredGoals(input.plan).filter(goal => goal.status !== "complete");
		if (incomplete.length > 0) {
			return {
				state: "active_missing_final_receipt",
				message: `Goal final receipt is not valid while required goals remain incomplete: ${incomplete.map(goal => goal.id).join(", ")}.`,
				goalId: input.goal.id,
			};
		}
		const missingReceipts = requiredGoals(input.plan).filter(
			goal => goal.id !== input.goal.id && !goal.completionVerification,
		);
		if (missingReceipts.length > 0) {
			return {
				state: "active_missing_receipt",
				message: `Goal final receipt is missing per-goal evidence for: ${missingReceipts.map(goal => goal.id).join(", ")}.`,
				goalId: input.goal.id,
			};
		}
	}
	return {
		state: "active_verified_complete",
		message: `Goal ${input.goal.id} has a fresh ${input.receiptKind} receipt.`,
		goalId: input.goal.id,
	};
}

export async function readGoalVerificationState(input: {
	cwd: string;
	currentGoal?: CurrentGoalLike | null;
}): Promise<GoalGuardDiagnostic> {
	const currentObjective = input.currentGoal?.objective?.trim() ?? "";
	if (!currentObjective) return { state: "inactive", message: "No current goal objective is active." };
	let plan: GoalPlan | null;
	let ledger: GoalLedgerEvent[];
	try {
		plan = await readGoalPlan(input.cwd);
		ledger = await readGoalLedger(input.cwd);
	} catch (error) {
		if (currentObjective === DEFAULT_GOAL_OBJECTIVE) {
			return {
				state: "unreadable_fail_closed",
				message: `Unable to read Goal verification state: ${error instanceof Error ? error.message : String(error)}`,
			};
		}
		return { state: "unrelated_goal", message: "Current goal is not an active Goal objective." };
	}
	if (!plan) {
		if (isKnownGoalObjective(currentObjective) || (await hasDurableGoalState(input.cwd))) {
			return {
				state: "unreadable_fail_closed",
				message: "Active Goal objective is missing durable .jwc/goal/goals.json state.",
			};
		}
		return { state: "inactive", message: "No Goal plan exists." };
	}
	if (!objectiveMatches(currentObjective, plan))
		return { state: "unrelated_goal", message: "Current goal is not an active Goal objective." };
	if (plan.goals.some(goal => goal.status === "review_blocked")) {
		return {
			state: "active_review_blocked_recorded",
			message: "Goal has recorded review blockers; complete blocker work and rerun verification.",
		};
	}
	const runState = getGoalRunCompletionState(plan);
	if (runState.incompleteGoals.some(goal => goal.status === "blocked" || goal.status === "failed")) {
		return {
			state: "active_dirty_quality_gate",
			message: "Goal has blocked or failed goals; record blockers or rerun verification.",
		};
	}
	const receiptTarget = findReceiptGoal(plan, currentObjective);
	if (!receiptTarget) {
		return {
			state: "active_missing_final_receipt",
			message: "Goal aggregate completion requires a fresh final aggregate receipt.",
		};
	}
	const receiptDiagnostic = validateCompletionReceipt({
		plan,
		ledger,
		goal: receiptTarget.goal,
		receiptKind: receiptTarget.receiptKind,
	});
	if (receiptDiagnostic.state !== "active_verified_complete") return receiptDiagnostic;
	if (runState.incompleteGoals.length > 0) {
		return {
			state: "active_missing_final_receipt",
			message: `Goal still has incomplete required goals: ${runState.incompleteGoals.map(goal => goal.id).join(", ")}. Run \`jwc goal complete-goals\` to continue.`,
			goalId: receiptTarget.goal.id,
		};
	}
	return receiptDiagnostic;
}

export async function assertCanCompleteCurrentGoal(input: {
	cwd: string;
	currentGoal?: CurrentGoalLike | null;
}): Promise<void> {
	if (!input.cwd) return;
	const diagnostic = await readGoalVerificationState(input);
	if (["inactive", "unrelated_goal", "active_verified_complete"].includes(diagnostic.state)) return;
	throw new Error(
		`${diagnostic.message} Run strict \`jwc goal checkpoint --status complete --quality-gate-json <file> --gjc-goal-json <file>\` first, or record review blockers and rerun verification.`,
	);
}

export function isGoalBypassPrompt(prompt: string): boolean {
	const normalized = prompt.replace(/\\?"/g, '"');
	return (
		/update_goal\s*\(|goal\s+complete|checkpoint[^\n]+--status\s+complete|skip\s+verification|weaken\s+verification|mark\s+.*complete/i.test(
			normalized,
		) || /goal[\s\S]{0,80}complete/i.test(normalized)
	);
}
