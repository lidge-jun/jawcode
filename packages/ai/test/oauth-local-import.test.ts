/**
 * Local CLI token import modes (99.30.02). "off" (default) must reach the real
 * OAuth flow, "fallback" imports a detected token on first login, "only"
 * (`/login <provider> local`) imports without OAuth fallback and fails loudly
 * when no token exists. The detector module is mocked — os.homedir() cannot be
 * redirected reliably under bun, and tests must never read the real ~/.grok.
 */
import { afterEach, describe, expect, it, mock } from "bun:test";
import type { OAuthCredentials } from "../src/utils/oauth/types";

let mockGrokToken: OAuthCredentials | null = null;

mock.module("../src/utils/oauth/local-token-detect", () => ({
	detectGrokCliToken: () => mockGrokToken,
	detectCodexCliToken: () => null,
	detectClaudeCodeToken: () => null,
}));

import { loginXai } from "../src/utils/oauth/xai";

afterEach(() => {
	mockGrokToken = null;
});

function validLocalToken(): OAuthCredentials {
	return {
		access: "local-access-token",
		refresh: "local-refresh-token",
		expires: Date.now() + 60 * 60 * 1000,
		accountId: "local-account",
		email: "local@example.com",
	};
}

describe("loginXai local import modes", () => {
	it('"only" imports a valid local grok-cli token without any network call', async () => {
		mockGrokToken = validLocalToken();
		const progress: string[] = [];
		const credentials = await loginXai({ onProgress: message => progress.push(message) }, { importLocal: "only" });
		expect(credentials).toMatchObject({
			access: "local-access-token",
			refresh: "local-refresh-token",
			accountId: "local-account",
			email: "local@example.com",
		});
		expect(progress.some(message => message.includes("Grok CLI token"))).toBe(true);
	});

	it('"only" throws when no local token exists (no OAuth fallback)', async () => {
		await expect(loginXai({}, { importLocal: "only" })).rejects.toThrow(/No Grok CLI token found/);
	});

	it('"fallback" imports a valid local token like "only"', async () => {
		mockGrokToken = validLocalToken();
		const credentials = await loginXai({}, { importLocal: "fallback" });
		expect(credentials.access).toBe("local-access-token");
	});

	it('"off" (default) ignores the local token and heads to the OAuth flow', async () => {
		mockGrokToken = validLocalToken();
		// Sentinel fetch: the OAuth flow's first network touch is OIDC discovery.
		// Seeing it proves the local token was bypassed.
		const originalFetch = global.fetch;
		let discoveryHit = false;
		global.fetch = (async () => {
			discoveryHit = true;
			throw new Error("OAUTH_FLOW_REACHED");
		}) as unknown as typeof fetch;
		try {
			await expect(loginXai({})).rejects.toThrow();
			expect(discoveryHit).toBe(true);
		} finally {
			global.fetch = originalFetch;
		}
	});
});
