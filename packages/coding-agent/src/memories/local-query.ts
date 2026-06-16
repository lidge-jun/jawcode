/**
 * Query/save surface over the local memories pipeline (99.01 M2).
 *
 * The engine (`memories/index.ts` + `storage.ts`) is an automatic
 * summarisation pipeline with no search verbs; this module adds the
 * cli-jaw-shaped read side without touching the schema. Ranking is the
 * 1st-iteration contract from 99.01.01 §2: SQL LIKE + kind weight +
 * recency — FTS5/RRF are follow-ups.
 *
 * Manual saves write straight into `stage1_outputs` (the
 * `markStage1SucceededWithOutput` path requires a running job's
 * ownership token, which manual rows never hold) and join phase2
 * consolidation through the normal watermark queue.
 */

import type { Database } from "bun:sqlite";
import * as fs from "node:fs";
import * as path from "node:path";
import { getAgentDbPath } from "@jawcode-dev/utils";
import { getMemoryRoot } from "./index";
import { MEMORY_RUNTIME_DEFAULTS, type MemorySearchMode } from "./memory-config";
import {
	buildStage1FtsMatchQuery,
	rebuildAllMemoryFts,
	searchArtifactFtsRows,
	searchStage1FtsRows,
	syncMemoryArtifactFtsRow,
	syncStage1FtsRow,
} from "./memory-fts";
import { closeMemoryDb, enqueueGlobalWatermark, openMemoryDb, upsertThreads } from "./storage";

export type LocalMemoryKind = "profile" | "shared" | "episode";

export interface LocalMemoryHit {
	/** Stable reference usable with `readLocalMemoryArtifact` (e.g. "memory", "summary", "stage1:<id>"). */
	ref: string;
	kind: LocalMemoryKind;
	line?: number;
	snippet: string;
	/** Lower is better (cli-jaw score semantics). */
	score: number;
	generatedAt?: number;
}

const SNIPPET_LIMIT = 700;
/** Kind weights mirror cli-jaw ranking priors (lower = stronger). */
const KIND_WEIGHT: Record<LocalMemoryKind, number> = { profile: -4, shared: -3, episode: 0 };
/** Seeded synonym groups for query expansion (FTS5 token search uses expanded terms). */
const SYNONYM_GROUPS: ReadonlyArray<ReadonlyArray<string>> = [["pabcd", "plan", "audit", "build", "check", "done"]];

const MANUAL_THREAD_PREFIX = "manual:";
const MANUAL_SOURCE_KIND = "manual";

function withDb<T>(agentDir: string, fn: (db: Database) => T): T {
	const dbPath = getAgentDbPath(agentDir);
	fs.mkdirSync(path.dirname(dbPath), { recursive: true });
	const db = openMemoryDb(dbPath);
	try {
		return fn(db);
	} finally {
		closeMemoryDb(db);
	}
}

function unixNow(): number {
	return Math.floor(Date.now() / 1000);
}

/** Canonical ref aliases accepted by read/context (99.01 M7). */
export function normalizeLocalMemoryRef(ref: string): string {
	const trimmed = ref.trim();
	if (trimmed === "memory_summary.md") return "summary";
	if (trimmed === "MEMORY.md") return "memory";
	return trimmed;
}

function compareMemoryHitsLexicographic(a: LocalMemoryHit, b: LocalMemoryHit): number {
	if (a.score !== b.score) return a.score - b.score;
	const refCmp = a.ref.localeCompare(b.ref);
	if (refCmp !== 0) return refCmp;
	return (a.line ?? 0) - (b.line ?? 0);
}
export interface LocalMemorySearchOptions {
	/** When non-empty, restrict episode/manual hits to threads whose rollout path matches a spec; profile/shared artifacts always pass. */
	scopePaths?: string[];
	/** Override settings `memories.searchMode` for this query. */
	searchMode?: MemorySearchMode;
}

function normalizeMemoryScopeSpec(value: string): string {
	const trimmed = value.trim().replaceAll("\\", "/");
	if (trimmed === "" || trimmed === "." || trimmed === "./") return ".";
	const collapsed = trimmed.replace(/^\.\/+/, "").replace(/\/+$/, "");
	return collapsed.length === 0 ? "." : collapsed;
}

function memoryPathMatchesScope(pathValue: string, specValue: string): boolean {
	const normalizedPath = normalizeMemoryScopeSpec(pathValue);
	const normalizedSpec = normalizeMemoryScopeSpec(specValue);
	if (normalizedSpec === ".") return true;
	return normalizedPath === normalizedSpec || normalizedPath.startsWith(`${normalizedSpec}/`);
}

function loadRolloutPathByThreadId(agentDir: string, cwd: string): Map<string, string> {
	return withDb(agentDir, db => {
		const rows = db.prepare("SELECT id, rollout_path FROM threads WHERE cwd = ?").all(cwd) as Array<{
			id: string;
			rollout_path: string;
		}>;
		return new Map(rows.map(r => [r.id, r.rollout_path]));
	});
}

function hitMatchesMemoryScope(
	hit: LocalMemoryHit,
	rolloutByThread: Map<string, string>,
	scopePaths: string[],
): boolean {
	if (scopePaths.length === 0) return true;
	if (hit.ref === "memory" || hit.ref === "summary") return true;
	if (hit.ref.startsWith("stage1:")) {
		const threadId = hit.ref.slice("stage1:".length);
		if (threadId.startsWith(MANUAL_THREAD_PREFIX)) {
			const file = threadId.slice(MANUAL_THREAD_PREFIX.length);
			return scopePaths.some(spec => memoryPathMatchesScope(file, spec));
		}
		const rolloutPath = rolloutByThread.get(threadId);
		if (!rolloutPath) return false;
		return scopePaths.some(spec => memoryPathMatchesScope(rolloutPath, spec));
	}
	return scopePaths.some(spec => memoryPathMatchesScope(hit.ref, spec));
}

export function filterScopePaths(
	hits: LocalMemoryHit[],
	scopePaths: string[] | undefined,
	rolloutByThread: Map<string, string>,
): LocalMemoryHit[] {
	const specs = scopePaths?.map(s => s.trim()).filter(Boolean) ?? [];
	if (specs.length === 0) return hits;
	return hits.filter(h => hitMatchesMemoryScope(h, rolloutByThread, specs));
}

function dedupeHitsByRef(hits: LocalMemoryHit[]): LocalMemoryHit[] {
	const best = new Map<string, LocalMemoryHit>();
	for (const hit of hits) {
		const prev = best.get(hit.ref);
		if (!prev || hit.score < prev.score) best.set(hit.ref, hit);
	}
	return [...best.values()];
}

/** Expand query terms with the seeded synonym groups (both directions). */
export function expandQueryTerms(query: string): string[] {
	const base = query
		.toLowerCase()
		.split(/[^\p{L}\p{N}_-]+/u)
		.filter(t => t.length >= 2);
	const terms = new Set(base);
	for (const group of SYNONYM_GROUPS) {
		if (base.some(t => group.includes(t))) for (const g of group) terms.add(g);
	}
	return [...terms];
}

/** Recency boost: hits from the last week float up; lower is better. */
function recencyBoost(generatedAt: number | undefined, nowSec: number): number {
	if (!generatedAt) return 0;
	const daysAgo = Math.max(0, (nowSec - generatedAt) / 86_400);
	return -Math.max(0, 2 - daysAgo / 7);
}

function clip(text: string, limit = SNIPPET_LIMIT): string {
	const collapsed = text.replace(/\s+/g, " ").trim();
	return collapsed.length > limit ? `${collapsed.slice(0, limit - 1)}…` : collapsed;
}

interface Stage1QueryRow {
	thread_id: string;
	raw_memory: string;
	rollout_summary: string;
	rollout_slug: string | null;
	generated_at: number;
}

function searchStage1RowsLike(db: Database, cwd: string, terms: string[], limit: number): LocalMemoryHit[] {
	if (terms.length === 0) return [];
	const likes = terms.map(() => "(o.raw_memory LIKE ? OR o.rollout_summary LIKE ?)").join(" OR ");
	const params: string[] = [];
	for (const t of terms) {
		const p = `%${t}%`;
		params.push(p, p);
	}
	const rows = db
		.prepare(
			`SELECT o.thread_id, o.raw_memory, o.rollout_summary, o.rollout_slug, o.generated_at
FROM stage1_outputs o
LEFT JOIN threads t ON t.id = o.thread_id
WHERE t.cwd = ? AND (${likes})
ORDER BY o.generated_at DESC
LIMIT ?`,
		)
		.all(cwd, ...params, limit * 4) as Stage1QueryRow[];
	const nowSec = unixNow();
	return rows.map(row => ({
		ref: `stage1:${row.thread_id}`,
		kind: "episode" as const,
		snippet: clip(row.raw_memory || row.rollout_summary),
		score: KIND_WEIGHT.episode + recencyBoost(row.generated_at, nowSec),
		generatedAt: row.generated_at,
	}));
}

function searchStage1Rows(
	db: Database,
	cwd: string,
	terms: string[],
	limit: number,
	searchMode: MemorySearchMode,
): LocalMemoryHit[] {
	if (terms.length === 0) return [];
	if (searchMode === "like") {
		return searchStage1RowsLike(db, cwd, terms, limit);
	}
	const matchQuery = buildStage1FtsMatchQuery(terms);
	if (matchQuery) {
		const nowSec = unixNow();
		const ftsRows = searchStage1FtsRows(db, cwd, matchQuery, limit * 4);
		if (ftsRows.length > 0 || searchMode === "fts") {
			return ftsRows
				.map(row => ({
					ref: `stage1:${row.thread_id}`,
					kind: "episode" as const,
					snippet: clip(row.raw_memory || row.rollout_summary),
					score: KIND_WEIGHT.episode + row.rank * 0.01 + recencyBoost(row.generated_at, nowSec),
					generatedAt: row.generated_at,
				}))
				.sort(compareMemoryHitsLexicographic);
		}
	}
	if (searchMode === "fts") return [];
	return searchStage1RowsLike(db, cwd, terms, limit);
}

const ARTIFACT_FTS_REF: Record<string, { ref: string; kind: LocalMemoryKind }> = {
	memory: { ref: "memory", kind: "profile" },
	summary: { ref: "summary", kind: "shared" },
};

function artifactSnippetForTerms(body: string, terms: string[]): { snippet: string; line?: number } {
	const lines = body.split("\n");
	for (let i = 0; i < lines.length; i++) {
		const lower = lines[i].toLowerCase();
		if (!terms.some(term => lower.includes(term.toLowerCase()))) continue;
		const context = lines.slice(Math.max(0, i - 1), i + 2).join(" ");
		return { snippet: clip(context), line: i + 1 };
	}
	return { snippet: clip(body) };
}

function searchArtifactFts(db: Database, terms: string[], limit: number): LocalMemoryHit[] {
	const matchQuery = buildStage1FtsMatchQuery(terms);
	if (!matchQuery) return [];
	const rows = searchArtifactFtsRows(db, matchQuery, limit * 4);
	const hits: LocalMemoryHit[] = [];
	for (const row of rows) {
		const meta = ARTIFACT_FTS_REF[row.ref];
		if (!meta) continue;
		const { snippet, line } = artifactSnippetForTerms(row.body, terms);
		hits.push({
			ref: meta.ref,
			kind: meta.kind,
			line,
			snippet,
			score: KIND_WEIGHT[meta.kind] + row.rank * 0.01,
		});
		if (hits.length >= limit * 2) break;
	}
	return hits;
}

function searchArtifacts(
	db: Database,
	memoryRoot: string,
	terms: string[],
	limit: number,
	searchMode: MemorySearchMode,
): LocalMemoryHit[] {
	if (terms.length === 0) return [];
	if (searchMode === "like") {
		return [
			...searchArtifact(memoryRoot, "MEMORY.md", "memory", "profile", terms),
			...searchArtifact(memoryRoot, "memory_summary.md", "summary", "shared", terms),
		];
	}
	const ftsHits = searchArtifactFts(db, terms, limit);
	if (ftsHits.length > 0 || searchMode === "fts") return ftsHits;
	return [
		...searchArtifact(memoryRoot, "MEMORY.md", "memory", "profile", terms),
		...searchArtifact(memoryRoot, "memory_summary.md", "summary", "shared", terms),
	];
}

function searchArtifact(
	memoryRoot: string,
	file: string,
	ref: string,
	kind: LocalMemoryKind,
	terms: string[],
): LocalMemoryHit[] {
	const filePath = path.join(memoryRoot, file);
	if (!fs.existsSync(filePath)) return [];
	let content: string;
	try {
		content = fs.readFileSync(filePath, "utf8");
	} catch {
		return [];
	}
	const hits: LocalMemoryHit[] = [];
	const lines = content.split("\n");
	for (let i = 0; i < lines.length; i++) {
		const lower = lines[i].toLowerCase();
		if (!terms.some(t => lower.includes(t))) continue;
		const context = lines.slice(Math.max(0, i - 1), i + 2).join(" ");
		hits.push({ ref, kind, line: i + 1, snippet: clip(context), score: KIND_WEIGHT[kind] });
		if (hits.length >= 3) break; // a few hits per artifact are enough — the artifact itself is one ref
	}
	return hits;
}

/**
 * FTS5 search over stage1 rows (LIKE fallback) + generated artifacts for one project.
 * Returns up to `limit` hits sorted by score (lower = better).
 */
export function searchMemoriesCore(
	agentDir: string,
	cwd: string,
	query: string,
	limit = MEMORY_RUNTIME_DEFAULTS.searchLimit,
	options?: LocalMemorySearchOptions,
): LocalMemoryHit[] {
	const terms = expandQueryTerms(query);
	if (terms.length === 0) return [];
	const searchMode = options?.searchMode ?? MEMORY_RUNTIME_DEFAULTS.searchMode;
	const memoryRoot = getMemoryRoot(agentDir, cwd);
	const stageHits = withDb(agentDir, db => searchStage1Rows(db, cwd, terms, limit, searchMode));
	const artifactHits = withDb(agentDir, db => searchArtifacts(db, memoryRoot, terms, limit, searchMode));
	const merged = dedupeHitsByRef([...artifactHits, ...stageHits]);
	const rolloutByThread = loadRolloutPathByThreadId(agentDir, cwd);
	const scoped = filterScopePaths(merged, options?.scopePaths, rolloutByThread);
	return scoped.sort(compareMemoryHitsLexicographic).slice(0, limit);
}

export function searchLocalMemories(
	agentDir: string,
	cwd: string,
	query: string,
	limit = MEMORY_RUNTIME_DEFAULTS.searchLimit,
	options?: LocalMemorySearchOptions,
): LocalMemoryHit[] {
	return searchMemoriesCore(agentDir, cwd, query, limit, options);
}

export interface ReadArtifactResult {
	ref: string;
	content: string;
}

/**
 * Read a memory artifact or record by ref vocabulary:
 * `summary` | `memory` | `raw` | `stage1:<thread_id>` | `rollout:<slug>`
 * (+ artifact basename compatibility). Optional `lines` = "a-b" range.
 */
export function readLocalMemoryArtifact(
	agentDir: string,
	cwd: string,
	ref: string,
	lines?: string,
): ReadArtifactResult | null {
	const normalized = normalizeLocalMemoryRef(ref);
	const memoryRoot = getMemoryRoot(agentDir, cwd);
	const sliceLines = (content: string): string => {
		if (!lines) return content;
		const m = lines.match(/^(\d+)-(\d+)$/);
		if (!m) return content;
		const all = content.split("\n");
		return all.slice(Math.max(0, Number(m[1]) - 1), Number(m[2])).join("\n");
	};
	const readFileRef = (file: string, normalizedRef: string): ReadArtifactResult | null => {
		const p = path.join(memoryRoot, file);
		if (!fs.existsSync(p)) return null;
		return { ref: normalizedRef, content: sliceLines(fs.readFileSync(p, "utf8")) };
	};

	if (normalized === "summary") return readFileRef("memory_summary.md", "summary");
	if (normalized === "memory") return readFileRef("MEMORY.md", "memory");
	if (normalized === "raw") {
		const rows = withDb(agentDir, db =>
			db
				.prepare(
					`SELECT o.thread_id, o.raw_memory, o.generated_at FROM stage1_outputs o
LEFT JOIN threads t ON t.id = o.thread_id WHERE t.cwd = ? ORDER BY o.generated_at DESC LIMIT 50`,
				)
				.all(cwd),
		) as Array<{ thread_id: string; raw_memory: string; generated_at: number }>;
		const body = rows.map(r => `## stage1:${r.thread_id}\n${r.raw_memory}`).join("\n\n");
		return { ref: "raw", content: sliceLines(body) };
	}
	if (normalized.startsWith("stage1:")) {
		const id = normalized.slice("stage1:".length);
		const row = withDb(agentDir, db =>
			db.prepare("SELECT raw_memory, rollout_summary FROM stage1_outputs WHERE thread_id = ?").get(id),
		) as { raw_memory: string; rollout_summary: string } | null;
		if (!row) return null;
		return { ref: normalized, content: sliceLines(`${row.raw_memory}\n\n---\n${row.rollout_summary}`) };
	}
	if (normalized.startsWith("rollout:")) {
		const slug = normalized.slice("rollout:".length);
		const row = withDb(agentDir, db =>
			db
				.prepare("SELECT thread_id, raw_memory, rollout_summary FROM stage1_outputs WHERE rollout_slug = ?")
				.get(slug),
		) as { thread_id: string; raw_memory: string; rollout_summary: string } | null;
		if (!row) return null;
		return { ref: normalized, content: sliceLines(`${row.raw_memory}\n\n---\n${row.rollout_summary}`) };
	}
	return null;
}

export interface SaveManualResult {
	threadId: string;
	enqueued: boolean;
}

/**
 * Save a manual memory as a stage1 row (`manual:<file>` thread id) and bump
 * the phase2 watermark so consolidation naturally folds it in. Direct
 * INSERT...ON CONFLICT — the job-owned write path is not applicable here.
 */
export function saveLocalMemoryManual(
	agentDir: string,
	cwd: string,
	file: string,
	content: string,
	kind?: LocalMemoryKind,
): SaveManualResult {
	const threadId = `${MANUAL_THREAD_PREFIX}${file}`;
	const nowSec = unixNow();
	const body = kind ? `---\nkind: ${kind}\n---\n${content}` : content;
	const summary = clip(content, 200);
	const slug = `manual-${file
		.toLowerCase()
		.replace(/[^a-z0-9]+/g, "-")
		.replace(/^-+|-+$/g, "")}`;
	withDb(agentDir, db => {
		upsertThreads(db, [
			{ id: threadId, updatedAt: nowSec, rolloutPath: threadId, cwd, sourceKind: MANUAL_SOURCE_KIND },
		]);
		db.prepare(
			`INSERT INTO stage1_outputs (thread_id, source_updated_at, raw_memory, rollout_summary, rollout_slug, generated_at)
VALUES (?, ?, ?, ?, ?, ?)
ON CONFLICT(thread_id) DO UPDATE SET
	source_updated_at = excluded.source_updated_at,
	raw_memory = excluded.raw_memory,
	rollout_summary = excluded.rollout_summary,
	rollout_slug = excluded.rollout_slug,
	generated_at = excluded.generated_at`,
		).run(threadId, nowSec, body, summary, slug, nowSec);
		syncStage1FtsRow(db, { threadId, rawMemory: body, rolloutSummary: summary });
		enqueueGlobalWatermark(db, nowSec, cwd, { forceDirtyWhenNotAdvanced: true });
	});
	return { threadId, enqueued: true };
}

export interface MemoryContextResult {
	ref: string;
	threadId: string;
	sourceKind: string;
	rolloutPath: string;
	updatedAt: number;
	record: string;
	/** Neighbouring rollout evidence when the source jsonl still exists. */
	rolloutExcerpt?: string;
}

/**
 * Resolve a stage1/manual ref back to its thread row and (when the rollout
 * jsonl still exists) a short excerpt of surrounding evidence.
 */
export function contextLocalMemory(agentDir: string, cwd: string, ref: string): MemoryContextResult | null {
	const normalized = normalizeLocalMemoryRef(ref);
	const threadId = normalized.startsWith("stage1:")
		? normalized.slice("stage1:".length)
		: normalized.startsWith(MANUAL_THREAD_PREFIX)
			? normalized
			: null;
	if (!threadId) return null;
	const joined = withDb(agentDir, db =>
		db
			.prepare(
				`SELECT t.id, t.source_kind, t.rollout_path, t.updated_at, o.raw_memory
FROM threads t LEFT JOIN stage1_outputs o ON o.thread_id = t.id
WHERE t.id = ? AND t.cwd = ?`,
			)
			.get(threadId, cwd),
	) as { id: string; source_kind: string; rollout_path: string; updated_at: number; raw_memory: string | null } | null;
	if (!joined) return null;
	const result: MemoryContextResult = {
		ref: normalized,
		threadId: joined.id,
		sourceKind: joined.source_kind,
		rolloutPath: joined.rollout_path,
		updatedAt: joined.updated_at,
		record: clip(joined.raw_memory ?? "", SNIPPET_LIMIT),
	};
	if (joined.source_kind !== MANUAL_SOURCE_KIND && joined.rollout_path && fs.existsSync(joined.rollout_path)) {
		try {
			const raw = fs.readFileSync(joined.rollout_path, "utf8");
			const tail = raw.split("\n").filter(Boolean).slice(-12).join("\n");
			result.rolloutExcerpt = tail.length > 2_000 ? `${tail.slice(0, 1_999)}…` : tail;
		} catch {
			// best-effort evidence — the record above is still the answer
		}
	}
	return result;
}

/**
 * Build the per-turn Task Snapshot block body (99.01 M6): top-N hits for the
 * current prompt, diversified (episodes capped at 2, one hit per ref).
 */

export interface LocalMemoryBrowseRow {
	ref: string;
	kind: LocalMemoryKind;
	updatedAt: number;
	snippet: string;
}

/** Recent memory index for `memory browse` (99.01 M7): artifacts + stage1 rows, newest first. */
export function browseLocalMemories(
	agentDir: string,
	cwd: string,
	limit = MEMORY_RUNTIME_DEFAULTS.browseLimit,
): LocalMemoryBrowseRow[] {
	const memoryRoot = getMemoryRoot(agentDir, cwd);
	const rows: LocalMemoryBrowseRow[] = [];
	const pushArtifact = (file: string, ref: string, kind: LocalMemoryKind) => {
		const filePath = path.join(memoryRoot, file);
		if (!fs.existsSync(filePath)) return;
		try {
			const stat = fs.statSync(filePath);
			const text = fs.readFileSync(filePath, "utf8");
			rows.push({ ref, kind, updatedAt: Math.floor(stat.mtimeMs / 1000), snippet: clip(text, 120) });
		} catch {
			// skip unreadable artifacts
		}
	};
	pushArtifact("MEMORY.md", "memory", "profile");
	pushArtifact("memory_summary.md", "summary", "shared");
	const stageRows = withDb(agentDir, db =>
		db
			.prepare(
				`SELECT o.thread_id, o.raw_memory, o.generated_at
FROM stage1_outputs o
LEFT JOIN threads t ON t.id = o.thread_id
WHERE t.cwd = ?
ORDER BY o.generated_at DESC
LIMIT ?`,
			)
			.all(cwd, limit * 2),
	) as Array<{ thread_id: string; raw_memory: string; generated_at: number }>;
	for (const row of stageRows) {
		const kind: LocalMemoryKind = row.thread_id.startsWith(MANUAL_THREAD_PREFIX) ? "shared" : "episode";
		rows.push({
			ref: `stage1:${row.thread_id}`,
			kind,
			updatedAt: row.generated_at,
			snippet: clip(row.raw_memory, 120),
		});
	}
	return rows.sort((a, b) => b.updatedAt - a.updatedAt || a.ref.localeCompare(b.ref)).slice(0, limit);
}

export function buildLocalTaskSnapshot(
	agentDir: string,
	cwd: string,
	promptText: string,
	topN = 4,
	options?: Pick<LocalMemorySearchOptions, "searchMode">,
): string | null {
	const hits = searchLocalMemories(agentDir, cwd, promptText, topN * 3, options);
	if (hits.length === 0) return null;
	const picked: LocalMemoryHit[] = [];
	const seenRefs = new Set<string>();
	let episodes = 0;
	for (const hit of hits) {
		if (picked.length >= topN) break;
		if (seenRefs.has(hit.ref)) continue;
		if (hit.kind === "episode" && episodes >= 2) continue;
		seenRefs.add(hit.ref);
		if (hit.kind === "episode") episodes += 1;
		picked.push(hit);
	}
	if (picked.length === 0) return null;
	return picked.map(h => `- [${h.kind}] ${h.ref}${h.line ? `:${h.line}` : ""} — ${clip(h.snippet, 200)}`).join("\n");
}

export interface LocalMemoryStatus {
	backend: "local";
	stage1Count: number;
	ftsStage1IndexedCount: number;
	ftsArtifactIndexedCount: number;
	artifactProfile: boolean;
	artifactSummary: boolean;
	pendingGlobalJobs: number;
}

/** Compact ref listing for `memory list` (99.01 M8). */
export function listLocalMemoryRefs(
	agentDir: string,
	cwd: string,
	limit = MEMORY_RUNTIME_DEFAULTS.browseLimit,
): string[] {
	return browseLocalMemories(agentDir, cwd, limit).map(r => r.ref);
}

/** Local backend health counters for `memory status` (99.01 M8). */
export function getLocalMemoryStatus(agentDir: string, cwd: string): LocalMemoryStatus {
	const memoryRoot = getMemoryRoot(agentDir, cwd);
	return withDb(agentDir, db => {
		const stage1Count = (
			db
				.prepare(
					`SELECT count(*) AS c FROM stage1_outputs o
LEFT JOIN threads t ON t.id = o.thread_id WHERE t.cwd = ?`,
				)
				.get(cwd) as { c: number }
		).c;
		let ftsStage1IndexedCount = 0;
		let ftsArtifactIndexedCount = 0;
		try {
			ftsStage1IndexedCount = (db.prepare("SELECT count(*) AS c FROM stage1_outputs_fts").get() as { c: number }).c;
			ftsArtifactIndexedCount = (db.prepare("SELECT count(*) AS c FROM memory_artifacts_fts").get() as { c: number })
				.c;
		} catch {
			ftsStage1IndexedCount = 0;
			ftsArtifactIndexedCount = 0;
		}
		const pendingGlobalJobs = (
			db
				.prepare(
					`SELECT count(*) AS c FROM jobs WHERE kind = 'memory_consolidate_global' AND job_key = ? AND status IN ('pending', 'running')`,
				)
				.get(`global:${cwd}`) as { c: number }
		).c;
		return {
			backend: "local",
			stage1Count,
			ftsStage1IndexedCount,
			ftsArtifactIndexedCount,
			artifactProfile: fs.existsSync(path.join(memoryRoot, "MEMORY.md")),
			artifactSummary: fs.existsSync(path.join(memoryRoot, "memory_summary.md")),
			pendingGlobalJobs,
		};
	});
}

/** Rebuild FTS5 index from stage1_outputs (`memory reindex`, 99.01 M8). */

/** Index on-disk MEMORY.md / memory_summary.md into artifact FTS (used after consolidation + reindex). */
export function syncArtifactFilesToFts(db: Database, memoryRoot: string): void {
	const read = (file: string): string => {
		const filePath = path.join(memoryRoot, file);
		if (!fs.existsSync(filePath)) return "";
		try {
			return fs.readFileSync(filePath, "utf8");
		} catch {
			return "";
		}
	};
	syncMemoryArtifactFtsRow(db, { ref: "memory", body: read("MEMORY.md") });
	syncMemoryArtifactFtsRow(db, { ref: "summary", body: read("memory_summary.md") });
}

export function reindexLocalMemoryFts(
	agentDir: string,
	memoryRoot?: string,
): { indexedStage1: number; indexedArtifacts: number } {
	return withDb(agentDir, db => {
		rebuildAllMemoryFts(db);
		if (memoryRoot) {
			syncArtifactFilesToFts(db, memoryRoot);
		}
		const indexedStage1 = (db.prepare("SELECT count(*) AS c FROM stage1_outputs_fts").get() as { c: number }).c;
		const indexedArtifacts = (db.prepare("SELECT count(*) AS c FROM memory_artifacts_fts").get() as { c: number }).c;
		return { indexedStage1, indexedArtifacts };
	});
}
