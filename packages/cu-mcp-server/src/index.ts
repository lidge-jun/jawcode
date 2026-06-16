#!/usr/bin/env node

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { acquireLock, releaseLock } from "./safety/lock.js";
import { createSessionState } from "./session.js";
import { registerAppTools } from "./tools/app.js";
import { registerBatchTool } from "./tools/batch.js";
import { registerClipboardTools } from "./tools/clipboard.js";
import { registerConsolidatedTool } from "./tools/consolidated.js";
import { registerInspectTools } from "./tools/inspect.js";
import { registerKeyboardTools } from "./tools/keyboard.js";
import { registerMouseTools } from "./tools/mouse.js";
import { registerScreenshotTools } from "./tools/screenshot.js";
import { registerScrollTool } from "./tools/scroll.js";
import { registerTeachTools } from "./tools/teach.js";
import { registerUtilityTools } from "./tools/utility.js";

async function main() {
	if (process.platform !== "darwin") {
		console.error(`computer-use requires macOS (darwin). Current platform: ${process.platform}`);
		process.exit(1);
	}

	const server = new McpServer({
		name: "computer-use",
		version: "0.1.0",
	});

	const state = createSessionState();

	// Acquire machine-wide lock
	const lockOk = await acquireLock(state.sessionId);
	if (!lockOk) {
		console.error("Another computer-use session is active. Only one session at a time is allowed.");
		process.exit(1);
	}
	state.lockAcquired = true;

	const consolidated = process.argv.includes("--consolidated") || process.env.CU_MCP_MODE === "consolidated";

	if (consolidated) {
		registerConsolidatedTool(server, state); // 1 tool, ~3K tokens
	} else {
		registerMouseTools(server, state); // 9 tools
		registerKeyboardTools(server, state); // 3 tools
		registerScreenshotTools(server, state); // 3 tools
		registerScrollTool(server, state); // 1 tool
		registerAppTools(server, state); // 3 tools
		registerClipboardTools(server, state); // 2 tools
		registerBatchTool(server, state); // 1 tool
		registerUtilityTools(server, state); // 2 tools
		registerTeachTools(server, state); // 3 tools
		registerInspectTools(server, state); // 2 tools
	}

	const transport = new StdioServerTransport();
	await server.connect(transport);

	const cleanup = async () => {
		await releaseLock(state.sessionId);
		await server.close();
		process.exit(0);
	};

	process.on("SIGINT", cleanup);
	process.on("SIGTERM", cleanup);
}

main().catch(err => {
	console.error("Fatal:", err);
	process.exit(1);
});
