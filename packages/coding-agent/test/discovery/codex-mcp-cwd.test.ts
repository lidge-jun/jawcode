import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import * as fs from "node:fs/promises";
import * as os from "node:os";
import * as path from "node:path";
import { loadCapability } from "../../src/capability";
import { type MCPServer, mcpCapability } from "../../src/capability/mcp";
import "../../src/discovery/codex";

describe("Codex config.toml MCP cwd rooting", () => {
	let cwd = "";

	beforeEach(async () => {
		cwd = await fs.mkdtemp(path.join(os.tmpdir(), "jwc-codex-mcp-cwd-"));
		await fs.mkdir(path.join(cwd, ".codex"), { recursive: true });
	});

	afterEach(async () => {
		await fs.rm(cwd, { recursive: true, force: true });
	});

	test("roots relative command and cwd at the declaring config directory", async () => {
		const codexDir = path.join(cwd, ".codex");
		const absoluteCommand = path.join(cwd, "absolute-mcp");
		const absoluteCwd = path.join(cwd, "absolute-work");
		await fs.writeFile(
			path.join(codexDir, "config.toml"),
			[
				"[mcp_servers.nested]",
				'command = "./bin/mcp"',
				'cwd = "server"',
				"",
				"[mcp_servers.bare]",
				'command = "npx"',
				"",
				"[mcp_servers.absolute]",
				`command = ${JSON.stringify(absoluteCommand)}`,
				`cwd = ${JSON.stringify(absoluteCwd)}`,
			].join("\n"),
		);

		const result = await loadCapability<MCPServer>(mcpCapability.id, {
			cwd,
			providers: ["codex"],
		});
		const nested = result.items.find(server => server.name === "nested");
		const bare = result.items.find(server => server.name === "bare");
		const absolute = result.items.find(server => server.name === "absolute");

		expect(nested?.cwd).toBe(path.join(codexDir, "server"));
		expect(nested?.command).toBe(path.join(codexDir, "server", "bin", "mcp"));
		expect(bare?.command).toBe("npx");
		expect(bare?.cwd).toBeUndefined();
		expect(absolute?.command).toBe(absoluteCommand);
		expect(absolute?.cwd).toBe(absoluteCwd);
	});
});
