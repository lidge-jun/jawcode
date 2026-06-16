import type { WorkflowHudChip, WorkflowHudSummary } from "./active-state";

interface WorkflowGateHudState {
	approvalStatus?: string;
	blockedReason?: string;
	nextAction?: string;
}

interface JawInterviewHudState extends WorkflowGateHudState {
	phase?: string;
	ambiguity?: number;
	threshold?: number;
	roundCount?: number;
	targetComponent?: string;
	weakestDimension?: string;
	/** 99.04.03 — per-dimension 0..3 scores from the last interview round. */
	dimensions?: { goal?: number; constraint?: number; success?: number; ontology?: number };
	/** 99.04.03 — ambiguity change vs the previous round (negative = improving). */
	ambiguityDelta?: number;
	specStatus?: string;
	updatedAt?: string;
}

interface PlanphaseHudState extends WorkflowGateHudState {
	stage?: string;
	waiting?: string;
	iteration?: number;
	verdict?: string;
	latestSummary?: string;
	pendingApproval?: boolean;
	updatedAt?: string;
}

interface GoalLikeEntry {
	id: string;
	title: string;
	status: string;
}

interface GoalHudState extends WorkflowGateHudState {
	status: string;
	currentGoal?: GoalLikeEntry;
	counts: Record<string, number>;
	goals: GoalLikeEntry[];
	latestLedgerEvent?: { event?: string; goalId?: string; timestamp?: string };
	updatedAt?: string;
}

interface TeamHudWorker {
	id: string;
	status?: string;
}

interface TeamHudState extends WorkflowGateHudState {
	phase: string;
	task_total: number;
	task_counts: Record<string, number>;
	workers: TeamHudWorker[];
	updated_at?: string;
	latestEvent?: { type?: string; worker?: string; message?: string };
	latestMessage?: { from_worker?: string; body?: string };
}

function percent(value: number | undefined): string | undefined {
	if (typeof value !== "number" || !Number.isFinite(value)) return undefined;
	return `${Math.round(value * 100)}%`;
}

function chip(
	label: string,
	value: string | undefined,
	priority: number,
	severity?: WorkflowHudChip["severity"],
): WorkflowHudChip | null {
	if (!value) return null;
	return { label, value, priority, ...(severity ? { severity } : {}) };
}

function gateChips(state: WorkflowGateHudState, gatePriority: number): Array<WorkflowHudChip | null> {
	return [
		chip("gate", state.approvalStatus, gatePriority, state.approvalStatus === "approved" ? "success" : "warning"),
		chip("blocked", state.blockedReason, gatePriority + 10, "blocked"),
		chip("next", state.nextAction, gatePriority + 20),
	];
}

function compactChips(chips: Array<WorkflowHudChip | null>): WorkflowHudChip[] {
	return chips.filter((item): item is WorkflowHudChip => item !== null);
}

export function buildJawInterviewHudSummary(state: JawInterviewHudState): WorkflowHudSummary {
	return {
		version: 1,
		chips: compactChips([
			...gateChips(state, 5),
			chip("phase", state.phase, 10),
			chip("ambiguity", [percent(state.ambiguity), percent(state.threshold)].filter(Boolean).join("/"), 20),
			chip("round", state.roundCount === undefined ? undefined : String(state.roundCount), 30),
			chip("target", state.targetComponent, 40),
			chip("weakest", state.weakestDimension, 50),
			chip(
				"\u0394",
				typeof state.ambiguityDelta === "number"
					? `${state.ambiguityDelta <= 0 ? "\u2193" : "\u2191"}${Math.abs(state.ambiguityDelta).toFixed(2)}`
					: undefined,
				35,
				typeof state.ambiguityDelta === "number" ? (state.ambiguityDelta <= 0 ? "success" : "warning") : undefined,
			),
			chip("spec", state.specStatus, 60),
		]),
		...(state.dimensions
			? {
					details: compactChips([chip("dims", formatDimensionGauges(state.dimensions), 40)]),
				}
			: {}),
		...(state.updatedAt ? { updated_at: state.updatedAt } : {}),
	};
}

/** `G\u25b0\u25b0\u25b1 C\u25b0\u25b1\u25b1 \u2026` — 0..3 mini gauges, 1-width chars only (99.04.01 \u00a75). */
function formatDimensionGauges(dims: NonNullable<JawInterviewHudState["dimensions"]>): string | undefined {
	const order = ["goal", "constraint", "success", "ontology"] as const;
	const parts: string[] = [];
	for (const key of order) {
		const raw = dims[key];
		if (typeof raw !== "number" || !Number.isFinite(raw)) continue;
		const level = Math.max(0, Math.min(3, Math.round(raw)));
		parts.push(`${key[0].toUpperCase()}${"\u25b0".repeat(level)}${"\u25b1".repeat(3 - level)}`);
	}
	return parts.length > 0 ? parts.join(" ") : undefined;
}

export function buildPlanphaseHudSummary(state: PlanphaseHudState): WorkflowHudSummary {
	const verdict = state.verdict?.toUpperCase();
	const verdictSeverity =
		verdict === "BLOCK"
			? "blocked"
			: verdict === "ITERATE" || verdict === "WATCH"
				? "warning"
				: verdict === "APPROVE" || verdict === "CLEAR"
					? "success"
					: undefined;
	return {
		version: 1,
		summary: state.latestSummary,
		chips: compactChips([
			state.pendingApproval ? { label: "pending", value: "approval", priority: 5, severity: "warning" } : null,
			...gateChips(state, 6),
			chip("stage", state.stage, 10),
			chip("waiting", state.waiting, 20),
			chip("iter", state.iteration === undefined ? undefined : String(state.iteration), 30),
			chip("verdict", verdict, 40, verdictSeverity),
		]),
		...(state.updatedAt ? { updated_at: state.updatedAt } : {}),
	};
}

export function buildGoalHudSummary(state: GoalHudState): WorkflowHudSummary {
	const total = state.goals.length;
	const complete = state.counts.complete ?? 0;
	const blockers = (state.counts.blocked ?? 0) + (state.counts.review_blocked ?? 0) + (state.counts.failed ?? 0);
	return {
		version: 1,
		chips: compactChips([
			blockers > 0 ? { label: "blocked", value: String(blockers), priority: 5, severity: "blocked" } : null,
			chip("goals", `${complete}/${total}`, 10),
			chip("current", state.currentGoal ? `${state.currentGoal.id}:${state.currentGoal.title}` : state.status, 20),
			chip("status", state.status, 30, state.status === "complete" ? "success" : undefined),
			...gateChips(state, 40),
		]),
		details: state.latestLedgerEvent
			? compactChips([
					chip(
						"ledger",
						[state.latestLedgerEvent.event, state.latestLedgerEvent.goalId].filter(Boolean).join(":"),
						100,
					),
				])
			: undefined,
		...(state.updatedAt ? { updated_at: state.updatedAt } : {}),
	};
}

export function buildTeamHudSummary(state: TeamHudState): WorkflowHudSummary {
	const failedWorkers = state.workers.filter(
		worker => worker.status === "failed" || worker.status === "blocked",
	).length;
	const stoppedWorkers = state.workers.filter(worker => worker.status === "stopped").length;
	const completed = state.task_counts.completed ?? 0;
	const failedTasks = (state.task_counts.failed ?? 0) + (state.task_counts.blocked ?? 0);
	const latest = state.latestEvent?.message ?? state.latestEvent?.type ?? state.latestMessage?.body;
	return {
		version: 1,
		chips: compactChips([
			failedWorkers > 0 || failedTasks > 0
				? { label: "blocked", value: String(failedWorkers + failedTasks), priority: 5, severity: "blocked" }
				: stoppedWorkers > 0
					? { label: "stopped", value: String(stoppedWorkers), priority: 5, severity: "warning" }
					: null,
			chip("phase", state.phase, 10),
			chip("workers", `${state.workers.length - failedWorkers}/${state.workers.length}`, 20),
			chip("tasks", `${completed}/${state.task_total}`, 30),
			...gateChips(state, 40),
			chip("latest", latest, 70),
		]),
		...(state.updated_at ? { updated_at: state.updated_at } : {}),
	};
}
