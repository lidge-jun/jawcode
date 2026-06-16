import type { Settings } from "../config/settings";

/** Local memory query backend for stage1 + artifacts (99.01 M2). */
export type MemorySearchMode = "hybrid" | "fts" | "like";

export interface MemoryRuntimeConfig {
	enabled: boolean;
	maxRolloutsPerStartup: number;
	maxRolloutAgeDays: number;
	minRolloutIdleHours: number;
	threadScanLimit: number;
	maxRawMemoriesForGlobal: number;
	stage1Concurrency: number;
	stage1LeaseSeconds: number;
	stage1RetryDelaySeconds: number;
	phase2LeaseSeconds: number;
	phase2RetryDelaySeconds: number;
	phase2HeartbeatSeconds: number;
	rolloutPayloadPercent: number;
	phase1InputTokenLimit: number;
	fallbackTokenLimit: number;
	summaryInjectionTokenLimit: number;
	/** Optional override for stage1/phase2 model (provider/model or pi/ role alias). */
	modelRolePattern?: string;
	/** FTS5 vs LIKE for `searchLocalMemories` (default hybrid: FTS with LIKE fallback). */
	searchMode: MemorySearchMode;
	/** CLI/search surface default (99.01 M7). */
	searchLimit: number;
	/** `memory browse` row cap (99.01 M7). */
	browseLimit: number;
	/** Per-turn task snapshot caps (99.01 M9). */
	taskSnapshotTopN: number;
	taskSnapshotEpisodeCap: number;
	taskSnapshotMaxChars: number;
	searchMaxChars: number;
	snapshotSnippetChars: number;
	searchSnippetChars: number;
	hitCountDedupThreshold: number;
	compactedTaskSnapshotTopN: number;
	compactedTaskSnapshotEpisodeCap: number;
	compactedTaskSnapshotMaxChars: number;
	compactedSnapshotSnippetChars: number;
	compactedSearchSnippetChars: number;
	compactionContextMaxChars: number;
}

export const MEMORY_RUNTIME_DEFAULTS: MemoryRuntimeConfig = {
	enabled: false,
	maxRolloutsPerStartup: 64,
	maxRolloutAgeDays: 30,
	minRolloutIdleHours: 12,
	threadScanLimit: 300,
	maxRawMemoriesForGlobal: 200,
	stage1Concurrency: 8,
	stage1LeaseSeconds: 120,
	stage1RetryDelaySeconds: 120,
	phase2LeaseSeconds: 180,
	phase2RetryDelaySeconds: 180,
	phase2HeartbeatSeconds: 30,
	rolloutPayloadPercent: 0.7,
	phase1InputTokenLimit: 4_000,
	fallbackTokenLimit: 16_000,
	summaryInjectionTokenLimit: 5_000,
	modelRolePattern: undefined,
	searchMode: "hybrid",
	searchLimit: 8,
	browseLimit: 50,
	taskSnapshotTopN: 4,
	taskSnapshotEpisodeCap: 2,
	taskSnapshotMaxChars: 1_200,
	searchMaxChars: 4_000,
	snapshotSnippetChars: 200,
	searchSnippetChars: 700,
	hitCountDedupThreshold: 3,
	compactedTaskSnapshotTopN: 2,
	compactedTaskSnapshotEpisodeCap: 1,
	compactedTaskSnapshotMaxChars: 600,
	compactedSnapshotSnippetChars: 120,
	compactedSearchSnippetChars: 400,
	compactionContextMaxChars: 800,
};

function parseMemorySearchMode(value: unknown): MemorySearchMode {
	if (value === "fts" || value === "like" || value === "hybrid") return value;
	return MEMORY_RUNTIME_DEFAULTS.searchMode;
}

function parsePositiveInt(value: unknown, fallback: number): number {
	if (typeof value !== "number" || !Number.isFinite(value)) return fallback;
	const n = Math.floor(value);
	return n > 0 ? n : fallback;
}

/** Settings → pipeline + CLI query limits (single handoff surface for runtime + local-query). */
export function loadMemoryConfig(settings: Settings): MemoryRuntimeConfig {
	return {
		enabled: settings.get("memory.backend") === "local" || settings.get("memories.enabled") === true,
		maxRolloutsPerStartup:
			settings.get("memories.maxRolloutsPerStartup") ?? MEMORY_RUNTIME_DEFAULTS.maxRolloutsPerStartup,
		maxRolloutAgeDays: settings.get("memories.maxRolloutAgeDays") ?? MEMORY_RUNTIME_DEFAULTS.maxRolloutAgeDays,
		minRolloutIdleHours: settings.get("memories.minRolloutIdleHours") ?? MEMORY_RUNTIME_DEFAULTS.minRolloutIdleHours,
		threadScanLimit: settings.get("memories.threadScanLimit") ?? MEMORY_RUNTIME_DEFAULTS.threadScanLimit,
		maxRawMemoriesForGlobal:
			settings.get("memories.maxRawMemoriesForGlobal") ?? MEMORY_RUNTIME_DEFAULTS.maxRawMemoriesForGlobal,
		stage1Concurrency: settings.get("memories.stage1Concurrency") ?? MEMORY_RUNTIME_DEFAULTS.stage1Concurrency,
		stage1LeaseSeconds: settings.get("memories.stage1LeaseSeconds") ?? MEMORY_RUNTIME_DEFAULTS.stage1LeaseSeconds,
		stage1RetryDelaySeconds:
			settings.get("memories.stage1RetryDelaySeconds") ?? MEMORY_RUNTIME_DEFAULTS.stage1RetryDelaySeconds,
		phase2LeaseSeconds: settings.get("memories.phase2LeaseSeconds") ?? MEMORY_RUNTIME_DEFAULTS.phase2LeaseSeconds,
		phase2RetryDelaySeconds:
			settings.get("memories.phase2RetryDelaySeconds") ?? MEMORY_RUNTIME_DEFAULTS.phase2RetryDelaySeconds,
		phase2HeartbeatSeconds:
			settings.get("memories.phase2HeartbeatSeconds") ?? MEMORY_RUNTIME_DEFAULTS.phase2HeartbeatSeconds,
		rolloutPayloadPercent:
			settings.get("memories.rolloutPayloadPercent") ?? MEMORY_RUNTIME_DEFAULTS.rolloutPayloadPercent,
		phase1InputTokenLimit:
			settings.get("memories.phase1InputTokenLimit") ?? MEMORY_RUNTIME_DEFAULTS.phase1InputTokenLimit,
		fallbackTokenLimit: settings.get("memories.fallbackTokenLimit") ?? MEMORY_RUNTIME_DEFAULTS.fallbackTokenLimit,
		summaryInjectionTokenLimit:
			settings.get("memories.summaryInjectionTokenLimit") ?? MEMORY_RUNTIME_DEFAULTS.summaryInjectionTokenLimit,
		modelRolePattern: settings.get("memories.modelRolePattern")?.trim() || undefined,
		searchMode: parseMemorySearchMode(settings.get("memories.searchMode")),
		searchLimit: MEMORY_RUNTIME_DEFAULTS.searchLimit,
		browseLimit: MEMORY_RUNTIME_DEFAULTS.browseLimit,
		taskSnapshotTopN: parsePositiveInt(
			settings.get("memories.taskSnapshotTopN"),
			MEMORY_RUNTIME_DEFAULTS.taskSnapshotTopN,
		),
		taskSnapshotEpisodeCap: parsePositiveInt(
			settings.get("memories.taskSnapshotEpisodeCap"),
			MEMORY_RUNTIME_DEFAULTS.taskSnapshotEpisodeCap,
		),
		taskSnapshotMaxChars: parsePositiveInt(
			settings.get("memories.taskSnapshotMaxChars"),
			MEMORY_RUNTIME_DEFAULTS.taskSnapshotMaxChars,
		),
		searchMaxChars: parsePositiveInt(settings.get("memories.searchMaxChars"), MEMORY_RUNTIME_DEFAULTS.searchMaxChars),
		snapshotSnippetChars: parsePositiveInt(
			settings.get("memories.snapshotSnippetChars"),
			MEMORY_RUNTIME_DEFAULTS.snapshotSnippetChars,
		),
		searchSnippetChars: parsePositiveInt(
			settings.get("memories.searchSnippetChars"),
			MEMORY_RUNTIME_DEFAULTS.searchSnippetChars,
		),
		hitCountDedupThreshold: parsePositiveInt(
			settings.get("memories.hitCountDedupThreshold"),
			MEMORY_RUNTIME_DEFAULTS.hitCountDedupThreshold,
		),
		compactedTaskSnapshotTopN: parsePositiveInt(
			settings.get("memories.compactedTaskSnapshotTopN"),
			MEMORY_RUNTIME_DEFAULTS.compactedTaskSnapshotTopN,
		),
		compactedTaskSnapshotEpisodeCap: parsePositiveInt(
			settings.get("memories.compactedTaskSnapshotEpisodeCap"),
			MEMORY_RUNTIME_DEFAULTS.compactedTaskSnapshotEpisodeCap,
		),
		compactedTaskSnapshotMaxChars: parsePositiveInt(
			settings.get("memories.compactedTaskSnapshotMaxChars"),
			MEMORY_RUNTIME_DEFAULTS.compactedTaskSnapshotMaxChars,
		),
		compactedSnapshotSnippetChars: parsePositiveInt(
			settings.get("memories.compactedSnapshotSnippetChars"),
			MEMORY_RUNTIME_DEFAULTS.compactedSnapshotSnippetChars,
		),
		compactedSearchSnippetChars: parsePositiveInt(
			settings.get("memories.compactedSearchSnippetChars"),
			MEMORY_RUNTIME_DEFAULTS.compactedSearchSnippetChars,
		),
		compactionContextMaxChars: parsePositiveInt(
			settings.get("memories.compactionContextMaxChars"),
			MEMORY_RUNTIME_DEFAULTS.compactionContextMaxChars,
		),
	};
}
