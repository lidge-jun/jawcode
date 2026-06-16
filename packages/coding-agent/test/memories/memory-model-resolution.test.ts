import { describe, expect, it } from "bun:test";
import { mkdtempSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { Settings } from "../../src/config/settings";
import {
	persistMemoryModelResolution,
	readMemoryModelResolution,
	resolveMemoryModelPattern,
} from "../../src/memories/memory-model-resolution";

function tempAgentDir(): string {
	return mkdtempSync(path.join(os.tmpdir(), "jwc-mem-model-"));
}

describe("memory-model-resolution (99.01)", () => {
	it("resolveMemoryModelPattern prefers memories.modelRolePattern", () => {
		const settings = Settings.isolated({
			"memories.modelRolePattern": "openai/gpt-4.1-mini",
			modelRoles: { memory: "anthropic/claude-sonnet-4", default: "openai/gpt-4o" },
		});
		const picked = resolveMemoryModelPattern(settings, "default");
		expect(picked.pattern).toBe("openai/gpt-4.1-mini");
		expect(picked.source).toBe("memories.modelRolePattern");
	});

	it("persists and reads resolution.json under the project memory root", async () => {
		const agentDir = tempAgentDir();
		const cwd = "/proj/resolution";
		await persistMemoryModelResolution(agentDir, cwd, {
			pattern: "openai/gpt-4.1-mini",
			provider: "openai",
			modelId: "gpt-4.1-mini",
			resolvedAt: 1_700_000_000,
			source: "memories.modelRolePattern",
		});
		const record = await readMemoryModelResolution(agentDir, cwd);
		expect(record?.provider).toBe("openai");
		expect(record?.modelId).toBe("gpt-4.1-mini");
	});
});
