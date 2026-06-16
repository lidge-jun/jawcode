import { describe, expect, it } from "bun:test";
import { mkdtempSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { setAgentDir } from "@gajae-code/utils";
import { Settings } from "../src/config/settings";
import { saveLocalMemoryManual } from "../src/memories/local-query";
import { localBackend } from "../src/memory-backend/local-backend";
import type { AgentSession } from "../src/session/agent-session";

function tempAgentDir(): string {
	return mkdtempSync(path.join(os.tmpdir(), "jwc-local-m6-"));
}

function stubSession(agentDir: string, cwd: string): AgentSession {
	setAgentDir(agentDir);
	const settings = Settings.isolated({ "memory.backend": "local" });
	return {
		settings,
		sessionManager: { getCwd: () => cwd },
		modelRegistry: { getAll: () => [] },
		taskDepth: 0,
	} as unknown as AgentSession;
}

describe("local backend task snapshot (99.01 M6)", () => {
	it("beforeAgentStartPrompt returns undefined when prompt is empty", async () => {
		const session = stubSession(tempAgentDir(), "/proj/m6");
		expect(await localBackend.beforeAgentStartPrompt!(session, "   ")).toBeUndefined();
	});

	it("beforeAgentStartPrompt wraps diversified hits in a memories block", async () => {
		const agentDir = tempAgentDir();
		const cwd = "/proj/m6-snapshot";
		saveLocalMemoryManual(agentDir, cwd, "prefs.md", "user prefers tabs over spaces", "profile");

		const session = stubSession(agentDir, cwd);
		const block = await localBackend.beforeAgentStartPrompt!(session, "tabs preference");
		expect(block).toBeDefined();
		expect(block).toContain("<memories>");
		expect(block).toContain("Task snapshot");
		expect(block).toContain("prefers tabs");
		expect(block).toContain("stage1:manual:prefs.md");
	});
});
