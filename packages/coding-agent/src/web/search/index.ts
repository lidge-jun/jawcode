/**
 * Unified Web Search Tool
 *
 * Single tool supporting Anthropic, Perplexity, Exa, Brave, Jina, Kimi, Gemini, OpenAI code backend, Tavily, Kagi, Z.AI, SearXNG, and Synthetic
 * providers with provider-specific parameters exposed conditionally.
 */
import type { AgentTool, AgentToolContext, AgentToolResult, AgentToolUpdateCallback } from "@jawcode-dev/agent-core";
import type { AuthStorage } from "@jawcode-dev/ai";
import { prompt } from "@jawcode-dev/utils";
import * as z from "zod/v4";
import { AsyncJobManager } from "../../async";
import { parseModelString } from "../../config/model-resolver";
import type { CustomTool, CustomToolContext, RenderResultOptions } from "../../extensibility/custom-tools/types";
import type { Theme } from "../../modes/theme/theme";
import webSearchSystemPrompt from "../../prompts/system/web-search.md" with { type: "text" };
import webSearchDescription from "../../prompts/tools/web-search.md" with { type: "text" };
import { discoverAuthStorage } from "../../sdk";
import type { ToolSession } from "../../tools";
import { formatAge } from "../../tools/render-utils";
import { throwIfAborted } from "../../tools/tool-errors";
import { getSearchProviderLabel, resolveProviderChain, type SearchProvider } from "./provider";
import { setSearchHardTimeoutMs } from "./providers/utils";
import { renderSearchCall, renderSearchResult, type SearchRenderDetails } from "./render";
import type { SearchProviderId, SearchResponse } from "./types";
import { SearchProviderError } from "./types";

/** Web search tool parameters schema */
export const webSearchSchema = z.object({
	query: z.string().describe("search query"),
	recency: z.enum(["day", "week", "month", "year"]).describe("recency filter").optional(),
	limit: z.number().describe("max results").optional(),
	max_tokens: z.number().describe("max output tokens").optional(),
	temperature: z.number().describe("sampling temperature").optional(),
	num_search_results: z.number().describe("number of search results").optional(),
	depth: z
		.enum(["fast", "deep"])
		.describe(
			"Search depth tier. fast (default) = synchronous 60s, quick results. deep = async 180s with heavier reasoning models for complex multi-hop research queries.",
		)
		.optional(),
});

/** Deep tier hard timeout — 3× the standard 60s (075 design: AsyncJob + heavier models need room). */
export const DEEP_SEARCH_TIMEOUT_MS = 180_000;

export type SearchToolParams = z.infer<typeof webSearchSchema>;

export interface SearchQueryParams extends SearchToolParams {
	provider?: SearchProviderId | "auto";
}

function formatProviderError(error: unknown, provider: SearchProvider): string {
	if (error instanceof SearchProviderError) {
		if (error.provider === "anthropic" && error.status === 404) {
			return "Anthropic web search returned 404 (model or endpoint not found).";
		}
		if (error.status === 401 || error.status === 403) {
			if (error.provider === "zai") {
				return error.message;
			}
			return `${getSearchProviderLabel(error.provider)} authorization failed (${error.status}). Check API key or base URL.`;
		}
		return error.message;
	}
	if (error instanceof Error) return error.message;
	return `Unknown error from ${provider.label}`;
}

/** Truncate text for tool output */
function truncateText(text: string, maxLen: number): string {
	if (text.length <= maxLen) return text;
	return `${text.slice(0, Math.max(0, maxLen - 1))}…`;
}

function formatCount(label: string, count: number): string {
	return `${count} ${label}${count === 1 ? "" : "s"}`;
}

/** Format response for LLM consumption */
function formatForLLM(response: SearchResponse): string {
	const parts: string[] = [];

	if (response.answer) {
		parts.push(response.answer);
		if (response.sources.length > 0) {
			parts.push("\n## Sources");
			parts.push(formatCount("source", response.sources.length));
		}
	}

	for (const [i, src] of response.sources.entries()) {
		const age = formatAge(src.ageSeconds) || src.publishedDate;
		const agePart = age ? ` (${age})` : "";
		parts.push(`[${i + 1}] ${src.title}${agePart}\n    ${src.url}`);
		if (src.snippet) {
			parts.push(`    ${truncateText(src.snippet, 240)}`);
		}
	}

	if (response.citations && response.citations.length > 0) {
		parts.push("\n## Citations");
		parts.push(formatCount("citation", response.citations.length));
		for (const [i, citation] of response.citations.entries()) {
			const title = citation.title || citation.url;
			parts.push(`[${i + 1}] ${title}\n    ${citation.url}`);
			if (citation.citedText) {
				parts.push(`    ${truncateText(citation.citedText, 240)}`);
			}
		}
	}

	if (response.relatedQuestions && response.relatedQuestions.length > 0) {
		parts.push("\n## Related");
		parts.push(formatCount("question", response.relatedQuestions.length));
		for (const q of response.relatedQuestions) {
			parts.push(`- ${q}`);
		}
	}

	if (response.searchQueries && response.searchQueries.length > 0) {
		parts.push(`Search queries: ${response.searchQueries.length}`);
		for (const query of response.searchQueries.slice(0, 3)) {
			parts.push(`- ${truncateText(query, 120)}`);
		}
	}

	return parts.join("\n");
}

/** Best-effort active model provider: prefer the resolved Model, fall back to parsing the model string. */
function resolveActiveModelProvider(
	modelProvider: string | undefined,
	modelString: string | undefined,
): string | undefined {
	if (modelProvider) return modelProvider;
	if (modelString) return parseModelString(modelString)?.provider;
	return undefined;
}

interface ExecuteSearchOptions {
	authStorage: AuthStorage;
	sessionId?: string;
	signal?: AbortSignal;
	activeModelProvider?: string;
	/** Session model id for parity (e.g. "gpt-5.3-codex-spark"). */
	sessionModel?: string;
	/** Session model provider (e.g. "openai-codex"). */
	sessionModelProvider?: string;
	/** "deep" = 180s async; "fast" (default) = 60s sync. */
	depth?: "fast" | "deep" | undefined;
	/** Timeout override for providers (deep = 180_000, fast = default 60_000). */
	timeoutMs?: number | undefined;
	/** Reasoning effort from settings (080). */
	reasoningEffort?: string | undefined;
	/** Search context size from settings (080, codex only). */
	searchContextSize?: string | undefined;
}

/** Execute web search */
async function executeSearch(
	_toolCallId: string,
	params: SearchQueryParams,
	options: ExecuteSearchOptions,
): Promise<{ content: Array<{ type: "text"; text: string }>; details: SearchRenderDetails }> {
	const { authStorage, sessionId, signal, activeModelProvider, sessionModel, sessionModelProvider } = options;
	// Pass `params.provider` straight through: when omitted (the normal model-facing
	// path) it is `undefined`, so `resolveProviderChain` applies the settings-configured
	// preferred provider. Coalescing to "auto" here would silently bypass that preference.
	const providers = await resolveProviderChain(authStorage, params.provider, activeModelProvider);

	const failures: Array<{ provider: SearchProvider; error: unknown }> = [];
	let lastProvider = providers[0];
	for (const provider of providers) {
		lastProvider = provider;
		try {
			const response = await provider.search({
				query: params.query.replace(/202\d/g, String(new Date().getFullYear())), // LUL
				limit: params.limit,
				recency: params.recency,
				systemPrompt: webSearchSystemPrompt,
				maxOutputTokens: params.max_tokens,
				numSearchResults: params.num_search_results,
				temperature: params.temperature,
				signal,
				authStorage,
				sessionId,
				// Session-model parity (074): providers use this when session's
				// provider matches theirs (e.g. codex-spark → codex, claude → anthropic).
				sessionModel,
				sessionModelProvider,
				depth: options.depth,
				timeoutMs: options.timeoutMs,
				reasoningEffort: options.reasoningEffort as "none" | "low" | "medium" | "high" | undefined,
				searchContextSize: options.searchContextSize as "low" | "medium" | "high" | undefined,
			});

			const text = formatForLLM(response);

			return {
				content: [{ type: "text" as const, text }],
				details: { response },
			};
		} catch (error) {
			// Surface user-initiated cancellation immediately so the session sees
			// a clean abort instead of a generic "all providers failed" message.
			// Without this, an AbortError from `fetch()` is treated as a provider
			// failure and the loop falls through to the next provider (or to the
			// summary error), masking the cancellation.
			throwIfAborted(signal);
			failures.push({ provider, error });
		}
	}

	const lastFailure = failures[failures.length - 1];
	const baseMessage = lastFailure
		? formatProviderError(lastFailure.error, lastFailure.provider)
		: `Unknown error from ${lastProvider.label}`;
	const message =
		providers.length > 1
			? `All web search providers failed: ${failures
					.map(f =>
						f.error instanceof SearchProviderError
							? f.error.message
							: `${f.provider.id}: ${formatProviderError(f.error, f.provider)}`,
					)
					.join("; ")}`
			: baseMessage;

	return {
		content: [{ type: "text" as const, text: `Error: ${message}` }],
		details: { response: { provider: lastProvider.id, sources: [] }, error: message },
	};
}

/**
 * Execute a web search query for CLI/testing workflows.
 *
 * `authStorage` may be omitted; in that case we discover one via the standard
 * factory (`discoverAuthStorage`), which honours `GJC_AUTH_BROKER_URL` and
 * otherwise opens the local SQLite credential store.
 */
export async function runSearchQuery(
	params: SearchQueryParams,
	options: { authStorage?: AuthStorage; sessionId?: string; signal?: AbortSignal; activeModelProvider?: string } = {},
): Promise<{ content: Array<{ type: "text"; text: string }>; details: SearchRenderDetails }> {
	const authStorage = options.authStorage ?? (await discoverAuthStorage());
	return executeSearch("cli-web-search", params, {
		authStorage,
		sessionId: options.sessionId,
		signal: options.signal,
		activeModelProvider: options.activeModelProvider,
	});
}

/**
 * Web search tool implementation.
 *
 * Supports Anthropic, Perplexity, Exa, Brave, Jina, Kimi, Gemini, OpenAI code backend, Z.AI, SearXNG, and Synthetic providers with automatic fallback.
 */
export class WebSearchTool implements AgentTool<typeof webSearchSchema, SearchRenderDetails> {
	readonly name = "web_search";
	readonly label = "Web Search";
	readonly description: string;
	readonly parameters = webSearchSchema;
	readonly strict = true;
	readonly loadMode = "discoverable";
	readonly summary = "Search the web for up-to-date information";

	#session: ToolSession;

	constructor(session: ToolSession) {
		this.#session = session;
		this.description = prompt.render(webSearchDescription);
	}

	async execute(
		_toolCallId: string,
		params: SearchToolParams,
		signal?: AbortSignal,
		_onUpdate?: AgentToolUpdateCallback<SearchRenderDetails>,
		_context?: AgentToolContext,
	): Promise<AgentToolResult<SearchRenderDetails>> {
		const authStorage = this.#session.authStorage ?? (await discoverAuthStorage());
		const sessionId = this.#session.getSessionId?.() ?? undefined;
		const activeModelProvider = resolveActiveModelProvider(
			this.#session.model?.provider,
			this.#session.getActiveModelString?.(),
		);
		const sessionModel = this.#session.model?.id;

		// 10.058: apply the configurable hard timeout (seconds) before any provider
		// round-trip so no-arg withHardTimeout() call sites pick up the runtime value.
		// setSearchHardTimeoutMs clamps to [5s, 600s] and ignores non-finite input.
		const settingsTimeoutSec = this.#session.settings?.get("web_search.timeout") as number | undefined;
		if (typeof settingsTimeoutSec === "number") setSearchHardTimeoutMs(settingsTimeoutSec * 1000);

		// Settings-driven defaults (080): LLM params > settings > hardcoded defaults.
		const settingsDepth = this.#session.settings?.get("web_search.depth") as "fast" | "deep" | undefined;
		const depth = params.depth ?? settingsDepth ?? "fast";
		const timeoutMs = depth === "deep" ? DEEP_SEARCH_TIMEOUT_MS : undefined;

		// Reasoning effort: settings value + deep floor (080 §7).
		const EFFORT_ORDER = ["none", "low", "medium", "high"] as const;
		const settingsEffort = (this.#session.settings?.get("web_search.reasoningEffort") as string) ?? "none";
		const effectiveEffort =
			depth === "deep"
				? EFFORT_ORDER.indexOf(settingsEffort as (typeof EFFORT_ORDER)[number]) >= EFFORT_ORDER.indexOf("high")
					? settingsEffort
					: "high"
				: settingsEffort;
		const settingsContextSize = (this.#session.settings?.get("web_search.contextSize") as string) ?? "high";

		// Deep tier (075 S4): register as async job — returns immediately with a
		// handle text; the actual result is delivered later via AsyncJobManager.
		if (depth === "deep") {
			try {
				const manager = AsyncJobManager.instance();
				if (!manager) throw new Error("no_job_manager");
				const query = params.query.slice(0, 80);
				const jobId = manager.register("task", `deep-search: ${query}`, async ctx => {
					const result = await executeSearch(_toolCallId, params, {
						authStorage,
						sessionId,
						signal: ctx.signal,
						activeModelProvider,
						sessionModel,
						sessionModelProvider: activeModelProvider,
						depth,
						timeoutMs,
						reasoningEffort: effectiveEffort,
						searchContextSize: settingsContextSize,
					});
					const text = result.content.map(c => c.text).join("\n");
					await ctx.reportProgress(`Deep search complete: ${text.slice(0, 200)}…`);
					return text;
				});
				return {
					content: [
						{
							type: "text" as const,
							text: `🔍 Deep search started (job ${jobId}). Results will be delivered when ready. Use the \`job\` tool to check status.`,
						},
					],
				};
			} catch {
				// Capacity exceeded or manager unavailable → fall back to fast sync.
			}
		}

		return executeSearch(_toolCallId, params, {
			authStorage,
			sessionId,
			signal,
			activeModelProvider,
			sessionModel,
			sessionModelProvider: activeModelProvider,
			depth,
			timeoutMs,
			reasoningEffort: effectiveEffort,
			searchContextSize: settingsContextSize,
		});
	}
}

/** Web search tool as CustomTool (for TUI rendering support) */
export const webSearchCustomTool: CustomTool<typeof webSearchSchema, SearchRenderDetails> = {
	name: "web_search",
	label: "Web Search",
	description: prompt.render(webSearchDescription),
	parameters: webSearchSchema,

	async execute(
		toolCallId: string,
		params: SearchToolParams,
		_onUpdate,
		ctx: CustomToolContext,
		signal?: AbortSignal,
	) {
		const authStorage = ctx.modelRegistry?.authStorage ?? (await discoverAuthStorage());
		const sessionId = ctx.sessionManager.getSessionId();
		// Settings-driven defaults (080) — mirror the AgentTool path.
		const settingsDepth = ctx.settings?.get("web_search.depth") as "fast" | "deep" | undefined;
		const depth = params.depth ?? settingsDepth ?? "fast";
		const timeoutMs = depth === "deep" ? DEEP_SEARCH_TIMEOUT_MS : undefined;
		const EFFORT_ORDER = ["none", "low", "medium", "high"] as const;
		const sEffort = (ctx.settings?.get("web_search.reasoningEffort") as string) ?? "none";
		const effectiveEffort =
			depth === "deep"
				? EFFORT_ORDER.indexOf(sEffort as (typeof EFFORT_ORDER)[number]) >= EFFORT_ORDER.indexOf("high")
					? sEffort
					: "high"
				: sEffort;
		const sCtxSize = (ctx.settings?.get("web_search.contextSize") as string) ?? "high";
		return executeSearch(toolCallId, params, {
			authStorage,
			sessionId,
			signal,
			activeModelProvider: ctx.model?.provider,
			sessionModel: ctx.model?.id,
			sessionModelProvider: ctx.model?.provider,
			depth,
			timeoutMs,
			reasoningEffort: effectiveEffort,
			searchContextSize: sCtxSize,
		});
	},

	renderCall(args: SearchToolParams, options: RenderResultOptions, theme: Theme) {
		return renderSearchCall(args, options, theme);
	},

	renderResult(result, options: RenderResultOptions, theme: Theme) {
		return renderSearchResult(result, options, theme);
	},
};

export function getSearchTools(): CustomTool<any, any>[] {
	return [webSearchCustomTool];
}

export { getSearchProvider, setPreferredSearchProvider } from "./provider";
export type { SearchProviderId as SearchProvider, SearchResponse } from "./types";
export { isSearchProviderPreference } from "./types";
