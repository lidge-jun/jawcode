import { describe, expect, it } from "bun:test";
import { Settings } from "../../src/config/settings";
import { loadMemoryConfig, MEMORY_RUNTIME_DEFAULTS } from "../../src/memories/memory-config";

describe("memory-config (99.01 M7)", () => {
	it("enables local backend from memory.backend", () => {
		const cfg = loadMemoryConfig(Settings.isolated({ "memory.backend": "local" }));
		expect(cfg.enabled).toBe(true);
		expect(cfg.searchLimit).toBe(MEMORY_RUNTIME_DEFAULTS.searchLimit);
		expect(cfg.searchMode).toBe("hybrid");
		expect(cfg.browseLimit).toBe(MEMORY_RUNTIME_DEFAULTS.browseLimit);
	});

	it("stays disabled when backend is off", () => {
		const cfg = loadMemoryConfig(Settings.isolated({}));
		expect(cfg.enabled).toBe(false);
	});

	it("loads memories.modelRolePattern into runtime config", () => {
		const cfg = loadMemoryConfig(Settings.isolated({ "memories.modelRolePattern": "openai/gpt-4.1-mini" }));
		expect(cfg.modelRolePattern).toBe("openai/gpt-4.1-mini");
	});

	it("loads memories.searchMode from settings", () => {
		const cfg = loadMemoryConfig(Settings.isolated({ "memories.searchMode": "like" }));
		expect(cfg.searchMode).toBe("like");
	});
});
