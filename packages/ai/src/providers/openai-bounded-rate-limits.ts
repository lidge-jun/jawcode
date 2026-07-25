import { isUsageLimitError } from "../rate-limit-utils";
import type { FetchImpl } from "../types";
import { getRetryAfterMsFromHeaders } from "../utils/retry-after";

const OPENAI_RETRY_DELAY_CAP_MS = 60_000;

// OpenAI-compatible providers can return HTTP 429 for permanent usage/quota
// exhaustion. A raw OpenAI SDK client treats 429 as transient and may honor a
// very long Retry-After before surfacing an error, which keeps JWC from applying
// its visible session-level retry/fallback logic. Mark permanent exhaustion as
// non-retryable for the SDK while preserving the response body for diagnostics.
export function isOpenAIUsageExhaustionResponse(
	bodyText: string,
	retryAfterMs: number | undefined,
	retryDelayCapMs: number,
): boolean {
	if (retryAfterMs !== undefined && retryAfterMs > retryDelayCapMs) return true;
	return isUsageLimitError(bodyText);
}

export function wrapOpenAIFetchForBoundedRateLimits(
	baseFetch: FetchImpl,
	maxRetryDelayMs: number | undefined,
): FetchImpl {
	const retryDelayCapMs = maxRetryDelayMs ?? OPENAI_RETRY_DELAY_CAP_MS;
	return Object.assign(
		async (input: string | URL | Request, init?: RequestInit): Promise<Response> => {
			const response = await baseFetch(input, init);
			if (response.status !== 429 || retryDelayCapMs === 0) return response;

			const headers = new Headers(response.headers);
			const retryAfterMs = getRetryAfterMsFromHeaders(headers);
			const bodyText = await response
				.clone()
				.text()
				.catch(() => "");
			if (!isOpenAIUsageExhaustionResponse(bodyText, retryAfterMs, retryDelayCapMs)) return response;

			headers.set("x-should-retry", "false");
			return new Response(bodyText, {
				status: response.status,
				statusText: response.statusText,
				headers,
			});
		},
		baseFetch.preconnect ? { preconnect: baseFetch.preconnect } : {},
	);
}
