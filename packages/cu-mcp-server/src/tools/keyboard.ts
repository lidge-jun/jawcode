import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { native } from "../native.js";
import { enforcePreAction } from "../safety/enforcement.js";
import { isSystemKeyCombo } from "../safety/tiers.js";
import type { SessionState } from "../session.js";

function ok(text: string) {
	return { content: [{ type: "text" as const, text }] };
}

function fail(text: string) {
	return { content: [{ type: "text" as const, text }], isError: true };
}

export function registerKeyboardTools(server: McpServer, session: SessionState) {
	server.registerTool(
		"type",
		{
			description: "Type text into the currently focused control. Use key for shortcuts.",
			inputSchema: z.object({
				text: z.string().describe("Text to type."),
			}),
		},
		async ({ text }) => {
			const tierError = await enforcePreAction(session, "keyboard");
			if (tierError) {
				return fail(tierError);
			}

			const viaClipboard = (text.includes("\n") || text.includes("\r")) && session.grantFlags.clipboardWrite;
			await native.type(text, viaClipboard);

			const segmenter = new Intl.Segmenter();
			const graphemes = [...segmenter.segment(text)].length;
			return ok(`Typed ${graphemes} grapheme(s).`);
		},
	);

	server.registerTool(
		"key",
		{
			description: "Press a key or key combination.",
			inputSchema: z.object({
				text: z.string().describe('Key or chord, e.g. "return" or "cmd+shift+a".'),
				repeat: z.number().int().min(1).max(100).optional().describe("How many times to press the key."),
			}),
		},
		async ({ text, repeat }) => {
			const tierError = await enforcePreAction(session, "keyboard");
			if (tierError) {
				return fail(tierError);
			}

			if (isSystemKeyCombo(text) && !session.grantFlags.systemKeyCombos) {
				return fail(
					`"${text}" is a system-level shortcut. Request the \`systemKeyCombos\` grant via request_access to use it.`,
				);
			}

			await native.key(text, repeat ?? 1);
			return ok("Key pressed.");
		},
	);

	server.registerTool(
		"hold_key",
		{
			description: "Hold a key or key combination for a duration, then release.",
			inputSchema: z.object({
				text: z.string().describe('Key or chord, e.g. "space" or "shift+down".'),
				duration: z.number().min(0).max(100).describe("Duration in seconds."),
			}),
		},
		async ({ text, duration }) => {
			const tierError = await enforcePreAction(session, "keyboard");
			if (tierError) {
				return fail(tierError);
			}

			if (isSystemKeyCombo(text) && !session.grantFlags.systemKeyCombos) {
				return fail(
					`"${text}" is a system-level shortcut. Request the \`systemKeyCombos\` grant via request_access to use it.`,
				);
			}

			await native.holdKey(text, duration);
			return ok("Key held.");
		},
	);
}
