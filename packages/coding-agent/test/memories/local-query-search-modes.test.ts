import { describe, expect, it } from "bun:test";
import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { getAgentDbPath } from "@jawcode-dev/utils";
import { getMemoryRoot } from "../../src/memories";
import {
	reindexLocalMemoryFts,
	saveLocalMemoryManual,
	searchLocalMemories,
	syncArtifactFilesToFts,
} from "../../src/memories/local-query";
import { closeMemoryDb, openMemoryDb } from "../../src/memories/storage";

function tempAgentDir(): string {
	return mkdtempSync(path.join(tmpdir(), "jwc-local-search-"));
}

describe("local-query search modes (99.01 M5)", () => {
	it("hybrid FTS finds stage1 manual row after reindex", () => {
		const agentDir = tempAgentDir();
		const cwd = "/proj/fts-hybrid";
		saveLocalMemoryManual(agentDir, cwd, "hybrid.md", "zebra hybrid fts marker");
		reindexLocalMemoryFts(agentDir, getMemoryRoot(agentDir, cwd));
		const hits = searchLocalMemories(agentDir, cwd, "zebra hybrid", 8, { searchMode: "hybrid" });
		expect(hits.some(h => h.ref === "stage1:manual:hybrid.md")).toBe(true);
	});

	it("fts-only can find the auto-indexed stage1 row immediately after save", () => {
		const agentDir = tempAgentDir();
		const cwd = "/proj/fts-only-empty";
		saveLocalMemoryManual(agentDir, cwd, "only.md", "lonely fts only token");
		const hits = searchLocalMemories(agentDir, cwd, "lonely fts", 8, { searchMode: "fts" });
		expect(hits.some(h => h.ref === "stage1:manual:only.md")).toBe(true);
	});

	it("like mode still finds stage1 without FTS index", () => {
		const agentDir = tempAgentDir();
		const cwd = "/proj/like-fallback";
		saveLocalMemoryManual(agentDir, cwd, "like.md", "like fallback marker");
		const hits = searchLocalMemories(agentDir, cwd, "fallback marker", 8, { searchMode: "like" });
		expect(hits.some(h => h.ref === "stage1:manual:like.md")).toBe(true);
	});

	it("artifact FTS search finds MEMORY.md body after sync", () => {
		const agentDir = tempAgentDir();
		const cwd = "/proj/artifact-fts";
		const memoryRoot = getMemoryRoot(agentDir, cwd);
		mkdirSync(memoryRoot, { recursive: true });
		writeFileSync(path.join(memoryRoot, "MEMORY.md"), "profile artifact unique cobalt token");
		const db = openMemoryDb(getAgentDbPath(agentDir));
		try {
			syncArtifactFilesToFts(db, memoryRoot);
		} finally {
			closeMemoryDb(db);
		}
		const hits = searchLocalMemories(agentDir, cwd, "cobalt token", 8, { searchMode: "hybrid" });
		expect(hits.some(h => h.ref === "memory")).toBe(true);
	});
});
