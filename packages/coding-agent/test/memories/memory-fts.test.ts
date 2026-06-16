import { describe, expect, it } from "bun:test";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import {
	buildStage1FtsMatchQuery,
	searchArtifactFtsRows,
	searchStage1FtsRows,
	syncMemoryArtifactFtsRow,
} from "../../src/memories/memory-fts";
import { closeMemoryDb, openMemoryDb, upsertThreads } from "../../src/memories/storage";

describe("memory-fts", () => {
	it("buildStage1FtsMatchQuery prefixes terms for prefix match", () => {
		expect(buildStage1FtsMatchQuery(["alpha"])).toBe('"alpha"*');
		expect(buildStage1FtsMatchQuery(["aa", "bb"])).toBe('("aa"* OR "bb"*)');
		expect(buildStage1FtsMatchQuery(["x"])).toBeNull();
	});

	it("searchStage1FtsRows ranks ties by thread_id", () => {
		const dir = mkdtempSync(path.join(tmpdir(), "jwc-fts-"));
		const dbPath = path.join(dir, "mem.db");
		const db = openMemoryDb(dbPath);
		const cwd = "/proj";
		upsertThreads(db, [
			{ id: "z-thread", updatedAt: 1, rolloutPath: "/z", cwd, sourceKind: "cli" },
			{ id: "a-thread", updatedAt: 1, rolloutPath: "/a", cwd, sourceKind: "cli" },
		]);
		db.prepare(
			`INSERT INTO stage1_outputs (thread_id, source_updated_at, raw_memory, rollout_summary, rollout_slug, generated_at)
VALUES (?, 1, ?, 's', NULL, 1), (?, 1, ?, 's', NULL, 1)`,
		).run("z-thread", "alpha keyword tie", "a-thread", "alpha keyword tie");
		const match = buildStage1FtsMatchQuery(["alpha", "keyword"]);
		expect(match).not.toBeNull();
		const rows = searchStage1FtsRows(db, cwd, match!, 10);
		expect(rows.length).toBe(2);
		expect(rows[0].thread_id).toBe("a-thread");
		expect(rows[1].thread_id).toBe("z-thread");
		closeMemoryDb(db);
	});

	it("searchArtifactFtsRows finds synced artifact body", () => {
		const dir = mkdtempSync(path.join(tmpdir(), "jwc-art-fts-"));
		const dbPath = path.join(dir, "mem.db");
		const db = openMemoryDb(dbPath);
		syncMemoryArtifactFtsRow(db, { ref: "memory", body: "artifact fts unique token" });
		const match = buildStage1FtsMatchQuery(["unique", "token"]);
		expect(match).not.toBeNull();
		const rows = searchArtifactFtsRows(db, match!, 5);
		expect(rows[0]?.ref).toBe("memory");
		closeMemoryDb(db);
	});
});
