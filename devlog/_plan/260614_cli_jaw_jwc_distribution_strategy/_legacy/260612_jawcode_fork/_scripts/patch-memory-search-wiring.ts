import * as fs from "node:fs";

// settings schema
{
	const p = "src/config/settings-schema.ts";
	let t = fs.readFileSync(p, "utf8");
	if (!t.includes('"memories.searchMode"')) {
		t = t.replace(
			'"memories.summaryInjectionTokenLimit": { type: "number", default: 5000 },\n',
			`"memories.summaryInjectionTokenLimit": { type: "number", default: 5000 },

	"memories.searchMode": {
		type: "enum",
		values: ["hybrid", "fts", "like"] as const,
		default: "hybrid",
		ui: {
			label: "Memory search mode",
			description: "hybrid: FTS5 with LIKE fallback; fts: FTS5 only; like: substring scan",
			tab: "memory",
		},
	},
`,
		);
		t = t.replace(
			"summaryInjectionTokenLimit: number;\n}",
			'summaryInjectionTokenLimit: number;\n\tsearchMode: "hybrid" | "fts" | "like";\n}',
		);
		fs.writeFileSync(p, t);
	}
}

// memory-runtime
{
	const p = "src/gjc-runtime/memory-runtime.ts";
	let t = fs.readFileSync(p, "utf8");
	if (!t.includes('from "../memories/index"')) {
		t = t.replace(
			`} from "../memories/local-query";`,
			`} from "../memories/local-query";
import { getMemoryRoot } from "../memories/index";`,
		);
	}
	t = t.replace(
		"const hits = searchLocalMemories(agentDir, cwd, query, memCfg.searchLimit);",
		"const hits = searchLocalMemories(agentDir, cwd, query, memCfg.searchLimit, { searchMode: memCfg.searchMode });",
	);
	t = t.replace(
		"`fts_indexed: ${st.ftsIndexedCount}`",
		"`fts_stage1_indexed: ${st.ftsStage1IndexedCount}`\n\t\t\t\t\t`fts_artifact_indexed: ${st.ftsArtifactIndexedCount}`\n\t\t\t\t\t`search_mode: ${loadMemoryConfig(settings).searchMode}`",
	);
	// fix if single backtick line exists without template nesting issue
	t = t.replace(
		"fts_indexed: ${st.ftsIndexedCount}",
		"fts_stage1_indexed: ${st.ftsStage1IndexedCount}\n\t\t\t\t\tfts_artifact_indexed: ${st.ftsArtifactIndexedCount}\n\t\t\t\t\tsearch_mode: ${loadMemoryConfig(settings).searchMode}",
	);
	t = t.replace(
		"const { indexed } = reindexLocalMemoryFts(agentDir);\n\t\t\t\treturn { stdout: `reindexed ${indexed} stage1 rows into FTS5\\n`, status: 0 };",
		`const memoryRoot = getMemoryRoot(agentDir, cwd);
				const { indexedStage1, indexedArtifacts } = reindexLocalMemoryFts(agentDir, memoryRoot);
				return {
					stdout: \`reindexed stage1=\${indexedStage1} artifacts=\${indexedArtifacts} (FTS5)\\n\`,
					status: 0,
				};`,
	);
	fs.writeFileSync(p, t);
}

// index.ts consolidation FTS sync
{
	const p = "src/memories/index.ts";
	let t = fs.readFileSync(p, "utf8");
	if (!t.includes("syncArtifactFilesToFts")) {
		t = t.replace(
			`} from "./storage";`,
			`} from "./storage";
import { syncArtifactFilesToFts } from "./local-query";
import { removeMemoryArtifactFtsRow } from "./memory-fts";`,
		);
	}
	t = t.replace("await applyConsolidation(memoryRoot, consolidated);", "await applyConsolidation(agentDir, memoryRoot, consolidated);");
	t = t.replace(
		`async function applyConsolidation(
	memoryRoot: string,
	consolidated: {`,
		`async function applyConsolidation(
	agentDir: string,
	memoryRoot: string,
	consolidated: {`,
	);
	if (!t.includes("syncArtifactFilesToFts(db, memoryRoot)")) {
		t = t.replace(
			'await Bun.write(path.join(memoryRoot, "memory_summary.md"), `${consolidated.memorySummary.trim()}\\n`);',
			`await Bun.write(path.join(memoryRoot, "memory_summary.md"), \`\${consolidated.memorySummary.trim()}\\n\`);
	const dbPath = getAgentDbPath(agentDir);
	const db = openMemoryDb(dbPath);
	try {
		syncArtifactFilesToFts(db, memoryRoot);
	} finally {
		closeMemoryDb(db);
	}`,
		);
	}
	if (!t.includes("removeMemoryArtifactFtsRow(db")) {
		t = t.replace(
			'await fs.rm(path.join(memoryRoot, "memory_summary.md"), { force: true });',
			`await fs.rm(path.join(memoryRoot, "memory_summary.md"), { force: true });
	try {
		const dbPath = getAgentDbPath(agentDir);
		const db = openMemoryDb(dbPath);
		try {
			removeMemoryArtifactFtsRow(db, "memory");
			removeMemoryArtifactFtsRow(db, "summary");
		} finally {
			closeMemoryDb(db);
		}
	} catch {
		// best-effort FTS cleanup when DB is unavailable
	}`,
		);
	}
	if (t.includes("async function cleanupConsolidatedArtifacts(memoryRoot: string)") && !t.includes("cleanupConsolidatedArtifacts(agentDir")) {
		t = t.replace("await cleanupConsolidatedArtifacts(memoryRoot);", "await cleanupConsolidatedArtifacts(agentDir, memoryRoot);");
		t = t.replace(
			"async function cleanupConsolidatedArtifacts(memoryRoot: string): Promise<void> {",
			"async function cleanupConsolidatedArtifacts(agentDir: string, memoryRoot: string): Promise<void> {",
		);
	}
	fs.writeFileSync(p, t);
}

// tests + changelog (same as before)
{
	const p = "test/memories/local-query.test.ts";
	let t = fs.readFileSync(p, "utf8");
	t = t.replace(
		`const { indexed } = reindexLocalMemoryFts(agentDir);
		expect(indexed).toBeGreaterThanOrEqual(1);`,
		`const memoryRoot = getMemoryRoot(agentDir, cwd);
		const { indexedStage1 } = reindexLocalMemoryFts(agentDir, memoryRoot);
		expect(indexedStage1).toBeGreaterThanOrEqual(1);`,
	);
	if (!t.includes("artifact FTS")) {
		t = t.replace(
			`describe("local-query list/status/reindex (99.01 M8)", () => {`,
			`describe("local-query artifact FTS + searchMode", () => {
	it("indexes MEMORY.md and finds via FTS", () => {
		const agentDir = tempAgentDir();
		const cwd = "/proj/artifact-fts";
		const memoryRoot = getMemoryRoot(agentDir, cwd);
		mkdirSync(memoryRoot, { recursive: true });
		writeFileSync(path.join(memoryRoot, "MEMORY.md"), "unique artifact zebra token\\n");
		reindexLocalMemoryFts(agentDir, memoryRoot);
		const hits = searchLocalMemories(agentDir, cwd, "zebra", 8, { searchMode: "fts" });
		expect(hits.some(h => h.ref === "memory")).toBe(true);
	});

	it("like mode skips FTS artifact index", () => {
		const agentDir = tempAgentDir();
		const cwd = "/proj/like-mode";
		const memoryRoot = getMemoryRoot(agentDir, cwd);
		mkdirSync(memoryRoot, { recursive: true });
		writeFileSync(path.join(memoryRoot, "MEMORY.md"), "like-only marker phrase\\n");
		const ftsHits = searchLocalMemories(agentDir, cwd, "marker", 8, { searchMode: "fts" });
		const likeHits = searchLocalMemories(agentDir, cwd, "marker", 8, { searchMode: "like" });
		expect(likeHits.some(h => h.ref === "memory")).toBe(true);
		expect(ftsHits.some(h => h.ref === "memory")).toBe(false);
	});
});

describe("local-query list/status/reindex (99.01 M8)", () => {`,
		);
	}
	fs.writeFileSync(p, t);
}

{
	const p = "test/memories/memory-config.test.ts";
	let t = fs.readFileSync(p, "utf8");
	if (!t.includes("searchMode")) {
		t = t.replace(
			"expect(cfg.searchLimit).toBe(MEMORY_RUNTIME_DEFAULTS.searchLimit);",
			`expect(cfg.searchLimit).toBe(MEMORY_RUNTIME_DEFAULTS.searchLimit);
		expect(cfg.searchMode).toBe("hybrid");`,
		);
	}
	fs.writeFileSync(p, t);
}

{
	const p = "test/memories/memory-fts.test.ts";
	let t = fs.readFileSync(p, "utf8");
	if (!t.includes("searchArtifactFtsRows")) {
		t = t.replace(
			`import { buildStage1FtsMatchQuery, searchStage1FtsRows } from "../../src/memories/memory-fts";`,
			`import {
	buildStage1FtsMatchQuery,
	searchArtifactFtsRows,
	searchStage1FtsRows,
	syncMemoryArtifactFtsRow,
} from "../../src/memories/memory-fts";`,
		);
		t = t.replace(
			`closeMemoryDb(db);
	});
});`,
			`closeMemoryDb(db);
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
});`,
		);
	}
	fs.writeFileSync(p, t);
}

{
	const p = "CHANGELOG.md";
	let t = fs.readFileSync(p, "utf8");
	if (!t.includes("memories.searchMode")) {
		t = t.replace(
			`### Changed`,
			`### Changed

- Local memory search: artifact \`MEMORY.md\` / \`memory_summary.md\` bodies are indexed in FTS5 (\`memory_artifacts_fts\`), synced on consolidation and \`memory reindex\`; new setting \`memories.searchMode\` (\`hybrid\` | \`fts\` | \`like\`) controls stage1 and artifact query backends.`,
		);
	}
	fs.writeFileSync(p, t);
}

console.log("wiring patches applied");