/**
 * Kiro (AWS CodeWhisperer Streaming) provider.
 *
 * Talks to `runtime.{region}.kiro.dev` with Bearer auth, impersonating the
 * Kiro IDE client. Decodes `application/vnd.amazon.eventstream` responses via
 * the shared decoder in `./aws-eventstream.ts`.
 *
 * No `@aws-sdk/*` dependencies — SigV4 is NOT required (Bearer auth only).
 */

import { createHash, randomUUID } from "node:crypto";
import { hostname, userInfo } from "node:os";
import { $env, fetchWithRetry } from "@jawcode-dev/utils";
import type { Effort } from "../model-thinking";
import { calculateCost } from "../models";
import type {
	AssistantMessage,
	Context,
	ImageContent,
	Model,
	ProviderSessionState,
	StreamFunction,
	StreamOptions,
	TextContent,
	Tool,
	ToolCall,
	ToolResultMessage,
	Usage,
} from "../types";
import { normalizeToolCallId } from "../utils";
import { AssistantMessageEventStream } from "../utils/event-stream";
import { withHttpStatus } from "../utils/http-inspector";
import { resolveRetryBudget } from "../utils/retry-budget";
import { toolWireSchema } from "../utils/schema/wire";
import { decodeEventStream } from "./aws-eventstream";
import { safeKiroErrorMessage, safeKiroHttpErrorMessage } from "./kiro-errors";
import { KiroThinkingParser } from "./kiro-thinking";
import { isCompleteKiroToolInput, kiroTruncationErrorMessage, kiroTruncationReason } from "./kiro-truncation";
import { estimateKiroInputTokens, finalizeKiroUsage } from "./kiro-usage";
import { NON_VISION_IMAGE_PLACEHOLDER } from "./vision-guard";

// ---------------------------------------------------------------------------
// Options
// ---------------------------------------------------------------------------

export interface KiroOptions extends StreamOptions {
	region?: string;
	accessToken?: string;
	profileArn?: string;
	spoofVersion?: string;
	reasoning?: Effort;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const DEFAULT_REGION = "us-east-1";
const KIRO_HOST_TEMPLATE = "https://runtime.{region}.kiro.dev";
const AMZ_TARGET = "AmazonCodeWhispererStreamingService.GenerateAssistantResponse";
const SDK_VERSION = "1.0.27";
const NODE_VERSION = "22.21.1";
const KIRO_IDE_VERSION = "1.2.0";
const DARWIN_VERSION = () => {
	try {
		return require("node:os").release();
	} catch {
		return "24.0.0";
	}
};
const OS_TAG = () => {
	const p = process.platform;
	if (p === "darwin") return `macos#${DARWIN_VERSION()}`;
	if (p === "win32") return "win32#10.0.26100";
	return `linux#6.8.0`;
};

// ---------------------------------------------------------------------------
// Anti-detection: fingerprint & headers
// ---------------------------------------------------------------------------

let cachedFingerprint: string | undefined;
function getMachineFingerprint(): string {
	if (cachedFingerprint) return cachedFingerprint;
	try {
		const hn = hostname();
		const un = userInfo().username;
		cachedFingerprint = createHash("sha256").update(`${hn}-${un}-kiro-jwc`).digest("hex");
	} catch {
		cachedFingerprint = createHash("sha256").update("default-kiro-jwc").digest("hex");
	}
	return cachedFingerprint;
}

function buildHeaders(token: string, version: string, profileArn?: string): Record<string, string> {
	const fp = getMachineFingerprint().slice(0, 64);
	const os = OS_TAG();
	const headers: Record<string, string> = {
		authorization: `Bearer ${token}`,
		"content-type": "application/x-amz-json-1.0",
		accept: "application/vnd.amazon.eventstream",
		"x-amz-target": AMZ_TARGET,
		"user-agent": `aws-sdk-js/${SDK_VERSION} ua/2.1 os/${os} lang/js md/nodejs#${NODE_VERSION} api/codewhispererstreaming#${SDK_VERSION} m/E KiroIDE-${version}-${fp}`,
		"x-amz-user-agent": `aws-sdk-js/${SDK_VERSION} KiroIDE-${version}-${fp}`,
		"x-amzn-codewhisperer-optout": "true",
		"x-amzn-kiro-agent-mode": "vibe",
		"amz-sdk-invocation-id": randomUUID(),
		"amz-sdk-request": "attempt=1; max=3",
	};
	if (profileArn) {
		headers["x-amzn-kiro-profile-arn"] = profileArn;
	}
	return headers;
}

// ---------------------------------------------------------------------------
// Payload construction
// ---------------------------------------------------------------------------

interface KiroToolSpec {
	toolSpecification: {
		name: string;
		description: string;
		inputSchema: { json: Record<string, unknown> };
	};
}

// Strip JSON-Schema fields CodeWhisperer/Bedrock rejects (additionalProperties, empty required[]).
// Recurses so nested object schemas are cleaned too.
function sanitizeKiroSchema(value: unknown): unknown {
	if (Array.isArray(value)) return value.map(sanitizeKiroSchema);
	if (!value || typeof value !== "object") return value;
	const out: Record<string, unknown> = {};
	for (const [key, child] of Object.entries(value as Record<string, unknown>)) {
		if (key === "additionalProperties") continue;
		if (key === "required" && Array.isArray(child) && child.length === 0) continue;
		out[key] = sanitizeKiroSchema(child);
	}
	return out;
}

// Bedrock requires `inputSchema.json.type` to be "object" and rejects oneOf/allOf/anyOf at the top
// level ("input_schema does not support oneOf, allOf, or anyOf at the top level"). Flatten any root
// composition into a single object schema by merging variant properties. Required is unioned only
// for allOf (AND semantics); anyOf/oneOf (OR) leave it off so a valid single-branch call passes.
function ensureRootObjectType(schema: unknown): Record<string, unknown> {
	const obj =
		schema && typeof schema === "object" && !Array.isArray(schema) ? (schema as Record<string, unknown>) : {};
	const COMPOSITION_KEYS = ["oneOf", "anyOf", "allOf"] as const;
	const hasComposition = COMPOSITION_KEYS.some(k => Array.isArray(obj[k]));
	const t = obj.type;
	if (!hasComposition) {
		if (t === "object") return obj;
		return { ...obj, type: "object" };
	}

	const props: Record<string, unknown> = {};
	const required = new Set<string>();
	// Seed with the root's own properties/required so a schema like
	// { type:"object", properties:{path}, required:["path"], oneOf:[...] } keeps them.
	if (obj.properties && typeof obj.properties === "object") {
		Object.assign(props, sanitizeKiroSchema(obj.properties) as Record<string, unknown>);
	}
	if (Array.isArray(obj.required)) {
		for (const r of obj.required) if (typeof r === "string") required.add(r);
	}
	for (const key of COMPOSITION_KEYS) {
		const variants = obj[key];
		if (!Array.isArray(variants)) continue;
		// allOf is conjunction: its required always applies. oneOf/anyOf are disjunction, so
		// promoting their required would over-constrain a valid single-branch call.
		const mergeRequired = key === "allOf";
		for (const variant of variants) {
			if (!variant || typeof variant !== "object" || Array.isArray(variant)) continue;
			const v = variant as Record<string, unknown>;
			if (v.properties && typeof v.properties === "object") {
				Object.assign(props, sanitizeKiroSchema(v.properties) as Record<string, unknown>);
			}
			if (mergeRequired && Array.isArray(v.required)) {
				for (const r of v.required) if (typeof r === "string") required.add(r);
			}
		}
	}

	// Keep non-composition sibling keys (description, $defs, definitions, etc.); replace
	// type/properties/required with the flattened object form.
	const merged: Record<string, unknown> = {};
	for (const [key, child] of Object.entries(obj)) {
		if (key === "oneOf" || key === "anyOf" || key === "allOf") continue;
		if (key === "type" || key === "properties" || key === "required") continue;
		merged[key] = child;
	}
	merged.type = "object";
	if (Object.keys(props).length > 0) merged.properties = props;
	if (required.size > 0) merged.required = [...required];
	return merged;
}

const MAX_KIRO_TOOL_DESCRIPTION = 1024;

// Convert tools to CodeWhisperer toolSpecifications. A description longer than the Kiro limit is NOT
// hard-truncated (that silently drops guidance the model needs); instead it is moved verbatim into
// the system prompt and replaced with a short pointer, matching the opencodex adapter.
function convertTools(tools: Tool[]): { specs: KiroToolSpec[]; systemAdditions: string[] } {
	const systemAdditions: string[] = [];
	const specs = tools.map(t => {
		const description = t.description || `Tool: ${t.name}`;
		const overLimit = description.length > MAX_KIRO_TOOL_DESCRIPTION;
		if (overLimit) {
			systemAdditions.push([`### Tool documentation: ${t.name}`, description].join("\n"));
		}
		return {
			toolSpecification: {
				// Tool names are sent verbatim. CodeWhisperer accepts the full name, and
				// truncating to 64 chars silently breaks long MCP / Computer Use tool names
				// (the model echoes a name the harness can no longer match to a tool).
				name: t.name,
				description: overLimit ? `Tool documentation moved to the system prompt: ${t.name}.` : description,
				inputSchema: { json: ensureRootObjectType(sanitizeKiroSchema(toolWireSchema(t))) },
			},
		};
	});
	return { specs, systemAdditions };
}

interface KiroToolUse {
	name: string;
	// CodeWhisperer expects `input` as a JSON object (document), not a stringified
	// JSON. Sending a string here produces `"input": "{...}"` and the server
	// rejects the whole request with REQUEST_BODY_INVALID.
	input: Record<string, unknown>;
	toolUseId: string;
}

interface KiroToolResult {
	content: Array<{ text: string }>;
	status: string;
	toolUseId: string;
}

// CodeWhisperer native image part (matches the Kiro IDE wire format): the base64 bytes live directly
// on `userInputMessage.images`, NOT inside `userInputMessageContext`. Verified against kiro-gateway.
interface KiroImage {
	format: string; // "jpeg" | "png" | "webp" | "gif" — the media subtype
	source: { bytes: string }; // pure base64, no "data:...;base64," prefix
}

// jawcode normalizes images to base64 `data` + `mimeType`, so (unlike a data URL) the bytes are
// already inline. We only derive the CodeWhisperer `format` from the mime subtype.
function toKiroImage(image: ImageContent): KiroImage | undefined {
	if (!image.data) return undefined;
	// Strip any media-type parameters (e.g. "image/png; charset=...") before taking the subtype.
	const baseType = (image.mimeType ?? "").split(";")[0];
	const subtype = baseType.includes("/") ? baseType.split("/")[1] : baseType;
	const normalized = (subtype || "jpeg").toLowerCase();
	// CodeWhisperer/Bedrock expects "jpeg", not the "jpg" alias.
	const format = normalized === "jpg" ? "jpeg" : normalized;
	return { format, source: { bytes: image.data } };
}

function extractKiroImages(content: ReadonlyArray<TextContent | ImageContent>): KiroImage[] {
	const out: KiroImage[] = [];
	for (const part of content) {
		if (part.type !== "image") continue;
		const img = toKiroImage(part);
		if (img) out.push(img);
	}
	return out;
}

interface KiroUserInputMessageContext {
	tools?: KiroToolSpec[];
	toolResults?: KiroToolResult[];
}

interface KiroUserInputMessage {
	content: string;
	modelId?: string;
	origin?: string;
	userInputMessageContext?: KiroUserInputMessageContext;
	images?: KiroImage[];
}

interface KiroHistoryEntry {
	userInputMessage?: KiroUserInputMessage;
	assistantResponseMessage?: { content: string; toolUses?: KiroToolUse[] };
}

interface BuildPayloadOptions {
	currentTurnOnly?: boolean;
	reasoning?: Effort;
	maxTokens?: number;
	// Whether the target model accepts image input. When false, images are dropped from the wire and
	// a short placeholder is appended so the model still knows an image was present.
	supportsImages?: boolean;
}

const KIRO_THINKING_RATIO: Record<Effort, number> = {
	minimal: 0.1,
	low: 0.2,
	medium: 0.5,
	high: 0.8,
	xhigh: 0.95,
	max: 0.95,
};

function kiroThinkingBudget(options?: BuildPayloadOptions): number | undefined {
	if (!options?.reasoning) return undefined;
	const ratio = KIRO_THINKING_RATIO[options.reasoning];
	if (ratio === undefined) return undefined;
	const maxTokens = options.maxTokens || 4096;
	return Math.max(1, Math.floor(maxTokens * ratio));
}

function injectKiroThinkingTags(content: string, options?: BuildPayloadOptions): string {
	const budget = kiroThinkingBudget(options);
	if (!budget) return content;
	const instruction = [
		"Think in English for better reasoning quality.",
		"Be thorough and systematic, consider edge cases, challenge assumptions, and verify reasoning before answering.",
		"After thinking, respond in the user's language.",
	].join("\n");
	return [
		"<thinking_mode>enabled</thinking_mode>",
		`<max_thinking_length>${budget}</max_thinking_length>`,
		`<thinking_instruction>${instruction}</thinking_instruction>`,
		"",
		content,
	].join("\n");
}

/**
 * Decide whether the synthetic <thinking_mode> prompt should ride on the current user turn.
 *
 * Parity with opencodex `shouldInjectKiroThinkingTags` (commit b496629 "skip fake thinking in tool
 * mode"). The synthetic prompt is only appropriate for a real free-form user turn:
 *   - turns carrying toolResults must answer the tool, not be told to re-think;
 *   - when tools are advertised the synthetic prompt can keep Kiro silent before the first
 *     tool/exec event (it waits for a thinking block that never comes);
 *   - the empty "(continue)" placeholder turn has no user intent to think about.
 * Natural leading <thinking> blocks the model emits are still parsed back by KiroThinkingParser.
 */
function shouldInjectKiroThinkingTags(uim: KiroUserInputMessage, toolsAdvertised: boolean): boolean {
	if (uim.userInputMessageContext?.toolResults?.length) return false;
	if (toolsAdvertised) return false;
	if (uim.content === "(continue)") return false;
	return true;
}

/**
 * Build the `conversationState` payload for `GenerateAssistantResponse`.
 *
 * CodeWhisperer enforces two structural rules that a naive flat conversion
 * violates and that surface as `REQUEST_BODY_INVALID` / "Improperly formed
 * request" on multi-round or parallel tool-call conversations:
 *
 *   1. `history` must strictly alternate user / assistant turns.
 *   2. Each `toolResult` must ride on the `userInputMessage` that immediately
 *      follows the `assistantResponseMessage` whose `toolUses` it answers, and
 *      its `toolUseId` must match that toolUse exactly.
 *
 * We therefore interleave tool results back into history (delivering any
 * outstanding results in their own user turn before the next assistant turn),
 * and normalize the tool-use id on BOTH sides so they always match.
 */
export function buildPayload(
	context: Context,
	modelId: string,
	conversationId: string,
	profileArn: string,
	options?: BuildPayloadOptions,
): Record<string, unknown> {
	const { specs: kiroTools, systemAdditions } = context.tools
		? convertTools(context.tools)
		: { specs: [] as KiroToolSpec[], systemAdditions: [] as string[] };

	// `systemPrompt` is a string[]; join with blank lines instead of relying on Array.toString()
	// (which would comma-join multiple system prompts). The base system prompt is dropped on resumed
	// (currentTurnOnly) turns, but tool-description additions must always ride along — the tools are
	// re-advertised every turn, so their moved-out docs have to travel with them.
	const baseSystem =
		!options?.currentTurnOnly && context.systemPrompt?.length ? context.systemPrompt.join("\n\n") : "";
	const systemParts: string[] = [];
	if (baseSystem) systemParts.push(baseSystem);
	if (systemAdditions.length > 0) systemParts.push(...systemAdditions);
	const systemPrefix = systemParts.length > 0 ? `${systemParts.join("\n\n")}\n\n` : "";

	const supportsImages = options?.supportsImages !== false;
	const mkUser = (content: string, images?: KiroImage[]): KiroHistoryEntry => ({
		userInputMessage: {
			content,
			modelId,
			origin: "AI_EDITOR",
			...(images && images.length > 0 ? { images } : {}),
		},
	});

	const history: KiroHistoryEntry[] = [];
	let pending: KiroToolResult[] = [];
	let pendingImages: KiroImage[] = [];
	let lastRole = "";

	// Attach buffered tool results (from the preceding assistant turn) to a user entry.
	const attachPending = (entry: KiroHistoryEntry): void => {
		if (pending.length === 0) return;
		const uim = entry.userInputMessage!;
		uim.userInputMessageContext = { ...(uim.userInputMessageContext ?? {}), toolResults: pending };
		// CodeWhisperer cannot embed images inside a toolResult, but it does accept sibling images on
		// the same userInputMessage, so tool-result screenshots ride along here instead of being lost.
		if (pendingImages.length > 0) uim.images = [...(uim.images ?? []), ...pendingImages];
		pending = [];
		pendingImages = [];
	};

	for (const msg of context.messages) {
		if (msg.role === "user" || msg.role === "developer") {
			let text: string;
			let images: KiroImage[] = [];
			if (typeof msg.content === "string") {
				text = msg.content;
			} else {
				const textParts = msg.content.filter((c): c is TextContent => c.type === "text").map(c => c.text);
				images = supportsImages ? extractKiroImages(msg.content) : [];
				const omittedImages = !supportsImages && msg.content.some(c => c.type === "image");
				text = textParts.join("\n");
				if (omittedImages) text = [text, NON_VISION_IMAGE_PLACEHOLDER].filter(Boolean).join("\n");
			}
			// Only insert a synthetic assistant turn for two genuinely consecutive
			// user messages — never when this user turn is carrying tool results.
			if (pending.length === 0 && lastRole === "user") {
				history.push({ assistantResponseMessage: { content: "(acknowledged)" } });
			}
			const entry = mkUser(text, images);
			attachPending(entry);
			history.push(entry);
			lastRole = "user";
		} else if (msg.role === "assistant") {
			// Deliver any outstanding tool results in their own user turn BEFORE the
			// next assistant turn, so toolUses/toolResults stay adjacent and aligned.
			if (pending.length > 0) {
				const carrier = mkUser("(tool results)");
				attachPending(carrier);
				history.push(carrier);
				lastRole = "user";
			}
			const aMsg = msg as AssistantMessage;
			const textParts = (aMsg.content || []).filter((b): b is TextContent => b.type === "text");
			const text = textParts.map(b => b.text).join("");
			const toolUses: KiroToolUse[] = (aMsg.content || [])
				.filter((b): b is ToolCall => b.type === "toolCall")
				.map(tc => ({
					name: tc.name,
					input: (tc.arguments ?? {}) as Record<string, unknown>,
					toolUseId: normalizeToolCallId(tc.id),
				}));
			if (lastRole === "assistant") {
				history.push(mkUser("(continue)"));
			}
			const entry: KiroHistoryEntry = { assistantResponseMessage: { content: text } };
			if (toolUses.length > 0) entry.assistantResponseMessage!.toolUses = toolUses;
			history.push(entry);
			lastRole = "assistant";
		} else if (msg.role === "toolResult") {
			const trMsg = msg as ToolResultMessage;
			const parts = trMsg.content.map(c => (c.type === "text" ? c.text : "")).filter(Boolean);
			const images = supportsImages ? extractKiroImages(trMsg.content) : [];
			const omittedImages = !supportsImages && trMsg.content.some(c => c.type === "image");
			let resultText = parts.join("\n");
			if (omittedImages) resultText = [resultText, NON_VISION_IMAGE_PLACEHOLDER].filter(Boolean).join("\n");
			pending.push({
				content: [{ text: resultText || "(empty)" }],
				status: trMsg.isError ? "error" : "success",
				toolUseId: normalizeToolCallId(trMsg.toolCallId),
			});
			if (images.length > 0) pendingImages.push(...images);
		}
	}

	// Resolve the active (current) user turn.
	let currentEntry: KiroHistoryEntry;
	if (pending.length > 0) {
		// Conversation ended awaiting the model's reply to the latest tool results.
		currentEntry = mkUser("(tool results)");
		attachPending(currentEntry);
	} else if (history.length > 0 && history[history.length - 1].userInputMessage) {
		currentEntry = history.pop()!;
	} else {
		currentEntry = mkUser("(continue)");
	}
	const currentUim = currentEntry.userInputMessage!;
	if (options?.currentTurnOnly) {
		// Resumed turn: drop repeated history. But if the current message carries toolResults, Kiro
		// requires the assistant turn whose toolUses they answer to remain adjacent — dropping it
		// orphans the results and triggers a CodeWhisperer 400. Keep that one assistant turn (and a
		// leading user turn if present so history still starts on a user role).
		const currentHasToolResults = Boolean(currentUim.userInputMessageContext?.toolResults?.length);
		if (currentHasToolResults && history.length > 0) {
			let start = history.length - 1;
			while (start >= 0 && !history[start].assistantResponseMessage?.toolUses?.length) start -= 1;
			if (start >= 0) {
				// Include a user turn immediately before the assistant turn so the kept history slice
				// still alternates user/assistant from the start.
				if (start > 0 && history[start - 1].userInputMessage) start -= 1;
				history.splice(0, start);
			} else {
				history.length = 0;
			}
		} else {
			history.length = 0;
		}
	}

	// Prepend the system prefix (base prompt + moved tool docs) to the earliest user turn. On
	// currentTurnOnly turns history is already empty, so it lands on the current message; baseSystem
	// is excluded from systemPrefix in that case but tool-doc additions still travel.
	if (systemPrefix) {
		const firstUser = history.find(e => e.userInputMessage)?.userInputMessage;
		if (firstUser) {
			firstUser.content = systemPrefix + firstUser.content;
		} else {
			currentUim.content = systemPrefix + currentUim.content;
		}
	}

	// Synthetic <thinking_mode> tags are injected only on a genuine free-form user turn. They are
	// skipped when (a) the turn carries toolResults (the model must answer the tool, not re-think),
	// (b) tools are being advertised (the synthetic prompt can keep Kiro silent before the first
	// tool/exec event), or (c) the turn is the empty "(continue)" placeholder. Natural leading
	// <thinking> blocks emitted by the model are still routed by KiroThinkingParser on the way back.
	// Parity with opencodex `shouldInjectKiroThinkingTags` (commit b496629).
	if (shouldInjectKiroThinkingTags(currentUim, kiroTools.length > 0)) {
		currentUim.content = injectKiroThinkingTags(currentUim.content, options);
	}

	// Tools are advertised on the current message's context.
	if (kiroTools.length > 0) {
		currentUim.userInputMessageContext = { ...(currentUim.userInputMessageContext ?? {}), tools: kiroTools };
	}

	const payload: Record<string, unknown> = {
		conversationState: {
			chatTriggerType: "MANUAL",
			conversationId,
			currentMessage: { userInputMessage: currentUim },
			...(history.length > 0 ? { history } : {}),
		},
	};
	if (profileArn) payload.profileArn = profileArn;
	return payload;
}

// ---------------------------------------------------------------------------
// Response parsing
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// Opt-in wire debug — set JWC_KIRO_DEBUG=1 (or =/abs/path.jsonl) to capture the
// outgoing payload and every raw streaming event for diagnosing tool-arg issues.
// ---------------------------------------------------------------------------
function kiroDebugPath(): string | null {
	const v = process.env.JWC_KIRO_DEBUG;
	if (!v) return null;
	return v === "1" || v === "true" ? "/tmp/jwc-kiro-debug.jsonl" : v;
}

function kiroDebugLog(tag: string, data: unknown): void {
	const path = kiroDebugPath();
	if (!path) return;
	try {
		const { appendFileSync } = require("node:fs") as typeof import("node:fs");
		appendFileSync(path, `${JSON.stringify({ t: Date.now(), tag, data })}\n`);
	} catch {
		// Never let debug logging break the request path.
	}
}

interface ParsedKiroEvent {
	type: "content" | "tool_start" | "tool_input" | "tool_stop" | "usage" | "context_usage" | "truncation";
	data?: string;
	name?: string;
	toolUseId?: string;
	input?: string;
	usage?: number;
	contextUsagePercentage?: number;
}

export function parseKiroPayload(raw: Uint8Array): ParsedKiroEvent | null {
	let text: string;
	try {
		text = new TextDecoder().decode(raw);
	} catch {
		return null;
	}
	const trimmed = text.trim();
	if (!trimmed.startsWith("{")) return null;

	let parsed: Record<string, unknown>;
	try {
		parsed = JSON.parse(trimmed);
	} catch {
		return null;
	}

	// An explicit truncation signal (finish/stop reason or `truncated` flag) takes priority: the
	// stream is being cut short, so surface it fail-closed rather than treating the partial as done.
	const truncationReason = kiroTruncationReason(parsed);
	if (truncationReason) return { type: "truncation", data: truncationReason };

	if ("content" in parsed && typeof parsed.content === "string") {
		return { type: "content", data: parsed.content };
	}

	// CodeWhisperer repeats `name` + `toolUseId` on EVERY tool event — the start,
	// each streamed `input` fragment, AND the final `stop` event. We must therefore
	// discriminate by `stop`/`input` presence, NOT by `name`. The old code treated
	// any event with `name` as a fresh tool_start, so every input fragment reset the
	// accumulator and arguments were lost (the empty-{} bug).
	const toolUseId = typeof parsed.toolUseId === "string" ? (parsed.toolUseId as string) : undefined;
	const name = typeof parsed.name === "string" ? (parsed.name as string) : undefined;

	if (parsed.stop === true) {
		return { type: "tool_stop", toolUseId };
	}
	if ("input" in parsed) {
		const input =
			typeof parsed.input === "object" && parsed.input !== null
				? JSON.stringify(parsed.input)
				: typeof parsed.input === "string"
					? (parsed.input as string)
					: "";
		return { type: "tool_input", input, name, toolUseId };
	}
	if (name !== undefined) {
		return { type: "tool_start", name, toolUseId: toolUseId || `toolu_${randomUUID().slice(0, 8)}`, input: "" };
	}
	if (typeof parsed.contextUsagePercentage === "number" && Number.isFinite(parsed.contextUsagePercentage)) {
		// CodeWhisperer periodically reports how full the context window is (0-100). It is the only
		// server-side usage signal CW emits; we convert it to an absolute total-token count on done.
		return { type: "context_usage", contextUsagePercentage: parsed.contextUsagePercentage };
	}
	if ("usage" in parsed) {
		return { type: "usage", usage: parsed.usage as number };
	}
	return null;
}

// ---------------------------------------------------------------------------
// Auth resolution (with caching & auto-refresh)
// ---------------------------------------------------------------------------

const KIRO_REFRESH_URL = "https://prod.{region}.auth.desktop.kiro.dev/refreshToken";
const TOKEN_KEYS = ["kirocli:social:token", "kirocli:odic:token", "codewhisperer:odic:token"];
const DB_PATHS = () => {
	const home = process.env.HOME || "";
	return [`${home}/Library/Application Support/kiro-cli/data.sqlite3`, `${home}/.kiro/sso/cache.db`];
};

interface CachedAuth {
	token: string;
	refreshToken: string;
	profileArn: string;
	expiresAt: number;
	region: string;
}
let authCache: CachedAuth | null = null;

const KIRO_PROVIDER_SESSION_STATE_KEY = "kiro";

interface KiroProviderSessionState extends ProviderSessionState {
	seenConversationKeys: Set<string>;
}

function createKiroProviderSessionState(): KiroProviderSessionState {
	const state: KiroProviderSessionState = {
		seenConversationKeys: new Set(),
		close: () => {
			state.seenConversationKeys.clear();
		},
	};
	return state;
}

function getKiroProviderSessionState(
	providerSessionState: Map<string, ProviderSessionState> | undefined,
): KiroProviderSessionState | undefined {
	if (!providerSessionState) return undefined;
	const existing = providerSessionState.get(KIRO_PROVIDER_SESSION_STATE_KEY) as KiroProviderSessionState | undefined;
	if (existing) return existing;
	const created = createKiroProviderSessionState();
	providerSessionState.set(KIRO_PROVIDER_SESSION_STATE_KEY, created);
	return created;
}

function readKiroCliSqlite(): {
	token: string;
	refreshToken: string;
	profileArn: string;
	expiresAt: number;
	region: string;
} | null {
	const { existsSync } = require("node:fs") as typeof import("node:fs");
	const { Database } = require("bun:sqlite") as typeof import("bun:sqlite");
	for (const dbPath of DB_PATHS()) {
		if (!existsSync(dbPath)) continue;
		let db: InstanceType<typeof Database> | undefined;
		try {
			db = new Database(dbPath, { readonly: true });
			for (const key of TOKEN_KEYS) {
				const row = db.query("SELECT value FROM auth_kv WHERE key = ?").get(key) as { value: string } | null;
				if (!row) continue;
				const data = JSON.parse(row.value) as {
					access_token?: string;
					refresh_token?: string;
					profile_arn?: string;
					expires_at?: string;
					region?: string;
				};
				if (data.access_token) {
					return {
						token: data.access_token,
						refreshToken: data.refresh_token || "",
						profileArn: data.profile_arn || "",
						expiresAt: data.expires_at ? new Date(data.expires_at).getTime() : Date.now() + 3600_000,
						region: data.region || DEFAULT_REGION,
					};
				}
			}
		} catch {
			// Fall through
		} finally {
			db?.close();
		}
	}
	return null;
}

async function refreshKiroDesktopToken(
	refreshToken: string,
	region: string,
): Promise<{ accessToken: string; refreshToken: string; expiresIn: number }> {
	const url = KIRO_REFRESH_URL.replace("{region}", region);
	const res = await fetch(url, {
		method: "POST",
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify({ refreshToken }),
		signal: AbortSignal.timeout(30_000),
	});
	if (!res.ok) throw new Error(`Kiro token refresh failed: ${res.status}`);
	const data = (await res.json()) as { accessToken?: string; refreshToken?: string; expiresIn?: number };
	if (!data.accessToken) throw new Error("Kiro refresh returned no accessToken");
	return {
		accessToken: data.accessToken,
		refreshToken: data.refreshToken || refreshToken,
		expiresIn: data.expiresIn ?? 3600,
	};
}

async function resolveKiroAuth(options: KiroOptions): Promise<{ token: string; profileArn: string }> {
	// 1. Explicit options (bypass cache)
	if (options.accessToken) {
		return { token: options.accessToken, profileArn: resolveProfileArn(options) };
	}

	// 2. jwc OAuth storage — validate token prefix
	if (options.apiKey?.startsWith("aoa")) {
		return { token: options.apiKey, profileArn: resolveProfileArn(options) };
	}

	// 3. Env var
	const envToken = $env.KIRO_ACCESS_TOKEN;
	if (envToken) {
		return { token: envToken, profileArn: resolveProfileArn(options) };
	}

	// 4. Cached auth (with expiry check & auto-refresh)
	if (authCache && Date.now() < authCache.expiresAt - 60_000) {
		return { token: authCache.token, profileArn: authCache.profileArn };
	}

	// 5. If cache expired but has refreshToken, refresh first
	if (authCache?.refreshToken) {
		try {
			const refreshed = await refreshKiroDesktopToken(authCache.refreshToken, authCache.region);
			authCache = {
				token: refreshed.accessToken,
				refreshToken: refreshed.refreshToken,
				profileArn: authCache.profileArn,
				expiresAt: Date.now() + refreshed.expiresIn * 1000,
				region: authCache.region,
			};
			return { token: authCache.token, profileArn: authCache.profileArn };
		} catch {
			authCache = null;
		}
	}

	// 6. prokiro auth.json
	try {
		const { readFileSync } = require("node:fs") as typeof import("node:fs");
		const authFile = `${process.env.HOME}/.prokiro/auth.json`;
		const raw = JSON.parse(readFileSync(authFile, "utf8")) as {
			accessToken?: string;
			refreshToken?: string;
			profileArn?: string;
			region?: string;
			expiresAt?: number;
		};
		if (raw.accessToken) {
			authCache = {
				token: raw.accessToken,
				refreshToken: raw.refreshToken || "",
				profileArn: raw.profileArn || "",
				expiresAt: raw.expiresAt || Date.now() + 3600_000,
				region: raw.region || DEFAULT_REGION,
			};
			if (Date.now() >= authCache.expiresAt - 60_000 && authCache.refreshToken) {
				const refreshed = await refreshKiroDesktopToken(authCache.refreshToken, authCache.region);
				authCache.token = refreshed.accessToken;
				authCache.refreshToken = refreshed.refreshToken;
				authCache.expiresAt = Date.now() + refreshed.expiresIn * 1000;
			}
			return { token: authCache.token, profileArn: authCache.profileArn };
		}
	} catch {
		/* */
	}

	// 7. kiro-cli SQLite (most common path for fresh installs)
	const sqlite = readKiroCliSqlite();
	if (sqlite) {
		authCache = {
			token: sqlite.token,
			refreshToken: sqlite.refreshToken,
			profileArn: sqlite.profileArn,
			expiresAt: sqlite.expiresAt,
			region: sqlite.region,
		};
		// Auto-refresh if expired
		if (Date.now() >= authCache.expiresAt - 60_000 && authCache.refreshToken) {
			try {
				const refreshed = await refreshKiroDesktopToken(authCache.refreshToken, authCache.region);
				authCache.token = refreshed.accessToken;
				authCache.refreshToken = refreshed.refreshToken;
				authCache.expiresAt = Date.now() + refreshed.expiresIn * 1000;
			} catch {
				// Use potentially stale token — server will 401 and trigger retry
			}
		}
		return { token: authCache.token, profileArn: authCache.profileArn };
	}

	throw new Error("Kiro auth not configured. Login via /login or set KIRO_ACCESS_TOKEN env var.");
}

function resolveProfileArn(options: KiroOptions): string {
	if (options.profileArn) return options.profileArn;
	const envArn = $env.KIRO_PROFILE_ARN;
	if (envArn) return envArn;
	// prokiro auth.json
	try {
		const { readFileSync } = require("node:fs") as typeof import("node:fs");
		const raw = JSON.parse(readFileSync(`${process.env.HOME}/.prokiro/auth.json`, "utf8")) as { profileArn?: string };
		if (raw.profileArn) return raw.profileArn;
	} catch {
		/* */
	}
	// kiro-cli SQLite
	const sqlite = readKiroCliSqlite();
	if (sqlite?.profileArn) return sqlite.profileArn;
	return "";
}

// ---------------------------------------------------------------------------
// Stream function
// ---------------------------------------------------------------------------

export const streamKiro: StreamFunction<"kiro-streaming"> = (
	model: Model<"kiro-streaming">,
	context: Context,
	options?: KiroOptions,
): AssistantMessageEventStream => {
	const stream = new AssistantMessageEventStream();
	const opts = options ?? ({} as KiroOptions);

	void (async () => {
		const startTime = Date.now();
		let firstTokenTime: number | undefined;
		const usage: Usage = {
			input: 0,
			output: 0,
			cacheRead: 0,
			cacheWrite: 0,
			totalTokens: 0,
			cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, total: 0 },
		};
		const output: AssistantMessage = {
			role: "assistant",
			content: [],
			api: "kiro-streaming",
			provider: model.provider,
			model: model.id,
			usage,
			stopReason: "stop",
			timestamp: Date.now(),
		};

		try {
			const { token, profileArn } = await resolveKiroAuth(opts);
			const region = opts.region || $env.KIRO_REGION || DEFAULT_REGION;
			const spoofVersion = opts.spoofVersion || $env.KIRO_SPOOF_VERSION || KIRO_IDE_VERSION;
			const host = KIRO_HOST_TEMPLATE.replace("{region}", region);
			const url = `${host}/`;
			const conversationId = stableConversationId(context, opts, model, profileArn);
			const sessionState = getKiroProviderSessionState(opts.providerSessionState);
			const sessionKey = kiroSessionKey(opts, model, profileArn, region);
			const currentTurnOnly = sessionKey ? (sessionState?.seenConversationKeys.has(sessionKey) ?? false) : false;
			const kiroModelId = mapModelId(model.id);

			const payload = buildPayload(context, kiroModelId, conversationId, profileArn, {
				currentTurnOnly,
				reasoning: model.reasoning ? opts.reasoning : undefined,
				maxTokens: opts.maxTokens,
				supportsImages: model.input.includes("image"),
			});
			const headers = buildHeaders(token, spoofVersion, profileArn);
			const body = new TextEncoder().encode(JSON.stringify(payload));
			kiroDebugLog("request.payload", payload);

			let response = await fetchWithRetry(url, {
				method: "POST",
				headers: { ...headers, "content-length": String(body.length) },
				body,
				signal: opts.signal,
				maxAttempts: resolveRetryBudget(opts.requestMaxRetries, 3) + 1,
			});

			if (response.status === 401 && authCache?.refreshToken) {
				try {
					const refreshed = await refreshKiroDesktopToken(authCache.refreshToken, region);
					authCache.token = refreshed.accessToken;
					authCache.refreshToken = refreshed.refreshToken;
					authCache.expiresAt = Date.now() + refreshed.expiresIn * 1000;
					const retryHeaders = buildHeaders(authCache.token, spoofVersion, profileArn);
					response = await fetchWithRetry(url, {
						method: "POST",
						headers: { ...retryHeaders, "content-length": String(body.length) },
						body,
						signal: opts.signal,
						maxAttempts: 1,
					});
				} catch {
					authCache = null;
					throw withHttpStatus(new Error("Kiro HTTP 401: token refresh failed"), 401);
				}
			}
			if (!response.ok) {
				const errBody = await response.text().catch(() => "");
				// Classify + redact (tokens / ARNs / local paths) before surfacing.
				throw withHttpStatus(
					new Error(safeKiroHttpErrorMessage(response.status, response.headers, errBody)),
					response.status,
				);
			}
			if (!response.body) throw new Error("Kiro response has no body");

			stream.push({ type: "start", partial: output });
			if (sessionKey) {
				sessionState?.seenConversationKeys.add(sessionKey);
			}
			let currentToolCall: { id: string; name: string; args: string } | null = null;
			let contentIndex = 0;
			// CodeWhisperer reports no token usage; we accumulate the assistant output text/thinking +
			// tool-call argument length and convert to a heuristic estimate on done. `context_usage`
			// events (window-fullness %) give a more precise total when present.
			let outputChars = "";
			let contextUsagePercentage: number | undefined;
			const thinkingParser = new KiroThinkingParser();
			// Track the kind of the currently open content block so consecutive same-kind chunks append.
			let openBlock: "text" | "thinking" | null = null;

			const closeOpenBlock = (): void => {
				if (!openBlock) return;
				const block = output.content[output.content.length - 1];
				if (block && block.type === openBlock) {
					const content = block.type === "thinking" ? block.thinking : block.text;
					stream.push({
						type: openBlock === "thinking" ? "thinking_end" : "text_end",
						contentIndex: contentIndex - 1,
						content,
						partial: output,
					} as never);
				}
				openBlock = null;
			};

			const pushThinkingChunk = (chunk: { kind: "thinking" | "text"; text: string }): void => {
				if (!chunk.text) return;
				outputChars += chunk.text;
				if (!firstTokenTime) firstTokenTime = Date.now();
				if (openBlock && openBlock !== chunk.kind) closeOpenBlock();
				const last = output.content[output.content.length - 1];
				if (openBlock === chunk.kind && last && last.type === chunk.kind) {
					if (last.type === "thinking") last.thinking += chunk.text;
					else last.text += chunk.text;
					stream.push({
						type: chunk.kind === "thinking" ? "thinking_delta" : "text_delta",
						contentIndex: contentIndex - 1,
						delta: chunk.text,
						partial: output,
					} as never);
					return;
				}
				contentIndex = output.content.length;
				if (chunk.kind === "thinking") {
					output.content.push({ type: "thinking", thinking: chunk.text });
					stream.push({ type: "thinking_start", contentIndex, partial: output });
					stream.push({ type: "thinking_delta", contentIndex, delta: chunk.text, partial: output });
				} else {
					output.content.push({ type: "text", text: chunk.text });
					stream.push({ type: "text_start", contentIndex, partial: output });
					stream.push({ type: "text_delta", contentIndex, delta: chunk.text, partial: output });
				}
				openBlock = chunk.kind;
				contentIndex++;
			};

			// Finalize the open tool call into the assistant message + stream events. Shared by the
			// tool_stop path, the interleaving guard (a new tool starting before the previous stop),
			// and end-of-stream cleanup so a buffered tool call is never silently dropped.
			const finalizeToolCall = (): void => {
				if (!currentToolCall) return;
				// Tool-call argument tokens count toward output usage (parity with opencodex).
				outputChars += `${currentToolCall.name}\n${currentToolCall.args}`;
				let parsedArgs: Record<string, unknown> = {};
				try {
					parsedArgs = JSON.parse(currentToolCall.args || "{}");
				} catch {
					parsedArgs = { _raw: currentToolCall.args };
				}
				const tc: ToolCall = {
					type: "toolCall",
					id: currentToolCall.id,
					name: currentToolCall.name,
					arguments: parsedArgs,
				};
				const tcIndex = output.content.length;
				output.content.push(tc);
				stream.push({ type: "toolcall_start", contentIndex: tcIndex, partial: output });
				stream.push({ type: "toolcall_end", contentIndex: tcIndex, toolCall: tc, partial: output });
				contentIndex = tcIndex + 1;
				output.stopReason = "toolUse";
				currentToolCall = null;
			};

			for await (const message of decodeEventStream(response.body)) {
				const messageType = message.headers[":message-type"];
				if (messageType === "exception" || messageType === "error") {
					const errText = new TextDecoder().decode(message.payload);
					throw new Error(safeKiroErrorMessage(message.headers, errText));
				}
				if (messageType !== "event") continue;

				if (kiroDebugPath()) {
					kiroDebugLog("event.raw", new TextDecoder().decode(message.payload));
				}
				const event = parseKiroPayload(message.payload);
				if (!event) continue;
				kiroDebugLog("event.parsed", event);

				switch (event.type) {
					case "content": {
						const text = event.data || "";
						if (!text) break;
						// Text arriving while a tool call is still open means the tool never got its stop
						// frame: the stream was cut mid tool call. Fail closed so the caller can retry
						// instead of emitting a half-built tool call. (Parity w/ opencodex.)
						if (currentToolCall) {
							throw new Error(kiroTruncationErrorMessage("content arrived before tool stop"));
						}
						// Split a leading <thinking> block out into reasoning; the rest is visible text.
						for (const chunk of thinkingParser.feed(text)) pushThinkingChunk(chunk);
						break;
					}
					case "tool_start": {
						if (!firstTokenTime) firstTokenTime = Date.now();
						// Flush any buffered reasoning, then close the open text/thinking block.
						for (const chunk of thinkingParser.flush()) pushThinkingChunk(chunk);
						closeOpenBlock();
						// A new tool starting while one is still open means the previous tool never got
						// its stop frame. Finalize what we have so its arguments are not silently lost.
						if (currentToolCall) finalizeToolCall();
						currentToolCall = {
							id: event.toolUseId || `toolu_${randomUUID().slice(0, 8)}`,
							name: event.name || "unknown",
							args: event.input || "",
						};
						break;
					}
					case "tool_input": {
						if (!currentToolCall) {
							// Input without a preceding start: open a tool keyed to this id.
							currentToolCall = {
								id: event.toolUseId || `toolu_${randomUUID().slice(0, 8)}`,
								name: event.name || "unknown",
								args: event.input || "",
							};
						} else if (event.toolUseId && event.toolUseId !== currentToolCall.id) {
							// Input for a different tool arrived before the open tool stopped. Finalize
							// the current one and start the new tool rather than merging arguments.
							finalizeToolCall();
							currentToolCall = {
								id: event.toolUseId,
								name: event.name || "unknown",
								args: event.input || "",
							};
						} else {
							if (currentToolCall.name === "unknown" && event.name) currentToolCall.name = event.name;
							currentToolCall.args += event.input || "";
						}
						break;
					}
					case "tool_stop": {
						// A finished tool whose argument buffer is non-empty but not valid JSON was cut
						// mid-stream. Surface a fail-closed truncation error rather than finalizing a
						// malformed call (which would later trip CodeWhisperer REQUEST_BODY_INVALID).
						if (currentToolCall && !isCompleteKiroToolInput(currentToolCall.args)) {
							throw new Error(kiroTruncationErrorMessage("incomplete tool input JSON"));
						}
						finalizeToolCall();
						break;
					}
					case "context_usage":
						if (event.contextUsagePercentage !== undefined && event.contextUsagePercentage > 0) {
							contextUsagePercentage = event.contextUsagePercentage;
						}
						break;
					case "truncation":
						// Explicit upstream truncation signal (finish/stop reason or `truncated` flag).
						throw new Error(kiroTruncationErrorMessage(event.data));
					case "usage":
						// CW does not report real token counts here; the estimate is finalized on done.
						break;
				}
			}

			// Flush any buffered reasoning (e.g. an unterminated <thinking> block) and close the
			// open text/thinking block.
			for (const chunk of thinkingParser.flush()) pushThinkingChunk(chunk);
			closeOpenBlock();

			// A tool call left open at end-of-stream (no trailing stop frame) is only safe to finalize
			// if its argument buffer is complete JSON. A non-empty but unparseable buffer means the
			// stream ended mid tool call: fail closed so the caller retries rather than shipping a
			// malformed call. (Parity w/ opencodex; jawcode previously fail-open finalized as {_raw}.)
			if (currentToolCall && !isCompleteKiroToolInput(currentToolCall.args)) {
				throw new Error(kiroTruncationErrorMessage("stream ended before tool stop"));
			}
			finalizeToolCall();

			// CodeWhisperer reports no usage; fill a heuristic estimate so the cost line and any
			// usage-percentage UI engage. A server-sent contextUsagePercentage yields a precise total.
			finalizeKiroUsage(usage, {
				inputTokens: estimateKiroInputTokens(context, kiroModelId),
				outputChars,
				modelId: kiroModelId,
				contextUsagePercentage,
				contextWindow: model.contextWindow,
			});
			usage.cost = calculateCost(model, usage);

			output.duration = Date.now() - startTime;
			if (firstTokenTime) output.ttft = firstTokenTime - startTime;
			const doneReason = output.stopReason === "toolUse" ? ("toolUse" as const) : ("stop" as const);
			stream.push({ type: "done", reason: doneReason, message: output });
			stream.end();
		} catch (error) {
			const message = error instanceof Error ? error.message : String(error);
			output.stopReason = "error";
			output.errorMessage = message;
			output.duration = Date.now() - startTime;
			stream.push({ type: "error", reason: "error", error: output });
			stream.end(output);
		}
	})();

	return stream;
};

// ---------------------------------------------------------------------------
// Model ID mapping
// ---------------------------------------------------------------------------

const MODEL_MAP: Record<string, string> = {
	"kiro-auto": "auto",
	"kiro-claude-opus-4.8": "claude-opus-4.8",
	"kiro-claude-opus-4.7": "claude-opus-4.7",
	"kiro-claude-opus-4.6": "claude-opus-4.6",
	"kiro-claude-sonnet-4.6": "claude-sonnet-4.6",
	"kiro-claude-opus-4.5": "claude-opus-4.5",
	"kiro-claude-sonnet-4.5": "claude-sonnet-4.5",
	"kiro-claude-sonnet-4": "claude-sonnet-4",
	"kiro-claude-haiku-4.5": "claude-haiku-4.5",
	"kiro-deepseek-3.2": "deepseek-3.2",
	"kiro-minimax-m2.5": "minimax-m2.5",
	"kiro-minimax-m2.1": "minimax-m2.1",
	"kiro-glm-5": "glm-5",
	"kiro-qwen3-coder": "qwen3-coder-next",
	auto: "auto",
	"claude-opus-4.8": "claude-opus-4.8",
	"claude-opus-4.7": "claude-opus-4.7",
	"claude-opus-4.6": "claude-opus-4.6",
	"claude-sonnet-4.6": "claude-sonnet-4.6",
	"claude-opus-4.5": "claude-opus-4.5",
	"claude-sonnet-4.5": "claude-sonnet-4.5",
	"claude-sonnet-4": "claude-sonnet-4",
	"claude-haiku-4.5": "claude-haiku-4.5",
	"deepseek-3.2": "deepseek-3.2",
	"minimax-m2.5": "minimax-m2.5",
	"minimax-m2.1": "minimax-m2.1",
	"glm-5": "glm-5",
	"qwen3-coder-next": "qwen3-coder-next",
};

function mapModelId(id: string): string {
	return MODEL_MAP[id] || id;
}

function kiroSessionKey(
	options: KiroOptions,
	model: Model<"kiro-streaming">,
	profileArn: string,
	region: string,
): string | undefined {
	if (!options.sessionId) return undefined;
	return `${region}:${profileArn}:${model.provider}:${model.id}:${options.sessionId}`;
}

function stableConversationId(
	context: Context,
	options?: KiroOptions,
	model?: Model<"kiro-streaming">,
	profileArn = "",
): string {
	if (options?.sessionId && model) {
		return createHash("sha256")
			.update(`${profileArn}:${model.provider}:${model.id}:${options.sessionId}`)
			.digest("hex")
			.slice(0, 16);
	}
	if (!context.messages || context.messages.length === 0) return randomUUID().slice(0, 16);
	const keyMsgs =
		context.messages.length <= 3
			? context.messages
			: [...context.messages.slice(0, 3), context.messages[context.messages.length - 1]];
	const simplified = keyMsgs
		.map(m => {
			const content =
				typeof m.content === "string" ? m.content.slice(0, 100) : JSON.stringify(m.content).slice(0, 100);
			return `${m.role}:${content}`;
		})
		.join("|");
	return createHash("sha256").update(simplified).digest("hex").slice(0, 16);
}
