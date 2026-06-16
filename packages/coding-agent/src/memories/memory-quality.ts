/**
 * Local memory quality gates (99.01 M9): character budgets, post-compaction recall
 * caps, and hit-count dedup for search/snapshot surfaces.
 */

import type { Database } from "bun:sqlite";
import type { CompactionEntry, SessionEntry } from "../session/session-manager";
import { getLatestCompactionEntry } from "../session/session-manager";
import type { LocalMemoryHit } from "./local-query";
import type { MemoryRuntimeConfig } from "./memory-config";
import { MEMORY_RUNTIME_DEFAULTS } from "./memory-config";

export interface MemorySnapshotLimits {
	topN: number;
	episodeCap: number;
	snippetChars: number;
	maxTotalChars: number;
}

export function sessionIsCompactionAware(entries: SessionEntry[]): boolean {
	return getLatestCompactionEntry(entries) !== null;
}

export function resolveSnapshotLimits(config: MemoryRuntimeConfig, isCompacted: boolean): MemorySnapshotLimits {
	if (isCompacted) {
		return {
			topN: config.compactedTaskSnapshotTopN,
			episodeCap: config.compactedTaskSnapshotEpisodeCap,
			snippetChars: config.compactedSnapshotSnippetChars,
			maxTotalChars: config.compactedTaskSnapshotMaxChars,
		};
	}
	return {
		topN: config.taskSnapshotTopN,
		episodeCap: config.taskSnapshotEpisodeCap,
		snippetChars: config.snapshotSnippetChars,
		maxTotalChars: config.taskSnapshotMaxChars,
	};
}

export function resolveSearchSnippetLimit(config: MemoryRuntimeConfig, isCompacted: boolean): number {
	return isCompacted ? config.compactedSearchSnippetChars : config.searchSnippetChars;
}

/** Apply hit-count penalty so over-recalled refs sink in ranking (M9 dedup). */
export function applyHitCountDedup(
	hits: LocalMemoryHit[],
	hitCounts: Map<string, number>,
	threshold: number,
): LocalMemoryHit[] {
	if (threshold <= 0) return hits;
	return hits
		.map(hit => {
			const count = hitCounts.get(hit.ref) ?? 0;
			const penalty = count >= threshold ? (count - threshold + 1) * 0.5 : 0;
			return { hit, score: hit.score + penalty };
		})
		.sort((a, b) => a.score - b.score || a.hit.ref.localeCompare(b.hit.ref))
		.map(row => row.hit);
}

export function loadMemoryHitCounts(db: Database, refs: string[]): Map<string, number> {
	const counts = new Map<string, number>();
	if (refs.length === 0) return counts;
	const placeholders = refs.map(() => "?").join(",");
	try {
		const rows = db
			.prepare(`SELECT ref, hit_count FROM memory_hit_counts WHERE ref IN (${placeholders})`)
			.all(...refs) as Array<{ ref: string; hit_count: number }>;
		for (const row of rows) {
			counts.set(row.ref, row.hit_count);
		}
	} catch {
		// Table may not exist on legacy DBs until openMemoryDb migrates.
	}
	return counts;
}

export function bumpMemoryHitCounts(db: Database, refs: string[], nowSec: number): void {
	const unique = [...new Set(refs.filter(r => r.trim().length > 0))];
	if (unique.length === 0) return;
	const stmt = db.prepare(`
INSERT INTO memory_hit_counts (ref, hit_count, last_hit_at)
VALUES (?, 1, ?)
ON CONFLICT(ref) DO UPDATE SET
	hit_count = hit_count + 1,
	last_hit_at = excluded.last_hit_at
`);
	const tx = db.transaction((items: string[]) => {
		for (const ref of items) {
			stmt.run(ref, nowSec);
		}
	});
	tx(unique);
}

export function formatSnapshotLine(hit: LocalMemoryHit, snippetLimit: number): string {
	const snippet = clipMemoryText(hit.snippet, snippetLimit);
	const loc = hit.line ? `:${hit.line}` : "";
	return `- [${hit.kind}] ${hit.ref}${loc} — ${snippet}`;
}

/** Trim snapshot lines to a total character budget without splitting refs mid-line. */
export function applySnapshotCharacterBudget(lines: string[], maxChars: number): string[] {
	if (maxChars <= 0) return lines;
	const picked: string[] = [];
	let used = 0;
	for (const line of lines) {
		const next = used === 0 ? line.length : used + 1 + line.length;
		if (picked.length > 0 && next > maxChars) break;
		if (picked.length === 0 && line.length > maxChars) {
			picked.push(clipMemoryText(line, maxChars));
			break;
		}
		picked.push(line);
		used = next;
	}
	return picked;
}

export function clipMemoryText(text: string, limit: number): string {
	if (limit <= 0 || text.length <= limit) return text;
	if (limit <= 3) return text.slice(0, limit);
	return `${text.slice(0, limit - 3)}...`;
}

export function compactionSummaryExcerpt(entry: CompactionEntry | null, maxChars: number): string | undefined {
	if (!entry?.summary?.trim()) return undefined;
	return clipMemoryText(entry.summary.trim(), maxChars);
}

export function defaultQualityConfig(): Pick<
	MemoryRuntimeConfig,
	| "taskSnapshotTopN"
	| "taskSnapshotEpisodeCap"
	| "taskSnapshotMaxChars"
	| "searchMaxChars"
	| "snapshotSnippetChars"
	| "searchSnippetChars"
	| "hitCountDedupThreshold"
	| "compactedTaskSnapshotTopN"
	| "compactedTaskSnapshotEpisodeCap"
	| "compactedTaskSnapshotMaxChars"
	| "compactedSnapshotSnippetChars"
	| "compactedSearchSnippetChars"
	| "compactionContextMaxChars"
> {
	return {
		taskSnapshotTopN: MEMORY_RUNTIME_DEFAULTS.taskSnapshotTopN,
		taskSnapshotEpisodeCap: MEMORY_RUNTIME_DEFAULTS.taskSnapshotEpisodeCap,
		taskSnapshotMaxChars: MEMORY_RUNTIME_DEFAULTS.taskSnapshotMaxChars,
		searchMaxChars: MEMORY_RUNTIME_DEFAULTS.searchMaxChars,
		snapshotSnippetChars: MEMORY_RUNTIME_DEFAULTS.snapshotSnippetChars,
		searchSnippetChars: MEMORY_RUNTIME_DEFAULTS.searchSnippetChars,
		hitCountDedupThreshold: MEMORY_RUNTIME_DEFAULTS.hitCountDedupThreshold,
		compactedTaskSnapshotTopN: MEMORY_RUNTIME_DEFAULTS.compactedTaskSnapshotTopN,
		compactedTaskSnapshotEpisodeCap: MEMORY_RUNTIME_DEFAULTS.compactedTaskSnapshotEpisodeCap,
		compactedTaskSnapshotMaxChars: MEMORY_RUNTIME_DEFAULTS.compactedTaskSnapshotMaxChars,
		compactedSnapshotSnippetChars: MEMORY_RUNTIME_DEFAULTS.compactedSnapshotSnippetChars,
		compactedSearchSnippetChars: MEMORY_RUNTIME_DEFAULTS.compactedSearchSnippetChars,
		compactionContextMaxChars: MEMORY_RUNTIME_DEFAULTS.compactionContextMaxChars,
	};
}
