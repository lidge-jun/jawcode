/**
 * Memory recall scenarios — observable contracts across local search, per-turn
 * injection, CLI `memory search`, and Hindsight `recall` (server-backed).
 */
import { afterEach, describe, expect, it, vi } from "bun:test";
import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { getAgentDbPath, setAgentDir } from "@jawcode-dev/utils";
import { Settings } from "../../src/config/settings";
import { HindsightApi } from "../../src/hindsight/client";
import { runNativeMemoryCommand } from "../../src/jwc-runtime/memory-runtime";
import { getMemoryRoot } from "../../src/memories";
import { saveLocalMemoryManual, searchLocalMemories } from "../../src/memories/local-query";
import { closeMemoryDb, openMemoryDb, upsertThreads } from "../../src/memories/storage";
import { localBackend } from "../../src/memory-backend/local-backend";
import type { AgentSession } from "../../src/session/agent-session";

function tempAgentDir(): string {
	return mkdtempSync(path.join(os.tmpdir(), "jwc-memory-recall-"));
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

function stubLocalSession(agentDir: string, cwd: string): AgentSession {
	setAgentDir(agentDir);
	const settings = Settings.isolated({ "memory.backend": "local" });
	return {
		settings,
		sessionManager: { getCwd: () => cwd },
		modelRegistry: { getAll: () => [] },
		taskDepth: 0,
	} as unknown as AgentSession;
}

describe("memory recall scenarios (local)", () => {
	it("recalls a saved manual memory when searching by keyword (save → search)", () => {
		const agentDir = tempAgentDir();
		const cwd = "/proj/recall-save-search";
		saveLocalMemoryManual(agentDir, cwd, "prefs.md", "user prefers tabs over spaces", "profile");

		const hits = searchLocalMemories(agentDir, cwd, "prefers tabs");
		expect(hits.some(h => h.ref === "stage1:manual:prefs.md")).toBe(true);
		expect(hits.find(h => h.ref === "stage1:manual:prefs.md")?.snippet).toContain("tabs");
	});

	it("does not recall memories from another project cwd", () => {
		const agentDir = tempAgentDir();
		const cwdA = "/proj/recall-a";
		const cwdB = "/proj/recall-b";
		seedStage1(agentDir, cwdA, "only-a", "recall token alpha project", 1_700_000_000);
		seedStage1(agentDir, cwdB, "only-b", "recall token beta project", 1_700_000_000);

		const hitsA = searchLocalMemories(agentDir, cwdA, "recall token");
		expect(hitsA).toHaveLength(1);
		expect(hitsA[0].ref).toBe("stage1:only-a");

		const hitsB = searchLocalMemories(agentDir, cwdB, "recall token");
		expect(hitsB).toHaveLength(1);
		expect(hitsB[0].ref).toBe("stage1:only-b");
	});

	it("recalls profile artifact above episode rows for the same query", () => {
		const agentDir = tempAgentDir();
		const cwd = "/proj/recall-rank";
		const memoryRoot = getMemoryRoot(agentDir, cwd);
		mkdirSync(memoryRoot, { recursive: true });
		writeFileSync(path.join(memoryRoot, "MEMORY.md"), "recall ranking marker in profile\n");
		seedStage1(agentDir, cwd, "ep1", "recall ranking marker in episode", Math.floor(Date.now() / 1000));

		const hits = searchLocalMemories(agentDir, cwd, "recall ranking");
		expect(hits.length).toBeGreaterThanOrEqual(2);
		expect(hits[0].ref).toBe("memory");
		expect(hits[0].kind).toBe("profile");
	});

	it("returns no hits when the query matches nothing", () => {
		const agentDir = tempAgentDir();
		const cwd = "/proj/recall-empty";
		saveLocalMemoryManual(agentDir, cwd, "note.md", "unrelated content");

		expect(searchLocalMemories(agentDir, cwd, "zzz-no-recall-match-qqq")).toHaveLength(0);
	});

	it("injects recalled hits into a <memories> block on beforeAgentStartPrompt", async () => {
		const agentDir = tempAgentDir();
		const cwd = "/proj/recall-inject";
		saveLocalMemoryManual(agentDir, cwd, "prefs.md", "user prefers tabs over spaces", "profile");

		const session = stubLocalSession(agentDir, cwd);
		const block = await localBackend.beforeAgentStartPrompt!(session, "tabs preference");

		expect(block).toBeDefined();
		expect(block).toContain("<memories>");
		expect(block).toContain("Task snapshot");
		expect(block).toContain("prefers tabs");
		expect(block).toContain("stage1:manual:prefs.md");
	});

	it("skips injection when the user prompt is empty", async () => {
		const agentDir = tempAgentDir();
		const cwd = "/proj/recall-blank-prompt";
		saveLocalMemoryManual(agentDir, cwd, "prefs.md", "user prefers tabs", "profile");

		const session = stubLocalSession(agentDir, cwd);
		expect(await localBackend.beforeAgentStartPrompt!(session, "   ")).toBeUndefined();
	});

	it("memory search CLI recalls the same ref as searchLocalMemories", async () => {
		const agentDir = tempAgentDir();
		const cwd = "/proj/recall-cli";
		const opts = { agentDir, settings: Settings.isolated({ "memory.backend": "local" }) };
		await runNativeMemoryCommand(["save", "cli.md", "recall", "cli", "surface", "marker"], cwd, opts);

		const result = await runNativeMemoryCommand(["search", "cli surface marker"], cwd, opts);
		expect(result.status).toBe(0);
		expect(result.stdout).toContain("stage1:manual:cli.md");
		expect(result.stdout).toContain("recall cli surface");
	});

	it("memory search CLI reports no memory hits when recall finds nothing", async () => {
		const agentDir = tempAgentDir();
		const cwd = "/proj/recall-cli-empty";
		const opts = { agentDir, settings: Settings.isolated({ "memory.backend": "local" }) };

		const result = await runNativeMemoryCommand(["search", "zzz-no-recall-cli"], cwd, opts);
		expect(result.status).toBe(0);
		expect(result.stdout).toBe("no memory hits\n");
	});
});

describe("memory recall scenarios (hindsight CLI)", () => {
	afterEach(() => {
		vi.restoreAllMocks();
	});

	it("memory search on hindsight backend calls recall and formats hits", async () => {
		const settings = Settings.isolated({
			"memory.backend": "hindsight",
			"hindsight.apiUrl": "http://localhost:8888",
		});
		vi.spyOn(HindsightApi.prototype, "recall").mockResolvedValue({
			results: [{ id: "doc-1", text: "recalled from hindsight bank" }],
		} as never);

		const result = await runNativeMemoryCommand(["search", "user prefs"], "/proj/hindsight-recall", {
			agentDir: tempAgentDir(),
			settings,
		});

		expect(result.status).toBe(0);
		expect(result.stdout).toContain("doc-1");
		expect(result.stdout).toContain("recalled from hindsight bank");
	});

	it("memory search on hindsight backend returns no memory hits when recall is empty", async () => {
		const settings = Settings.isolated({
			"memory.backend": "hindsight",
			"hindsight.apiUrl": "http://localhost:8888",
		});
		vi.spyOn(HindsightApi.prototype, "recall").mockResolvedValue({ results: [] } as never);

		const result = await runNativeMemoryCommand(["search", "anything"], "/proj/hindsight-empty", {
			agentDir: tempAgentDir(),
			settings,
		});

		expect(result.status).toBe(0);
		expect(result.stdout).toBe("no memory hits\n");
	});
});
