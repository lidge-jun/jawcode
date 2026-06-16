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
import { $env, fetchWithRetry } from "@gajae-code/utils";
import type {
	AssistantMessage,
	Context,
	Model,
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

// ---------------------------------------------------------------------------
// Options
// ---------------------------------------------------------------------------

export interface KiroOptions extends StreamOptions {
	region?: string;
	accessToken?: string;
	profileArn?: string;
	spoofVersion?: string;
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

function convertTools(tools: Tool[]): KiroToolSpec[] {
	return tools.map(t => ({
		toolSpecification: {
			name: t.name.slice(0, 64),
			description: (t.description || `Tool: ${t.name}`).slice(0, 1024),
			inputSchema: { json: toolWireSchema(t) as Record<string, unknown> },
		},
	}));
}

interface KiroToolUse {
	name: string;
	input: string;
	toolUseId: string;
}

interface KiroToolResult {
	content: Array<{ text: string }>;
	status: string;
	toolUseId: string;
}

interface KiroHistoryEntry {
	userInputMessage?: { content: string; modelId?: string; origin?: string };
	assistantResponseMessage?: { content: string; toolUses?: KiroToolUse[] };
}

function buildPayload(
	context: Context,
	modelId: string,
	conversationId: string,
	profileArn: string,
): Record<string, unknown> {
	const history: KiroHistoryEntry[] = [];
	const kiroTools = context.tools ? convertTools(context.tools) : [];
	const toolResults: KiroToolResult[] = [];

	let systemPrefix = "";
	if (context.systemPrompt) {
		systemPrefix = `${context.systemPrompt}\n\n`;
	}

	let lastRole = "";
	for (const msg of context.messages) {
		if (msg.role === "user" || msg.role === "developer") {
			const text = typeof msg.content === "string" ? msg.content : JSON.stringify(msg.content);
			if (lastRole === "user") {
				history.push({ assistantResponseMessage: { content: "(acknowledged)" } });
			}
			history.push({ userInputMessage: { content: text, modelId, origin: "AI_EDITOR" } });
			lastRole = "user";
		} else if (msg.role === "assistant") {
			const aMsg = msg as AssistantMessage;
			const textParts = (aMsg.content || []).filter((b): b is TextContent => b.type === "text");
			const text = textParts.map(b => b.text).join("");
			const toolUses: KiroToolUse[] = (aMsg.content || [])
				.filter((b): b is ToolCall => b.type === "toolCall")
				.map(tc => ({
					name: tc.name,
					input: JSON.stringify(tc.arguments ?? {}),
					toolUseId: tc.id,
				}));
			if (lastRole === "assistant") {
				history.push({ userInputMessage: { content: "(continue)", modelId, origin: "AI_EDITOR" } });
			}
			const entry: KiroHistoryEntry = { assistantResponseMessage: { content: text } };
			if (toolUses.length > 0) entry.assistantResponseMessage!.toolUses = toolUses;
			history.push(entry);
			lastRole = "assistant";
		} else if (msg.role === "toolResult") {
			const trMsg = msg as ToolResultMessage;
			const parts = trMsg.content.map(c => (c.type === "text" ? c.text : "")).filter(Boolean);
			toolResults.push({
				content: [{ text: parts.join("\n") || "(empty)" }],
				status: trMsg.isError ? "error" : "success",
				toolUseId: normalizeToolCallId(trMsg.toolCallId),
			});
		}
	}

	// Pop last user message as currentMessage
	let currentContent: string;
	if (history.length > 0 && history[history.length - 1].userInputMessage) {
		const last = history.pop()!;
		currentContent = last.userInputMessage!.content;
	} else if (toolResults.length > 0) {
		currentContent = "(tool results attached)";
	} else {
		currentContent = "(continue)";
	}

	// Prepend system prompt
	if (systemPrefix) {
		if (history.length > 0 && history[0].userInputMessage) {
			history[0].userInputMessage!.content = systemPrefix + history[0].userInputMessage!.content;
		} else {
			currentContent = systemPrefix + currentContent;
		}
	}

	const userInputMessage: Record<string, unknown> = {
		content: currentContent,
		modelId,
		origin: "AI_EDITOR",
	};

	const userInputMessageContext: Record<string, unknown> = {};
	if (kiroTools.length > 0) userInputMessageContext.tools = kiroTools;
	if (toolResults.length > 0) userInputMessageContext.toolResults = toolResults;
	if (Object.keys(userInputMessageContext).length > 0) {
		userInputMessage.userInputMessageContext = userInputMessageContext;
	}

	const payload: Record<string, unknown> = {
		conversationState: {
			chatTriggerType: "MANUAL",
			conversationId,
			currentMessage: { userInputMessage },
			...(history.length > 0 ? { history } : {}),
		},
	};
	if (profileArn) payload.profileArn = profileArn;
	return payload;
}

// ---------------------------------------------------------------------------
// Response parsing
// ---------------------------------------------------------------------------

interface ParsedKiroEvent {
	type: "content" | "tool_start" | "tool_input" | "tool_stop" | "usage";
	data?: string;
	name?: string;
	toolUseId?: string;
	input?: string;
	usage?: number;
}

function parseKiroPayload(raw: Uint8Array): ParsedKiroEvent | null {
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

	if ("content" in parsed && typeof parsed.content === "string") {
		return { type: "content", data: parsed.content };
	}
	if ("name" in parsed && typeof parsed.name === "string") {
		const input =
			typeof parsed.input === "object" && parsed.input !== null
				? JSON.stringify(parsed.input)
				: typeof parsed.input === "string"
					? (parsed.input as string)
					: "";
		return {
			type: "tool_start",
			name: parsed.name as string,
			toolUseId: (parsed.toolUseId as string) || `toolu_${randomUUID().slice(0, 8)}`,
			input,
		};
	}
	if ("input" in parsed && !("name" in parsed)) {
		const input =
			typeof parsed.input === "object" && parsed.input !== null
				? JSON.stringify(parsed.input)
				: typeof parsed.input === "string"
					? (parsed.input as string)
					: "";
		return { type: "tool_input", input };
	}
	if ("stop" in parsed && parsed.stop === true) {
		return { type: "tool_stop" };
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
			const conversationId = stableConversationId(context);
			const kiroModelId = mapModelId(model.id);

			const payload = buildPayload(context, kiroModelId, conversationId, profileArn);
			const headers = buildHeaders(token, spoofVersion, profileArn);
			const body = new TextEncoder().encode(JSON.stringify(payload));

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
				throw withHttpStatus(new Error(`Kiro HTTP ${response.status}: ${errBody.slice(0, 1000)}`), response.status);
			}
			if (!response.body) throw new Error("Kiro response has no body");

			stream.push({ type: "start", partial: output });
			let currentToolCall: { id: string; name: string; args: string } | null = null;
			let contentIndex = 0;

			for await (const message of decodeEventStream(response.body)) {
				const messageType = message.headers[":message-type"];
				if (messageType === "exception" || messageType === "error") {
					const errText = new TextDecoder().decode(message.payload);
					throw new Error(`Kiro stream error: ${errText.slice(0, 500)}`);
				}
				if (messageType !== "event") continue;

				const event = parseKiroPayload(message.payload);
				if (!event) continue;

				switch (event.type) {
					case "content": {
						if (!firstTokenTime) firstTokenTime = Date.now();
						const text = event.data || "";
						if (!text) break;
						const lastBlock = output.content[output.content.length - 1];
						if (lastBlock && lastBlock.type === "text") {
							lastBlock.text += text;
							stream.push({ type: "text_delta", contentIndex: contentIndex - 1, delta: text, partial: output });
						} else {
							contentIndex = output.content.length;
							output.content.push({ type: "text", text });
							stream.push({ type: "text_start", contentIndex, partial: output });
							stream.push({ type: "text_delta", contentIndex, delta: text, partial: output });
							contentIndex++;
						}
						break;
					}
					case "tool_start": {
						if (!firstTokenTime) firstTokenTime = Date.now();
						// End any open text block
						const prevBlock = output.content[output.content.length - 1];
						if (prevBlock && prevBlock.type === "text") {
							stream.push({
								type: "text_end",
								contentIndex: contentIndex - 1,
								content: prevBlock.text,
								partial: output,
							});
						}
						currentToolCall = {
							id: event.toolUseId || `toolu_${randomUUID().slice(0, 8)}`,
							name: event.name || "unknown",
							args: event.input || "",
						};
						break;
					}
					case "tool_input": {
						if (currentToolCall) {
							currentToolCall.args += event.input || "";
						}
						break;
					}
					case "tool_stop": {
						if (currentToolCall) {
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
						}
						break;
					}
					case "usage":
						break;
				}
			}

			// Finalize open text block
			const finalBlock = output.content[output.content.length - 1];
			if (finalBlock && finalBlock.type === "text") {
				stream.push({
					type: "text_end",
					contentIndex: contentIndex - 1,
					content: finalBlock.text,
					partial: output,
				});
			}

			// Finalize incomplete tool call
			if (currentToolCall) {
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
				output.stopReason = "toolUse";
			}

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
	"kiro-claude-sonnet-4.5": "claude-sonnet-4.5",
	"kiro-claude-sonnet-4": "claude-sonnet-4",
	"kiro-claude-haiku-4.5": "claude-haiku-4.5",
	"kiro-deepseek-3.2": "deepseek-3.2",
	"kiro-minimax-m2.5": "minimax-m2.5",
	"kiro-glm-5": "glm-5",
	"kiro-qwen3-coder": "qwen3-coder-next",
	auto: "auto",
	"claude-sonnet-4.5": "claude-sonnet-4.5",
	"claude-sonnet-4": "claude-sonnet-4",
	"claude-haiku-4.5": "claude-haiku-4.5",
	"deepseek-3.2": "deepseek-3.2",
	"minimax-m2.5": "minimax-m2.5",
	"glm-5": "glm-5",
	"qwen3-coder-next": "qwen3-coder-next",
};

function mapModelId(id: string): string {
	return MODEL_MAP[id] || id;
}

function stableConversationId(context: Context): string {
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
