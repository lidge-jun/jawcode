import { describe, expect, it } from "bun:test";
import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { getAgentDbPath } from "@gajae-code/utils";
import { getMemoryRoot } from "../../src/memories";
import {
	browseLocalMemories,
	buildLocalTaskSnapshot,
	contextLocalMemory,
	expandQueryTerms,
	getLocalMemoryStatus,
	listLocalMemoryRefs,
	normalizeLocalMemoryRef,
	readLocalMemoryArtifact,
	reindexLocalMemoryFts,
	saveLocalMemoryManual,
	searchLocalMemories,
} from "../../src/memories/local-query";
import { closeMemoryDb, openMemoryDb, upsertThreads } from "../../src/memories/storage";

function tempAgentDir(): string {
	return mkdtempSync(path.join(os.tmpdir(), "jwc-local-query-"));
}

function seedStage1(
	agentDir: string,
	cwd: string,
	threadId: string,
	rawMemory: string,
	generatedAt: number,
	rolloutPath?: string,
): void {
	const dbPath = getAgentDbPath(agentDir);
	mkdirSync(path.dirname(dbPath), { recursive: true });
	const db = openMemoryDb(dbPath);
	upsertThreads(db, [
		{
			id: threadId,
			updatedAt: generatedAt,
			rolloutPath: rolloutPath ?? `/tmp/${threadId}.jsonl`,
			cwd,
			sourceKind: "cli",
		},
	]);
	db.prepare(
		`INSERT INTO stage1_outputs (thread_id, source_updated_at, raw_memory, rollout_summary, rollout_slug, generated_at)
VALUES (?, ?, ?, ?, NULL, ?) ON CONFLICT(thread_id) DO UPDATE SET raw_memory = excluded.raw_memory`,
	).run(threadId, generatedAt, rawMemory, "summary line", generatedAt);
	closeMemoryDb(db);
}

describe("local-query (99.01 M2)", () => {
	it("expands the pabcd synonym group both ways", () => {
		expect(expandQueryTerms("pabcd 진행")).toContain("audit");
		expect(expandQueryTerms("run the audit")).toContain("pabcd");
		expect(expandQueryTerms("unrelated words")).not.toContain("pabcd");
	});

	it("finds stage1 rows by LIKE, scoped to cwd", () => {
		const agentDir = tempAgentDir();
		const cwd = "/proj/a";
		seedStage1(agentDir, cwd, "t1", "user prefers ES modules everywhere", 1_700_000_000);
		seedStage1(agentDir, "/proj/other", "t2", "ES modules note from another project", 1_700_000_000);
		const hits = searchLocalMemories(agentDir, cwd, "ES modules");
		expect(hits.length).toBe(1);
		expect(hits[0].ref).toBe("stage1:t1");
		expect(hits[0].kind).toBe("episode");
	});

	it("ranks profile artifact hits above episode rows (kind weight)", () => {
		const agentDir = tempAgentDir();
		const cwd = "/proj/a";
		const memoryRoot = getMemoryRoot(agentDir, cwd);
		mkdirSync(memoryRoot, { recursive: true });
		writeFileSync(path.join(memoryRoot, "MEMORY.md"), "# Profile\nuser timezone is Asia/Seoul\n");
		seedStage1(agentDir, cwd, "t1", "timezone debugging session yesterday", Math.floor(Date.now() / 1000));
		const hits = searchLocalMemories(agentDir, cwd, "timezone");
		expect(hits.length).toBe(2);
		expect(hits[0].ref).toBe("memory");
		expect(hits[0].kind).toBe("profile");
	});

	it("saves a manual row that is searchable and watermark-enqueued", () => {
		const agentDir = tempAgentDir();
		const cwd = "/proj/a";
		const saved = saveLocalMemoryManual(agentDir, cwd, "decisions.md", "We chose SQLite over JSON files", "shared");
		expect(saved.threadId).toBe("manual:decisions.md");

		const hits = searchLocalMemories(agentDir, cwd, "SQLite");
		expect(hits.some(h => h.ref === "stage1:manual:decisions.md")).toBe(true);

		const db = openMemoryDb(getAgentDbPath(agentDir));
		const row = db
			.prepare("SELECT raw_memory FROM stage1_outputs WHERE thread_id = ?")
			.get("manual:decisions.md") as {
			raw_memory: string;
		};
		expect(row.raw_memory).toContain("kind: shared");
		const job = db
			.prepare("SELECT input_watermark FROM jobs WHERE kind = 'memory_consolidate_global' AND job_key = ?")
			.get(`global:${cwd}`) as { input_watermark: number } | null;
		expect(job).not.toBeNull();
		expect(job?.input_watermark).toBeGreaterThan(0);
		const thread = db.prepare("SELECT source_kind FROM threads WHERE id = ?").get("manual:decisions.md") as {
			source_kind: string;
		};
		expect(thread.source_kind).toBe("manual");
		closeMemoryDb(db);
	});

	it("save is idempotent on the same file ref (upsert)", () => {
		const agentDir = tempAgentDir();
		const cwd = "/proj/a";
		saveLocalMemoryManual(agentDir, cwd, "note.md", "first version");
		saveLocalMemoryManual(agentDir, cwd, "note.md", "second version");
		const read = readLocalMemoryArtifact(agentDir, cwd, "stage1:manual:note.md");
		expect(read?.content).toContain("second version");
		expect(read?.content).not.toContain("first version");
	});

	it("reads artifacts by ref vocabulary with --lines ranges", () => {
		const agentDir = tempAgentDir();
		const cwd = "/proj/a";
		const memoryRoot = getMemoryRoot(agentDir, cwd);
		mkdirSync(memoryRoot, { recursive: true });
		writeFileSync(path.join(memoryRoot, "memory_summary.md"), "line one\nline two\nline three\n");
		expect(readLocalMemoryArtifact(agentDir, cwd, "summary")?.content).toContain("line three");
		expect(readLocalMemoryArtifact(agentDir, cwd, "summary", "2-2")?.content).toBe("line two");
		expect(readLocalMemoryArtifact(agentDir, cwd, "memory_summary.md")?.ref).toBe("summary");
		expect(readLocalMemoryArtifact(agentDir, cwd, "memory")).toBeNull();
		expect(readLocalMemoryArtifact(agentDir, cwd, "bogus-ref")).toBeNull();
	});

	it("reads stage1/rollout refs and the raw digest", () => {
		const agentDir = tempAgentDir();
		const cwd = "/proj/a";
		saveLocalMemoryManual(agentDir, cwd, "alpha.md", "alpha content body");
		const byId = readLocalMemoryArtifact(agentDir, cwd, "stage1:manual:alpha.md");
		expect(byId?.content).toContain("alpha content body");
		const bySlug = readLocalMemoryArtifact(agentDir, cwd, "rollout:manual-alpha-md");
		expect(bySlug?.content).toContain("alpha content body");
		const raw = readLocalMemoryArtifact(agentDir, cwd, "raw");
		expect(raw?.content).toContain("## stage1:manual:alpha.md");
	});

	it("memory context resolves manual rows without rollout evidence", () => {
		const agentDir = tempAgentDir();
		const cwd = "/proj/a";
		saveLocalMemoryManual(agentDir, cwd, "ctx.md", "context target fact");
		const ctx = contextLocalMemory(agentDir, cwd, "stage1:manual:ctx.md");
		expect(ctx?.sourceKind).toBe("manual");
		expect(ctx?.record).toContain("context target fact");
		expect(ctx?.rolloutExcerpt).toBeUndefined();
	});

	it("memory context returns rollout excerpt when the jsonl exists", () => {
		const agentDir = tempAgentDir();
		const cwd = "/proj/a";
		const rollout = path.join(tempAgentDir(), "sess.jsonl");
		writeFileSync(rollout, '{"type":"session","id":"s1"}\n{"type":"message","text":"evidence line"}\n');
		const dbPath = getAgentDbPath(agentDir);
		mkdirSync(path.dirname(dbPath), { recursive: true });
		const db = openMemoryDb(dbPath);
		upsertThreads(db, [{ id: "s1", updatedAt: 1, rolloutPath: rollout, cwd, sourceKind: "cli" }]);
		db.prepare(
			`INSERT INTO stage1_outputs (thread_id, source_updated_at, raw_memory, rollout_summary, rollout_slug, generated_at)
VALUES ('s1', 1, 'remembered fact', 'sum', NULL, 1)`,
		).run();
		closeMemoryDb(db);
		const ctx = contextLocalMemory(agentDir, cwd, "stage1:s1");
		expect(ctx?.rolloutExcerpt).toContain("evidence line");
	});

	it("builds a diversified task snapshot (episodes capped at 2)", () => {
		const agentDir = tempAgentDir();
		const cwd = "/proj/a";
		const now = Math.floor(Date.now() / 1000);
		seedStage1(agentDir, cwd, "e1", "deploy pipeline fact one", now);
		seedStage1(agentDir, cwd, "e2", "deploy pipeline fact two", now - 10);
		seedStage1(agentDir, cwd, "e3", "deploy pipeline fact three", now - 20);
		const memoryRoot = getMemoryRoot(agentDir, cwd);
		mkdirSync(memoryRoot, { recursive: true });
		writeFileSync(path.join(memoryRoot, "MEMORY.md"), "deploy owner is Jun\n");
		const snapshot = buildLocalTaskSnapshot(agentDir, cwd, "how do we deploy", 4);
		expect(snapshot).not.toBeNull();
		const lines = snapshot?.split("\n") ?? [];
		expect(lines.filter(l => l.includes("[episode]")).length).toBeLessThanOrEqual(2);
		expect(lines.some(l => l.includes("[profile]"))).toBe(true);
	});

	it("returns null snapshot when nothing matches", () => {
		const agentDir = tempAgentDir();
		expect(buildLocalTaskSnapshot(agentDir, "/proj/a", "zzz-nothing", 4)).toBeNull();
	});
});

describe("local-query browse + ref normalize (99.01 M7)", () => {
	it("normalizes artifact filename aliases", () => {
		expect(normalizeLocalMemoryRef("memory_summary.md")).toBe("summary");
		expect(normalizeLocalMemoryRef("MEMORY.md")).toBe("memory");
		expect(normalizeLocalMemoryRef("stage1:t1")).toBe("stage1:t1");
	});

	it("sorts search ties lexicographically by ref", () => {
		const agentDir = tempAgentDir();
		const cwd = "/proj/a";
		const now = Math.floor(Date.now() / 1000);
		seedStage1(agentDir, cwd, "z-thread", "alpha keyword tie", now);
		seedStage1(agentDir, cwd, "a-thread", "alpha keyword tie", now);
		const hits = searchLocalMemories(agentDir, cwd, "alpha keyword");
		expect(hits.length).toBeGreaterThanOrEqual(2);
		expect(hits[0].ref).toBe("stage1:a-thread");
		expect(hits[1].ref).toBe("stage1:z-thread");
	});

	it("browse lists artifacts and stage1 rows newest first", () => {
		const agentDir = tempAgentDir();
		const cwd = "/proj/browse";
		const memoryRoot = getMemoryRoot(agentDir, cwd);
		mkdirSync(memoryRoot, { recursive: true });
		writeFileSync(path.join(memoryRoot, "MEMORY.md"), "profile browse marker\n");
		saveLocalMemoryManual(agentDir, cwd, "b.md", "shared browse marker");
		const rows = browseLocalMemories(agentDir, cwd, 10);
		expect(rows.some(r => r.ref === "memory")).toBe(true);
		expect(rows.some(r => r.ref === "stage1:manual:b.md")).toBe(true);
	});
});

describe("local-query artifact FTS + searchMode", () => {
	it("indexes MEMORY.md and finds via FTS", () => {
		const agentDir = tempAgentDir();
		const cwd = "/proj/artifact-fts";
		const memoryRoot = getMemoryRoot(agentDir, cwd);
		mkdirSync(memoryRoot, { recursive: true });
		writeFileSync(path.join(memoryRoot, "MEMORY.md"), "unique artifact zebra token\n");
		reindexLocalMemoryFts(agentDir, memoryRoot);
		const hits = searchLocalMemories(agentDir, cwd, "zebra", 8, { searchMode: "fts" });
		expect(hits.some(h => h.ref === "memory")).toBe(true);
	});

	it("like mode skips FTS artifact index", () => {
		const agentDir = tempAgentDir();
		const cwd = "/proj/like-mode";
		const memoryRoot = getMemoryRoot(agentDir, cwd);
		mkdirSync(memoryRoot, { recursive: true });
		writeFileSync(path.join(memoryRoot, "MEMORY.md"), "like-only marker phrase\n");
		const ftsHits = searchLocalMemories(agentDir, cwd, "marker", 8, { searchMode: "fts" });
		const likeHits = searchLocalMemories(agentDir, cwd, "marker", 8, { searchMode: "like" });
		expect(likeHits.some(h => h.ref === "memory")).toBe(true);
		expect(ftsHits.some(h => h.ref === "memory")).toBe(false);
	});
});

describe("local-query list/status/reindex (99.01 M8)", () => {
	it("listLocalMemoryRefs mirrors browse refs", () => {
		const agentDir = tempAgentDir();
		const cwd = "/proj/list";
		saveLocalMemoryManual(agentDir, cwd, "x.md", "hello");
		expect(listLocalMemoryRefs(agentDir, cwd, 10)).toContain("stage1:manual:x.md");
	});

	it("getLocalMemoryStatus reports counts", () => {
		const agentDir = tempAgentDir();
		const cwd = "/proj/st";
		saveLocalMemoryManual(agentDir, cwd, "y.md", "status");
		const st = getLocalMemoryStatus(agentDir, cwd);
		expect(st.stage1Count).toBe(1);
		expect(st.backend).toBe("local");
	});

	it("reindexLocalMemoryFts indexes manual rows", () => {
		const agentDir = tempAgentDir();
		const cwd = "/proj/reindex";
		saveLocalMemoryManual(agentDir, cwd, "z.md", "zebra reindex token");
		const memoryRoot = getMemoryRoot(agentDir, cwd);
		const { indexedStage1 } = reindexLocalMemoryFts(agentDir, memoryRoot);
		expect(indexedStage1).toBeGreaterThanOrEqual(1);
		const hits = searchLocalMemories(agentDir, cwd, "zebra");
		expect(hits.some(h => h.ref === "stage1:manual:z.md")).toBe(true);
	});
});

describe("local-query search scope (99.01)", () => {
	it("filterScopePaths keeps profile artifacts and filters episodes by rollout path", () => {
		const agentDir = tempAgentDir();
		const cwd = "/proj/scope";
		const now = Math.floor(Date.now() / 1000);
		seedStage1(agentDir, cwd, "in-src", "alpha scope token in src tree", now, "src/memories/foo.jsonl");
		seedStage1(agentDir, cwd, "in-test", "alpha scope token in test tree", now, "test/out.jsonl");
		const memoryRoot = getMemoryRoot(agentDir, cwd);
		mkdirSync(memoryRoot, { recursive: true });
		writeFileSync(path.join(memoryRoot, "MEMORY.md"), "alpha scope token in profile artifact\n");
		const hits = searchLocalMemories(agentDir, cwd, "alpha scope", 20, { scopePaths: ["src/memories"] });
		const refs = hits.map(h => h.ref);
		expect(refs).toContain("memory");
		expect(refs).toContain("stage1:in-src");
		expect(refs).not.toContain("stage1:in-test");
	});
});
