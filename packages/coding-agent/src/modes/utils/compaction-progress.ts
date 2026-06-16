import { replaceTabs, truncateToWidth, visibleWidth } from "@gajae-code/tui";
import type { CompactionProgressUpdate } from "../../extensibility/extensions/types";

const BAR_FILL = "█";
const BAR_EMPTY = "░";
const DEFAULT_BAR_WIDTH = 18;
const MIN_BAR_WIDTH = 6;
const TICK_MS = 200;

const COMPACTION_PROGRESS_TIMING = {
	setupPrepareMs: 300,
	setupHooksMs: 2_000,
	remoteAwaitMs: 60_000,
	localSummaryMs: 90_000,
	splitTurnSummaryMs: 90_000,
	shortSummaryMs: 15_000,
	finalizeMs: 1_000,
	persistMs: 2_000,
} as const;

interface SegmentTiming {
	start: number;
	hold: number;
	predictedMs: number;
}

const SEGMENT_TIMING: Record<CompactionProgressUpdate["segment"], SegmentTiming> = {
	setup_prepare: { start: 0, hold: 4, predictedMs: COMPACTION_PROGRESS_TIMING.setupPrepareMs },
	setup_hooks: { start: 5, hold: 14, predictedMs: COMPACTION_PROGRESS_TIMING.setupHooksMs },
	remote_await: { start: 15, hold: 29, predictedMs: COMPACTION_PROGRESS_TIMING.remoteAwaitMs },
	local_summary: { start: 30, hold: 81, predictedMs: COMPACTION_PROGRESS_TIMING.localSummaryMs },
	parallel_local_summaries: { start: 30, hold: 81, predictedMs: COMPACTION_PROGRESS_TIMING.splitTurnSummaryMs },
	short_summary: { start: 82, hold: 91, predictedMs: COMPACTION_PROGRESS_TIMING.shortSummaryMs },
	finalize: { start: 92, hold: 94, predictedMs: COMPACTION_PROGRESS_TIMING.finalizeMs },
	persist: { start: 95, hold: 99, predictedMs: COMPACTION_PROGRESS_TIMING.persistMs },
	terminal: { start: 100, hold: 100, predictedMs: 1 },
};

export interface CompactionProgressPresenterOptions {
	setMessage: (message: string) => void;
	getWidth: () => number;
	prefix: string;
	cancelHint: string;
}

function clampPercent(percent: number): number {
	if (!Number.isFinite(percent)) return 0;
	return Math.max(0, Math.min(100, percent));
}

function predictedPercent(start: number, hold: number, elapsedMs: number, predictedMs: number): number {
	const ratio = Math.min(1, elapsedMs / Math.max(1, predictedMs));
	const eased = 1 - (1 - ratio) ** 2;
	return Math.min(hold, start + (hold - start) * eased);
}

function renderBar(percent: number, width: number): string {
	const clampedWidth = Math.max(MIN_BAR_WIDTH, width);
	const filled = Math.max(0, Math.min(clampedWidth, Math.round((clampPercent(percent) / 100) * clampedWidth)));
	return `${BAR_FILL.repeat(filled)}${BAR_EMPTY.repeat(clampedWidth - filled)}`;
}

export function formatCompactionLoaderLine(args: {
	prefix: string;
	percent: number;
	message: string;
	cancelHint: string;
	width: number;
}): string {
	const width = Math.max(20, args.width);
	const prefix = replaceTabs(args.prefix.trim());
	const cancelHint = replaceTabs(args.cancelHint.trim());
	const percentText = `${Math.round(clampPercent(args.percent))}%`;
	const fixedWithoutMessage = `${prefix}  ${percentText}  ${cancelHint}`;
	const fixedWidth = visibleWidth(fixedWithoutMessage) + 4;
	const availableForBarAndMessage = Math.max(MIN_BAR_WIDTH, width - fixedWidth);
	const barWidth = Math.max(
		MIN_BAR_WIDTH,
		Math.min(DEFAULT_BAR_WIDTH, Math.floor(Math.max(MIN_BAR_WIDTH, availableForBarAndMessage) / 2)),
	);
	const bar = renderBar(args.percent, barWidth);
	const fixed = `${prefix}  ${bar} ${percentText}`;
	const remainingForMessage = Math.max(0, width - visibleWidth(`${fixed}  ${cancelHint}`) - 2);
	const message = remainingForMessage > 0 ? truncateToWidth(replaceTabs(args.message), remainingForMessage) : "";
	const line = message ? `${fixed}  ${message}  ${cancelHint}` : `${fixed}  ${cancelHint}`;
	return truncateToWidth(line, width);
}

export class CompactionProgressPresenter {
	#options: CompactionProgressPresenterOptions;
	#current?: CompactionProgressUpdate;
	#segmentStartedAt = Date.now();
	#displayPercent = 0;
	#intervalId?: NodeJS.Timeout;
	#stopped = false;

	constructor(options: CompactionProgressPresenterOptions) {
		this.#options = options;
		this.#intervalId = setInterval(() => this.#render(), TICK_MS);
		this.#intervalId.unref?.();
		this.#renderFallback();
	}

	update(update: CompactionProgressUpdate): void {
		if (this.#stopped) return;
		const previous = this.#current;
		this.#current = update;
		if (!previous || previous.segment !== update.segment || previous.phase !== update.phase) {
			this.#segmentStartedAt = Date.now();
		}
		if (update.phase === "cancelled" || update.phase === "failed") {
			this.#displayPercent = clampPercent(update.percent);
		} else {
			this.#displayPercent = Math.max(this.#displayPercent, clampPercent(update.percent));
		}
		this.#render();
		if (update.segment === "terminal" || update.phase === "completed") {
			this.stop();
		}
	}

	stop(): void {
		this.#stopped = true;
		if (this.#intervalId) {
			clearInterval(this.#intervalId);
			this.#intervalId = undefined;
		}
	}

	#renderFallback(): void {
		this.#options.setMessage(
			formatCompactionLoaderLine({
				prefix: this.#options.prefix,
				percent: 0,
				message: "Preparing compaction…",
				cancelHint: this.#options.cancelHint,
				width: this.#options.getWidth(),
			}),
		);
	}

	#render(): void {
		if (this.#stopped) return;
		const update = this.#current;
		if (!update) {
			this.#renderFallback();
			return;
		}
		let percent = this.#displayPercent;
		if (update.phase === "completed") {
			percent = 100;
		} else if (update.phase !== "cancelled" && update.phase !== "failed") {
			const timing = SEGMENT_TIMING[update.segment];
			const predicted = predictedPercent(
				timing.start,
				timing.hold,
				Date.now() - this.#segmentStartedAt,
				timing.predictedMs,
			);
			percent = Math.max(percent, predicted);
			percent = Math.min(percent, timing.hold);
		}
		this.#displayPercent = percent;
		this.#options.setMessage(
			formatCompactionLoaderLine({
				prefix: this.#options.prefix,
				percent,
				message: update.message,
				cancelHint: this.#options.cancelHint,
				width: this.#options.getWidth(),
			}),
		);
	}
}
