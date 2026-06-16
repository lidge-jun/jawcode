import type { AuthStorage } from "@gajae-code/ai";
import type { SearchProviderId, SearchResponse } from "../types";

/**
 * Shared web search parameters passed to providers.
 *
 * `authStorage` is the **only** credential source providers may consult.
 * Opening a sibling SQLite handle or calling provider-direct refresh helpers
 * (e.g. `refreshOpenAIOpenAI code backendToken`, `refreshGoogleCloudToken`) is prohibited:
 * it races the broker's per-credential refresh and POSTs the broker sentinel
 * (`REMOTE_REFRESH_SENTINEL`) to the upstream token endpoint, which classifies
 * as `invalid_grant` and disables the row.
 */
export interface SearchParams {
	query: string;
	limit?: number;
	/**
	 * Temporal filter narrowing results to the specified time window.
	 *
	 * Providers MUST interpret this as a pure time filter. Providers MUST NOT
	 * use recency as an implicit signal to change topic scope, content domain,
	 * or ranking strategy. If a provider API couples temporal filtering with
	 * other dimensions (e.g. Tavily's `topic=news`), the provider implementation
	 * is responsible for decoupling them before calling the upstream API.
	 *
	 * Providers that do not support temporal filtering MUST ignore this field
	 * silently; they MUST NOT approximate it by rewriting the query or altering
	 * any other request parameter.
	 */
	recency?: "day" | "week" | "month" | "year";
	systemPrompt: string;
	signal?: AbortSignal;
	maxOutputTokens?: number;
	numSearchResults?: number;
	temperature?: number;
	googleSearch?: Record<string, unknown>;
	codeExecution?: Record<string, unknown>;
	urlContext?: Record<string, unknown>;
	/**
	 * The single source of truth for credentials. Providers MUST consult this
	 * handle exclusively (`getApiKey` for bearer-style auth, `getOAuthAccess`
	 * when identity metadata is required). Do not open `AgentStorage` or any
	 * `AuthCredentialStore` directly — that bypasses the broker pipeline and
	 * the per-credential single-flight refresh.
	 */
	authStorage: AuthStorage;
	/**
	 * Optional session id used as the round-robin / sticky key when selecting
	 * among multiple credentials for the same provider. Pass through from the
	 * caller's agent session when available; otherwise omit.
	 */
	sessionId?: string;

	// ── Session-model parity + deep tier (074/075) ──────────────────────

	/**
	 * Active session model id (e.g. "gpt-5.3-codex-spark", "claude-sonnet-4-6").
	 * When the session's provider matches the search provider, the provider
	 * SHOULD use this model instead of its default pin (session-model parity).
	 * Cross-provider callers leave this undefined → provider uses its pin.
	 */
	sessionModel?: string | undefined;

	/** Provider id of the active session model (e.g. "openai-codex", "anthropic"). */
	sessionModelProvider?: string | undefined;

	/**
	 * Search depth tier. `"fast"` (default) = synchronous 60s, `"deep"` = async
	 * 180s with heavier models. The caller (WebSearchTool) handles the async job
	 * wrapper; providers just see an extended timeout + possibly a different model.
	 */
	depth?: "fast" | "deep" | undefined;

	/** Override the hard timeout (ms). Deep tier passes 180_000; fast uses the
	 *  provider default (SEARCH_HARD_TIMEOUT_MS = 60_000). */
	timeoutMs?: number | undefined;

	/** Reasoning effort from settings (080). Providers apply floor logic per tier
	 *  (e.g. codex deep = max(this, "high")). "none" = non-thinking. */
	reasoningEffort?: "none" | "low" | "medium" | "high" | undefined;

	/** Search context size (codex-specific, others ignore). */
	searchContextSize?: "low" | "medium" | "high" | undefined;
}

/** Base class for web search providers. */
export abstract class SearchProvider {
	abstract readonly id: SearchProviderId;
	abstract readonly label: string;

	/**
	 * Indicates whether this provider has the credentials/config it needs to
	 * service a request right now. Implementations consult the passed
	 * {@link AuthStorage} — never a sibling store.
	 */
	abstract isAvailable(authStorage: AuthStorage): Promise<boolean> | boolean;

	/**
	 * Execute a search. Credentials MUST be resolved through `params.authStorage`.
	 */
	abstract search(params: SearchParams): Promise<SearchResponse>;
}
