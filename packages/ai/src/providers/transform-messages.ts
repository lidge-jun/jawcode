import turnAbortedGuidance from "../prompts/turn-aborted-guidance.md" with { type: "text" };
import type {
	Api,
	AssistantMessage,
	DeveloperMessage,
	Message,
	Model,
	ToolCall,
	ToolResultMessage,
	UserMessage,
} from "../types";

const enum ToolCallStatus {
	/** Tool call has received a result (real or synthetic for orphan) */
	Resolved = 1,
	/** Tool call was from an aborted message; synthetic result injected, skip real results */
	Aborted = 2,
}

const SENSITIVE_TOKEN_RE =
	/(?<![a-zA-Z0-9_*-])(gh[opusr]_[a-zA-Z0-9_*]{36,}|github_pat_[a-zA-Z0-9_*]{36,}|glpat-[a-zA-Z0-9_*-]{20,}|sk-proj-[a-zA-Z0-9_*-]{36,}|sk-ant-[a-zA-Z0-9_*-]{36,}|sk-[a-zA-Z0-9_*-]{48,})(?![a-zA-Z0-9_*-])/gi;

export interface SensitiveRedactionResult {
	result: unknown;
	changed: boolean;
}

function hasPlausibleCredentialEntropy(token: string): boolean {
	const lower = token.toLowerCase();
	const prefixLength = lower.startsWith("github_pat_")
		? "github_pat_".length
		: lower.startsWith("glpat-")
			? "glpat-".length
			: lower.startsWith("sk-proj-")
				? "sk-proj-".length
				: lower.startsWith("sk-ant-")
					? "sk-ant-".length
					: lower.startsWith("gh")
						? 4
						: 3;
	const secret = token.slice(prefixLength);
	if (/^\*+$/.test(secret)) return true;
	return [/[a-z]/, /[A-Z]/, /\d/, /[_-]/].filter(pattern => pattern.test(secret)).length >= 2;
}

export function redactSensitiveCredentials(text: string): string {
	return text.replace(SENSITIVE_TOKEN_RE, match => {
		if (!hasPlausibleCredentialEntropy(match)) return match;
		const lower = match.toLowerCase();
		if (lower.startsWith("gh")) return "[github_token_redacted]";
		if (lower.startsWith("gl")) return "[gitlab_token_redacted]";
		if (lower.startsWith("sk-ant-")) return "[anthropic_token_redacted]";
		if (lower.startsWith("sk")) return "[openai_token_redacted]";
		return "[token_redacted]";
	});
}

export function redactSensitiveInObject(value: unknown): SensitiveRedactionResult {
	return redactSensitiveInObjectInner(value, new WeakMap<object, SensitiveRedactionResult>());
}

function redactSensitiveInObjectInner(
	value: unknown,
	seen: WeakMap<object, SensitiveRedactionResult>,
): SensitiveRedactionResult {
	if (typeof value === "string") {
		const result = redactSensitiveCredentials(value);
		return { result, changed: result !== value };
	}
	if (value === null || typeof value !== "object") return { result: value, changed: false };

	const cached = seen.get(value);
	if (cached) return cached;

	if (Array.isArray(value)) {
		const result: unknown[] = [];
		const state: SensitiveRedactionResult = { result, changed: false };
		seen.set(value, state);
		for (const item of value) {
			const redacted = redactSensitiveInObjectInner(item, seen);
			result.push(redacted.result);
			state.changed ||= redacted.changed;
		}
		return state;
	}

	const prototype = Object.getPrototypeOf(value);
	if (prototype !== Object.prototype && prototype !== null) return { result: value, changed: false };

	const result: Record<string, unknown> = {};
	const state: SensitiveRedactionResult = { result, changed: false };
	seen.set(value, state);
	for (const [key, item] of Object.entries(value)) {
		const redacted = redactSensitiveInObjectInner(item, seen);
		result[key] = redacted.result;
		state.changed ||= redacted.changed;
	}
	return state;
}

function redactSensitiveCredentialsInMessages(messages: Message[]): Message[] {
	return messages.map((message): Message => {
		if (message.role === "user" || message.role === "developer") {
			const content = message.content;
			if (typeof content === "string") {
				const redacted = redactSensitiveCredentials(content);
				return redacted === content ? message : { ...message, content: redacted };
			}
			let changed = false;
			const redactedContent = content.map(block => {
				if (block.type !== "text") return block;
				const text = redactSensitiveCredentials(block.text);
				if (text === block.text) return block;
				changed = true;
				return { ...block, text };
			});
			return changed ? { ...message, content: redactedContent } : message;
		}

		if (message.role === "toolResult") {
			let changed = false;
			const content = message.content.map(block => {
				if (block.type !== "text") return block;
				const text = redactSensitiveCredentials(block.text);
				if (text === block.text) return block;
				changed = true;
				return { ...block, text };
			});
			return changed ? { ...message, content } : message;
		}

		if (message.role === "assistant") {
			let changed = false;
			const content = message.content.map(block => {
				if (block.type === "text") {
					const text = redactSensitiveCredentials(block.text);
					if (text === block.text) return block;
					changed = true;
					return { ...block, text };
				}
				if (block.type === "thinking") {
					const thinking = redactSensitiveCredentials(block.thinking);
					if (thinking === block.thinking) return block;
					changed = true;
					return { ...block, thinking, thinkingSignature: undefined };
				}
				if (block.type === "toolCall") {
					const redacted = redactSensitiveInObject(block.arguments);
					if (!redacted.changed) return block;
					changed = true;
					return {
						...block,
						arguments: redacted.result as Record<string, unknown>,
						thoughtSignature: undefined,
					};
				}
				return block;
			});
			return changed ? { ...message, content } : message;
		}

		return message;
	});
}

/**
 * Normalize tool call ID for cross-provider compatibility.
 * OpenAI Responses API generates IDs that are 450+ chars with special characters like `|`.
 * Anthropic APIs require IDs matching ^[a-zA-Z0-9_-]+$ (max 64 chars).
 *
 * For aborted/errored turns, this function:
 * - Preserves tool call structure (unlike converting to text summaries)
 * - Injects synthetic "aborted" tool results
 * - Adds a <turn-aborted> guidance marker for the model
 */
/**
 * True when a tool-call name is missing or whitespace-only. Models very
 * occasionally emit `{ "name": "", "arguments": "{}" }` (observed on some
 * thinking-heavy turns). The agent loop rejects the call at execution time
 * with `Tool  not found`, but the malformed block plus its error `toolResult`
 * otherwise stay in the replayed history and 400 every provider on
 * `tool_use.name` / `tool_calls[i].function.name` validation — wedging the
 * session in an unrecoverable loop until a manual clear.
 */
function isMalformedToolCallName(name: string | undefined): boolean {
	return !name || name.trim().length === 0;
}

/**
 * Strip malformed (empty-name) tool calls and their paired results from the
 * replayed history. `transformMessages` is the canonical sanitize boundary
 * every provider funnels through, so the defensive filter lives here.
 *
 * Run before any other transform so the rest of the pipeline never sees a
 * malformed call. Idempotent: a re-run on an already-sanitized list returns
 * the input untouched. Provider-agnostic — any wire model could surface this.
 */
function sanitizeMalformedToolCalls(messages: Message[]): Message[] {
	// Fast path: skip the rewrite entirely when nothing is malformed.
	let hasMalformed = false;
	outer: for (const msg of messages) {
		if (msg.role !== "assistant") continue;
		for (const block of msg.content) {
			if (block.type === "toolCall" && isMalformedToolCallName(block.name)) {
				hasMalformed = true;
				break outer;
			}
		}
	}
	if (!hasMalformed) return messages;

	// Positional FIFO pairing within one assistant->tool-result window: a
	// tool-call id can repeat across history when an OpenAI-Responses composite
	// id (`callId|itemId`) collapses on the wire to the same `callId`. A
	// set-based "drop every result for this id" loses the real output for the
	// surviving valid occurrence whenever one duplicate is malformed. Track each
	// `toolCall` occurrence's malformed-ness on a per-id queue and pop on the
	// matching `toolResult`, but clear the queues at every non-result boundary
	// so a malformed call whose rejection result never arrived cannot consume a
	// later valid call's real result when the id is reused.
	const dropQueues = new Map<string, boolean[]>();
	const result: Message[] = [];
	for (const msg of messages) {
		if (msg.role === "assistant") {
			dropQueues.clear();
			const filtered: AssistantMessage["content"] = [];
			for (const block of msg.content) {
				if (block.type === "toolCall") {
					const malformed = isMalformedToolCallName(block.name);
					const queue = dropQueues.get(block.id);
					if (queue) queue.push(malformed);
					else dropQueues.set(block.id, [malformed]);
					if (malformed) continue;
				}
				filtered.push(block);
			}
			if (filtered.length === 0) continue;
			result.push(filtered.length === msg.content.length ? msg : { ...msg, content: filtered });
			continue;
		}
		if (msg.role === "toolResult") {
			const queue = dropQueues.get(msg.toolCallId);
			if (queue && queue.length > 0) {
				const drop = queue.shift() === true;
				if (queue.length === 0) dropQueues.delete(msg.toolCallId);
				if (drop) continue;
			}
			result.push(msg);
			continue;
		}
		dropQueues.clear();
		result.push(msg);
	}
	return result;
}

export function transformMessages<TApi extends Api>(
	messages: Message[],
	model: Model<TApi>,
	normalizeToolCallId?: (id: string, model: Model<TApi>, source: AssistantMessage) => string,
	options?: { repairLatestAssistantThinking?: boolean },
): Message[] {
	// Provider request builders share this boundary, so redact before any
	// provider-specific replay normalization or serialization occurs.
	messages = redactSensitiveCredentialsInMessages(messages);

	// Drop malformed (empty-name) tool calls and their paired results before any
	// other transform — replays of these 400 every provider on tool-name
	// validation and wedge the session in an unrecoverable loop.
	messages = sanitizeMalformedToolCalls(messages);

	// Build a map of original tool call IDs to normalized IDs
	const toolCallIdMap = new Map<string, string>();

	const latestAssistantIndex = messages.findLastIndex(msg => msg.role === "assistant");
	// First pass: transform messages (thinking blocks, tool call ID normalization)
	const transformed = messages.map((msg, index) => {
		// User and developer messages pass through unchanged
		if (msg.role === "user" || msg.role === "developer") {
			return msg;
		}

		// Handle toolResult messages - normalize toolCallId if we have a mapping
		if (msg.role === "toolResult") {
			const normalizedId = toolCallIdMap.get(msg.toolCallId);
			if (normalizedId && normalizedId !== msg.toolCallId) {
				return { ...msg, toolCallId: normalizedId };
			}
			return msg;
		}

		// Assistant messages need transformation check
		if (msg.role === "assistant") {
			const assistantMsg = msg as AssistantMessage;
			const isSameModel =
				assistantMsg.provider === model.provider &&
				assistantMsg.api === model.api &&
				assistantMsg.model === model.id;

			const mustPreserveLatestAnthropicThinking =
				index === latestAssistantIndex &&
				model.api === "anthropic-messages" &&
				assistantMsg.api === "anthropic-messages";
			// Aborted/errored messages may contain partially-streamed thinking blocks.
			// Anthropic requires thinking/redacted_thinking bytes in replayed assistant
			// messages to match the original response exactly; stripping a signature,
			// well-forming text, or keeping a partial redacted block would emit a
			// modified thinking sequence. Drop those private blocks instead. Tool calls
			// are kept so the second pass can either preserve real results or synthesize
			// an explicit aborted result without leaving dangling tool_use blocks.
			const hasPartialThinking = assistantMsg.stopReason === "aborted" || assistantMsg.stopReason === "error";
			const dropLatestAssistantThinking =
				options?.repairLatestAssistantThinking === true &&
				index === latestAssistantIndex &&
				model.api === "anthropic-messages" &&
				assistantMsg.api === "anthropic-messages";

			const transformedContent = assistantMsg.content.flatMap(block => {
				if (block.type === "thinking") {
					if (hasPartialThinking || dropLatestAssistantThinking) return [];
					const sanitized = block;
					if (mustPreserveLatestAnthropicThinking) return sanitized;
					// For same model: keep thinking blocks with signatures (needed for replay)
					// even if the thinking text is empty (OpenAI encrypted reasoning)
					if (isSameModel && sanitized.thinkingSignature) return sanitized;
					// Skip empty thinking blocks, convert others to plain text
					if (!sanitized.thinking || sanitized.thinking.trim() === "") return [];
					if (isSameModel) return sanitized;
					return {
						type: "text" as const,
						text: sanitized.thinking,
					};
				}

				if (block.type === "redactedThinking") {
					if (hasPartialThinking || dropLatestAssistantThinking) return [];
					if (mustPreserveLatestAnthropicThinking) return block;
					if (isSameModel) return block;
					return [];
				}

				if (block.type === "text") {
					if (isSameModel) return block;
					return {
						type: "text" as const,
						text: block.text,
					};
				}

				if (block.type === "toolCall") {
					const toolCall = block as ToolCall;
					let normalizedToolCall: ToolCall = toolCall;

					if (!isSameModel && toolCall.thoughtSignature) {
						normalizedToolCall = { ...toolCall };
						delete (normalizedToolCall as { thoughtSignature?: string }).thoughtSignature;
					}

					if (!isSameModel && normalizeToolCallId) {
						const normalizedId = normalizeToolCallId(toolCall.id, model, assistantMsg);
						if (normalizedId !== toolCall.id) {
							toolCallIdMap.set(toolCall.id, normalizedId);
							normalizedToolCall = { ...normalizedToolCall, id: normalizedId };
						}
					}

					return normalizedToolCall;
				}

				return block;
			});

			return {
				...assistantMsg,
				content: transformedContent,
			};
		}
		return msg;
	});
	const realToolResultIds = new Set(
		transformed.filter((msg): msg is ToolResultMessage => msg.role === "toolResult").map(msg => msg.toolCallId),
	);

	// Anthropic rejects `tool_result` blocks whose `tool_use_id` does not appear in a prior
	// `tool_use` block. After handoff/compaction folds an assistant turn into a summary
	// string, the user-side `toolResult` for that turn can survive while the originating
	// `tool_use` disappears — leaving an orphan that triggers HTTP 400. Track the set of
	// `tool_use` ids that survive transformation so the second pass can drop orphans cleanly.
	const validToolUseIds = new Set<string>();
	for (const msg of transformed) {
		if (msg.role !== "assistant") continue;
		for (const block of msg.content) {
			if (block.type === "toolCall") validToolUseIds.add(block.id);
		}
	}

	// Second pass: insert synthetic empty tool results for orphaned tool calls
	// and preserve aborted/errored tool results when they were already persisted.
	const result: Message[] = [];
	let pendingToolCalls: ToolCall[] = [];
	let pendingAbortedToolCalls = new Map<string, ToolCall>();
	let pendingAbortedTimestamp: number | undefined;
	// Track tool call status: whether resolved (has result) or aborted (synthetic result injected, skip later real results)
	const toolCallStatus = new Map<string, ToolCallStatus>();

	const flushPendingToolCalls = (timestamp: number): void => {
		if (pendingToolCalls.length === 0) return;
		for (const tc of pendingToolCalls) {
			if (!toolCallStatus.has(tc.id) && !realToolResultIds.has(tc.id)) {
				result.push({
					role: "toolResult",
					toolCallId: tc.id,
					toolName: tc.name,
					content: [{ type: "text", text: "No result provided" }],
					isError: true,
					timestamp,
				} as ToolResultMessage);
				toolCallStatus.set(tc.id, ToolCallStatus.Resolved);
			}
		}
		pendingToolCalls = [];
	};

	const flushPendingAbortedToolCalls = (): void => {
		if (pendingAbortedTimestamp === undefined) return;
		for (const tc of pendingAbortedToolCalls.values()) {
			if (!toolCallStatus.has(tc.id)) {
				result.push({
					role: "toolResult",
					toolCallId: tc.id,
					toolName: tc.name,
					content: [{ type: "text", text: "aborted" }],
					isError: true,
					timestamp: pendingAbortedTimestamp,
				} as ToolResultMessage);
				toolCallStatus.set(tc.id, ToolCallStatus.Aborted);
			}
		}
		result.push({
			role: "developer",
			content: turnAbortedGuidance,
			timestamp: pendingAbortedTimestamp + 1,
		} as DeveloperMessage);
		pendingAbortedToolCalls = new Map();
		pendingAbortedTimestamp = undefined;
	};

	for (let i = 0; i < transformed.length; i++) {
		const msg = transformed[i];
		const messageTimestamp = "timestamp" in msg && typeof msg.timestamp === "number" ? msg.timestamp : Date.now();

		if (msg.role === "assistant") {
			flushPendingToolCalls(messageTimestamp);
			flushPendingAbortedToolCalls();

			const assistantMsg = msg as AssistantMessage;
			const toolCalls = assistantMsg.content.filter(b => b.type === "toolCall") as ToolCall[];

			if (assistantMsg.stopReason === "error" || assistantMsg.stopReason === "aborted") {
				// Keep the assistant message with tool calls intact. If real tool results follow, preserve them;
				// otherwise synthesize aborted results before the next turn boundary.
				result.push(msg);
				pendingAbortedToolCalls = new Map(toolCalls.map(toolCall => [toolCall.id, toolCall] as const));
				pendingAbortedTimestamp = assistantMsg.timestamp;
				continue;
			}

			if (toolCalls.length > 0) {
				pendingToolCalls = toolCalls;
			}

			result.push(msg);
		} else if (msg.role === "toolResult") {
			if (pendingAbortedToolCalls.has(msg.toolCallId)) {
				pendingAbortedToolCalls.delete(msg.toolCallId);
				toolCallStatus.set(msg.toolCallId, ToolCallStatus.Resolved);
				result.push(msg);
				continue;
			}

			if (toolCallStatus.get(msg.toolCallId) === ToolCallStatus.Aborted) continue;

			if (!validToolUseIds.has(msg.toolCallId)) {
				// Orphan `tool_result`: the originating `tool_use` is not present in the
				// transformed history (typically because handoff/compaction folded the
				// assistant message into a summary string while the user-side result
				// survived). Sending the block as-is would 400 the request, so it must
				// be dropped.
				//
				// If a pending tool-call window is still open (either normal or
				// aborted), the orphan cannot be replaced with a developer note here:
				//
				// * Anthropic requires the next message after an assistant `tool_use`
				//   to be the matching `tool_result`. Inserting a developer message
				//   would break that contiguity.
				// * `flushPendingAbortedToolCalls` synthesizes "aborted" results
				//   without checking whether a real result lands later in history
				//   (unlike `flushPendingToolCalls`, which is gated by
				//   `realToolResultIds`). Calling it here would convert a legitimate
				//   later `tool_result` into a synthetic "aborted" one via the
				//   `ToolCallStatus.Aborted` skip-guard.
				//
				// Drop the orphan silently in that case; the upcoming real
				// `tool_result` will land normally on the next iteration.
				if (pendingToolCalls.length > 0 || pendingAbortedToolCalls.size > 0) {
					continue;
				}
				// No pending tool-call window: safe to preserve the text payload so the
				// model still sees what the tool returned.
				//
				// The note is emitted with `role: "user"` rather than `role: "developer"`
				// because the developer role is elevated by some providers:
				//
				// * Ollama maps `developer` -> `system` (highest instruction priority).
				// * OpenAI chat-completions reasoning models forward `developer` as
				//   `developer` (above-user instruction priority).
				//
				// Stale, model-untrusted tool output must not gain instruction priority
				// above user/developer messages it lived alongside before compaction.
				// `user` role is mapped to plain user content by every provider, so the
				// content survives without ever being treated as an instruction the
				// model should obey.
				const textParts: string[] = [];
				for (const part of msg.content) {
					if (part.type === "text" && part.text.trim() !== "") textParts.push(part.text);
				}
				if (textParts.length > 0) {
					const errorAttr = msg.isError ? ' is-error="true"' : "";
					result.push({
						role: "user",
						content: `<stale-tool-result tool="${msg.toolName}" id="${msg.toolCallId}"${errorAttr}>\n${textParts.join("\n")}\n</stale-tool-result>`,
						timestamp: messageTimestamp,
					} as UserMessage);
				}
				continue;
			}

			toolCallStatus.set(msg.toolCallId, ToolCallStatus.Resolved);
			result.push(msg);
		} else if (msg.role === "user" || msg.role === "developer") {
			flushPendingToolCalls(messageTimestamp);
			flushPendingAbortedToolCalls();
			result.push(msg);
		} else {
			flushPendingToolCalls(messageTimestamp);
			flushPendingAbortedToolCalls();
			result.push(msg);
		}
	}

	flushPendingToolCalls(Date.now());
	flushPendingAbortedToolCalls();

	return result;
}
