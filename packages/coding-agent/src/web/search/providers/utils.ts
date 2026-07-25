import type { AgentStorage } from "../../../session/agent-storage";
import { SearchProviderError, type SearchProviderId, type SearchSource } from "../../../web/search/types";
import { dateToAgeSeconds } from "../utils";

/**
 * Search for an API credential by checking an env-derived key first,
 * then falling back to agent.db stored credentials for the given providers.
 *
 * The caller MUST supply an open {@link AgentStorage} handle so the helper
 * never reaches out to global filesystem state; both the unified web_search
 * chain and one-shot CLI calls open storage exactly once and thread it
 * through every provider.
 *
 * @param storage - Open agent storage handle
 * @param envKey - Pre-resolved environment variable value (or null)
 * @param storageProviders - Provider names to look up in AgentStorage
 */
export function findCredential(
	storage: AgentStorage | null | undefined,
	envKey: string | null | undefined,
	...storageProviders: string[]
): string | null {
	if (envKey) return envKey;
	if (!storage) return null;

	try {
		for (const provider of storageProviders) {
			const records = storage.listAuthCredentials(provider);
			for (const record of records) {
				const credential = record.credential;
				if (credential.type === "api_key" && credential.key.trim().length > 0) {
					return credential.key;
				}
				if (credential.type === "oauth" && credential.access.trim().length > 0) {
					return credential.access;
				}
			}
		}
	} catch {
		return null;
	}

	return null;
}

/**
 * Default hard ceiling for an unclassified web-search round-trip. 60s keeps
 * legacy no-argument call sites bounded while provider-specific classes can opt
 * into shorter API or longer LLM transport ceilings.
 */
export const SEARCH_HARD_TIMEOUT_MS = 60_000;

/** Default hard ceiling for direct search APIs. */
export const SEARCH_API_TIMEOUT_MS = 15_000;

/** Default hard ceiling for LLM-mediated search providers. */
export const SEARCH_LLM_TIMEOUT_MS = 120_000;

export type SearchTimeoutClass = "api" | "llm";

const TIMEOUT_CLASS_MS: Record<SearchTimeoutClass, number> = {
	api: SEARCH_API_TIMEOUT_MS,
	llm: SEARCH_LLM_TIMEOUT_MS,
};

/** Lower bound for the configurable hard timeout (5s) — guards against a
 *  near-zero setting that would abort every request before it can settle. */
export const MIN_SEARCH_HARD_TIMEOUT_MS = 5_000;
/** Upper bound for the configurable hard timeout (600s) — keeps a stalled
 *  request from holding the session open indefinitely. */
export const MAX_SEARCH_HARD_TIMEOUT_MS = 600_000;

let configuredHardTimeoutMs: number | undefined;

export interface SearchTimeoutSettingSource {
	get(key: "web_search.timeout"): unknown;
	has?(key: "web_search.timeout"): boolean;
}

/** Current effective hard timeout in milliseconds. */
export function getSearchHardTimeoutMs(timeoutClass?: SearchTimeoutClass): number {
	return configuredHardTimeoutMs ?? (timeoutClass ? TIMEOUT_CLASS_MS[timeoutClass] : SEARCH_HARD_TIMEOUT_MS);
}

/**
 * Override the global web-search hard timeout. The value is clamped to
 * [{@link MIN_SEARCH_HARD_TIMEOUT_MS}, {@link MAX_SEARCH_HARD_TIMEOUT_MS}].
 * Passing undefined, non-finite, or non-positive values clears the override.
 */
export function setSearchHardTimeoutMs(ms: number | undefined): number {
	if (typeof ms !== "number" || !Number.isFinite(ms) || ms <= 0) {
		configuredHardTimeoutMs = undefined;
		return SEARCH_HARD_TIMEOUT_MS;
	}
	configuredHardTimeoutMs = Math.min(MAX_SEARCH_HARD_TIMEOUT_MS, Math.max(MIN_SEARCH_HARD_TIMEOUT_MS, ms));
	return configuredHardTimeoutMs;
}

/**
 * Apply the user-configured timeout only when the setting source explicitly
 * contains `web_search.timeout`; schema/default values must not collapse API and
 * LLM class defaults back into one uniform ceiling.
 */
export function applyConfiguredSearchTimeout(settings: SearchTimeoutSettingSource | null | undefined): void {
	if (!settings?.has?.("web_search.timeout")) {
		setSearchHardTimeoutMs(undefined);
		return;
	}
	const seconds = settings.get("web_search.timeout");
	setSearchHardTimeoutMs(typeof seconds === "number" ? seconds * 1000 : undefined);
}

/**
 * Compose a caller-supplied {@link AbortSignal} with a hard timeout so an
 * outbound `fetch()` is guaranteed to settle within `ms` even when the
 * runtime fails to propagate cancellation to the underlying transport.
 *
 * Bun's WinHTTP backend on Windows is known to ignore `AbortSignal` once a
 * TCP/TLS connection stalls (oven-sh/bun#15275, oven-sh/bun#18536); without
 * this safety net a stalled web-search request freezes the entire session
 * because the user's Esc is never delivered to the native layer.
 */
export function withHardTimeout(signal: AbortSignal | undefined, msOrClass?: number | SearchTimeoutClass): AbortSignal {
	const ms = typeof msOrClass === "number" ? msOrClass : getSearchHardTimeoutMs(msOrClass);
	const timeout = AbortSignal.timeout(ms);
	return signal ? AbortSignal.any([signal, timeout]) : timeout;
}

/**
 * Map a provider's raw source list to the unified SearchSource shape,
 * clamped to the requested result count and annotated with ageSeconds.
 */
export function toSearchSources(
	sources: ReadonlyArray<{
		title: string;
		url: string;
		snippet?: string;
		publishedDate?: string;
	}>,
	numResults: number,
): SearchSource[] {
	return sources.slice(0, numResults).map(source => ({
		title: source.title,
		url: source.url,
		snippet: source.snippet,
		publishedDate: source.publishedDate,
		ageSeconds: dateToAgeSeconds(source.publishedDate),
	}));
}

/**
 * Quota/auth signals across providers. Telemetry on 15.1.7/15.1.8 showed users
 * hitting credit-exhaustion and 401/402/403 responses that were surfaced as
 * raw HTTP error text. Map those into compact, provider-tagged messages so
 * the orchestrator can chain-advance cleanly and the final summary stays
 * legible when every provider rejects the request.
 *
 * Returns `null` when the response does not match a known quota/auth signal,
 * leaving the caller to throw its provider-specific fallback error.
 */
const CREDIT_BODY_PATTERN = /credits?\s*(?:exhausted|exceeded)|quota|insufficient/i;

export function classifyProviderHttpError(
	provider: SearchProviderId,
	status: number,
	body: string,
): SearchProviderError | null {
	if (CREDIT_BODY_PATTERN.test(body)) {
		return new SearchProviderError(provider, `${provider}: credits exhausted`, status);
	}
	if (status === 402) {
		return new SearchProviderError(provider, `${provider}: 402 credits exhausted`, status);
	}
	if (status === 401) {
		return new SearchProviderError(provider, `${provider}: 401 unauthorized`, status);
	}
	if (status === 403) {
		return new SearchProviderError(provider, `${provider}: 403 forbidden`, status);
	}
	return null;
}
