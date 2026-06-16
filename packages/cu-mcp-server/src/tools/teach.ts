import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import type { SessionState } from "../session.js";

function desktopOnly() {
	return {
		content: [
			{
				type: "text" as const,
				text: "Teach mode is only available in Claude Desktop.",
			},
		],
		isError: true,
	};
}

export function registerTeachTools(server: McpServer, session: SessionState) {
	void session;

	server.registerTool(
		"request_teach_access",
		{
			description: "Request teach mode access.",
			inputSchema: z.object({
				apps: z.array(z.string()),
				reason: z.string(),
			}),
		},
		async () => desktopOnly(),
	);

	server.registerTool(
		"teach_step",
		{
			description: "Execute one teach-mode step.",
			inputSchema: z.object({
				explanation: z.string(),
				next_preview: z.string(),
				actions: z.array(z.object({ action: z.string() })),
				anchor: z.tuple([z.number(), z.number()]).optional(),
			}),
		},
		async () => desktopOnly(),
	);

	server.registerTool(
		"teach_batch",
		{
			description: "Execute multiple teach-mode steps.",
			inputSchema: z.object({
				steps: z.array(
					z.object({
						explanation: z.string(),
						next_preview: z.string(),
						actions: z.array(z.object({ action: z.string() })),
						anchor: z.tuple([z.number(), z.number()]).optional(),
					}),
				),
			}),
		},
		async () => desktopOnly(),
	);
}
