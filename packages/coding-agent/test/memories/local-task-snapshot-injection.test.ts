import { describe, expect, it } from "bun:test";
import { mkdtempSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { Settings } from "../../src/config/settings";
import { saveLocalMemoryManual } from "../../src/memories/local-query";
import { localBackend } from "../../src/memory-backend/local-backend";
import type { AgentSession } from "../../src/session/agent-session";

function fakeSession(agentDir: string, cwd: string): AgentSession {
	const settings = Settings.isolated({ "memory.backend": "local" });
	// localBackend.beforeAgentStartPrompt only touches these three surfaces.
	(settings as unknown as { getAgentDir: () => string }).getAgentDir = () => agentDir;
	return {
		settings,
		sessionManager: { getCwd: () => cwd },
	} as unknown as AgentSession;
}

describe("local backend Task Snapshot injection (99.01 M6)", () => {
	it("returns a <memories> block with top hits for the prompt", async () => {
		const agentDir = mkdtempSync(path.join(os.tmpdir(), "jwc-snap-"));
		const cwd = "/proj/snap";
		saveLocalMemoryManual(agentDir, cwd, "deploy.md", "deploy target is the staging cluster", "shared");
		const session = fakeSession(agentDir, cwd);

		const injected = await localBackend.beforeAgentStartPrompt?.(session, "how do we deploy this");
		expect(injected).toBeDefined();
		expect(injected).toContain("<memories>");
		expect(injected).toContain("stage1:manual:deploy.md");
		expect(injected).toContain("</memories>");
	});

	it("returns undefined for empty prompts and zero hits", async () => {
		const agentDir = mkdtempSync(path.join(os.tmpdir(), "jwc-snap-"));
		const session = fakeSession(agentDir, "/proj/empty");
		expect(await localBackend.beforeAgentStartPrompt?.(session, "   ")).toBeUndefined();
		expect(await localBackend.beforeAgentStartPrompt?.(session, "zzz-no-match-term")).toBeUndefined();
	});
});
