/**
 * Heuristic token-usage estimation for Kiro / CodeWhisperer.
 *
 * CodeWhisperer's event stream returns no token usage, so without this the assistant turn reports
 * all-zero usage: the cost line stays at $0 and any usage-percentage UI shows nothing. This module
 * provides a cheap, dependency-free char-based estimate to fill that gap, plus a precise total when
 * the stream does surface a `contextUsagePercentage`.
 *
 * Parity with opencodex `src/lib/token-estimate.ts` + the kiro adapter's usage path. Grounding:
 * ~4 chars/token for English prose; code / JSON / tool-args (the dominant agent traffic) pack more
 * tokens per char, so Kiro's code-heavy family uses a tighter ratio. Over-counting fails safe
 * (cost/usage slightly high); under-counting would risk hiding real context pressure.
 */

import type { Context, Message, Tool, Usage } from "../types";
import { toolWireSchema } from "../utils/schema/wire";

/** Generic English-prose fallback ratio (chars per token). */
const DEFAULT_CHARS_PER_TOKEN = 4;
/** Kiro routes code/JSON-heavy traffic (~3.0-3.3 chars/token); 3.5 keeps a small safety margin. */
const KIRO_CHARS_PER_TOKEN = 3.5;
const KIRO_MODEL_PREFIXES = ["kiro", "claude", "deepseek", "minimax", "glm", "qwen"];

/** Model-aware chars-per-token ratio. Unknown models fall back to the generic English ratio. */
function charsPerToken(modelId?: string): number {
	if (!modelId) return DEFAULT_CHARS_PER_TOKEN;
	const id = modelId.toLowerCase();
	if (KIRO_MODEL_PREFIXES.some(p => id.startsWith(p))) return KIRO_CHARS_PER_TOKEN;
	return DEFAULT_CHARS_PER_TOKEN;
}

/** Estimate the token count of a text blob. Pure and deterministic; empty input is 0. */
export function estimateKiroTokens(text: string, modelId?: string): number {
	if (!text) return 0;
	const len = text.length;
	if (len === 0) return 0;
	return Math.max(1, Math.ceil(len / charsPerToken(modelId)));
}

function contentText(content: string | Array<{ type: string; text?: string; detail?: string }>): string {
	if (typeof content === "string") return content;
	return content
		.map(p => (p.type === "text" ? (p.text ?? "") : p.type === "image" ? `[image:${p.detail ?? "auto"}]` : ""))
		.filter(Boolean)
		.join("\n");
}

function messageUsageText(msg: Message): string {
	switch (msg.role) {
		case "user":
		case "developer":
			return contentText(msg.content);
		case "toolResult":
			return [msg.toolName, msg.toolCallId, msg.isError ? "error" : "success", contentText(msg.content)]
				.filter(Boolean)
				.join("\n");
		case "assistant":
			// Assistant turns are echoed back into history but they are not *new* input the model must
			// re-read as fresh prompt tokens for the current turn — opencodex excludes them here.
			return "";
	}
}

/** Messages that make up the current (latest) turn: everything after the last assistant turn. */
function currentTurnMessages(messages: Message[]): Message[] {
	const lastAssistant = messages.map(m => m.role).lastIndexOf("assistant");
	return messages.slice(lastAssistant + 1).filter(m => m.role !== "assistant");
}

/**
 * Serialize a tool to ONLY its wire surface (name + description + parameter schema) for token
 * estimation. jawcode's `context.tools` are factory-built objects carrying handler closures and
 * framework metadata; `JSON.stringify`-ing the whole array produced absurd sizes (a greeting turn
 * estimated ~1.34M input tokens), which then tripped the usage-based context-overflow check. Only
 * the wire-visible fields are actually sent to the model, so only those should be counted.
 */
function toolWireText(tool: Tool): string {
	try {
		return JSON.stringify({
			name: tool.name,
			description: tool.description,
			parameters: toolWireSchema(tool),
		});
	} catch {
		return `${tool.name}\n${tool.description ?? ""}`;
	}
}

/**
 * Estimate the current-turn input tokens. On a fresh session (no prior assistant turn) the stable
 * system-prompt + tool-schema overhead is counted once; on resumed turns only the new user/tool
 * messages are counted so the input delta is not inflated by repeated history.
 */
export function estimateKiroInputTokens(context: Context, modelId: string): number {
	const parts = currentTurnMessages(context.messages).map(messageUsageText).filter(Boolean);
	const freshSession = !context.messages.some(m => m.role === "assistant");
	if (freshSession) {
		if (context.systemPrompt?.length) parts.push(...context.systemPrompt);
		if (context.tools?.length) {
			// Count only the wire surface that is actually sent, NOT the full factory tool objects.
			for (const tool of context.tools) parts.push(toolWireText(tool));
		}
	}
	return estimateKiroTokens(parts.join("\n"), modelId);
}

/**
 * Convert a CodeWhisperer `contextUsagePercentage` (0-100) into an absolute total-token count using
 * the model's context window. Returns undefined when either input is missing/zero so callers can
 * fall back to the char-based estimate.
 */
export function contextUsageTotalTokens(
	contextUsagePercentage: number | undefined,
	contextWindow: number | undefined,
): number | undefined {
	if (contextUsagePercentage === undefined || contextUsagePercentage <= 0 || !contextWindow) return undefined;
	return Math.max(0, Math.floor((contextUsagePercentage / 100) * contextWindow));
}

/**
 * Finalize a Kiro usage object in place from heuristic estimates. `input` is the current-turn input
 * estimate; `outputChars` is the accumulated assistant text + thinking + tool-arg length. When the
 * stream surfaced a `contextUsagePercentage`, `totalTokens` is taken from it (a server-derived
 * signal); otherwise it falls back to input + output. Marks the usage as estimated.
 */
export function finalizeKiroUsage(
	usage: Usage,
	args: {
		inputTokens: number;
		outputChars: string;
		modelId: string;
		contextUsagePercentage?: number;
		contextWindow?: number;
	},
): void {
	usage.input = args.inputTokens;
	usage.output = estimateKiroTokens(args.outputChars, args.modelId);
	usage.cacheRead = 0;
	usage.cacheWrite = 0;
	const total = contextUsageTotalTokens(args.contextUsagePercentage, args.contextWindow);
	usage.totalTokens = total ?? usage.input + usage.output;
	usage.estimated = true;
}
