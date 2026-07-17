const INVALIDATED_OAUTH_TOKEN_PATTERN = /\binvalidated oauth token\b/i;

/** Whether an upstream failure explicitly says the supplied OAuth bearer was invalidated. */
export function isInvalidatedOAuthTokenError(error: unknown): boolean {
	if (typeof error === "object" && error !== null) {
		if ("errorMessage" in error && typeof error.errorMessage === "string") {
			return INVALIDATED_OAUTH_TOKEN_PATTERN.test(error.errorMessage);
		}
		if ("message" in error && typeof error.message === "string") {
			return INVALIDATED_OAUTH_TOKEN_PATTERN.test(error.message);
		}
	}
	return typeof error === "string" && INVALIDATED_OAUTH_TOKEN_PATTERN.test(error);
}
