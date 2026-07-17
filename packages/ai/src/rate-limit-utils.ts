/**
 * Rate limit reason classification and backoff calculation utilities.
 * Ported from opencode-antigravity-auth plugin for consistency.
 */

export type RateLimitReason =
	| "QUOTA_EXHAUSTED"
	| "RATE_LIMIT_EXCEEDED"
	| "MODEL_CAPACITY_EXHAUSTED"
	| "SERVER_ERROR"
	| "UNKNOWN";

const QUOTA_EXHAUSTED_BACKOFF_MS = 30 * 60 * 1000; // 30 min
const RATE_LIMIT_EXCEEDED_BACKOFF_MS = 30 * 1000; // 30s
const MODEL_CAPACITY_BASE_MS = 45 * 1000; // 45s base
const MODEL_CAPACITY_JITTER_MS = 30 * 1000; // ±15s
const SERVER_ERROR_BACKOFF_MS = 20 * 1000; // 20s

const SPEND_LIMIT_PATTERN = /\bspend(?:ing)?[-_ ]?limit\b/i;
const OPENROUTER_DAILY_FREE_LIMIT_PATTERN = /\bfree[-_ ]models[-_ ]per[-_ ]day\b/i;

/** Detect usage/quota limit errors in error messages (persistent, requires credential switch). */
// ZAI reports durable token exhaustion as "[1310][Weekly/Monthly Limit Exhausted...]".
// Keep this explicit so generic "rate limit exhausted, retry..." throttles remain retryable.
const USAGE_LIMIT_PATTERN =
	/usage.?limit|usage_limit_reached|usage_not_included|limit_reached|weekly\/monthly\s+limit\s+exhausted|quota.?(?:exceeded|reached|insufficient)|resource.?exhausted|insufficient.?(?:balance|quota)|out[-_ ]of[-_ ]credits/i;

function matchesPersistentUsageLimit(errorMessage: string): boolean {
	return (
		USAGE_LIMIT_PATTERN.test(errorMessage) ||
		SPEND_LIMIT_PATTERN.test(errorMessage) ||
		OPENROUTER_DAILY_FREE_LIMIT_PATTERN.test(errorMessage)
	);
}

/**
 * Classify a rate-limit error message into a reason category.
 * Priority order: provider-specific persistent limits > MODEL_CAPACITY > RATE_LIMIT >
 * generic QUOTA > SERVER_ERROR > UNKNOWN.
 *
 * "resource exhausted" maps to MODEL_CAPACITY (transient, short wait)
 * "quota exceeded" maps to QUOTA_EXHAUSTED (long wait, switch account)
 */
export function parseRateLimitReason(errorMessage: string): RateLimitReason {
	const lower = errorMessage.toLowerCase();

	// These provider-specific persistent limits often also contain generic
	// "rate limit" framing. Preserve the stronger quota classifier before the
	// transient throttle branch gets a chance to match.
	if (SPEND_LIMIT_PATTERN.test(errorMessage) || OPENROUTER_DAILY_FREE_LIMIT_PATTERN.test(errorMessage)) {
		return "QUOTA_EXHAUSTED";
	}

	if (
		lower.includes("capacity") ||
		lower.includes("overloaded") ||
		lower.includes("529") ||
		lower.includes("503") ||
		lower.includes("resource exhausted")
	) {
		return "MODEL_CAPACITY_EXHAUSTED";
	}

	if (
		lower.includes("per minute") ||
		lower.includes("rate limit") ||
		lower.includes("too many requests") ||
		lower.includes("presque")
	) {
		return "RATE_LIMIT_EXCEEDED";
	}

	if (lower.includes("exhausted") || lower.includes("quota") || matchesPersistentUsageLimit(errorMessage)) {
		return "QUOTA_EXHAUSTED";
	}

	if (lower.includes("500") || lower.includes("internal error") || lower.includes("internal server error")) {
		return "SERVER_ERROR";
	}

	return "UNKNOWN";
}

/**
 * Calculate backoff delay in ms for a given rate limit reason.
 * MODEL_CAPACITY gets jitter to prevent thundering herd.
 */
export function calculateRateLimitBackoffMs(reason: RateLimitReason): number {
	switch (reason) {
		case "QUOTA_EXHAUSTED":
			return QUOTA_EXHAUSTED_BACKOFF_MS;
		case "RATE_LIMIT_EXCEEDED":
			return RATE_LIMIT_EXCEEDED_BACKOFF_MS;
		case "MODEL_CAPACITY_EXHAUSTED":
			return MODEL_CAPACITY_BASE_MS + Math.random() * MODEL_CAPACITY_JITTER_MS;
		case "SERVER_ERROR":
			return SERVER_ERROR_BACKOFF_MS;
		default:
			return QUOTA_EXHAUSTED_BACKOFF_MS; // conservative default
	}
}

export function isUsageLimitError(errorMessage: string): boolean {
	return matchesPersistentUsageLimit(errorMessage);
}
