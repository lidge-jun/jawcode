import { describe, expect, it } from "bun:test";
import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { getSessionsDir } from "@jawcode-dev/utils";
import { Settings } from "../../src/config/settings";
import { runNativeChatCommand, runNativeMemoryCommand } from "../../src/jwc-runtime/memory-runtime";
import { getDefaultSessionDirName } from "../../src/session/session-manager";

function tempAgentDir(): string {
	return mkdtempSync(path.join(os.tmpdir(), "jwc-memory-runtime-"));
}

function localSettings(): Settings {
	return Settings.isolated({ "memory.backend": "local" });
}

function offSettings(): Settings {
	return Settings.isolated({});
}

describe("memory-runtime (99.01 M1)", () => {
	it("rejects verbs when the backend is off", async () => {
		const result = await runNativeMemoryCommand(["search", "x"], "/proj/a", {
			agentDir: tempAgentDir(),
			settings: offSettings(),
		});
		expect(result.status).toBe(1);
		expect(result.stderr).toContain("memory backend is off");
	});

	it("prints usage for missing/unknown verbs", async () => {
		const missing = await runNativeMemoryCommand([], "/proj/a", {
			agentDir: tempAgentDir(),
			settings: localSettings(),
		});
		expect(missing.status).toBe(1);
		expect(missing.stdout).toContain("memory search <query>");
		const unknown = await runNativeMemoryCommand(["bogus"], "/proj/a", {
			agentDir: tempAgentDir(),
			settings: localSettings(),
		});
		expect(unknown.status).toBe(1);
		expect(unknown.stderr).toContain('unknown verb "bogus"');
	});

	it("save → search → read → context round-trip on the local backend", async () => {
		const agentDir = tempAgentDir();
		const cwd = "/proj/roundtrip";
		const opts = { agentDir, settings: localSettings() };

		const saved = await runNativeMemoryCommand(
			["save", "prefs.md", "user", "prefers", "tabs", "--kind", "profile"],
			cwd,
			opts,
		);
		expect(saved.status).toBe(0);
		expect(saved.stdout).toContain("saved manual:prefs.md");

		const found = await runNativeMemoryCommand(["search", "prefers tabs"], cwd, opts);
		expect(found.status).toBe(0);
		expect(found.stdout).toContain("stage1:manual:prefs.md");

		const scoped = await runNativeMemoryCommand(["search", "prefers tabs", "--scope", "prefs.md"], cwd, opts);
		expect(scoped.status).toBe(0);
		expect(scoped.stdout).toContain("stage1:manual:prefs.md");

		const read = await runNativeMemoryCommand(["read", "stage1:manual:prefs.md"], cwd, opts);
		expect(read.status).toBe(0);
		expect(read.stdout).toContain("user prefers tabs");

		const ctx = await runNativeMemoryCommand(["context", "stage1:manual:prefs.md"], cwd, opts);
		expect(ctx.status).toBe(0);
		expect(ctx.stdout).toContain("source: manual");
	});

	it("memory list prints refs", async () => {
		const agentDir = tempAgentDir();
		const cwd = "/proj/list-cli";
		const opts = { agentDir, settings: localSettings() };
		await runNativeMemoryCommand(["save", "a.md", "list marker"], cwd, opts);
		const result = await runNativeMemoryCommand(["list"], cwd, opts);
		expect(result.status).toBe(0);
		expect(result.stdout).toContain("stage1:manual:a.md");
	});

	it("memory status reports search_mode from settings", async () => {
		const agentDir = tempAgentDir();
		const cwd = "/proj/search-mode-status";
		const settings = Settings.isolated({ "memory.backend": "local", "memories.searchMode": "fts" });
		const opts = { agentDir, settings };
		const status = await runNativeMemoryCommand(["status"], cwd, opts);
		expect(status.status).toBe(0);
		expect(status.stdout).toContain("search_mode: fts");
	});

	it("memory status and reindex", async () => {
		const agentDir = tempAgentDir();
		const cwd = "/proj/status";
		const opts = { agentDir, settings: localSettings() };
		await runNativeMemoryCommand(["save", "s.md", "status marker"], cwd, opts);
		const status = await runNativeMemoryCommand(["status"], cwd, opts);
		expect(status.status).toBe(0);
		expect(status.stdout).toContain("stage1_rows: 1");
		const reindex = await runNativeMemoryCommand(["reindex"], cwd, opts);
		expect(reindex.status).toBe(0);
		expect(reindex.stdout).toContain("reindexed");
	});

	it("memory browse lists local entries", async () => {
		const agentDir = tempAgentDir();
		const cwd = "/proj/browse-cli";
		const opts = { agentDir, settings: localSettings() };
		await runNativeMemoryCommand(["save", "note.md", "browse", "cli", "marker"], cwd, opts);
		const result = await runNativeMemoryCommand(["browse"], cwd, opts);
		expect(result.status).toBe(0);
		expect(result.stdout).toContain("stage1:manual:note.md");
	});

	it("rejects invalid --kind and rejects init verb", async () => {
		const opts = { agentDir: tempAgentDir(), settings: localSettings() };
		const badKind = await runNativeMemoryCommand(["save", "f.md", "content", "--kind", "banana"], "/proj/a", opts);
		expect(badKind.status).toBe(1);
		expect(badKind.stderr).toContain('invalid --kind "banana"');
		const init = await runNativeMemoryCommand(["init"], "/proj/a", opts);
		expect(init.status).toBe(1);
		expect(init.stderr).toContain("not in this surface yet");
	});

	it("memory search --cloud uses hindsight when backend is off", async () => {
		const settings = Settings.isolated({ "hindsight.apiUrl": "http://127.0.0.1:9" });
		const result = await runNativeMemoryCommand(["search", "x", "--cloud"], "/proj/a", {
			agentDir: tempAgentDir(),
			settings,
		});
		expect(result.status).toBe(1);
		expect(result.stderr).toContain("memory search failed");
	});

	it("memory search --cloud on local backend still routes to hindsight", async () => {
		const settings = Settings.isolated({
			"memory.backend": "local",
			"hindsight.apiUrl": "http://127.0.0.1:9",
		});
		const result = await runNativeMemoryCommand(["search", "x", "--cloud"], "/proj/a", {
			agentDir: tempAgentDir(),
			settings,
		});
		expect(result.status).toBe(1);
		expect(result.stderr).toContain("memory search failed");
	});
	it("hindsight backend failure surfaces plainly without throwing", async () => {
		// Unroutable local endpoint — deterministic failure regardless of env/network.
		const settings = Settings.isolated({ "memory.backend": "hindsight", "hindsight.apiUrl": "http://127.0.0.1:9" });
		const result = await runNativeMemoryCommand(["search", "x"], "/proj/a", { agentDir: tempAgentDir(), settings });
		expect(result.status).toBe(1);
		expect(result.stderr).toContain("memory search failed");
	});
});

describe("chat search (99.01 M4)", () => {
	function seedSession(agentDir: string, cwd: string, fileName: string, lines: string[]): void {
		const { encodedDirName } = getDefaultSessionDirName(cwd);
		const dir = path.join(getSessionsDir(agentDir), encodedDirName);
		mkdirSync(dir, { recursive: true });
		writeFileSync(path.join(dir, fileName), lines.join("\n"));
	}

	const header = '{"type":"session","id":"s1","timestamp":"2026-06-12T10:00:00Z","cwd":"/proj/chat"}';

	it("greps message entries across session jsonl files", async () => {
		const agentDir = tempAgentDir();
		const cwd = "/proj/chat";
		seedSession(agentDir, cwd, "a_s1.jsonl", [
			header,
			'{"type":"message","id":"m1","timestamp":"2026-06-12T10:01:00Z","message":{"role":"user","content":"please fix the migration bug"}}',
			'{"type":"message","id":"m2","timestamp":"2026-06-12T10:02:00Z","message":{"role":"assistant","content":[{"type":"text","text":"migration bug fixed in storage.ts"}]}}',
		]);
		const result = await runNativeChatCommand(["search", "migration bug"], cwd, { agentDir });
		expect(result.status).toBe(0);
		expect(result.stdout).toContain("(user) please fix the migration bug");
		expect(result.stdout).toContain("(assistant) migration bug fixed");
	});

	it("returns a friendly message when nothing matches or no sessions exist", async () => {
		const agentDir = tempAgentDir();
		const none = await runNativeChatCommand(["search", "zzz"], "/proj/empty", { agentDir });
		expect(none.status).toBe(0);
		expect(none.stdout).toContain("no sessions");

		seedSession(agentDir, "/proj/chat2", "b_s2.jsonl", [header]);
		const noHits = await runNativeChatCommand(["search", "zzz"], "/proj/chat2", { agentDir });
		expect(noHits.status).toBe(0);
		expect(noHits.stdout).toContain("no chat hits");
	});

	it("rejects non-search verbs with usage", async () => {
		const result = await runNativeChatCommand(["history"], "/proj/a", { agentDir: tempAgentDir() });
		expect(result.status).toBe(1);
		expect(result.stderr).toContain("chat search <query>");
	});

	it("respects --recent and includes --context neighbours", async () => {
		const agentDir = tempAgentDir();
		const cwd = "/proj/chat3";
		seedSession(agentDir, cwd, "c_s3.jsonl", [
			header,
			'{"type":"message","id":"m1","timestamp":"t1","message":{"role":"user","content":"setup question"}}',
			'{"type":"message","id":"m2","timestamp":"t2","message":{"role":"assistant","content":"answer about deploy target"}}',
			'{"type":"message","id":"m3","timestamp":"t3","message":{"role":"user","content":"deploy target confirmed"}}',
		]);
		const result = await runNativeChatCommand(["search", "deploy target", "--context", "1", "--recent", "5"], cwd, {
			agentDir,
		});
		expect(result.status).toBe(0);
		expect(result.stdout).toContain("~user) setup question");
		expect(result.stdout).toContain("(assistant) answer about deploy target");
	});
});
