/**
 * JobsObserver
 *
 * Event-driven aggregator over background-work sources surfaced by the status
 * line, jobs overlay, and footer-below background panel.
 */
import type { AsyncJob, AsyncJobManager, SubagentRecord } from "../async";
import { deleteCronJobById, listCronSnapshots, onCronChange } from "../tools/cron";
import { sortBackgroundRows } from "./background-row-model";

export type JobsWorstState = "none" | "running" | "failed";
export type BackgroundWorkKind = "sub" | "sh" | "mon" | "cron" | "q";
export type BackgroundRowStatus = "running" | "queued" | "paused" | "failed" | "cancelled" | "scheduled";
export type BackgroundTerminalState = "none" | "attention";

export interface MonitorJobView {
	id: string;
	label: string;
	status: AsyncJob["status"];
	startTime: number;
}

export interface CronJobView {
	id: string;
	humanSchedule: string;
	cronExpression: string;
	prompt: string;
	recurring: boolean;
	nextFireAt?: number;
	createdAt: number;
}

export interface BackgroundRowView {
	id: string;
	kind: BackgroundWorkKind;
	label: string;
	status: BackgroundRowStatus;
	startTime?: number;
	nextFireAt?: number;
	terminalLatched: boolean;
	visibleSinceUserMessageSeq?: number;
	description?: string;
	outputPreview?: string;
	errorPreview?: string;
	resultPreview?: string;
}

export interface JobsSnapshot {
	backgroundRows: BackgroundRowView[];
	backgroundCounts: Record<BackgroundWorkKind, number>;
	totalVisible: number;
	terminalState: BackgroundTerminalState;
	failedOrCancelledLatched: boolean;
	monitors: MonitorJobView[];
	crons: CronJobView[];
	activeMonitorCount: number;
	activeCronCount: number;
	worstState: JobsWorstState;
	failedUnacknowledged: boolean;
}

const emptyCounts = (): Record<BackgroundWorkKind, number> => ({ sub: 0, sh: 0, mon: 0, cron: 0, q: 0 });

export const EMPTY_JOBS_SNAPSHOT: JobsSnapshot = {
	backgroundRows: [],
	backgroundCounts: emptyCounts(),
	totalVisible: 0,
	terminalState: "none",
	failedOrCancelledLatched: false,
	monitors: [],
	crons: [],
	activeMonitorCount: 0,
	activeCronCount: 0,
	worstState: "none",
	failedUnacknowledged: false,
};

function statusToBackgroundStatus(status: AsyncJob["status"]): BackgroundRowStatus | undefined {
	if (status === "running" || status === "paused" || status === "failed" || status === "cancelled") return status;
	return undefined;
}

function preview(text: string | undefined, max = 120): string | undefined {
	const oneLine = text?.replace(/\s+/g, " ").trim();
	if (!oneLine) return undefined;
	return oneLine.length > max ? `${oneLine.slice(0, max - 1)}…` : oneLine;
}

function classifyJob(job: AsyncJob): BackgroundWorkKind {
	if (job.type === "task" || job.metadata?.subagent) return "sub";
	if (job.type === "bash" && job.metadata?.monitor === true) return "mon";
	if (job.type === "bash") return "sh";
	return "q";
}

function rowFromJob(job: AsyncJob, kind = classifyJob(job)): BackgroundRowView | undefined {
	const status = statusToBackgroundStatus(job.status);
	if (!status) return undefined;
	return {
		id: job.id,
		kind,
		label: job.metadata?.subagent?.description ?? job.label,
		status,
		startTime: job.startTime,
		terminalLatched: status === "failed" || status === "cancelled",
		description: job.metadata?.subagent?.assignment ?? job.metadata?.subagent?.description,
		outputPreview: preview(job.resultText),
		errorPreview: preview(job.errorText),
		resultPreview: preview(job.resultText),
	};
}

function rowFromQueuedSubagent(record: SubagentRecord): BackgroundRowView | undefined {
	if (record.status !== "queued") return undefined;
	return {
		id: record.subagentId,
		kind: "sub",
		label: record.subagentId,
		status: "queued",
		startTime: record.queued?.createdAt,
		terminalLatched: false,
		description: record.queued?.message,
	};
}

export class JobsObserver {
	readonly #manager: AsyncJobManager;
	readonly #ownerId: string | undefined;
	readonly #unsubscribers: Array<() => void> = [];
	readonly #listeners = new Set<() => void>();
	readonly #acknowledgedFailedIds = new Set<string>();
	readonly #retainedTerminalRows = new Map<string, BackgroundRowView>();
	#failedUnacknowledged = false;
	#notifyScheduled = false;
	#disposed = false;
	#snapshot: JobsSnapshot = EMPTY_JOBS_SNAPSHOT;

	constructor(manager: AsyncJobManager, ownerId: string | undefined) {
		this.#manager = manager;
		this.#ownerId = ownerId;
		this.#unsubscribers.push(manager.onChange(() => this.#onUpstreamChange()));
		this.#unsubscribers.push(onCronChange(() => this.#onUpstreamChange()));
		this.#recompute();
	}

	onChange(cb: () => void): () => void {
		this.#listeners.add(cb);
		return () => {
			this.#listeners.delete(cb);
		};
	}

	#onUpstreamChange(): void {
		if (this.#disposed) return;
		this.#recompute();
		if (this.#notifyScheduled) return;
		this.#notifyScheduled = true;
		queueMicrotask(() => {
			this.#notifyScheduled = false;
			if (this.#disposed) return;
			this.#emit();
		});
	}

	#emit(): void {
		for (const cb of this.#listeners) {
			try {
				cb();
			} catch {
				// Listener errors are isolated; a bad subscriber must not break others.
			}
		}
	}

	#jobFilter(): { ownerId?: string } | undefined {
		return this.#ownerId ? { ownerId: this.#ownerId } : undefined;
	}

	#listMonitorJobs(): AsyncJob[] {
		return this.#manager
			.getAllJobs(this.#jobFilter())
			.filter(job => job.type === "bash" && job.metadata?.monitor === true);
	}

	#captureTerminalRows(jobs: AsyncJob[]): void {
		for (const job of jobs) {
			if (job.status !== "failed" && job.status !== "cancelled") continue;
			if (this.#acknowledgedFailedIds.has(job.id)) {
				this.#retainedTerminalRows.delete(job.id);
				continue;
			}
			const row = rowFromJob(job);
			if (!row) continue;
			const output = this.#manager.readOutputSince(job.id, 0, this.#jobFilter());
			const existing = this.#retainedTerminalRows.get(row.id);
			this.#retainedTerminalRows.set(row.id, {
				...row,
				visibleSinceUserMessageSeq: existing?.visibleSinceUserMessageSeq,
				outputPreview: preview(output?.text) ?? row.outputPreview,
				errorPreview: row.errorPreview,
				resultPreview: row.resultPreview,
			});
		}
		for (const id of this.#retainedTerminalRows.keys()) {
			if (this.#acknowledgedFailedIds.has(id)) this.#retainedTerminalRows.delete(id);
		}
	}

	#recompute(): void {
		const allJobs = this.#manager.getAllJobs(this.#jobFilter());
		this.#captureTerminalRows(allJobs);

		const monitorJobs = this.#listMonitorJobs();
		const presentMonitorIds = new Set(monitorJobs.map(job => job.id));
		for (const id of this.#acknowledgedFailedIds) {
			if (!presentMonitorIds.has(id) && !this.#retainedTerminalRows.has(id)) this.#acknowledgedFailedIds.delete(id);
		}

		const hasUnacknowledgedMonitorFailure = monitorJobs.some(
			job => job.status === "failed" && !this.#acknowledgedFailedIds.has(job.id),
		);
		if (hasUnacknowledgedMonitorFailure) this.#failedUnacknowledged = true;

		const activeMonitors = monitorJobs.filter(job => job.status === "running");
		const cronSnapshots = listCronSnapshots(this.#ownerId);
		const monitors: MonitorJobView[] = monitorJobs
			.map(job => ({ id: job.id, label: job.label, status: job.status, startTime: job.startTime }))
			.sort((a, b) => b.startTime - a.startTime);
		const crons: CronJobView[] = cronSnapshots
			.map(snapshot => ({
				id: snapshot.id,
				humanSchedule: snapshot.humanSchedule,
				cronExpression: snapshot.cron_expression,
				prompt: snapshot.prompt,
				recurring: snapshot.recurring,
				nextFireAt: snapshot.nextFireAt,
				createdAt: snapshot.createdAt,
			}))
			.sort((a, b) => b.createdAt - a.createdAt);

		const liveRows = allJobs
			.map(job => rowFromJob(job))
			.filter((row): row is BackgroundRowView => Boolean(row))
			.filter(row => !row.terminalLatched);
		const queuedRows = this.#manager
			.getSubagentRecords(this.#jobFilter())
			.map(rowFromQueuedSubagent)
			.filter((row): row is BackgroundRowView => Boolean(row));
		const cronRows: BackgroundRowView[] = crons.map(cron => ({
			id: cron.id,
			kind: "cron",
			label: cron.humanSchedule,
			status: "scheduled",
			nextFireAt: cron.nextFireAt,
			terminalLatched: false,
			description: cron.prompt,
		}));
		const backgroundRows = sortBackgroundRows([
			...this.#retainedTerminalRows.values(),
			...liveRows,
			...queuedRows,
			...cronRows,
		]);
		const backgroundCounts = emptyCounts();
		for (const row of backgroundRows) backgroundCounts[row.kind]++;
		const failedOrCancelledLatched = backgroundRows.some(row => row.terminalLatched);
		const worstState: JobsWorstState = this.#failedUnacknowledged
			? "failed"
			: activeMonitors.length > 0 || crons.length > 0
				? "running"
				: "none";
		this.#snapshot = {
			backgroundRows,
			backgroundCounts,
			totalVisible: backgroundRows.length,
			terminalState: failedOrCancelledLatched ? "attention" : "none",
			failedOrCancelledLatched,
			monitors,
			crons,
			activeMonitorCount: activeMonitors.length,
			activeCronCount: crons.length,
			worstState,
			failedUnacknowledged: this.#failedUnacknowledged || failedOrCancelledLatched,
		};
	}

	getSnapshot(): JobsSnapshot {
		return this.#snapshot;
	}

	markTerminalRowsVisible(userMessageSeq: number): void {
		let changed = false;
		for (const [id, row] of this.#retainedTerminalRows) {
			if (row.visibleSinceUserMessageSeq !== undefined) continue;
			this.#retainedTerminalRows.set(id, { ...row, visibleSinceUserMessageSeq: userMessageSeq });
			changed = true;
		}
		if (!changed) return;
		this.#recompute();
	}

	acknowledgeTerminalAfterUserMessage(userMessageSeq: number): void {
		let changed = false;
		for (const [id, row] of this.#retainedTerminalRows) {
			if (row.visibleSinceUserMessageSeq === undefined || row.visibleSinceUserMessageSeq >= userMessageSeq) continue;
			this.#retainedTerminalRows.delete(id);
			this.#acknowledgedFailedIds.add(id);
			changed = true;
		}
		if (!changed) return;
		this.#failedUnacknowledged = false;
		this.#recompute();
		this.#emit();
	}

	acknowledgeFailures(): void {
		for (const job of this.#listMonitorJobs()) {
			if (job.status === "failed") this.#acknowledgedFailedIds.add(job.id);
		}
		this.#retainedTerminalRows.clear();
		if (!this.#failedUnacknowledged) return;
		this.#failedUnacknowledged = false;
		this.#recompute();
		this.#emit();
	}

	cancelMonitor(id: string): boolean {
		return this.#manager.cancel(id);
	}

	deleteCron(id: string): boolean {
		return deleteCronJobById(this.#ownerId, id);
	}

	getMonitorOutput(id: string): string {
		const slice = this.#manager.readOutputSince(id, 0, this.#jobFilter());
		return slice?.text ?? this.#retainedTerminalRows.get(id)?.outputPreview ?? "";
	}

	dispose(): void {
		this.#disposed = true;
		for (const unsubscribe of this.#unsubscribers) {
			try {
				unsubscribe();
			} catch {
				// best-effort teardown
			}
		}
		this.#unsubscribers.length = 0;
		this.#listeners.clear();
	}
}
