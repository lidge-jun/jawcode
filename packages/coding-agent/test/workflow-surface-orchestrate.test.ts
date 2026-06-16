import { describe, expect, it } from "bun:test";
import path from "node:path";

const promptPath = path.join(import.meta.dir, "..", "src", "prompts", "system", "system-prompt.md");

describe("workflow surface — orchestrate discovery (99.03 M1)", () => {
	const read = async () => await Bun.file(promptPath).text();

	it("system-prompt contains native-workflow orchestrate block", async () => {
		const source = await read();
		expect(source).toContain('<native-workflow name="orchestrate"');
		expect(source).toContain('user-entrypoint="/orchestrate <i|p|a|b|c|d>"');
		expect(source).toContain('alias="pabcd"');
	});

	it("system-prompt routing rows contain self-transition rule", async () => {
		const source = await read();
		expect(source).toContain("YOU advance IPABCD phases by running the exact");
		expect(source).toContain("No other method");
	});

	it("system-prompt routing rows contain natural-language trigger", async () => {
		const source = await read();
		expect(source).toContain("pabcd 진행해");
	});

	it("system-prompt IPABCD surface labels present", async () => {
		const source = await read();
		expect(source).toContain("IPABCD I-stage engine.");
		expect(source).toContain("- p (PLANNING): Plan authoring by the main session");
		expect(source).toContain("Planning runs through `jwc orchestrate p`");
		expect(source).toContain("**Durable goal ledger.**");
		expect(source).toContain("IPABCD B-stage coordinated execution engine.");
	});

	it("system-prompt invariant sentences preserved", async () => {
		const source = await read();
		expect(source).toContain("delegate bounded slices to `executor`");
		expect(source).toContain("committed repo-visible `.jwc` defaults are not the source of truth");
	});

	it("system-prompt static workflow skill attributes match public surface", async () => {
		const source = await read();
		expect(source).toContain(
			'<skill name="jaw-interview" user-entrypoint="/skill:jaw-interview" cli-runtime="native: jwc jaw-interview">',
		);
		expect(source).not.toContain('<skill name="ralplan" user-entrypoint="/skill:ralplan"');
		expect(source).toContain('<skill name="plan" user-entrypoint="/skill:plan"');
		expect(source).toContain('<skill name="goal" user-entrypoint="/skill:goal"');
		expect(source).toContain('<skill name="team" user-entrypoint="/skill:team" cli-runtime="native: jwc team">');
	});

	it("system-prompt no prose GJC", async () => {
		const source = await read();
		const prose = source
			.split("\n")
			.filter(line => !line.includes(".jwc") && !line.includes("defaults/gjc"))
			.join("\n");
		expect(prose).not.toMatch(/\bGJC\b/);
	});
});
