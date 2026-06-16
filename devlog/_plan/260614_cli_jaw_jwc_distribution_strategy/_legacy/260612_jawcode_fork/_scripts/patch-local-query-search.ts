import * as fs from "node:fs";

const p = "src/memories/local-query.ts";
let t = fs.readFileSync(p, "utf8");

t = t.replace(
	'import { MEMORY_RUNTIME_DEFAULTS } from "./memory-config";',
	'import { MEMORY_RUNTIME_DEFAULTS, type MemorySearchMode } from "./memory-config";',
);

t = t.replace(
	`import { buildStage1FtsMatchQuery, rebuildMemoryStage1Fts, searchStage1FtsRows, syncStage1FtsRow } from "./memory-fts";`,
	`import {
	buildStage1FtsMatchQuery,
	rebuildAllMemoryFts,
	searchArtifactFtsRows,
	searchStage1FtsRows,
	syncMemoryArtifactFtsRow,
	syncStage1FtsRow,
} from "./memory-fts";`,
);

t = t.replace(
	/export interface LocalMemorySearchOptions \{[\s\S]*?\}/,
	`export interface LocalMemorySearchOptions {
	/** When non-empty, restrict episode/manual hits to threads whose rollout path matches a spec; profile/shared artifacts always pass. */
	scopePaths?: string[];
	/** Override settings \`memories.searchMode\` for this query. */
	searchMode?: MemorySearchMode;
}`,
);

const stage1Fn = `function searchStage1Rows(
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
					ref: \`stage1:\${row.thread_id}\`,
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
}`;

t = t.replace(/function searchStage1Rows\([\s\S]*?\n\}/, stage1Fn);

const artifactFns = `
const ARTIFACT_FTS_REF: Record<string, { ref: string; kind: LocalMemoryKind }> = {
	memory: { ref: "memory", kind: "profile" },
	summary: { ref: "summary", kind: "shared" },
};

function artifactSnippetForTerms(body: string, terms: string[]): { snippet: string; line?: number } {
	const lines = body.split("\\n");
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
`;

const insertAt = t.indexOf("function searchArtifact(");
t = `${t.slice(0, insertAt)}${artifactFns}\n${t.slice(insertAt)}`;

t = t.replace(
	/export function searchMemoriesCore\([\s\S]*?\n\}/,
	`export function searchMemoriesCore(
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
}`,
);

const syncHelper = `
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
`;

t = t.replace(
	/export function reindexLocalMemoryFts\([\s\S]*?\n\}/,
	`${syncHelper}
export function reindexLocalMemoryFts(agentDir: string, memoryRoot?: string): { indexedStage1: number; indexedArtifacts: number } {
	return withDb(agentDir, db => {
		rebuildAllMemoryFts(db);
		if (memoryRoot) {
			syncArtifactFilesToFts(db, memoryRoot);
		}
		const indexedStage1 = (db.prepare("SELECT count(*) AS c FROM stage1_outputs_fts").get() as { c: number }).c;
		const indexedArtifacts = (db.prepare("SELECT count(*) AS c FROM memory_artifacts_fts").get() as { c: number }).c;
		return { indexedStage1, indexedArtifacts };
	});
}`,
);

if (t.includes("ftsIndexedCount: number;")) {
	t = t.replace(
		"ftsIndexedCount: number;",
		"ftsStage1IndexedCount: number;\n\tftsArtifactIndexedCount: number;",
	);
	t = t.replace(
		/let ftsIndexedCount = 0;[\s\S]*?ftsIndexedCount = 0;\n\t\t}/,
		`let ftsStage1IndexedCount = 0;
		let ftsArtifactIndexedCount = 0;
		try {
			ftsStage1IndexedCount = (db.prepare("SELECT count(*) AS c FROM stage1_outputs_fts").get() as { c: number }).c;
			ftsArtifactIndexedCount = (db.prepare("SELECT count(*) AS c FROM memory_artifacts_fts").get() as { c: number }).c;
		} catch {
			ftsStage1IndexedCount = 0;
			ftsArtifactIndexedCount = 0;
		}`,
	);
	t = t.replace("ftsIndexedCount,", "ftsStage1IndexedCount,\n\t\t\tftsArtifactIndexedCount,");
}

fs.writeFileSync(p, t);
console.log("patched local-query.ts");