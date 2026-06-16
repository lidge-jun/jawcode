import { describe, expect, it } from "bun:test";
import { BUILTIN_SLASH_COMMANDS } from "@gajae-code/coding-agent/extensibility/slash-commands";

describe("native workflow autocomplete pin (99.30.02)", () => {
	it("pins /orchestrate and /goal above the bundled skill commands (priority > 100)", () => {
		const orchestrate = BUILTIN_SLASH_COMMANDS.find(cmd => cmd.name === "orchestrate");
		const goal = BUILTIN_SLASH_COMMANDS.find(cmd => cmd.name === "goal");
		// orchestrate is jaw-brand-gated; assert only when present in this build.
		if (orchestrate) expect(orchestrate.priority).toBe(110);
		expect(goal?.priority).toBe(105);
		if (orchestrate && goal) expect(orchestrate.priority!).toBeGreaterThan(goal.priority!);
		expect(goal!.priority!).toBeGreaterThan(100); // skill pin tier
	});

	it("does not propagate the pin to alias rows", () => {
		const pabcd = BUILTIN_SLASH_COMMANDS.find(cmd => cmd.name === "pabcd");
		if (pabcd) expect(pabcd.priority).toBeUndefined();
	});
});
