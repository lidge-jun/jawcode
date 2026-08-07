/**
 * An explicitly configured search provider that cannot run should say so.
 *
 * `resolveProviderChain` drops a preferred provider whose `isAvailable()` is
 * false and appends DuckDuckGo as the terminal fallback. That keeps search
 * working, which is right — but it was silent, so a user whose `EXA_API_KEY`
 * expired saw their configured provider apparently in use while every result
 * actually came from DuckDuckGo. A missing credential looked like a provider
 * that had simply gotten worse.
 *
 * This also pins the two facts that make upstream's `isExplicitlyAvailable`
 * split non-applicable here, so a future reader does not re-derive them.
 */
import { describe, expect, it } from "bun:test";
import * as fs from "node:fs";
import * as path from "node:path";

const SEARCH_SRC = path.join(import.meta.dir, "..", "..", "..", "src", "web", "search");

function read(...segments: string[]): string {
	return fs.readFileSync(path.join(SEARCH_SRC, ...segments), "utf-8");
}

describe("preferred provider fallback", () => {
	it("warns when an explicitly preferred provider is unavailable", () => {
		const source = read("provider.ts");
		const explicitBranch = source.slice(source.indexOf('if (preferredProvider !== "auto")'));
		const branchBody = explicitBranch.slice(0, explicitBranch.indexOf("} else if"));

		expect(branchBody).toContain("logger.warn");
		expect(branchBody).toContain("preferred");
	});

	it("still falls back rather than failing the search", () => {
		// The warning must not become a hard error: DuckDuckGo is appended
		// unconditionally so a missing credential never breaks web search.
		const source = read("provider.ts");
		expect(source).toContain('if (!chain.includes("duckduckgo")) chain.push("duckduckgo");');
	});

	it("has no keyless fallback for isExplicitlyAvailable to admit", () => {
		// Upstream's split exists so an explicitly selected Exa routes through its
		// public MCP fallback. This fork removed that fallback outright, so the
		// method would have nothing to admit.
		const exa = read("providers", "exa.ts");
		expect(exa).toContain("Exa MCP fallback is disabled in jawcode");
	});

	it("keeps duckduckgo unconditionally available as the terminal fallback", () => {
		// The only keyless provider, and it is already always admitted — the other
		// half of why the explicit/auto admission split has nothing to do here.
		const ddg = read("providers", "duckduckgo.ts");
		const availability = ddg.slice(ddg.indexOf("isAvailable(_authStorage: AuthStorage)"));
		expect(availability.slice(0, availability.indexOf("}"))).toContain("return true;");
	});
});
