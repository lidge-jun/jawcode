import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import * as path from "node:path";
import { MCPManager } from "../src/runtime-mcp/manager";
import type { MCPStdioServerConfig } from "../src/runtime-mcp/types";

const FIXTURE_PATH = path.join(import.meta.dir, "fixtures", "mcp-tool-ownership-server.ts");
const SHORT_SERVER = "atlassian";
const SANITIZED_SERVER = "atlassian:atlassian";
const SHORT_TOOL = "mcp__atlassian_search";
const SANITIZED_TOOL = "mcp__atlassian_atlassian_search";

function fixtureConfig(): MCPStdioServerConfig {
	return { type: "stdio", command: process.execPath, args: [FIXTURE_PATH] };
}

describe("MCP tool ownership with prefix-colliding server names", () => {
	let manager: MCPManager;

	beforeEach(() => {
		manager = new MCPManager(process.cwd());
	});

	afterEach(async () => {
		await manager.disconnectAll();
	});

	it("refreshing one server preserves the sibling server tools", async () => {
		await manager.connectServers({ [SHORT_SERVER]: fixtureConfig(), [SANITIZED_SERVER]: fixtureConfig() }, {});
		const names = () => manager.getTools().map(tool => tool.name);
		expect(names()).toEqual([SANITIZED_TOOL, SHORT_TOOL]);

		await manager.refreshServerTools(SHORT_SERVER);

		expect(names()).toEqual([SANITIZED_TOOL, SHORT_TOOL]);
		expect(manager.getTools().find(tool => tool.name === SANITIZED_TOOL)?.mcpServerName).toBe(SANITIZED_SERVER);
	});

	it("disconnecting a sanitized server removes only its owned tools", async () => {
		await manager.connectServers({ [SHORT_SERVER]: fixtureConfig(), [SANITIZED_SERVER]: fixtureConfig() }, {});

		await manager.disconnectServer(SANITIZED_SERVER);

		expect(manager.getTools().map(tool => tool.name)).toEqual([SHORT_TOOL]);
		expect(manager.getTools().every(tool => tool.mcpServerName === SHORT_SERVER)).toBe(true);
	});
});
