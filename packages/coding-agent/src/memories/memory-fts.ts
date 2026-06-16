/**
 * FTS5 full-text indexes for local memory (99.01 M2).
 * Standalone FTS tables — stage1 uses `thread_id`; artifacts use `ref` (TEXT PKs elsewhere).
 */
import type { Database } from "bun:sqlite";

const STAGE1_FTS_TABLE = "stage1_outputs_fts";
const ARTIFACT_FTS_TABLE = "memory_artifacts_fts";

/** Create FTS virtual table + insert/delete triggers; stage1 updates sync via {@link syncStage1FtsRow}. */
export function ensureMemoryStage1Fts(db: Database): void {
	const hasFts = db
		.prepare("SELECT 1 AS ok FROM sqlite_master WHERE type = 'table' AND name = ?")
		.get(STAGE1_FTS_TABLE) as { ok?: number } | undefined;

	if (!hasFts?.ok) {
		db.exec(`
CREATE VIRTUAL TABLE IF NOT EXISTS ${STAGE1_FTS_TABLE} USING fts5(
	thread_id UNINDEXED,
	raw_memory,
	rollout_summary,
	tokenize='unicode61'
);

CREATE TRIGGER IF NOT EXISTS stage1_outputs_fts_ai AFTER INSERT ON stage1_outputs BEGIN
	INSERT INTO ${STAGE1_FTS_TABLE}(thread_id, raw_memory, rollout_summary)
	VALUES (new.thread_id, new.raw_memory, new.rollout_summary);
END;

CREATE TRIGGER IF NOT EXISTS stage1_outputs_fts_ad AFTER DELETE ON stage1_outputs BEGIN
	DELETE FROM ${STAGE1_FTS_TABLE} WHERE thread_id = old.thread_id;
END;
`);
	} else {
		db.exec("DROP TRIGGER IF EXISTS stage1_outputs_fts_au");
	}

	const ftsCount = db.prepare(`SELECT count(*) AS c FROM ${STAGE1_FTS_TABLE}`).get() as { c: number };
	const stageCount = db.prepare("SELECT count(*) AS c FROM stage1_outputs").get() as { c: number };
	if (stageCount.c > 0 && ftsCount.c === 0) {
		rebuildMemoryStage1Fts(db);
	}
}

/** FTS index for consolidated `MEMORY.md` / `memory_summary.md` (ref-keyed, manual sync). */
export function ensureMemoryArtifactFts(db: Database): void {
	const hasFts = db
		.prepare("SELECT 1 AS ok FROM sqlite_master WHERE type = 'table' AND name = ?")
		.get(ARTIFACT_FTS_TABLE) as { ok?: number } | undefined;
	if (!hasFts?.ok) {
		db.exec(`
CREATE VIRTUAL TABLE IF NOT EXISTS ${ARTIFACT_FTS_TABLE} USING fts5(
	ref UNINDEXED,
	body,
	tokenize='unicode61'
);
`);
	}
}

export function ensureMemoryFtsIndexes(db: Database): void {
	ensureMemoryStage1Fts(db);
	ensureMemoryArtifactFts(db);
}

/** Upsert one stage1 row into the FTS index (used on UPDATE paths that skip the broken FTS5 update trigger). */
export function syncStage1FtsRow(
	db: Database,
	params: { threadId: string; rawMemory: string; rolloutSummary: string },
): void {
	ensureMemoryStage1Fts(db);
	db.prepare(`DELETE FROM ${STAGE1_FTS_TABLE} WHERE thread_id = ?`).run(params.threadId);
	db.prepare(`INSERT INTO ${STAGE1_FTS_TABLE}(thread_id, raw_memory, rollout_summary) VALUES (?, ?, ?)`).run(
		params.threadId,
		params.rawMemory,
		params.rolloutSummary,
	);
}

export function removeMemoryArtifactFtsRow(db: Database, ref: string): void {
	ensureMemoryArtifactFts(db);
	db.prepare(`DELETE FROM ${ARTIFACT_FTS_TABLE} WHERE ref = ?`).run(ref);
}

/** Upsert one artifact ref (`memory` | `summary`) into the artifact FTS index. */
export function syncMemoryArtifactFtsRow(db: Database, params: { ref: string; body: string }): void {
	ensureMemoryArtifactFts(db);
	db.prepare(`DELETE FROM ${ARTIFACT_FTS_TABLE} WHERE ref = ?`).run(params.ref);
	if (params.body.trim().length === 0) return;
	db.prepare(`INSERT INTO ${ARTIFACT_FTS_TABLE}(ref, body) VALUES (?, ?)`).run(params.ref, params.body);
}

export function rebuildMemoryStage1Fts(db: Database): void {
	ensureMemoryStage1Fts(db);
	db.exec(`DELETE FROM ${STAGE1_FTS_TABLE}`);
	db.exec(`
INSERT INTO ${STAGE1_FTS_TABLE}(thread_id, raw_memory, rollout_summary)
SELECT thread_id, raw_memory, rollout_summary FROM stage1_outputs
`);
}

export function rebuildMemoryArtifactFts(db: Database): void {
	ensureMemoryArtifactFts(db);
	db.exec(`DELETE FROM ${ARTIFACT_FTS_TABLE}`);
}

export function rebuildAllMemoryFts(db: Database): void {
	rebuildMemoryStage1Fts(db);
	rebuildMemoryArtifactFts(db);
}

/** Escape a token for FTS5 quoted phrase / prefix search. */
function escapeFtsToken(term: string): string {
	return term.replace(/"/g, '""');
}

/**
 * Build an FTS5 MATCH expression from expanded query terms (prefix OR).
 * Returns null when there are no usable terms.
 */
export function buildStage1FtsMatchQuery(terms: string[]): string | null {
	const usable = terms.map(t => t.trim()).filter(t => t.length >= 2);
	if (usable.length === 0) return null;
	const parts = usable.map(t => `"${escapeFtsToken(t)}"*`);
	return parts.length === 1 ? parts[0] : `(${parts.join(" OR ")})`;
}

export const buildFtsMatchQuery = buildStage1FtsMatchQuery;

export interface Stage1FtsHitRow {
	thread_id: string;
	raw_memory: string;
	rollout_summary: string;
	rollout_slug: string | null;
	generated_at: number;
	rank: number;
}

export interface ArtifactFtsHitRow {
	ref: string;
	body: string;
	rank: number;
}

/**
 * Full-text search over stage1 outputs for one project cwd.
 * Lower `rank` from bm25() is a stronger match.
 */
export function searchStage1FtsRows(db: Database, cwd: string, matchQuery: string, limit: number): Stage1FtsHitRow[] {
	const sql = `
SELECT o.thread_id, o.raw_memory, o.rollout_summary, o.rollout_slug, o.generated_at,
	bm25(${STAGE1_FTS_TABLE}) AS rank
FROM ${STAGE1_FTS_TABLE} f
JOIN stage1_outputs o ON o.thread_id = f.thread_id
LEFT JOIN threads t ON t.id = o.thread_id
WHERE t.cwd = ? AND ${STAGE1_FTS_TABLE} MATCH ?
ORDER BY rank ASC, o.thread_id ASC
LIMIT ?`;
	try {
		return db.prepare(sql).all(cwd, matchQuery, limit) as Stage1FtsHitRow[];
	} catch {
		return [];
	}
}

/** Full-text search over indexed artifact bodies (`memory`, `summary` refs). */
export function searchArtifactFtsRows(db: Database, matchQuery: string, limit: number): ArtifactFtsHitRow[] {
	const sql = `
SELECT ref, body, bm25(${ARTIFACT_FTS_TABLE}) AS rank
FROM ${ARTIFACT_FTS_TABLE}
WHERE ${ARTIFACT_FTS_TABLE} MATCH ?
ORDER BY rank ASC, ref ASC
LIMIT ?`;
	try {
		return db.prepare(sql).all(matchQuery, limit) as ArtifactFtsHitRow[];
	} catch {
		return [];
	}
}
