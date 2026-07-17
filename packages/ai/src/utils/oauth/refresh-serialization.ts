import type { OAuthCredentials, OAuthProviderId } from "./types";

type RefreshOperation = () => Promise<OAuthCredentials>;

const providerRefreshes = new Map<OAuthProviderId, Map<string, Promise<OAuthCredentials>>>();

/**
 * Coalesce concurrent refreshes that present the same rotating refresh token.
 *
 * The refresh token is the credential identity here: providers may rotate it
 * after every successful exchange, so a second request using the old value can
 * invalidate an otherwise successful first refresh. Distinct credentials for
 * the same provider remain independent.
 */
export function serializeOAuthRefresh(
	provider: OAuthProviderId,
	credentials: OAuthCredentials,
	refresh: RefreshOperation,
): Promise<OAuthCredentials> {
	let refreshes = providerRefreshes.get(provider);
	if (!refreshes) {
		refreshes = new Map();
		providerRefreshes.set(provider, refreshes);
	}

	const refreshToken = credentials.refresh;
	const existing = refreshes.get(refreshToken);
	if (existing) return existing;

	const operation = Promise.resolve()
		.then(refresh)
		.finally(() => {
			if (refreshes.get(refreshToken) === operation) {
				refreshes.delete(refreshToken);
			}
			if (refreshes.size === 0) {
				providerRefreshes.delete(provider);
			}
		});
	refreshes.set(refreshToken, operation);
	return operation;
}
