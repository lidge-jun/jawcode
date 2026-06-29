/**
 * Tool-call/result fallback serialization for Kiro / CodeWhisperer.
 *
 * CodeWhisperer only accepts `toolUses` / `toolResults` on the wire when the corresponding tools
 * are advertised on the request. On a turn that advertises NO tools but whose history still contains
 * tool calls/results (e.g. a resumed turn that dropped tools, or a tool-result whose id does not
 * match any advertised structured tool-use), sending a structured `toolResult` produces a
 * `REQUEST_BODY_INVALID`. To stay valid we serialize those into plain prose carried on a normal
 * user/assistant turn instead. Parity with opencodex `kiro-tool-fallback.ts` (commit a63aa76).
 */

import type { ImageContent, TextContent, ToolCall, ToolResultMessage } from "../types";
import { normalizeToolCallId } from "../utils";

function stringifyValue(value: unknown): string {
	try {
		return JSON.stringify(value);
	} catch {
		return String(value);
	}
}

function contentText(content: string | (TextContent | ImageContent)[]): string {
	if (typeof content === "string") return content;
	return content
		.map(part => (part.type === "text" ? part.text : part.type === "image" ? "[image]" : ""))
		.filter(Boolean)
		.join("\n");
}

/** Join a base message body with appended fallback prose. */
export function appendFallbackText(base: string, fallback: string): string {
	return [base, fallback].filter(Boolean).join("\n\n");
}

/** Serialize an unstructured assistant tool call (tool not advertised) into prose. */
export function toolCallFallbackText(toolCall: ToolCall): string {
	return [
		`Tool call fallback (${toolCall.name}, id ${normalizeToolCallId(toolCall.id)}):`,
		stringifyValue(toolCall.arguments ?? {}),
	].join("\n");
}

/** Serialize an unstructured tool result (no matching advertised tool-use) into prose. */
export function toolResultFallbackText(toolResult: ToolResultMessage): string {
	return [
		`Tool result fallback (${toolResult.toolName}, id ${normalizeToolCallId(toolResult.toolCallId)}, ${
			toolResult.isError ? "error" : "success"
		}):`,
		contentText(toolResult.content) || "(empty)",
	].join("\n");
}
