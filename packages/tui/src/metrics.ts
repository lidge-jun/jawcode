/**
 * Opt-in renderer/runtime observability counters for the TUI.
 *
 * This module is the Stage 1 "observability foundation" surface. It is OFF by
 * default and only collects data when explicitly enabled via `JWC_PERF=1`,
 * the `PI_TUI_METRICS=1` in-memory compatibility flag, or programmatically
 * (used by the replay harness and tests). P2.0a also exposes bounded
 * `jwc.perf-events/1` JSONL rows plus explicit flush helpers; automatic
 * `TUI.stop()` flushing requires `JWC_PERF=1` or a non-empty `JWC_PERF_LOG`.
 * When disabled, every record call is a single boolean check at the call site,
 * so default runtime overhead is negligible and no existing render behavior
 * changes.
 *
 * It tracks:
 *  - `#doRender` durations (p50/p95/p99/max/mean) — frame-time histogram.
 *  - `requestRender` source attribution — which callers ask for renders.
 *  - Full-redraw cause classification — why a frame fell back to full repaint.
 *  - Repaint-storm detection — runs of consecutive unexpected full redraws.
 *  - RSS samples — baseline/peak/last for memory-growth gates.
 *  - Owner/timer gauges — long-lived resource counts for leak gates.
 */
import * as fs from "node:fs";
import * as path from "node:path";
import { performance } from "node:perf_hooks";
import { getLogsDir } from "@gajae-code/utils";

/** Number of consecutive unexpected full redraws that constitute a "storm". */
export const REPAINT_STORM_THRESHOLD = 3;

/** Hard cap on retained render-duration samples to keep memory bounded. */
const MAX_DURATION_SAMPLES = 200_000;

/** Hard cap on retained metric label keys; overflow is aggregated under `other`. */
export const MAX_LABEL_MAP_ENTRIES = 128;
/** Hard cap on retained perf event rows to keep memory bounded. */
export const MAX_PERF_EVENTS = 2048;

const LABEL_OVERFLOW_KEY = "other";

/**
 * Normalize full-redraw causes before retaining them as metric labels. Some
 * render paths include dimensions in debug-facing reason strings; metrics keep
 * the stable cause class so resize/delete storms cannot create unbounded label
 * cardinality.
 */
function normalizeFullRedrawCause(cause: string): string {
	const c = cause.toLowerCase();
	if (c.startsWith("first render")) return "first render";
	if (c.startsWith("terminal width changed")) return "terminal width changed";
	if (c.startsWith("terminal height changed")) return "terminal height changed";
	if (c.startsWith("clearonshrink")) return "clearOnShrink";
	if (c.startsWith("extralines > height")) return "extraLines > height";
	if (c.startsWith("firstchanged < viewporttop")) return "firstChanged < viewportTop";
	return cause;
}

/**
 * Full-redraw causes that are expected and do not count toward repaint storms.
 * These are legitimate, unavoidable full repaints (first frame, resize, shrink
 * clearing). Steady-stream storms come from any other repeated full redraw.
 */
function isExpectedFullRedraw(cause: string): boolean {
	const c = cause.toLowerCase();
	return (
		c.startsWith("first render") ||
		c.includes("width changed") ||
		c.includes("height changed") ||
		c.startsWith("clearonshrink") ||
		c.includes("forced") ||
		c.includes("force")
	);
}

function retainedLabel<T>(map: Map<string, T>, label: string): string {
	if (map.has(label) || label === LABEL_OVERFLOW_KEY) return label;
	return map.size < MAX_LABEL_MAP_ENTRIES - 1 ? label : LABEL_OVERFLOW_KEY;
}
export const PERF_EVENT_SCHEMA = "jwc.perf-events/1" as const;

export interface PerfCounterEvent {
	schema: typeof PERF_EVENT_SCHEMA;
	ts: string;
	source: string;
	counters: Record<string, number>;
	labels?: Record<string, string>;
}

function incrementCount(map: Map<string, number>, label: string): void {
	const retained = retainedLabel(map, label);
	map.set(retained, (map.get(retained) ?? 0) + 1);
}

export interface DurationStats {
	count: number;
	meanMs: number;
	p50Ms: number;
	p95Ms: number;
	p99Ms: number;
	maxMs: number;
}

export interface RssStats {
	samples: number;
	baselineBytes: number | null;
	lastBytes: number | null;
	peakBytes: number;
	growthBytes: number;
	/** RSS sampled after the run + a forced GC (informational). */
	returnBytes: number | null;
	/** Heap used at baseline and after the run + forced GC (reclaimable signal). */
	heapBaselineBytes: number | null;
	heapReturnBytes: number | null;
	/** (heapReturn - heapBaseline) / heapBaseline; <= tolerance means heap returned. */
	returnWithinBaselineFraction: number | null;
}

export interface HelperStat {
	count: number;
	totalMs: number;
	meanMs: number;
}

export interface RenderMetricsSnapshot {
	enabled: boolean;
	renderCount: number;
	renderDurations: DurationStats;
	durationsTruncated: boolean;
	requestSources: Record<string, number>;
	fullRedrawCount: number;
	fullRedrawCauses: Record<string, number>;
	repaintStorms: number;
	maxConsecutiveFullRedraws: number;
	counters: Record<string, number>;
	eventsBuffered: number;
	eventsDropped: number;
	rss: RssStats;
	ownerGauges: Record<string, number>;
	timerGauges: Record<string, number>;
	helperStats: Record<string, HelperStat>;
}

function emptyDurationStats(): DurationStats {
	return { count: 0, meanMs: 0, p50Ms: 0, p95Ms: 0, p99Ms: 0, maxMs: 0 };
}

function percentile(sorted: number[], p: number): number {
	if (sorted.length === 0) return 0;
	const rank = (p / 100) * (sorted.length - 1);
	const lo = Math.floor(rank);
	const hi = Math.ceil(rank);
	if (lo === hi) return sorted[lo];
	const frac = rank - lo;
	return sorted[lo] * (1 - frac) + sorted[hi] * frac;
}
export function isPerfMetricsEnabled(env: NodeJS.ProcessEnv = process.env): boolean {
	return env.JWC_PERF === "1" || env.PI_TUI_METRICS === "1";
}

export function isPerfJsonlFlushEnabled(env: NodeJS.ProcessEnv = process.env): boolean {
	return env.JWC_PERF === "1" || (typeof env.JWC_PERF_LOG === "string" && env.JWC_PERF_LOG.length > 0);
}

export class RenderMetrics {
	#enabled: boolean;
	#renderCount = 0;
	#durations: number[] = [];
	#durationsTruncated = false;
	#requestSources = new Map<string, number>();
	#fullRedrawCount = 0;
	#fullRedrawCauses = new Map<string, number>();
	#pendingUnexpectedFullRedraw = false;
	#consecutiveFullRedraws = 0;
	#maxConsecutiveFullRedraws = 0;
	#repaintStorms = 0;
	#rssSamples = 0;
	#rssBaseline: number | null = null;
	#rssLast: number | null = null;
	#rssPeak = 0;
	#ownerGauges = new Map<string, number>();
	#timerGauges = new Map<string, number>();
	#helpers = new Map<string, { count: number; totalMs: number }>();
	#rssReturn: number | null = null;
	#heapBaseline: number | null = null;
	#heapReturn: number | null = null;
	#counters = new Map<string, number>();
	#events: PerfCounterEvent[] = [];
	#eventsDropped = 0;
	#eventSources = new Map<string, number>();
	#eventCounterKeys = new Map<string, number>();
	#eventLabelKeys = new Map<string, number>();

	constructor(enabled = isPerfMetricsEnabled()) {
		this.#enabled = enabled;
	}

	get enabled(): boolean {
		return this.#enabled;
	}

	enable(): void {
		this.#enabled = true;
	}

	disable(): void {
		this.#enabled = false;
	}

	/** Reset all collected data (keeps the enabled state). */
	reset(): void {
		this.#renderCount = 0;
		this.#durations = [];
		this.#durationsTruncated = false;
		this.#requestSources.clear();
		this.#fullRedrawCount = 0;
		this.#fullRedrawCauses.clear();
		this.#pendingUnexpectedFullRedraw = false;
		this.#consecutiveFullRedraws = 0;
		this.#maxConsecutiveFullRedraws = 0;
		this.#repaintStorms = 0;
		this.#rssSamples = 0;
		this.#rssBaseline = null;
		this.#rssLast = null;
		this.#rssPeak = 0;
		this.#ownerGauges.clear();
		this.#timerGauges.clear();
		this.#helpers.clear();
		this.#rssReturn = null;
		this.#heapBaseline = null;
		this.#heapReturn = null;
		this.#counters.clear();
		this.#events = [];
		this.#eventsDropped = 0;
		this.#eventSources.clear();
		this.#eventCounterKeys.clear();
		this.#eventLabelKeys.clear();
	}

	/** High-resolution clock for timing render passes. Returns 0 when disabled. */
	now(): number {
		return this.#enabled ? performance.now() : 0;
	}

	/** Record that a render was requested, attributed to a caller source. */
	recordRequest(source = "unknown"): void {
		if (!this.#enabled) return;
		incrementCount(this.#requestSources, source);
	}

	/** Record one completed `#doRender` pass duration (ms). */
	recordRender(durationMs: number): void {
		if (!this.#enabled) return;
		this.#renderCount += 1;
		if (this.#durations.length < MAX_DURATION_SAMPLES) {
			this.#durations.push(durationMs);
		} else {
			this.#durationsTruncated = true;
		}

		// Storm bookkeeping: a render that performed an unexpected full redraw
		// extends the current run; any other render breaks it.
		if (this.#pendingUnexpectedFullRedraw) {
			this.#consecutiveFullRedraws += 1;
			if (this.#consecutiveFullRedraws > this.#maxConsecutiveFullRedraws) {
				this.#maxConsecutiveFullRedraws = this.#consecutiveFullRedraws;
			}
			if (this.#consecutiveFullRedraws === REPAINT_STORM_THRESHOLD) {
				this.#repaintStorms += 1;
			}
		} else {
			this.#consecutiveFullRedraws = 0;
		}
		this.#pendingUnexpectedFullRedraw = false;
	}

	/** Record a full-redraw event and classify its cause for storm detection. */
	recordFullRedraw(cause: string): void {
		if (!this.#enabled) return;
		this.#fullRedrawCount += 1;
		const normalizedCause = normalizeFullRedrawCause(cause);
		incrementCount(this.#fullRedrawCauses, normalizedCause);
		if (!isExpectedFullRedraw(normalizedCause)) {
			this.#pendingUnexpectedFullRedraw = true;
		}
	}

	/** Sample current RSS. Records baseline on first sample, tracks peak/last. */
	sampleRss(): number {
		if (!this.#enabled) return 0;
		const mem = process.memoryUsage();
		const rss = mem.rss;
		this.#rssSamples += 1;
		if (this.#rssBaseline === null) this.#rssBaseline = rss;
		if (this.#heapBaseline === null) this.#heapBaseline = mem.heapUsed;
		this.#rssLast = rss;
		if (rss > this.#rssPeak) this.#rssPeak = rss;
		return rss;
	}

	setOwnerGauge(name: string, value: number): void {
		if (!this.#enabled) return;
		this.#ownerGauges.set(name, value);
	}

	setTimerGauge(name: string, value: number): void {
		if (!this.#enabled) return;
		this.#timerGauges.set(name, value);
	}

	/** Accumulate timing/count for a named render helper (e.g. "renderTree"). */
	recordHelper(name: string, durationMs: number): void {
		if (!this.#enabled) return;
		const retained = retainedLabel(this.#helpers, name);
		const cur = this.#helpers.get(retained) ?? { count: 0, totalMs: 0 };
		cur.count += 1;
		cur.totalMs += durationMs;
		this.#helpers.set(retained, cur);
	}
	recordCounter(source: string, name: string, value = 1, labels?: Record<string, string>): void {
		if (!this.#enabled) return;
		const retained = retainedLabel(this.#counters, `${source}.${name}`);
		this.#counters.set(retained, (this.#counters.get(retained) ?? 0) + value);
		this.#pushEvent(source, { [name]: value }, labels);
	}

	recordEvent(source: string, counters: Record<string, number>, labels?: Record<string, string>): void {
		if (!this.#enabled) return;
		const retainedCounters: Record<string, number> = {};
		for (const [name, value] of Object.entries(counters)) {
			const retained = retainedLabel(this.#counters, `${source}.${name}`);
			this.#counters.set(retained, (this.#counters.get(retained) ?? 0) + value);
			retainedCounters[name] = value;
		}
		this.#pushEvent(source, retainedCounters, labels);
	}

	#pushEvent(source: string, counters: Record<string, number>, labels?: Record<string, string>): void {
		if (this.#events.length >= MAX_PERF_EVENTS) {
			this.#eventsDropped += 1;
			return;
		}
		const retainedSource = retainedLabel(this.#eventSources, source);
		this.#eventSources.set(retainedSource, (this.#eventSources.get(retainedSource) ?? 0) + 1);
		const retainedCounters: Record<string, number> = {};
		for (const [name, value] of Object.entries(counters)) {
			const retainedKey = retainedLabel(this.#eventCounterKeys, `${retainedSource}.${name}`);
			const eventKey = retainedKey === LABEL_OVERFLOW_KEY ? LABEL_OVERFLOW_KEY : name;
			this.#eventCounterKeys.set(retainedKey, (this.#eventCounterKeys.get(retainedKey) ?? 0) + 1);
			retainedCounters[eventKey] = (retainedCounters[eventKey] ?? 0) + value;
		}
		const retainedLabels: Record<string, string> = {};
		if (labels !== undefined) {
			for (const [name, value] of Object.entries(labels)) {
				const retainedKey = retainedLabel(this.#eventLabelKeys, name);
				this.#eventLabelKeys.set(retainedKey, (this.#eventLabelKeys.get(retainedKey) ?? 0) + 1);
				retainedLabels[retainedKey] = retainedKey === LABEL_OVERFLOW_KEY ? LABEL_OVERFLOW_KEY : value;
			}
		}
		const event: PerfCounterEvent = {
			schema: PERF_EVENT_SCHEMA,
			ts: new Date().toISOString(),
			source: retainedSource,
			counters: retainedCounters,
		};
		if (Object.keys(retainedLabels).length > 0) {
			event.labels = retainedLabels;
		}
		this.#events.push(event);
	}

	events(): PerfCounterEvent[] {
		return [...this.#events];
	}

	drainEvents(): PerfCounterEvent[] {
		const events = this.#events;
		this.#events = [];
		return events;
	}

	/**
	 * Force a GC when the runtime exposes one and sample RSS as the post-run
	 * "return" value used by the memory-leak gate. Callers should drop large
	 * references before calling so reclaimable memory is actually freed.
	 */
	sampleReturn(): number {
		if (!this.#enabled) return 0;
		const bunGc = (globalThis as { Bun?: { gc?: (force: boolean) => void } }).Bun?.gc;
		const nodeGc = (globalThis as { gc?: () => void }).gc;
		if (typeof bunGc === "function") bunGc(true);
		else if (typeof nodeGc === "function") nodeGc();
		const mem = process.memoryUsage();
		this.#rssReturn = mem.rss;
		this.#heapReturn = mem.heapUsed;
		if (this.#rssBaseline === null) this.#rssBaseline = mem.rss;
		if (this.#heapBaseline === null) this.#heapBaseline = mem.heapUsed;
		return mem.rss;
	}

	#durationStats(): DurationStats {
		if (this.#durations.length === 0) return emptyDurationStats();
		const sorted = [...this.#durations].sort((a, b) => a - b);
		const sum = sorted.reduce((acc, v) => acc + v, 0);
		return {
			count: sorted.length,
			meanMs: sum / sorted.length,
			p50Ms: percentile(sorted, 50),
			p95Ms: percentile(sorted, 95),
			p99Ms: percentile(sorted, 99),
			maxMs: sorted[sorted.length - 1],
		};
	}

	#helperStats(): Record<string, HelperStat> {
		const out: Record<string, HelperStat> = {};
		for (const [name, v] of this.#helpers) {
			out[name] = { count: v.count, totalMs: v.totalMs, meanMs: v.count ? v.totalMs / v.count : 0 };
		}
		return out;
	}

	snapshot(): RenderMetricsSnapshot {
		return {
			enabled: this.#enabled,
			renderCount: this.#renderCount,
			renderDurations: this.#durationStats(),
			durationsTruncated: this.#durationsTruncated,
			requestSources: Object.fromEntries(this.#requestSources),
			fullRedrawCount: this.#fullRedrawCount,
			fullRedrawCauses: Object.fromEntries(this.#fullRedrawCauses),
			repaintStorms: this.#repaintStorms,
			maxConsecutiveFullRedraws: this.#maxConsecutiveFullRedraws,
			counters: Object.fromEntries(this.#counters),
			eventsBuffered: this.#events.length,
			eventsDropped: this.#eventsDropped,
			rss: {
				samples: this.#rssSamples,
				baselineBytes: this.#rssBaseline,
				lastBytes: this.#rssLast,
				peakBytes: this.#rssPeak,
				growthBytes: this.#rssBaseline === null ? 0 : this.#rssPeak - this.#rssBaseline,
				returnBytes: this.#rssReturn,
				heapBaselineBytes: this.#heapBaseline,
				heapReturnBytes: this.#heapReturn,
				returnWithinBaselineFraction:
					this.#heapBaseline && this.#heapReturn !== null
						? (this.#heapReturn - this.#heapBaseline) / this.#heapBaseline
						: null,
			},
			ownerGauges: Object.fromEntries(this.#ownerGauges),
			timerGauges: Object.fromEntries(this.#timerGauges),
			helperStats: this.#helperStats(),
		};
	}
}
export function serializePerfEvent(event: PerfCounterEvent): string {
	return JSON.stringify(event);
}

export function resolvePerfLogPath(env: NodeJS.ProcessEnv = process.env): string {
	const configured = env.JWC_PERF_LOG;
	return configured && configured.length > 0 ? path.resolve(configured) : path.join(getLogsDir(), "perf.jsonl");
}

function recordPerfWriteError(metrics: RenderMetrics): void {
	metrics.recordCounter("perf.write", "error", 1);
}

export async function flushPerfEvents(metrics = renderMetrics, targetPath = resolvePerfLogPath()): Promise<void> {
	if (!metrics.enabled) return;
	const events = metrics.events();
	if (events.length === 0) return;
	const payload = `${events.map(serializePerfEvent).join("\n")}\n`;
	try {
		await fs.promises.mkdir(path.dirname(targetPath), { recursive: true });
		await fs.promises.appendFile(targetPath, payload, "utf8");
		metrics.drainEvents();
	} catch {
		recordPerfWriteError(metrics);
	}
}

export function flushPerfEventsSync(metrics = renderMetrics, targetPath = resolvePerfLogPath()): void {
	if (!metrics.enabled) return;
	const events = metrics.events();
	if (events.length === 0) return;
	const payload = `${events.map(serializePerfEvent).join("\n")}\n`;
	try {
		fs.mkdirSync(path.dirname(targetPath), { recursive: true });
		fs.appendFileSync(targetPath, payload, "utf8");
		metrics.drainEvents();
	} catch {
		recordPerfWriteError(metrics);
	}
}

/** Shared metrics instance used by the TUI render loop. */
export const renderMetrics = new RenderMetrics();
