import { describe, expect, test } from "bun:test";

const promptPath = (name: string) => new URL(`../src/prompts/tools/${name}.md`, import.meta.url);

describe("background tool prompt guidance", () => {
	test("background prompt teaches launch timing and footer parity", async () => {
		const text = await Bun.file(promptPath("background")).text();

		expect(text).toContain("Long-running work should be background-launched");
		expect(text).toContain("TUI footer/panel rows");
		expect(text).toContain("same canonical background work");
	});

	test("launch and legacy tool prompts cross-reference background management", async () => {
		const task = await Bun.file(promptPath("task")).text();
		const bash = await Bun.file(promptPath("bash")).text();
		const monitor = await Bun.file(promptPath("monitor")).text();
		const job = await Bun.file(promptPath("job")).text();

		expect(task).toContain("tool rows are the same conceptual background work surface");
		expect(bash).toContain("Manage resulting background rows");
		expect(monitor).toContain("Monitor rows appear in `background list/detail/follow`");
		expect(job).toContain("legacy low-level async job polling/cancel surface");
	});

	test("system prompt contains conditional background guidance", async () => {
		const text = await Bun.file(new URL("../src/prompts/system/system-prompt.md", import.meta.url)).text();

		expect(text).toContain('{{#has tools "background"}}');
		expect(text).toContain("canonical background row management surface");
		expect(text).toContain("TUI footer/panel");
	});
});
