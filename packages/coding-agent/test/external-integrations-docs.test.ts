import { describe, expect, it } from "bun:test";
import * as path from "node:path";

const repoRoot = path.resolve(import.meta.dir, "..", "..", "..");

async function readRepoFile(file: string): Promise<string> {
	return await Bun.file(path.join(repoRoot, file)).text();
}

describe("external integration docs", () => {
	it("summarizes shipped, fail-closed, design-only, and deferred integration surfaces", async () => {
		const doc = await readRepoFile("docs/external-integrations.md");
		expect(doc).toContain("Telegram notifications");
		expect(doc).toContain("Shipped operator runtime");
		expect(doc).toContain("Bridge mode");
		expect(doc).toContain("Experimental, fail-closed by default");
		expect(doc).toContain("Hermes coordinator MCP bridge");
		expect(doc).toContain("Shipped outward bridge, fail-closed by default");
		expect(doc).toContain("Grok Build provider");
		expect(doc).toContain("Design-only, owner decision required");
		expect(doc).toContain("Discord and Slack notification adapters");
		expect(doc).toContain("Deferred, not shipped");
	});

	it("does not overclaim upstream-only integration docs as shipped JWC features", async () => {
		const lower = (await readRepoFile("docs/external-integrations.md")).toLowerCase();
		expect(lower).toContain("codegraph custom tool notes from upstream");
		expect(lower).toContain("not shipped in jwc docs");
		expect(lower).toContain("standalone mcp registration notes from upstream");
		expect(lower).toContain("not shipped as a jwc product doc");
		expect(lower).toContain("openclaw / gajae remote upstream notes");
		expect(lower).toContain("translated into jwc bridge/coordinator boundaries only");
		expect(lower).not.toContain("discord adapter | shipped");
		expect(lower).not.toContain("slack adapter | shipped");
	});

	it("keeps bridge client package examples on the JWC package namespace", async () => {
		for (const file of ["docs/bridge.md", "docs/rpc.md"]) {
			const text = await readRepoFile(file);
			expect(text).toContain("@jawcode-dev/bridge-client");
			expect(text).not.toContain("@gajae-code/bridge-client");
		}
	});

	it("embeds the external integrations matrix in the local docs index", async () => {
		const generated = await readRepoFile("packages/coding-agent/src/internal-urls/docs-index.generated.ts");
		expect(generated).toContain('"external-integrations.md"');
		expect(generated).toContain("External Integrations Matrix");
	});
});
