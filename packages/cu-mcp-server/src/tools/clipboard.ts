import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { native } from "../native.js";
import type { SessionState } from "../session.js";

function ok(text: string, structuredContent?: Record<string, unknown>) {
	return {
		content: [{ type: "text" as const, text }],
		...(structuredContent !== undefined ? { structuredContent } : {}),
	};
}

function fail(text: string) {
	return { content: [{ type: "text" as const, text }], isError: true };
}

export function registerClipboardTools(server: McpServer, session: SessionState) {
	server.registerTool(
		"read_clipboard",
		{
			description: "Read the current clipboard contents as text.",
			inputSchema: z.object({}),
		},
		async () => {
			if (!session.grantFlags.clipboardRead) {
				return fail("clipboardRead grant required.");
			}

			const result = (await native.clipboardRead()) as { text: string };
			return ok(result.text, result);
		},
	);

	server.registerTool(
		"write_clipboard",
		{
			description: "Write text to the clipboard.",
			inputSchema: z.object({
				text: z.string(),
			}),
		},
		async ({ text }) => {
			if (!session.grantFlags.clipboardWrite) {
				return fail("clipboardWrite grant required.");
			}

			await native.clipboardWrite(text);
			return ok("Clipboard updated.");
		},
	);
}
