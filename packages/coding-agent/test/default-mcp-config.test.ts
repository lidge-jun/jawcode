import { afterEach, describe, expect, it } from "bun:test";
import * as fs from "node:fs/promises";
import * as os from "node:os";
import * as path from "node:path";
import {
	type DefaultMcpConfigInstallResult,
	getManagedDefaultMcpServers,
	installDefaultMcpConfig,
} from "@jawcode-dev/coding-agent/defaults/jwc-defaults";
import type { MCPConfigFile } from "../src/runtime-mcp/types";

const tempRoots: string[] = [];

async function makeTempRoot(): Promise<string> {
	const tempRoot = await fs.mkdtemp(path.join(os.tmpdir(), "jwc-default-mcp-"));
	tempRoots.push(tempRoot);
	return tempRoot;
}

async function readConfig(root: string): Promise<MCPConfigFile> {
	return (await Bun.file(path.join(root, "mcp.json")).json()) as MCPConfigFile;
}

afterEach(async () => {
	await Promise.all(tempRoots.splice(0).map(root => fs.rm(root, { recursive: true, force: true })));
});

describe("default MCP config", () => {
	it("installs bundled managed MCP defaults into the target agent mcp.json on macOS", async () => {
		const targetRoot = await makeTempRoot();

		const result = await installDefaultMcpConfig({ targetRoot, platform: "darwin" });

		const managedDefaults = getManagedDefaultMcpServers("darwin");
		expect(result).toEqual({
			targetRoot,
			path: path.join(targetRoot, "mcp.json"),
			serverNames: Object.keys(managedDefaults),
			status: "written",
		} satisfies DefaultMcpConfigInstallResult);
		const config = await readConfig(targetRoot);
		expect(config.mcpServers?.context7).toEqual({
			command: "npx",
			args: ["-y", "@upstash/context7-mcp@latest"],
		});
		expect(config.mcpServers?.["computer-use"]).toBeUndefined();
		expect(config.mcpServers?.["cua-driver"]).toBeUndefined();
	});

	it("reports missing, different, and matching states in check mode", async () => {
		const targetRoot = await makeTempRoot();

		const missing = await installDefaultMcpConfig({ targetRoot, check: true, platform: "darwin" });
		expect(missing.status).toBe("missing");

		const managedDefaults = getManagedDefaultMcpServers("darwin");
		await Bun.write(
			path.join(targetRoot, "mcp.json"),
			JSON.stringify(
				{
					mcpServers: {
						...managedDefaults,
						context7: { command: "node", args: ["old.js"] },
					},
				},
				null,
				2,
			),
		);
		const different = await installDefaultMcpConfig({ targetRoot, check: true, platform: "darwin" });
		expect(different.status).toBe("different");

		await installDefaultMcpConfig({ targetRoot, platform: "darwin" });
		const matching = await installDefaultMcpConfig({ targetRoot, check: true, platform: "darwin" });
		expect(matching.status).toBe("matching");
		await Bun.write(
			path.join(targetRoot, "mcp.json"),
			JSON.stringify(
				{ mcpServers: { ...managedDefaults, "cua-driver": { command: "cua-driver", args: ["mcp"] } } },
				null,
				2,
			),
		);
		const legacyDifferent = await installDefaultMcpConfig({ targetRoot, check: true, platform: "darwin" });
		expect(legacyDifferent.status).toBe("different");
	});

	it("updates only managed default server entries and preserves the rest of mcp.json", async () => {
		const targetRoot = await makeTempRoot();
		await Bun.write(
			path.join(targetRoot, "mcp.json"),
			JSON.stringify(
				{
					$schema: "https://example.test/schema.json",
					disabledServers: ["legacy"],
					mcpServers: {
						context7: { command: "node", args: ["old.js"] },
						"computer-use": { command: "node", args: ["old-cu.js"] },
						legacy: { command: "legacy-mcp", args: ["--safe"] },
					},
				} satisfies MCPConfigFile,
				null,
				2,
			),
		);

		const result = await installDefaultMcpConfig({ targetRoot, platform: "darwin" });

		expect(result.status).toBe("written");
		const config = await readConfig(targetRoot);
		expect(config.$schema).toBe("https://example.test/schema.json");
		expect(config.disabledServers).toEqual(["legacy"]);
		expect(config.mcpServers?.legacy).toEqual({ command: "legacy-mcp", args: ["--safe"] });
		expect(config.mcpServers?.context7).toEqual({
			command: "npx",
			args: ["-y", "@upstash/context7-mcp@latest"],
		});
		expect(config.mcpServers?.["computer-use"]).toEqual({
			command: "node",
			args: ["old-cu.js"],
		});
		expect(config.mcpServers?.["cua-driver"]).toBeUndefined();
	});
	it("removes exact legacy managed cua-driver entries and preserves custom cua-driver configs", async () => {
		const targetRoot = await makeTempRoot();
		await Bun.write(
			path.join(targetRoot, "mcp.json"),
			JSON.stringify(
				{
					mcpServers: {
						context7: {
							command: "npx",
							args: ["-y", "@upstash/context7-mcp@latest"],
						},
						"cua-driver": { command: "cua-driver", args: ["mcp"] },
					},
				} satisfies MCPConfigFile,
				null,
				2,
			),
		);

		const result = await installDefaultMcpConfig({ targetRoot, platform: "darwin" });

		expect(result.status).toBe("written");
		const config = await readConfig(targetRoot);
		expect(config.mcpServers?.context7).toEqual({
			command: "npx",
			args: ["-y", "@upstash/context7-mcp@latest"],
		});
		expect(config.mcpServers?.["cua-driver"]).toBeUndefined();

		await Bun.write(
			path.join(targetRoot, "mcp.json"),
			JSON.stringify(
				{
					mcpServers: {
						context7: {
							command: "npx",
							args: ["-y", "@upstash/context7-mcp@latest"],
						},
						"cua-driver": {
							command: "cua-driver",
							args: ["mcp"],
							env: { FOO: "bar" },
						},
					},
				} satisfies MCPConfigFile,
				null,
				2,
			),
		);

		const custom = await installDefaultMcpConfig({ targetRoot, platform: "darwin" });
		const customConfig = await readConfig(targetRoot);
		expect(custom.status).toBe("matching");
		expect(customConfig.mcpServers?.["cua-driver"]).toEqual({
			command: "cua-driver",
			args: ["mcp"],
			env: { FOO: "bar" },
		});
	});

	it("installs only platform-neutral MCP defaults outside macOS", async () => {
		const targetRoot = await makeTempRoot();
		await Bun.write(
			path.join(targetRoot, "mcp.json"),
			JSON.stringify(
				{
					mcpServers: {
						context7: { command: "node", args: ["old.js"] },
						"computer-use": { command: "node", args: ["existing-cu.js"] },
						"cua-driver": { command: "existing-cua", args: ["mcp"] },
					},
				} satisfies MCPConfigFile,
				null,
				2,
			),
		);

		const result = await installDefaultMcpConfig({ targetRoot, platform: "linux" });

		expect(result.serverNames).toEqual(["context7"]);
		const config = await readConfig(targetRoot);
		expect(config.mcpServers?.context7).toEqual({
			command: "npx",
			args: ["-y", "@upstash/context7-mcp@latest"],
		});
		expect(config.mcpServers?.["computer-use"]).toEqual({
			command: "node",
			args: ["existing-cu.js"],
		});
		expect(config.mcpServers?.["cua-driver"]).toEqual({
			command: "existing-cua",
			args: ["mcp"],
		});
	});
});
