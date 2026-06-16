import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { native } from "../native.js";
import type { ScreenshotMeta, SessionState } from "../session.js";

function ok(text: string, structuredContent?: Record<string, unknown>) {
	return {
		content: [{ type: "text" as const, text }],
		...(structuredContent !== undefined ? { structuredContent } : {}),
	};
}

function convertCursorPosition(location: { x: number; y: number }, meta: ScreenshotMeta | null) {
	if (!meta) {
		return {
			x: location.x,
			y: location.y,
		};
	}

	return {
		x: (location.x - meta.originX) * (meta.width / meta.displayWidth),
		y: (location.y - meta.originY) * (meta.height / meta.displayHeight),
	};
}

export function registerUtilityTools(server: McpServer, session: SessionState) {
	server.registerTool(
		"wait",
		{
			description: "Wait for a specified duration.",
			inputSchema: z.object({
				duration: z.number().min(0).max(100),
			}),
		},
		async ({ duration }) => {
			await new Promise(resolve => setTimeout(resolve, duration * 1000));
			return ok(`Waited ${duration} seconds.`);
		},
	);

	server.registerTool(
		"cursor_position",
		{
			description: "Get the current cursor position relative to the most recent screenshot.",
			inputSchema: z.object({}),
		},
		async () => {
			const location = (await native.mouseLocation()) as { x: number; y: number };
			const converted = convertCursorPosition(location, session.lastScreenshot);
			return ok(JSON.stringify(converted), converted);
		},
	);
}
